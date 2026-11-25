import { describe, expect, it } from 'vitest';
import { LOW_OCR_CONFIDENCE } from './receipt-workbench.component';
import { clampZoom, normalizeRotation } from './receipt-viewer.component';

describe('receipt viewer', () => {
  it('keeps the zoom between a quarter and five times', () => {
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(1.25)).toBe(1.25);
    expect(clampZoom(9)).toBe(5);
  });

  it('keeps the rotation in a full turn', () => {
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
  });

  it('asks for a careful review below the OCR confidence threshold', () => {
    expect(LOW_OCR_CONFIDENCE).toBeGreaterThan(0);
    expect(LOW_OCR_CONFIDENCE).toBeLessThan(1);
  });
});
