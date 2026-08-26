import { normalizeModelBoxes, normalizeBoxToPercent } from '../nvidia/nvidiaProcessor.js';

describe('normalizeModelBoxes', () => {
  it('passes through valid 0-100 x/y/width/height boxes', () => {
    expect(normalizeModelBoxes([{ x: 30.2, y: 25.5, width: 8.3, height: 29.5 }])).toEqual([
      { x: 30.2, y: 25.5, width: 8.3, height: 29.5 },
    ]);
  });

  it('converts gemini corner-format boxes on a 0-1000 grid', () => {
    expect(
      normalizeModelBoxes([{ xmin: 510, ymin: 316, xmax: 531, ymax: 451 }], 2560, 1440),
    ).toEqual([{ x: 51, y: 31.6, width: 2.1, height: 13.5 }]);
  });

  it('converts box_2d arrays [ymin, xmin, ymax, xmax]', () => {
    expect(normalizeModelBoxes([[316, 510, 451, 531]])).toEqual([
      { x: 51, y: 31.6, width: 2.1, height: 13.5 },
    ]);
  });

  it('scales pixel coordinates per-axis when any box exceeds 1000', () => {
    expect(
      normalizeModelBoxes(
        [{ x: 1500, y: 700, width: 400, height: 300 }, { x: 772.7, y: 366.8, width: 212.7, height: 425.4 }],
        2560,
        1440,
      ),
    ).toEqual([
      { x: 58.6, y: 48.6, width: 15.6, height: 20.8 },
      { x: 30.2, y: 25.5, width: 8.3, height: 29.5 },
    ]);
  });

  it('applies one grid interpretation to the whole response', () => {
    const result = normalizeModelBoxes(
      [{ x: 200, y: 300, width: 150, height: 400 }, { x: 0, y: 0, width: 1000, height: 1000 }],
      2560,
      1440,
    );
    expect(result[0]).toEqual({ x: 20, y: 30, width: 15, height: 40 });
    expect(result[1]).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('keeps result indexes aligned with input, nulling unparseable entries', () => {
    const result = normalizeModelBoxes([{ foo: 1 }, { x: 10, y: 10, width: 5, height: 5 }]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeNull();
    expect(result[1]).toEqual({ x: 10, y: 10, width: 5, height: 5 });
  });

  it('returns null for unknown or degenerate positions', () => {
    expect(normalizeModelBoxes([{ foo: 1 }, null, 'left-center'])).toEqual([null, null, null]);
    expect(normalizeModelBoxes([{ x: 10, y: 10, width: 0, height: 5 }])).toEqual([null]);
    expect(normalizeModelBoxes([{ xmin: 100, ymin: 100, xmax: 50, ymax: 150 }])).toEqual([null]);
  });

  it('clamps boxes that overflow the 0-100 frame', () => {
    const [box] = normalizeModelBoxes([{ x: 95, y: 95, width: 20, height: 20 }]);
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(100);
    expect(box!.y + box!.height).toBeLessThanOrEqual(100);
  });
});

describe('normalizeBoxToPercent', () => {
  it('normalizes a single box', () => {
    expect(normalizeBoxToPercent({ xmin: 510, ymin: 316, xmax: 531, ymax: 451 })).toEqual({
      x: 51,
      y: 31.6,
      width: 2.1,
      height: 13.5,
    });
  });
});
