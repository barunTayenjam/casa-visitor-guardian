import time
import cv2
import numpy as np
from typing import Dict, Any, List, Optional, Tuple


class ThreatDetector:
    """Real-time threat assessment using YOLO detections + scene context.

    Combines multiple threat signals to produce a structured threat assessment
    matching the NVIDIA vision LLM output format — but runs in ~0ms per frame.
    """

    def __init__(self, history_size: int = 10):
        self._frame_count = 0
        self._history_size = history_size
        self._threat_history: List[Dict[str, Any]] = []
        self._last_assessment: Dict[str, Any] = {
            "level": "low",
            "confidence": 0,
            "factors": [],
            "reasoning": "No activity",
        }

        self._camera_config: Optional[Dict] = None
        self._track_presence: Dict[int, int] = {}
        self._track_zones: Dict[int, str] = {}

    def set_camera_config(self, config: Optional[Dict]) -> None:
        self._camera_config = config

    def assess(
        self,
        detections: List[Dict],
        scene_context: Dict[str, Any],
        person_attributes: Optional[List[Dict]] = None,
        camera_id: Optional[str] = None,
        frame: Optional[np.ndarray] = None,
    ) -> Dict[str, Any]:
        self._frame_count += 1
        factors: List[str] = []
        threat_score: float = 0.0
        h, w = (frame.shape[:2] if frame is not None else (720, 1280))

        persons = [d for d in detections if d.get("class") == "person"]
        vehicles = [d for d in detections if d.get("class") in ("car", "truck", "bus", "motorcycle")]
        animals = [d for d in detections if d.get("class") in ("dog", "cat", "bird", "horse", "cow", "sheep")]

        for p in persons:
            tid = p.get("track_id", -1)
            if tid > 0:
                self._track_presence[tid] = self._track_presence.get(tid, 0) + 1

        time_of_day = scene_context.get("timeOfDay", "day")
        lighting = scene_context.get("lighting", "normal")
        environment = scene_context.get("environment", "outdoor")

        person_count = len(persons)
        if person_count == 0:
            self._last_assessment = {
                "level": "low", "confidence": 0,
                "factors": [], "reasoning": "No persons detected",
            }
            return self._last_assessment

        is_night = time_of_day in ("night", "dawn_dusk")
        is_dim = lighting in ("dim", "dark")

        if person_count >= 3:
            threat_score += 30
            factors.append(f"Multiple persons ({person_count})")
        elif person_count >= 2:
            threat_score += 15
            factors.append(f"Two persons detected")

        if is_night:
            threat_score += 20
            factors.append("Nighttime activity")
            if person_count >= 2:
                threat_score += 10
                factors.append("Multiple persons at night — suspicious")

        if person_attributes:
            for pattr in person_attributes:
                bl = pattr.get("bodyLanguage", "neutral")
                facing = pattr.get("facing", "unknown")
                carrying = pattr.get("carryingItem", "none")
                distance = pattr.get("estimatedAge", "")
                identity = pattr.get("identity", "unknown")

                if bl == "suspicious":
                    threat_score += 20
                    factors.append("Suspicious body language (crouching/hiding)")
                elif bl == "alert":
                    threat_score += 10
                    factors.append("Alert posture")

                if identity in (None, "unknown", ""):
                    if is_night:
                        threat_score += 15
                        factors.append("Unknown person at night")
                    else:
                        threat_score += 5

                if "close" in distance and is_night:
                    threat_score += 10
                    factors.append("Person in close proximity at night")
                elif "close" in distance:
                    threat_score += 5

                if carrying and carrying != "none":
                    threat_score += 5
                    factors.append(f"Person carrying {carrying}")

        for v in vehicles:
            conf = v.get("score", v.get("confidence", 0))
            if isinstance(conf, float) and conf < 1:
                conf = conf * 100
            if is_night and conf > 50:
                threat_score += 10
                factors.append("Vehicle activity at night")
                if person_count > 0:
                    threat_score += 10
                    factors.append("Person near vehicle at night")
                break

        if frame is not None:
            tamper_score = self._check_tampering(frame)
            if tamper_score > 0:
                threat_score += tamper_score
                factors.append("Camera tampering detected")

        zones = self._get_zones()
        if zones and persons:
            for p in persons:
                bbox = p.get("bbox", [0, 0, 0, 0])
                if isinstance(bbox, dict):
                    px, py = bbox.get("x", 0) + bbox.get("width", 0) // 2, bbox.get("y", 0) + bbox.get("height", 0) // 2
                else:
                    px = (bbox[0] + bbox[2] // 2) if len(bbox) >= 2 else 0
                    py = (bbox[1] + bbox[3] // 2) if len(bbox) >= 4 else 0
                nx, ny = px / max(w, 1), py / max(h, 1)
                for zone in zones:
                    if self._point_in_polygon(nx, ny, zone.get("coordinates", [])):
                        zone_objects = zone.get("objects", [])
                        if "person" not in zone_objects:
                            threat_score += 15
                            factors.append(f"Person in restricted zone: {zone.get('name', 'unknown')}")
                        loitering = zone.get("loiteringTime", 0)
                        if loitering > 0 and person_count > 0:
                            tid = p.get("track_id", -1)
                            if tid > 0 and self._track_presence.get(tid, 0) > loitering:
                                threat_score += 10
                                factors.append(f"Loitering in zone {zone.get('name', '')}")

        threat_score = min(100, threat_score)
        level = self._score_to_level(threat_score)

        reasoning_parts = factors if factors else ["Persons detected — monitoring"]
        reasoning = "; ".join(reasoning_parts[:5])

        self._last_assessment = {
            "level": level,
            "confidence": round(threat_score, 1),
            "factors": factors[:10],
            "reasoning": reasoning,
            "person_count": person_count,
            "vehicle_count": len(vehicles),
            "is_night": is_night,
        }

        self._threat_history.append(self._last_assessment)
        if len(self._threat_history) > self._history_size:
            self._threat_history.pop(0)

        return self._last_assessment

    def _score_to_level(self, score: float) -> str:
        if score >= 70:
            return "critical"
        elif score >= 40:
            return "high"
        elif score >= 20:
            return "medium"
        return "low"

    def _point_in_polygon(self, nx: float, ny: float, coords: List[List[float]]) -> bool:
        if len(coords) < 3:
            return False
        inside = False
        j = len(coords) - 1
        for i in range(len(coords)):
            xi, yi = coords[i]
            xj, yj = coords[j]
            if ((yi > ny) != (yj > ny)) and (nx < (xj - xi) * (ny - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside

    def _get_zones(self) -> List[Dict]:
        if not self._camera_config:
            return []
        return self._camera_config.get("zones", [])

    def _check_tampering(self, frame: np.ndarray) -> float:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
        mean_brightness = np.mean(gray)
        std_brightness = np.std(gray)

        if mean_brightness < 5:
            return 30
        if mean_brightness < 15:
            return 20
        if mean_brightness > 250:
            return 25
        if std_brightness < 3 and mean_brightness > 200:
            return 15
        return 0.0

    def get_threat_summary(self) -> Dict[str, Any]:
        if not self._threat_history:
            return self._last_assessment

        recent = self._threat_history[-5:]
        max_level = max(
            (self._score_to_level_score(s["level"]) for s in recent),
            default=0,
        )
        max_score = max((s["confidence"] for s in recent), default=0)
        all_factors = []
        for s in recent:
            all_factors.extend(s.get("factors", []))
        unique_factors = list(dict.fromkeys(all_factors))[:10]

        level_map = {0: "low", 1: "medium", 2: "high", 3: "critical"}
        return {
            "level": level_map.get(max_level, "low"),
            "confidence": round(max_score, 1),
            "factors": unique_factors,
            "reasoning": "; ".join(unique_factors[:3]) if unique_factors else "No threat factors",
        }

    def _score_to_level_score(self, level: str) -> int:
        return {"low": 0, "medium": 1, "high": 2, "critical": 3}.get(level, 0)

    def reset(self) -> None:
        self._threat_history.clear()
        self._track_presence.clear()
        self._track_zones.clear()
        self._last_assessment = {
            "level": "low", "confidence": 0,
            "factors": [], "reasoning": "Reset",
        }
