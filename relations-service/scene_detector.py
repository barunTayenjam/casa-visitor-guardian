import os
import threading
import time
from typing import Any, Dict, List

WORLD_MODEL_PATH = os.environ.get(
    "RELATIONS_WORLD_MODEL", "/opt/models/yolov8s-worldv2.pt"
)
SCENE_PROMPTS = [
    p.strip()
    for p in os.environ.get(
        "RELATION_SCENE_PROMPTS",
        "person,bicycle,car,motorcycle,bus,truck,dog,cat,bird,backpack,handbag,umbrella,"
        "chair,potted plant,bowl,bottle,cup,plate,water tank,barrel,bucket,scooter,"
        "wheelbarrow,ladder,bench,table,bucket,clothes",
    )
    .split(",")
    if p.strip()
]
SCENE_CONF = float(os.environ.get("RELATION_SCENE_CONF", "0.25"))
SCENE_IMGSZ = int(os.environ.get("RELATION_SCENE_IMGSZ", "1280"))


class SceneDetector:
    _lock = threading.Lock()
    _infer_lock = threading.Lock()
    _model: Any = None
    _error: str = ""

    @classmethod
    def _load(cls) -> None:
        from ultralytics import YOLOWorld

        started = time.time()
        model = YOLOWorld(WORLD_MODEL_PATH)
        model.set_classes(SCENE_PROMPTS)
        cls._model = model
        print(
            f"[SceneDetector] YOLO-World loaded from {WORLD_MODEL_PATH} in {time.time() - started:.1f}s",
            flush=True,
        )

    @classmethod
    def available(cls) -> bool:
        with cls._lock:
            if cls._model is not None:
                return True
            try:
                cls._load()
                return True
            except Exception as exc:
                cls._error = str(exc)
                print(f"[SceneDetector] unavailable: {exc}", flush=True)
                return False

    @classmethod
    def load_error(cls) -> str:
        return cls._error

    @classmethod
    def detect(cls, image_path: str) -> List[Dict[str, Any]]:
        with cls._lock:
            if cls._model is None:
                cls._load()
        with cls._infer_lock:
            results = cls._model.predict(image_path, conf=SCENE_CONF, imgsz=SCENE_IMGSZ, verbose=False)
        out: List[Dict[str, Any]] = []
        for result in results:
            names = result.names
            for box in result.boxes:
                x1, y1, x2, y2 = (float(v) for v in box.xyxy[0].tolist())
                out.append(
                    {
                        "x": x1,
                        "y": y1,
                        "width": x2 - x1,
                        "height": y2 - y1,
                        "class": names[int(box.cls[0])],
                        "confidence": float(box.conf[0]),
                    }
                )
        return out
