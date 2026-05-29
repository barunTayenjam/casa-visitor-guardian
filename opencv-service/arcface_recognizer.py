import cv2
import numpy as np
import os
import pickle
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any, Union


class ArcFaceRecognizer:
    """
    Face recognition using InsightFace ArcFace with RetinaFace detection.

    Primary: InsightFace arcface (buffalo_s) — 512-dim embeddings, RetinaFace detection
    Fallback: OpenCV DNN face detector + HOG/CNN (face_recognition lib)
    Legacy fallback: Haar cascade + histogram matching

    Dual-mode transition: stores both 128-dim (legacy) and 512-dim (ArcFace) embeddings
    side by side during migration.
    """

    def __init__(self):
        self.known_faces_dir = os.path.join(os.path.dirname(__file__), 'known_faces')
        self.models_dir = os.path.join(os.path.dirname(__file__), 'models')
        Path(self.known_faces_dir).mkdir(parents=True, exist_ok=True)
        Path(self.models_dir).mkdir(parents=True, exist_ok=True)

        # ArcFace model state
        self._app = None
        self._model_loaded = False
        self._model_name = 'buffalo_s'
        self._embedding_dim = 512
        self._gpu_available = False

        # Fallback detection
        self.dnn_face_detector = None
        self.haar_detector = None
        self.use_face_recognition_lib = self._check_face_recognition_lib()

        # Legacy embeddings (dual-mode — 128-dim)
        self.known_encodings_128 = []
        self.known_names_128 = []
        # ArcFace embeddings (512-dim)
        self.known_encodings_512 = []
        self.known_names_512 = []
        self.is_trained = False

        self._initialize_detectors()
        self._initialize_model()
        self._load_known_faces()

    def _check_face_recognition_lib(self) -> bool:
        try:
            import face_recognition
            return True
        except ImportError:
            return False

    def _initialize_detectors(self):
        try:
            prototxt_path = os.path.join(self.models_dir, 'deploy.prototxt')
            model_path = os.path.join(self.models_dir, 'res10_300x300_ssd_iter_140000_fp16.caffemodel')
            if os.path.exists(prototxt_path) and os.path.exists(model_path):
                self.dnn_face_detector = cv2.dnn.readNetFromCaffe(prototxt_path, model_path)
        except Exception:
            self.dnn_face_detector = None

        try:
            self.haar_detector = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
        except Exception:
            self.haar_detector = None

    def _initialize_model(self):
        try:
            import insightface
            from insightface.app import FaceAnalysis
            self._app = FaceAnalysis(name=self._model_name, providers=['CPUExecutionProvider'])
            self._app.prepare(ctx_id=0, det_size=(640, 640))
            self._model_loaded = True
            try:
                import onnxruntime
                if 'CUDAExecutionProvider' in onnxruntime.get_available_providers():
                    self._app = FaceAnalysis(name=self._model_name, providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
                    self._app.prepare(ctx_id=0, det_size=(640, 640))
                    self._gpu_available = True
                    print(f"[ArcFace] GPU (CUDA) — model: {self._model_name}")
                else:
                    print(f"[ArcFace] CPU — model: {self._model_name}")
            except Exception:
                print(f"[ArcFace] CPU — model: {self._model_name}")
        except ImportError:
            print("[ArcFace] insightface not available — fallback mode")
            self._model_loaded = False

    def _load_known_faces(self):
        legacy_emb_path = os.path.join(self.models_dir, 'face_embeddings_improved.pkl')
        legacy_labels_path = os.path.join(self.models_dir, 'face_labels_improved.pkl')
        if os.path.exists(legacy_emb_path) and os.path.exists(legacy_labels_path):
            try:
                with open(legacy_emb_path, 'rb') as f:
                    self.known_encodings_128 = pickle.load(f)
                with open(legacy_labels_path, 'rb') as f:
                    self.known_names_128 = pickle.load(f)
            except Exception as e:
                print(f"[ArcFace] Failed to load legacy embeddings: {e}")

        arcface_emb_path = os.path.join(self.models_dir, 'face_embeddings_512.pkl')
        arcface_labels_path = os.path.join(self.models_dir, 'face_labels_512.pkl')
        if os.path.exists(arcface_emb_path) and os.path.exists(arcface_labels_path):
            try:
                with open(arcface_emb_path, 'rb') as f:
                    self.known_encodings_512 = pickle.load(f)
                with open(arcface_labels_path, 'rb') as f:
                    self.known_names_512 = pickle.load(f)
            except Exception as e:
                print(f"[ArcFace] Failed to load arcface embeddings: {e}")

        self.is_trained = bool(self.known_encodings_128 or self.known_encodings_512)

    def detect_faces(self, image: np.ndarray, method: str = 'auto') -> List[Dict[str, Any]]:
        faces = []

        if method == 'auto':
            if self._model_loaded and self._app is not None:
                try:
                    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    dets = self._app.get(rgb)
                    for det in dets:
                        bbox = det.bbox.astype(int)
                        x, y, x1, y1 = bbox[0], bbox[1], bbox[2], bbox[3]
                        x, y = max(0, x), max(0, y)
                        x1, y1 = min(image.shape[1], x1), min(image.shape[0], y1)
                        faces.append({
                            'x': int(x),
                            'y': int(y),
                            'width': int(x1 - x),
                            'height': int(y1 - y),
                            'method': 'retinaface',
                            'confidence': round(float(det.det_score) * 100, 2)
                        })
                    if faces:
                        return faces
                except Exception as e:
                    print(f"[ArcFace] RetinaFace detection error: {e}")

            if self.dnn_face_detector is not None:
                return self._detect_with_dnn(image)

            if self.haar_detector is not None:
                return self._detect_with_haar(image)

        if method == 'dnn' and self.dnn_face_detector is not None:
            return self._detect_with_dnn(image)

        if method == 'haar' and self.haar_detector is not None:
            return self._detect_with_haar(image)

        if method == 'retinaface' and self._model_loaded and self._app is not None:
            try:
                rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                dets = self._app.get(rgb)
                for det in dets:
                    bbox = det.bbox.astype(int)
                    x, y, x1, y1 = bbox[0], bbox[1], bbox[2], bbox[3]
                    x, y = max(0, x), max(0, y)
                    x1, y1 = min(image.shape[1], x1), min(image.shape[0], y1)
                    faces.append({
                        'x': int(x),
                        'y': int(y),
                        'width': int(x1 - x),
                        'height': int(y1 - y),
                        'method': 'retinaface',
                        'confidence': round(float(det.det_score) * 100, 2)
                    })
            except Exception:
                pass

        return faces

    def _detect_with_dnn(self, image: np.ndarray) -> List[Dict[str, Any]]:
        h, w = image.shape[:2]
        blob = cv2.dnn.blobFromImage(cv2.resize(image, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0))
        self.dnn_face_detector.setInput(blob)
        detections = self.dnn_face_detector.forward()
        faces = []
        for i in range(detections.shape[2]):
            confidence = float(detections[0, 0, i, 2])
            if confidence > 0.15:
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                x, y, x1, y1 = box.astype(int)
                x, y = max(0, x), max(0, y)
                x1, y1 = min(w, x1), min(h, y1)
                faces.append({
                    'x': int(x),
                    'y': int(y),
                    'width': int(x1 - x),
                    'height': int(y1 - y),
                    'method': 'dnn',
                    'confidence': round(confidence * 100, 2)
                })
        return faces

    def _detect_with_haar(self, image: np.ndarray) -> List[Dict[str, Any]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces_rects = self.haar_detector.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
        return [
            {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h), 'method': 'haar', 'confidence': 70.0}
            for (x, y, w, h) in faces_rects
        ]

    def extract_face_embedding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        if self._model_loaded and self._app is not None:
            try:
                rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
                dets = self._app.get(rgb)
                if dets and len(dets) > 0:
                    norm_embedding = dets[0].embedding / np.linalg.norm(dets[0].embedding)
                    return norm_embedding.astype(np.float64)
            except Exception as e:
                print(f"[ArcFace] ArcFace embedding error: {e}")

        if self.use_face_recognition_lib:
            try:
                import face_recognition
                rgb_face = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
                rgb_face = cv2.resize(rgb_face, (150, 150))
                encodings = face_recognition.face_encodings(rgb_face, num_jitters=1)
                if len(encodings) > 0:
                    return encodings[0]
            except ImportError:
                pass

        try:
            face_resized = cv2.resize(face_image, (100, 100))
            gray = cv2.cvtColor(face_resized, cv2.COLOR_BGR2GRAY)
            hist = cv2.calcHist([gray], [0], None, [32], [0, 256])
            hist = cv2.normalize(hist, hist).flatten()
            return hist
        except Exception:
            return None

    def recognize_face(self, face_image: np.ndarray, tolerance: float = 0.6) -> Tuple[str, float]:
        if not self.is_trained:
            return "unknown", 0.0

        embedding = self.extract_face_embedding(face_image)
        if embedding is None:
            return "unknown", 0.0

        embedding_dim = len(embedding)

        # Try ArcFace 512-dim first
        if embedding_dim == 512 and self.known_encodings_512:
            distances = []
            for known_encoding in self.known_encodings_512:
                if len(known_encoding) != 512:
                    continue
                distance = np.linalg.norm(embedding - known_encoding)
                distances.append(distance)
            if distances:
                min_distance = min(distances)
                min_index = np.argmin(distances)
                if min_distance < tolerance:
                    name = self.known_names_512[min_index]
                    confidence = max(0, min(100, (1.0 - min_distance / tolerance) * 100))
                    return name, round(confidence, 2)

        # Fallback to 128-dim legacy
        if embedding_dim == 128 and self.known_encodings_128:
            distances = []
            for known_encoding in self.known_encodings_128:
                if len(known_encoding) != 128:
                    continue
                distance = np.linalg.norm(embedding - known_encoding)
                distances.append(distance)
            if distances:
                min_distance = min(distances)
                min_index = np.argmin(distances)
                if min_distance < tolerance:
                    name = self.known_names_128[min_index]
                    confidence = max(0, min(100, (1.0 - min_distance / tolerance) * 100))
                    return name, round(confidence, 2)

        # Cross-dim fallback: compare against available embeddings
        if self.known_encodings_512:
            ref_encodings = self.known_encodings_512
            ref_names = self.known_names_512
        elif self.known_encodings_128:
            ref_encodings = self.known_encodings_128
            ref_names = self.known_names_128
        else:
            return "unknown", 0.0

        distances = []
        for known_encoding in ref_encodings:
            if len(embedding) != len(known_encoding):
                continue
            distance = np.linalg.norm(embedding - known_encoding)
            distances.append(distance)

        if distances:
            min_distance = min(distances)
            min_index = np.argmin(distances)
            if min_distance < tolerance:
                name = ref_names[min_index]
                confidence = max(0, min(100, (1.0 - min_distance / tolerance) * 100))
                return name, round(confidence, 2)

        return "unknown", 0.0

    def _detect_faces(self, image: np.ndarray) -> List[Dict[str, Any]]:
        results = []
        faces = self.detect_faces(image)
        for i, face in enumerate(faces):
            x, y, w, h = face['x'], face['y'], face['width'], face['height']
            x, y = max(0, min(x, image.shape[1])), max(0, min(y, image.shape[0]))
            w, h = min(w, image.shape[1] - x), min(h, image.shape[0] - y)
            if w <= 0 or h <= 0:
                continue

            face_roi = image[y:y + h, x:x + w]
            name, confidence = self.recognize_face(face_roi)
            results.append({
                'id': f'face_{i}',
                'name': name,
                'confidence': confidence,
                'isKnown': name != 'unknown',
                'bbox': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                'detection_method': face.get('method', 'unknown')
            })
        return results

    def train_recognizer(self) -> bool:
        try:
            arcface_faces = []
            arcface_names = []
            for person_dir in os.listdir(self.known_faces_dir):
                person_path = os.path.join(self.known_faces_dir, person_dir)
                if not os.path.isdir(person_path):
                    continue
                for image_file in os.listdir(person_path):
                    if not image_file.lower().endswith(('.png', '.jpg', '.jpeg')):
                        continue
                    image_path = os.path.join(person_path, image_file)
                    image = cv2.imread(image_path)
                    if image is None:
                        continue
                    face_detections = self.detect_faces(image)
                    for face in face_detections:
                        x, y, w, h = face['x'], face['y'], face['width'], face['height']
                        if w < 50 or h < 50:
                            continue
                        face_roi = image[y:y + h, x:x + w]
                        embedding = self.extract_face_embedding(face_roi)
                        if embedding is not None and len(embedding) == 512:
                            arcface_faces.append(embedding)
                            arcface_names.append(person_dir)

            if arcface_faces:
                self.known_encodings_512 = arcface_faces
                self.known_names_512 = arcface_names
                arcface_emb_path = os.path.join(self.models_dir, 'face_embeddings_512.pkl')
                arcface_labels_path = os.path.join(self.models_dir, 'face_labels_512.pkl')
                with open(arcface_emb_path, 'wb') as f:
                    pickle.dump(self.known_encodings_512, f)
                with open(arcface_labels_path, 'wb') as f:
                    pickle.dump(self.known_names_512, f)
                self.is_trained = True
                return True
            return False
        except Exception as e:
            print(f"[ArcFace] Training error: {e}")
            return False


arcface_recognizer = ArcFaceRecognizer()
