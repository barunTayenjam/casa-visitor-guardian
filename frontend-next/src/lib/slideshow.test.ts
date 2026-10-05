import { describe, expect, it } from 'vitest';
import { nextFocusId } from './slideshow';

const cameras = [
  { id: 'cam-1', name: 'Camera 1' },
  { id: 'cam-2', name: 'Camera 2' },
  { id: 'cam-3', name: 'Camera 3' },
];

describe('nextFocusId', () => {
  it('advances forward and wraps past the last camera', () => {
    expect(nextFocusId('cam-2', cameras, 1)).toBe('cam-3');
    expect(nextFocusId('cam-3', cameras, 1)).toBe('cam-1');
  });

  it('goes backward and wraps past the first camera', () => {
    expect(nextFocusId('cam-2', cameras, -1)).toBe('cam-1');
    expect(nextFocusId('cam-1', cameras, -1)).toBe('cam-3');
  });

  it('starts from the first camera when nothing is focused', () => {
    expect(nextFocusId(null, cameras, 1)).toBe('cam-1');
  });

  it('starts from the last camera when going backward without focus', () => {
    expect(nextFocusId(null, cameras, -1)).toBe('cam-3');
  });

  it('falls back to the first camera when the focused camera is gone', () => {
    expect(nextFocusId('cam-vanished', cameras, 1)).toBe('cam-1');
    expect(nextFocusId('cam-vanished', cameras, -1)).toBe('cam-1');
  });

  it('returns null for fewer than two cameras', () => {
    expect(nextFocusId('cam-1', [cameras[0]], 1)).toBeNull();
    expect(nextFocusId(null, [], 1)).toBeNull();
  });
});
