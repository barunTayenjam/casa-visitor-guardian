import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional


class PersonAnalyzer:
    """Analyzes detected persons for attributes (clothing, position, activity hints).

    Mimics the NVIDIA person detection output structure using only OpenCV
    image processing — no additional ML models required.
    """

    def analyze_persons(self, frame: np.ndarray, detections: List[Dict]) -> Dict[str, Any]:
        h, w = frame.shape[:2]
        person_detections = [d for d in detections if d.get("class") == "person"]

        people = []
        for i, det in enumerate(person_detections):
            bbox = det.get("bbox", [0, 0, 0, 0])
            if isinstance(bbox, dict):
                x, y, bw, bh = bbox.get("x", 0), bbox.get("y", 0), bbox.get("width", 0), bbox.get("height", 0)
            else:
                x, y, bw, bh = bbox[0], bbox[1], bbox[2], bbox[3]

            conf = det.get("score", det.get("confidence", 0))
            if isinstance(conf, float):
                conf_pct = round(conf * 100 if conf < 1 else conf, 1)
            else:
                conf_pct = 0

            person_roi = frame[max(0, y):min(h, y + bh), max(0, x):min(w, x + bw)]

            clothing = self._analyze_clothing(person_roi) if person_roi.size > 0 else {}
            position_pct = self._position_in_frame(x, y, bw, bh, w, h)
            facing = self._estimate_facing(person_roi) if person_roi.size > 0 else "unknown"
            distance = self._estimate_distance(bh, h)
            carrying = self._detect_carrying(bbox, detections, w, h)
            action = self._estimate_action(bw, bh, bh / max(h, 1))
            body_language = self._estimate_body_language(action)

            people.append({
                "position": {
                    "x": round(position_pct["x"], 1),
                    "y": round(position_pct["y"], 1),
                    "width": round(position_pct["width"], 1),
                    "height": round(position_pct["height"], 1),
                },
                "description": f"Person {i + 1} at {position_pct['zone']}, {clothing.get('description', 'visible')}, {distance}",
                "clothing": clothing.get("description", "unknown"),
                "clothing_colors": clothing.get("colors", []),
                "actions": [action],
                "facing": facing,
                "estimatedAge": distance_to_age.get(distance, "unknown"),
                "carryingItem": carrying,
                "bodyLanguage": body_language,
                "confidence": conf_pct,
                "bbox_original": {"x": x, "y": y, "width": bw, "height": bh},
            })

        scene_description = self._build_scene_description(people, person_detections, detections)

        return {
            "count": len(people),
            "people": people,
            "sceneDescription": scene_description,
            "sceneContext": {
                "environment": "unknown",
                "lighting": "unknown",
                "weather": "unknown",
            },
        }

    def _analyze_clothing(self, roi: np.ndarray) -> Dict[str, Any]:
        if roi.shape[0] < 10 or roi.shape[1] < 10:
            return {"description": "unknown", "colors": []}

        try:
            hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
            lower_half = hsv[hsv.shape[0] // 2:, :, :]
            mean_s = np.mean(lower_half[:, :, 1])
            mean_v = np.mean(lower_half[:, :, 2])

            if mean_v < 30:
                return {"description": "dark clothing", "colors": ["dark"]}

            colors = []
            if mean_s < 30:
                if mean_v > 200:
                    colors.append("white")
                elif mean_v < 80:
                    colors.append("black")
                else:
                    colors.append("gray")
            else:
                mean_h = np.mean(lower_half[:, :, 0])
                if mean_h < 10 or mean_h > 170:
                    colors.append("red")
                elif mean_h < 25:
                    colors.append("orange")
                elif mean_h < 35:
                    colors.append("yellow")
                elif mean_h < 50:
                    colors.append("yellow-green")
                elif mean_h < 85:
                    colors.append("green")
                elif mean_h < 130:
                    colors.append("blue")
                elif mean_h < 155:
                    colors.append("purple")
                elif mean_h < 170:
                    colors.append("pink")
                else:
                    colors.append("red")

            upper_half = hsv[:hsv.shape[0] // 2, :, :]
            upper_mean_s = np.mean(upper_half[:, :, 1])
            upper_mean_v = np.mean(upper_half[:, :, 2])
            upper_colors = []
            if upper_mean_s > 30:
                upper_h = np.mean(upper_half[:, :, 0])
                if upper_h < 10 or upper_h > 170:
                    upper_colors.append("red")
                elif upper_h < 25:
                    upper_colors.append("orange")
                elif upper_h < 35:
                    upper_colors.append("yellow")
                elif upper_h < 85:
                    upper_colors.append("green")
                elif upper_h < 130:
                    upper_colors.append("blue")
                else:
                    upper_colors.append("purple")
            else:
                if upper_mean_v > 200:
                    upper_colors.append("white")
                elif upper_mean_v < 80:
                    upper_colors.append("black")
                else:
                    upper_colors.append("gray")

            all_colors = list(set(upper_colors + colors))
            desc = " and ".join(all_colors[:2]) + (" clothing" if all_colors else "visible")
            if "dark" in all_colors and len(all_colors) == 1:
                desc = "dark silhouette"
            elif not all_colors:
                desc = "visible"

            return {"description": desc, "colors": all_colors}
        except Exception:
            return {"description": "visible", "colors": []}

    def _position_in_frame(self, x: int, y: int, bw: int, bh: int, fw: int, fh: int) -> Dict[str, Any]:
        cx = ((x + bw / 2) / fw) * 100
        cy = ((y + bh / 2) / fh) * 100
        pct_w = (bw / fw) * 100
        pct_h = (bh / fh) * 100

        zone_x = "left" if cx < 33 else "right" if cx > 66 else "center"
        zone_y = "top" if cy < 33 else "bottom" if cy > 66 else "middle"
        zone = f"{zone_x}-{zone_y}" if zone_y != "middle" else zone_x

        return {"x": cx, "y": cy, "width": pct_w, "height": pct_h, "zone": zone}

    def _estimate_facing(self, roi: np.ndarray) -> str:
        if roi.shape[0] < 20 or roi.shape[1] < 20:
            return "unknown"
        try:
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(20, 20))
            if len(faces) > 0:
                return "front"
            profile = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
            profiles = profile.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20))
            if len(profiles) > 0:
                return "side"
            return "back_or_side"
        except Exception:
            return "unknown"

    def _estimate_distance(self, person_height_px: int, frame_height: int) -> str:
        ratio = person_height_px / max(frame_height, 1)
        if ratio > 0.4:
            return "close"
        elif ratio > 0.2:
            return "medium"
        elif ratio > 0.08:
            return "far"
        else:
            return "very_far"

    def _detect_carrying(self, bbox: List[int], all_dets: List[Dict], fw: int, fh: int) -> str:
        if isinstance(bbox, dict):
            bx, by, bw, bh = bbox.get("x", 0), bbox.get("y", 0), bbox.get("width", 0), bbox.get("height", 0)
        else:
            bx, by, bw, bh = bbox[0], bbox[1], bbox[2], bbox[3]

        px_center = bx + bw // 2
        py_bottom = by + bh

        for det in all_dets:
            cls = det.get("class", "")
            if cls in ("backpack", "handbag", "suitcase", "umbrella"):
                db = det.get("bbox", [0, 0, 0, 0])
                if isinstance(db, dict):
                    dx, dy = db.get("x", 0), db.get("y", 0)
                    dw, dh = db.get("width", 0), db.get("height", 0)
                else:
                    dx, dy, dw, dh = db[0], db[1], db[2], db[3]
                dcx = dx + dw // 2
                dcy = dy + dh // 2
                if abs(dcx - px_center) < 100 and abs(dcy - py_bottom) < 150:
                    return cls
        return "none"

    def _estimate_action(self, bw: int, bh: int, height_ratio: float) -> str:
        if bh == 0:
            return "standing"
        aspect = bw / bh
        if aspect > 0.8:
            return "side_view_or_crouching"
        elif aspect < 0.25:
            return "standing"
        elif bw * bh > 100 * 300:
            return "close_proximity"
        return "standing"

    def _estimate_body_language(self, action: str) -> str:
        if "crouching" in action:
            return "suspicious"
        elif "proximity" in action:
            return "alert"
        return "neutral"

    def _build_scene_description(self, people: List[Dict], person_dets: List[Dict], all_dets: List[Dict]) -> str:
        parts = []
        if len(people) == 1:
            p = people[0]
            parts.append(f"One person detected at {p['position'].get('zone', 'frame')}, {p['clothing']}")
        elif len(people) > 1:
            parts.append(f"{len(people)} persons detected")

        vehicle_dets = [d for d in all_dets if d.get("class") in ("car", "truck", "bus", "motorcycle", "bicycle")]
        if vehicle_dets:
            makes = {}
            for v in vehicle_dets:
                cls = v.get("class", "vehicle")
                makes[cls] = makes.get(cls, 0) + 1
            veh_str = ", ".join(f"{c}×{n}" if n > 1 else c for c, n in makes.items())
            parts.append(f"{veh_str} present")

        animal_dets = [d for d in all_dets if d.get("class") in ("dog", "cat", "bird", "horse")]
        if animal_dets:
            parts.append(f"{len(animal_dets)} animal(s) detected")

        if not parts:
            return "Scene with person detected"

        return ". ".join(parts) + "."


distance_to_age = {
    "close": "adult (close range)",
    "medium": "adult",
    "far": "adult (far range)",
    "very_far": "person (distant)",
}
