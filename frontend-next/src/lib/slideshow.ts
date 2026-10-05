/**
 * Pure slideshow-advance logic for the camera grid.
 *
 * Extracted from AdaptiveCameraGrid so the wrap-around and recovery rules
 * are unit-testable without a DOM: the component's timer, keyboard and
 * chevron controls all funnel through this single decision.
 */

export type SlideDirection = 1 | -1;

export function nextFocusId<T extends { id: string }>(
  currentId: string | null | undefined,
  cameras: T[],
  direction: SlideDirection,
): string | null {
  if (cameras.length < 2) return null;
  if (currentId == null) {
    return direction === 1 ? cameras[0].id : cameras[cameras.length - 1].id;
  }
  const index = cameras.findIndex((camera) => camera.id === currentId);
  if (index < 0) return cameras[0].id;
  const nextIndex = (index + direction + cameras.length) % cameras.length;
  return cameras[nextIndex].id;
}
