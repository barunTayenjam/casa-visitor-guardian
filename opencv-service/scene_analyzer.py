import cv2
import numpy as np
import time
from typing import Dict, Any, List, Optional


class SceneAnalyzer:
    """Analyzes scene context from a frame using image processing + YOLO detections.

    Provides structured scene understanding similar to NVIDIA vision LLM output
    but using lightweight classical CV techniques:
      - Lighting / time-of-day estimation
      - Indoor/outdoor classification via color + edge analysis
      - Weather indicators (fog, rain)
      - Scene complexity scoring
      - Person activity clues (from bbox aspect ratios)
    """

    def __init__(self):
        self._frame_count = 0
        self._last_analysis: Optional[Dict[str, Any]] = None

    def analyze(self, frame: np.ndarray, detections: Optional[List[Dict]] = None) -> Dict[str, Any]:
        self._frame_count += 1
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame

        lighting = self._estimate_lighting(gray)
        time_of_day = self._estimate_time_of_day(gray)
        environment = self._classify_environment(gray, frame)
        weather = self._detect_weather(gray, frame)
        complexity = self._scene_complexity(gray)
        dominant_colors = self._dominant_colors(frame)

        people_hints = self._analyze_person_actions(detections) if detections else []

        result = {
            "scene_context": {
                "environment": environment,
                "lighting": lighting,
                "timeOfDay": time_of_day,
                "weather": weather,
            },
            "complexity": complexity,
            "dominant_colors": dominant_colors,
            "person_actions": people_hints,
            "detection_summary": self._summarize_detections(detections) if detections else {},
        }
        self._last_analysis = result
        return result

    def _estimate_lighting(self, gray: np.ndarray) -> str:
        mean_brightness = np.mean(gray)
        if mean_brightness > 180:
            return "bright"
        elif mean_brightness > 120:
            return "normal"
        elif mean_brightness > 70:
            return "dim"
        else:
            return "dark"

    def _estimate_time_of_day(self, gray: np.ndarray) -> str:
        mean_brightness = np.mean(gray)
        std_brightness = np.std(gray)
        if mean_brightness > 150 and std_brightness > 50:
            return "day"
        elif mean_brightness > 100:
            if std_brightness < 40:
                return "overcast"
            return "day"
        elif mean_brightness > 60:
            return "dawn_dusk"
        else:
            return "night"

    def _classify_environment(self, gray: np.ndarray, color: np.ndarray) -> str:
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.count_nonzero(edges) / (gray.shape[0] * gray.shape[1])
        mean_brightness = np.mean(gray)

        hsv = cv2.cvtColor(color, cv2.COLOR_BGR2HSV)
        top_third = hsv[:hsv.shape[0] // 3, :]
        sky_mask = (top_third[:, :, 1] < 40) & (top_third[:, :, 2] > 120)
        sky_ratio = np.count_nonzero(sky_mask) / sky_mask.size

        green_mask = cv2.inRange(hsv, (35, 30, 30), (85, 255, 255))
        green_ratio = np.count_nonzero(green_mask) / (hsv.shape[0] * hsv.shape[1])

        saturation = np.mean(hsv[:, :, 1])

        if sky_ratio > 0.15:
            return "outdoor"
        if green_ratio > 0.20:
            return "outdoor"
        if edge_density > 0.12 and saturation < 40:
            return "indoor"
        if edge_density < 0.05 and mean_brightness > 150:
            return "outdoor"

        if edge_density > 0.10:
            return "indoor"
        if mean_brightness > 150 and sky_ratio > 0.05:
            return "outdoor"
        return "indoor"

    def _detect_weather(self, gray: np.ndarray, color: np.ndarray) -> str:
        mean_brightness = np.mean(gray)
        hsv = cv2.cvtColor(color, cv2.COLOR_BGR2HSV)
        saturation = np.mean(hsv[:, :, 1])

        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        blur_score = np.var(laplacian)

        if blur_score < 50 and mean_brightness > 100:
            return "foggy"
        if mean_brightness < 60 and saturation < 30:
            return "rainy"
        if saturation > 50 and mean_brightness > 150 and blur_score > 200:
            return "clear"
        if blur_score < 80:
            return "overcast"
        return "clear"

    def _scene_complexity(self, gray: np.ndarray) -> str:
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.count_nonzero(edges) / (gray.shape[0] * gray.shape[1])
        mean_brightness = np.mean(gray)
        std_brightness = np.std(gray)

        complexity_score = edge_density * 100 + std_brightness / 128 * 50
        if complexity_score > 40:
            return "complex"
        elif complexity_score > 15:
            return "moderate"
        else:
            return "simple"

    def _dominant_colors(self, frame: np.ndarray) -> List[str]:
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        h, w = hsv.shape[:1], hsv.shape[1]
        center = hsv[hsv.shape[0] // 3 : 2 * hsv.shape[0] // 3, :, :]
        mean_h = np.mean(center[:, :, 0])
        mean_s = np.mean(center[:, :, 1])
        mean_v = np.mean(center[:, :, 2])

        colors = []
        if mean_v < 40:
            colors.append("dark")
            return colors
        if mean_s < 30:
            if mean_v > 200:
                colors.append("white")
            elif mean_v < 80:
                colors.append("black")
            else:
                colors.append("gray")
            return colors
        if mean_h < 10 or mean_h > 170:
            colors.append("red")
        elif mean_h < 25:
            colors.append("orange")
        elif mean_h < 35:
            colors.append("yellow")
        elif mean_h < 85:
            colors.append("green")
        elif mean_h < 130:
            colors.append("blue")
        elif mean_h < 155:
            colors.append("purple")
        else:
            colors.append("pink")
        return colors

    def _analyze_person_actions(self, detections: List[Dict]) -> List[Dict]:
        hints = []
        for d in detections:
            if d.get("class") != "person":
                continue
            bbox = d.get("bbox", [0, 0, 0, 0])
            if isinstance(bbox, dict):
                x, y, bw, bh = bbox.get("x", 0), bbox.get("y", 0), bbox.get("width", 0), bbox.get("height", 0)
            else:
                x, y, bw, bh = bbox[0], bbox[1], bbox[2], bbox[3]
            if bh == 0:
                continue
            aspect = bw / bh
            action = "unknown"
            if aspect > 0.8:
                action = "side_view"
            elif aspect < 0.3:
                action = "standing"
            if bw * bh > 200 * 400:
                action = "close"
            hints.append({
                "action": action,
                "bbox_aspect": round(aspect, 2),
                "confidence": d.get("score", d.get("confidence", 0)),
            })
        return hints

    def _summarize_detections(self, detections: List[Dict]) -> Dict[str, Any]:
        counts: Dict[str, int] = {}
        max_conf: Dict[str, float] = {}
        for d in detections:
            cls_name = d.get("class", "unknown")
            counts[cls_name] = counts.get(cls_name, 0) + 1
            conf = d.get("score", d.get("confidence", 0))
            if isinstance(conf, (int, float)):
                max_conf[cls_name] = max(max_conf.get(cls_name, 0), conf)
        return {
            "total_objects": len(detections),
            "class_counts": counts,
            "max_confidences": max_conf,
            "has_person": "person" in counts,
            "has_vehicle": any(c in counts for c in ("car", "truck", "bus", "motorcycle", "bicycle")),
            "has_animal": any(c in counts for c in ("dog", "cat", "bird", "horse")),
        }

    def get_last_analysis(self) -> Optional[Dict[str, Any]]:
        return self._last_analysis
