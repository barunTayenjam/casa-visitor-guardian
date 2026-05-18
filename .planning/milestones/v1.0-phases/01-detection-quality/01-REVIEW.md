---
status: completed
files_reviewed:
  - server/src/detection/optimizedMotionDetection.ts (1103 lines)
  - server/src/config/detectionConfig.ts (72 lines)
  - server/src/detection/motionTriggeredDetection.ts (671 lines)
  - opencv-service/app.py (1924 lines)
  - server/src/detection/simpleMotionDetection.ts (MISSING — referenced in docs but does not exist)
findings:
  critical: 6
  warning: 14
  info: 7
total: 27
reviewer_notes: >
  Review performed at "standard" depth. The phase 01 detection code is functionally
  complete but suffers from duplicated caching, dead code paths, missing file references,
  security anti-patterns (pickle), and threading hazards. The three detection implementations
  overlap significantly without clear separation of concerns.
---

# Phase 01 — Detection Quality Review

## Critical

### C-01. Unreachable YOLOv4-tiny fallback code
- **File:** `opencv-service/app.py:375-403`
- **Description:** The YOLOv4-tiny initialization block is placed after unconditional `return` statements at lines 357 and 372. If neither YOLOv8 nor YOLOv5 models are found, `self.initialized = True` is set at line 371 and `return` is executed, making the YOLOv4-tiny fallback dead code.
- **Recommendation:** Move the YOLOv4-tiny fallback into the same conditional chain (if-elif-else) before any `return`. Restructure `initialize()` to attempt each model in priority order without early returns.

### C-02. NMS uses global threshold, bypassing per-class thresholds
- **File:** `opencv-service/app.py:677`
- **Description:** `cv2.dnn.NMSBoxes(boxes, confidences, self.confidence_threshold, self.nms_threshold)` filters by the global threshold of 0.55. Per-class thresholds (e.g., person=0.45, dog=0.35) are checked earlier in the loop, but detections that pass at 0.50 are added to boxes then silently rejected by NMS because 0.50 < 0.55. This makes per-class tuning ineffective.
- **Recommendation:** Remove the `self.confidence_threshold` argument from NMS (use 0.0) since per-class filtering already happened, or match the NMS threshold to the minimum per-class threshold.

### C-03. Pickle deserialization of untrusted model files
- **File:** `opencv-service/app.py:1168-1172`
- **Description:** Face encodings are loaded with `pickle.load(f)` from `face_embeddings_improved.pkl` and `face_labels_improved.pkl`. Pickle is inherently unsafe — any tampering with these files achieves arbitrary code execution in the Python process.
- **Recommendation:** Replace pickle with a safe serialization format (e.g., JSON, msgpack, or `safetensors`). If pickle must be retained, validate file integrity with a checksum and ensure strict filesystem permissions.

### C-04. New service instances created on every detection event
- **File:** `server/src/detection/motionTriggeredDetection.ts:601-626`
- **Description:** Each call to `saveMotionFrame()` creates fresh `TimelineService`, `EnhancedDetectionService`, and `DetectionConfig` repository instances. This happens on every motion detection, causing unnecessary object allocation, repository lookups, and potential database connection pool churn.
- **Recommendation:** Hoist these service instances to the class constructor or use dependency injection. They should be created once and reused.

### C-05. Missing file: `simpleMotionDetection.ts`
- **File:** `AGENTS.md`, `README.md`, `CONCERNS.md`
- **Description:** The file `server/src/detection/simpleMotionDetection.ts` (138 lines) is documented in AGENTS.md, README.md, and CONCERNS.md as existing, but does not exist on disk. Coverage data in `coverage-final.json` suggests it existed at some point. No active imports remain, but the stale documentation will confuse future developers.
- **Recommendation:** Either restore the file from version control or update all documentation (AGENTS.md, README.md, CONCERNS.md) to remove references to it.

### C-06. Unauthenticated Redis connection
- **File:** `opencv-service/app.py:187-193`
- **Description:** Redis client connects with no password (`db=0`). If the Redis port is exposed (even internally), an attacker can read/write cached detection data. Combined with the pickle vulnerability, this enables cache-poisoning attacks.
- **Recommendation:** Add `password=os.getenv('REDIS_PASSWORD')` to the Redis constructor and configure a strong password in the deployment environment.

---

## Warning

### W-01. PostgreSQL detection cache unused for main detection flow
- **File:** `opencv-service/app.py:222-224, 440-467`
- **Description:** Both `DetectionCache` (PostgreSQL) and `RedisDetectionCache` are initialized. `detect_objects()` checks Redis cache but never calls `db_cache.set()`. The PostgreSQL cache is initialized, has a cleanup thread, but is only used by its own methods — never from the actual detection pipeline.
- **Recommendation:** Decide on one caching strategy. If Redis is preferred, remove `DetectionCache`. If both are needed, wire `db_cache.set()` into the detection result path.

### W-02. Daemon cleanup thread runs only once, not periodically
- **File:** `opencv-service/app.py:227-228`
- **Description:** `db_cache.cleanup()` is spawned as a daemon thread but the method executes a single `DELETE` query and exits. It is not wrapped in a `while True: ... time.sleep(interval)` loop, so expired cache entries are never cleaned up after the initial call.
- **Recommendation:** Wrap the cleanup call in a loop with `time.sleep(self.cache_ttl)` or schedule it with `threading.Timer`.

### W-03. Duplicate `_detect_faces` method across two classes
- **File:** `opencv-service/app.py:812-859, 1313-1348`
- **Description:** `YOLOObjectDetector._detect_faces()` (line 812) and `FaceRecognition._detect_faces()` (line 1313) implement similar face detection logic with different approaches. The YOLO version uses `face_recognition` library inline imports; the FaceRecognition version uses DNN and Haar cascade.
- **Recommendation:** Consolidate into a single face detection utility, preferably using the DNN approach (more accurate). Remove the inline `import face_recognition` statements.

### W-04. Inline imports of `face_recognition` inside a loop
- **File:** `opencv-service/app.py:819, 823, 832-833`
- **Description:** `import face_recognition as fr_lib` is executed on every call to `_detect_faces`, potentially multiple times. Python import caching makes this less harmful than it appears, but it is still poor practice and triggers unnecessary module-system lookups.
- **Recommendation:** Move the import to the top of the file.

### W-05. `CACHE_DIR` constant defined but never used
- **File:** `opencv-service/app.py:31`
- **Description:** `CACHE_DIR = os.path.join(...)` is set at module level but never referenced anywhere in the file. All caching goes to Redis or PostgreSQL.
- **Recommendation:** Remove unused constant.

### W-06. Dynamic import of config inside hot method path
- **File:** `server/src/detection/motionTriggeredDetection.ts:464`
- **Description:** `const { getEventPath } = await import('../config/index.js')` is a dynamic import called every time `saveMotionFrame()` executes. This adds latency and defeats module bundling/static analysis.
- **Recommendation:** Move the static `import { getEventPath }` statement to the top of the file.

### W-07. Frame buffer not bounded by number of cameras
- **File:** `server/src/detection/optimizedMotionDetection.ts:353-363`
- **Description:** `frameBuffer` stores up to 3 frames per camera. If cameras are added/removed dynamically, stale entries remain in the map. `cleanupMemory()` trims buffers but never removes orphaned camera keys.
- **Recommendation:** Remove entries for cameras that are no longer active in `cleanupMemory()` or hook into a camera removal event.

### W-08. Logging of full detection response containing PII
- **File:** `server/src/detection/optimizedMotionDetection.ts:445`
- **Description:** `console.log(JSON.stringify(data).substring(0, 200))` logs raw detection data. If detections include known-face names, bounding boxes, or person IDs, this leaks PII into server logs.
- **Recommendation:** Log only metadata (count of detections, processing time) rather than the full response payload.

### W-09. Thread-unsafe access to `bg_subtractors` dict
- **File:** `opencv-service/app.py:866, 880-902`
- **Description:** Flask runs with `threaded=True`. `MotionDetector.bg_subtractors` is a plain dict accessed from `_get_bg_subtractor()` without a lock. Concurrent requests for the same new camera ID could create multiple subtractor instances, or a read during write could see a partial state.
- **Recommendation:** Use `threading.Lock` around `bg_subtractors` access, or use `defaultdict` with a lock.

### W-10. Possible path traversal in `cleanupOldFrames`
- **File:** `server/src/detection/motionTriggeredDetection.ts:634-641`
- **Description:** `cleanupOldFrames` constructs a filesystem path by joining `__dirname`, `../../public`, and the frame path. If a frame path containing `../` enters the queue, files outside the intended directory could be deleted.
- **Recommendation:** Use `path.resolve()` and verify the final path starts with the expected base directory before unlinking.

### W-11. Duplicate database writes in `saveMotionFrame`
- **File:** `server/src/detection/motionTriggeredDetection.ts:498-534, 601-626`
- **Description:** Motion events are inserted into the `events` table via raw SQL (line 498), then processed again by `EnhancedDetectionService.processDetectionResults()` (line 611). This creates duplicate event records.
- **Recommendation:** Remove the raw SQL insert and rely solely on `EnhancedDetectionService` for persistence.

### W-12. Worker termination promises not awaited
- **File:** `server/src/detection/optimizedMotionDetection.ts:295-296, 1013-1014`
- **Description:** `worker.terminate()` returns a Promise, but neither `stop()` nor `cleanup()` awaits it. The function can return before workers are fully terminated.
- **Recommendation:** Use `await Promise.all(this.workers.map(w => w.terminate()))`.

### W-13. `saveMotionFrameAsync` called without `await` in error fallback
- **File:** `server/src/detection/optimizedMotionDetection.ts:598`
- **Description:** In the catch handler for enhanced analysis failure, `saveMotionFrameAsync` is called without `await` and without `.catch()`. If this promise rejects, the rejection is unhandled.
- **Recommendation:** Add `.catch()` or use `await` inside the async catch block.

### W-14. YOLO confidence scaling uses multiplication but NMS expects 0-1
- **File:** `opencv-service/app.py:690`
- **Description:** `confidence * 100` is applied to produce a 0-100 percentage. The earlier per-class threshold checks (lines 556, 615, 655) compare against raw 0-1 values. Downstream consumers (both JS and DB columns) may expect either range. The inconsistent scaling between internal filtering and output encoding is fragile.
- **Recommendation:** Keep 0-1 throughout and only scale at the API boundary. Document the expected range.

---

## Info

### I-01. No bounds validation on `updateSettings`
- **File:** `server/src/detection/optimizedMotionDetection.ts:988-996`
- **Description:** `updateSettings` applies a `Partial<OptimizedMotionSettings>` with `Object.assign()`. No clamping or validation is performed — a caller could set `sensitivity: 999` or `cooldownPeriod: 0`.
- **Recommendation:** Add runtime clamping for numeric fields (e.g., `sensitivity: clamp(0, 100)`).

### I-02. `isQuietHours` uses string comparison for time ranges
- **File:** `server/src/detection/optimizedMotionDetection.ts:220-225`
- **Description:** Time comparison uses lexicographic string ordering on `HH:mm` format. This works correctly only because zero-padded 24-hour strings sort lexicographically the same as chronologically. It is brittle.
- **Recommendation:** Parse minutes-since-midnight integers for unambiguous comparison.

### I-03. Redundant `crypto` import
- **File:** `server/src/detection/optimizedMotionDetection.ts:796, 881`
- **Description:** `import('node:crypto')` is called twice (lines 796 and 881) within the same `saveMotionFrameAsync` method. The first result is used for `fileHash`, then another identical import is made later.
- **Recommendation:** Use the already-imported `crypto` module from the first dynamic import instead of re-importing.

### I-04. `redis_client.ping()` can crash health check
- **File:** `opencv-service/app.py:1654`
- **Description:** `redis_client.ping()` will raise `redis.exceptions.ConnectionError` if Redis is unreachable. This exception is unhandled inside the route handler and would return a 500 error instead of a health response indicating Redis is down.
- **Recommendation:** Wrap in a try/except and return `{"connected": false}` on failure.

### I-05. Default sensitivity 90 with minConfidence 5 is extremely permissive
- **File:** `server/src/config/detectionConfig.ts:24,27`
- **Description:** Sensitivity of 90 (out of 100) means almost any pixel change triggers detection. Min confidence of 5% means even noise-level confidence is accepted. This generates high recall at the cost of many false positives.
- **Recommendation:** Evaluate false-positive rates at these settings. Consider a default of sensitivity=70, minConfidence=20.

### I-06. Liveness check only at module init for OpenCV service
- **File:** `opencv-service/app.py:1363-1368`
- **Description:** The YOLO detector is initialized once at module load. If the model loading fails silently (caught exceptions), the service reports healthy but runs in fallback mode. No periodic health recheck occurs.
- **Recommendation:** Add a periodic re-initialization attempt in the health endpoint or a background thread if the model is in fallback state.

### I-07. Redis cache and DB cache have different `set` signatures
- **File:** `opencv-service/app.py:159, 209`
- **Description:** `DetectionCache.set()` takes 7 parameters (including `file_path`, `file_size`, `file_modified`), while `RedisDetectionCache.set()` takes 4. This divergence in the cache layer's internal API makes it difficult to swap implementations.
- **Recommendation:** Unify the interface or clearly separate the two caching concerns.
