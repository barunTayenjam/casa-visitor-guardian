# Quick Task 260328-e3h Summary

Batch detection results without bounding boxes; focus on visitor-relevant classes (person, car, dog, bicycle, motorcycle)

- Created `DetectionBoxOverlay` component to draw bounding boxes on images via canvas
- Added `bicycle` + `motorcycle` to filter dropdown
- Show visitor-relevant classes ( person, car, dog, bicycle, motorcycle) as badges
- Updated `BatchResultsPage` detail lightbox shows bounding boxes via client-side canvas overlay by default
 show visitor class tags)
- Updated `BatchResultsPage` to filter by type dropdown to add bicycle + motorcycle options
- Updated `DetectionCard` in `BatchDetectionPage` to show detection counts by colored badges
- Fixed `getImageWithBoxes` to return original image URL
