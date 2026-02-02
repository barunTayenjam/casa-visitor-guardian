# OpenCV Detection Enhancement Guide

## Current Issues

1. **MOG2 Background Subtraction Too Conservative**
   - `varThreshold=16` → Should be `8`
   - `history=500` → Should be `200` (adapts faster)
   - `detectShadows=True` → Should be `False` (reduces noise)

2. **Motion Threshold Too High**
   - Current: >0.3% pixel change OR >0.2% contour area
   - Should be: >0.2% pixel change OR >0.1% contour area

3. **Morphological Operations Too Aggressive**
   - Opening/Closing: 2 iterations → Should be 1
   - Kernel size: (5,5) and (7,7) → Should be (3,3)

4. **Confidence Calculation Under-Reports**
   - Multiplier: 5 → Should be 8-10
   - Result: 0.5% confidence → Should be 4-5%

## Recommended Changes

### Option 1: Update Existing OpenCV Service (Quick)

Edit `/opencv-service/app.py`:

```python
# Line 743-747: Update MOG2 parameters
bg_subtractor = cv2.createBackgroundSubtractorMOG2(
    history=200,        # Changed from 500
    varThreshold=8,     # Changed from 16
    detectShadows=False # Changed from True
)

# Line 801-806: Update morphological operations
kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))  # Changed from (5,5)
fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel_open, iterations=1)  # Changed from 2

kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))  # Changed from (7,7)
fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel_close, iterations=1)  # Changed from 2

# Line 831: Update motion detection threshold
motion_detected = (motion_percentage > 0.2) or (contour_area_percentage > 0.1)  # Changed from 0.3/0.2

# Line 856: Update confidence calculation
confidence = max(0, min(100, (motion_percentage * 8 + contour_area_percentage * 8)))  # Changed from 5
```

### Option 2: Add Enhanced Detection Service (Parallel)

1. Copy `enhanced_app.py` to `/opencv-service/`
2. Update `docker-compose.yml` to add service on port 8085
3. Test both methods in parallel

### Option 3: Use Frame Difference Method

For scenarios with:
- Fast-changing lighting
- Outdoor cameras with trees/leaves
- High-frequency motion

Frame difference works better than MOG2.

## Testing

After changes, test with:

```bash
# Test motion detection
curl -X POST http://192.168.31.99:8084/detect-motion \
  -H "Content-Type: application/json" \
  -d '{"image": "base64_encoded_image", "cameraId": "cam1"}'

# Check confidence values (should be 5-15% for normal motion)
# Old: 0-0.5%
# New: 5-15%
```

## Expected Results

| Scenario | Old Confidence | New Confidence |
|----------|---------------|----------------|
| Person walking | 0-2% | 10-25% |
| Car passing | 0-5% | 15-40% |
| Tree movement | 0-0.5% | 2-8% |
| No motion | 0% | 0-1% |

## Additional Optimizations

1. **Adaptive Threshold**: Adjust based on time of day
2. **Zone-Based Detection**: Only detect motion in specific regions
3. **Object Tracking**: Track movement across frames
4. **Hybrid Approach**: Use both MOG2 and frame difference
