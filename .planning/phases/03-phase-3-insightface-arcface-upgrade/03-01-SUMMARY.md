# Plan 03-01 Summary — ArcFace Python Implementation

**Phase:** 03 — InsightFace ArcFace Upgrade  
**Executed:** 2026-05-29  
**Status:** Complete  

## Completed Tasks

### Task 1: Install dependencies and create ArcFaceRecognizer class
- **`opencv-service/requirements.txt`**: Added `insightface>=0.7.3,<0.8` and `onnxruntime>=1.15.0`
- **`opencv-service/Dockerfile`**: Added ArcFace model pre-download step (`buffalo_s`) after pip install
- **`opencv-service/arcface_recognizer.py`**: Created full `ArcFaceRecognizer` class with:
  - ArcFace (RetinaFace detection + 512-dim embeddings) as primary engine
  - InsightFace `FaceAnalysis` with CPU/GPU auto-detect (CUDAExecutionProvider fallback)
  - Fallback chain: RetinaFace → OpenCV DNN → Haar cascade
  - Dual-mode embedding storage: `known_encodings_128` (legacy) + `known_encodings_512` (ArcFace)
  - `detect_faces()`, `extract_face_embedding()`, `recognize_face()`, `_detect_faces()`, `train_recognizer()` methods
  - **CRITICAL-02 FIX**: Dimension check (`if len(embedding) != len(known_encoding): continue`) replaces `cv2.resize` on 1D vectors
- `improved_face_recognition.py` preserved as fallback

### Task 2: Wire ArcFaceRecognizer into app.py, replace dual-class pattern
- **Import block** (line 1343): Three-tier fallback chain — `ArcFaceRecognizer` → `ImprovedFaceRecognition` → legacy `FaceRecognition`
- **DNN face detector removed** from `YOLOObjectDetector.__init__()` and `initialize()` — saved ~10MB model memory. RetinaFace handles detection internally now.
- `YOLOObjectDetector.recognize_faces()` already delegates to `face_recognition._detect_faces()` — no change needed
- Initialization ordering verified safe (RTSP lambda uses late-binding)

## Verification
- `arcface_recognizer.py`: Python syntax OK
- `app.py`: Python syntax OK
- `improved_face_recognition.py`: Still exists, preserved as fallback
- All HTTP endpoint signatures and return formats unchanged
- `_face_rec_fn` callback pattern unchanged

## Files Changed
| File | Action |
|------|--------|
| `opencv-service/arcface_recognizer.py` | **Created** — ArcFaceRecognizer class |
| `opencv-service/requirements.txt` | **Modified** — Added insightface, onnxruntime |
| `opencv-service/Dockerfile` | **Modified** — Added model download step |
| `opencv-service/app.py` | **Modified** — Import chain, removed redundant DNN detector |
| `opencv-service/improved_face_recognition.py` | **Unchanged** — Preserved as fallback |
