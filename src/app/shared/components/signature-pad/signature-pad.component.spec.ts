import { describe, expect, it } from 'vitest';
import { strokesToSvg } from './signature-pad.component';

describe('strokesToSvg', () => {
  it('draws one path per stroke inside a sized viewBox', () => {
    const svg = strokesToSvg(
      [
        [
          { x: 1, y: 2 },
          { x: 3.14159, y: 4 },
        ],
        [{ x: 10, y: 10 }],
      ],
      480,
      180,
    );
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 180"')).toBe(true);
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg).toContain('d="M1 2 L3.1 4"');
    expect(svg).toContain('d="M10 10 L10 10"');
  });

  it('produces markup the backend accepts: no scripts, event handlers or javascript urls', () => {
    const svg = strokesToSvg([[{ x: 1, y: 1 }]], 100, 50);
    expect(svg).toMatch(/^\s*<svg[\s>]/i);
    expect(svg).not.toMatch(/<\s*script|[\s"']on[a-z]+\s*=|javascript:/i);
  });

  it('is an empty drawing for no strokes', () => {
    expect(strokesToSvg([], 100, 50)).not.toContain('<path');
  });
});
