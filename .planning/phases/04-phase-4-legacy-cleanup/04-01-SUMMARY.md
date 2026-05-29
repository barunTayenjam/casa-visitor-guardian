---
plan: 04-01
status: completed
phase: 04
wave: 1
executed: "2026-05-29T14:10:00+05:30"
---

# Plan 04-01 SUMMARY — Remove Legacy FaceRecognition

## Objective

Remove the legacy `FaceRecognition` class from `opencv-service/app.py` and simplify the fallback chain from 3-tier to 2-tier.

## Changes Made

### `opencv-service/app.py`

| Change | Lines | Description |
|--------|-------|-------------|
| Remove `import pickle` | -21 | Only used by removed class |
| Remove legacy `class FaceRecognition` | 1094-1338 | ~245 lines of dead code |
| Simplify fallback chain | 1343-1356 | Changed 3rd fallback from "keep legacy class" to `FaceRecognition = None` |
| None-safe singleton init | ~1115 | `face_recognition = FaceRecognition() if FaceRecognition is not None else None` |
| None guard: `_face_rec_fn` | ~43 | Returns `("unknown", 0.0)` when `face_recognition is None` |
| None guard: `YOLOObjectDetector._detect_faces` | ~845 | Returns `[]` when `face_recognition is None` |
| None guard: `/train-face` | ~1601 | Returns 503 when `face_recognition is None` |
| None guard: `/retrain-model` | ~1643 | Returns 503 when `face_recognition is None` |
| None guard: `/known-faces` | ~1659 | Returns empty list when `face_recognition is None` |

### Fallback Chain (After)

```
ArcFaceRecognizer → ImprovedFaceRecognition → None
```

### Verification

- [x] Python syntax validates: `python -m py_compile opencv-service/app.py`
- [x] No `class FaceRecognition:` in app.py
- [x] `FaceRecognition = None` set when all imports fail
- [x] None-safety guards at all 5 call sites
- [x] All endpoint return formats unchanged

## Commit

Phase 4 complete: removed legacy FaceRecognition class, simplified fallback chain, added None-safety guards
