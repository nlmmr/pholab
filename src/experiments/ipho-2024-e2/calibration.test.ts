import { describe, it, expect } from 'vitest';

describe('Perspective Camera 2D Ruler Calibration Math', () => {
  function computeMmPerPixel(depthMeters: number, fovDeg: number, viewportHeightPx: number): number {
    const fovRad = (fovDeg * Math.PI) / 180;
    const visibleHeightMeters = 2 * depthMeters * Math.tan(fovRad / 2);
    return (visibleHeightMeters * 1000) / viewportHeightPx;
  }

  function normalizeAngleDeg(angle: number): number {
    let norm = ((angle % 360) + 360) % 360;
    if (norm > 180) norm -= 360;
    return norm;
  }

  it('computes exact screen mm/pixel from perspective camera frustum', () => {
    // Screen view parameters in IPhO 2024:
    // Distance from camera (2.08, 0.58, 0.16) to screen target (1.37, 0.43, 0) is ~0.743m
    const depth = 0.743;
    const fov = 42;
    const viewportHeight = 800;

    const mmPerPx = computeMmPerPixel(depth, fov, viewportHeight);
    // 2 * 0.743 * tan(21°) = 2 * 0.743 * 0.383864 = 0.5704m = 570.4mm
    // 570.4 / 800 = ~0.713 mm/px
    expect(mmPerPx).toBeCloseTo(0.713, 2);
    const pixelsPerMm = 1 / mmPerPx;
    expect(pixelsPerMm).toBeCloseTo(1.402, 2);
  });

  it('scales proportionally when zooming in for microscopic fringe inspection', () => {
    const zoomedDepth = 0.096; // 9.6 cm close-up view of diffraction pattern
    const fov = 42;
    const viewportHeight = 800;

    const mmPerPx = computeMmPerPixel(zoomedDepth, fov, viewportHeight);
    // At 9.6cm: 2 * 0.096 * tan(21°) = 0.0737m = 73.7mm
    // 73.7 / 800 = 0.092 mm/px
    expect(mmPerPx).toBeCloseTo(0.092, 2);
  });

  it('accurately recovers distance in millimeters with instrument uncertainty', () => {
    const mmPerPx = 0.092;
    const spanPixels = 160.87;
    const distanceMm = spanPixels * mmPerPx;

    expect(distanceMm).toBeCloseTo(14.8, 1);

    const uncertaintyMm = Math.max(0.1, Number((0.5 * mmPerPx).toFixed(1)));
    expect(uncertaintyMm).toBe(0.1);
  });

  it('correctly normalizes angles across all quadrants', () => {
    expect(normalizeAngleDeg(0)).toBe(0);
    expect(normalizeAngleDeg(45)).toBe(45);
    expect(normalizeAngleDeg(180)).toBe(180);
    expect(normalizeAngleDeg(190)).toBe(-170);
    expect(normalizeAngleDeg(-90)).toBe(-90);
    expect(normalizeAngleDeg(360)).toBe(0);
    expect(normalizeAngleDeg(375)).toBe(15);
  });

  it('scales inversely with viewport pixel resolution across Full HD and 4K displays', () => {
    const depth = 0.743;
    const fov = 42;

    const mmPerPx1080 = computeMmPerPixel(depth, fov, 1080);
    const mmPerPx2160 = computeMmPerPixel(depth, fov, 2160);

    // 4K has twice the vertical pixel density, so mmPerPixel is exactly halved
    expect(mmPerPx1080 / mmPerPx2160).toBeCloseTo(2.0, 5);
    expect(mmPerPx1080).toBeCloseTo(0.528, 3);
    expect(mmPerPx2160).toBeCloseTo(0.264, 3);
  });

  it('computes 2D Euclidean measurement between points with resolution-dependent uncertainty', () => {
    const depth = 0.096; // Zoomed screen view
    const fov = 42;
    const viewportHeight = 800;
    const mmPerPx = computeMmPerPixel(depth, fov, viewportHeight); // ~0.0921 mm/px

    // User measures between fringe peak #1 at (120, 300) and peak #5 at (420, 300) -> 300 px horizontal span
    const p1 = { x: 120, y: 300 };
    const p2 = { x: 420, y: 300 };
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const spanPx = Math.sqrt(dx * dx + dy * dy);
    expect(spanPx).toBe(300);

    const distanceMm = spanPx * mmPerPx;
    // 300 * 0.09213 = ~27.64 mm
    expect(distanceMm).toBeCloseTo(27.64, 1);

    // Diagonal measurement: (100, 100) to (180, 160) -> dx=80, dy=60 -> span=100 px
    const spanDiagonalPx = Math.sqrt(80 * 80 + 60 * 60);
    expect(spanDiagonalPx).toBe(100);
    const distanceDiagMm = spanDiagonalPx * mmPerPx;
    expect(distanceDiagMm).toBeCloseTo(9.21, 1);

    // Wide view: uncertainty is determined by pixel resolution
    const wideMmPerPx = computeMmPerPixel(0.743, 42, 800); // 0.713 mm/px
    const wideUncertainty = Math.max(0.1, Number((0.5 * wideMmPerPx).toFixed(1)));
    expect(wideUncertainty).toBe(0.4); // 0.5 * 0.713 = 0.3565 -> rounds to 0.4 mm
  });
});
