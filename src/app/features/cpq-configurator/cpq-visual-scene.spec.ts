import { describe, expect, it } from 'vitest';
import { cpqEvaluation } from '../../../testing/cpq-fixtures';
import { buildScene, CpqPreviewView, shade } from './cpq-visual-scene';

describe('cpq-visual-scene', () => {
  const visual = cpqEvaluation().visual;

  it('shades a colour lighter or darker and leaves anything else alone', () => {
    expect(shade('#808080', 1.5)).toBe('#c0c0c0');
    expect(shade('#808080', 0.5)).toBe('#404040');
    expect(shade('#ffffff', 2)).toBe('#ffffff');
    expect(shade('red', 0.5)).toBe('red');
  });

  it.each<CpqPreviewView>(['plan', 'elevation', 'isometric'])(
    'draws the base and the layers in the %s view',
    (view) => {
      const scene = buildScene(visual, view);

      expect(scene.some((shape) => shape.layerId === null)).toBe(true);
      expect(scene.some((shape) => shape.layerId === 'safety_kit')).toBe(true);
    },
  );

  it('paints the base with the colour of the material layer', () => {
    const scene = buildScene(visual, 'elevation');
    const base = scene.find((shape) => shape.id === 'base');

    expect(base?.fill).toBe('#9fb3c8');
  });

  it('uses the colour of the model when there is no material layer', () => {
    const scene = buildScene(
      { ...visual, layers: visual.layers.filter((layer) => layer.kind !== 'material') },
      'elevation',
    );

    expect(scene.find((shape) => shape.id === 'base')?.fill).toBe('#bfc5cc');
  });

  it('leaves a hidden layer out and keeps the rest', () => {
    const scene = buildScene(visual, 'isometric', new Set(['safety_kit']));

    expect(scene.some((shape) => shape.layerId === 'safety_kit')).toBe(false);
    expect(scene.some((shape) => shape.layerId === null)).toBe(true);
  });

  it('draws a badge, a motor, a panel and accessories where their layers say', () => {
    const rich = {
      ...visual,
      layers: [
        {
          id: 'zone',
          characteristic: 'atex_zone',
          option: 'ZONE_1',
          label: 'Zone 1',
          kind: 'certification',
          shape: 'badge',
          color: '#f5222d',
          z: 50,
          slot: null,
          auto_included: false,
          visible: true,
        },
        {
          id: 'motor_type',
          characteristic: 'motor_type',
          option: 'ATEX_EXD',
          label: 'Ex d',
          kind: 'motor',
          shape: 'motor',
          color: '#d4380d',
          z: 20,
          slot: null,
          auto_included: true,
          visible: true,
        },
        {
          id: 'control_panel',
          characteristic: 'control_panel',
          option: 'PLC',
          label: 'PLC',
          kind: 'electrical',
          shape: 'panel',
          color: '#722ed1',
          z: 30,
          slot: null,
          auto_included: false,
          visible: true,
        },
        {
          id: 'flush_kit',
          characteristic: 'flush_kit',
          option: null,
          label: 'Flush',
          kind: 'accessory',
          shape: 'accessory',
          color: '#2f54eb',
          z: 60,
          slot: 3,
          auto_included: false,
          visible: true,
        },
      ],
    };

    for (const view of ['plan', 'elevation', 'isometric'] as const) {
      const scene = buildScene(rich, view);
      const layers = new Set(scene.map((shape) => shape.layerId));

      expect(layers).toEqual(new Set([null, 'zone', 'motor_type', 'control_panel', 'flush_kit']));
      expect(scene.find((shape) => shape.kind === 'text')?.text).toBe('Ex');
    }
  });

  it('scales the base with the characteristic the model says', () => {
    const small = buildScene(
      { ...visual, base: { ...visual.base, scale_factor: 0.8 } },
      'elevation',
    ).find((shape) => shape.id === 'base');
    const large = buildScene(
      { ...visual, base: { ...visual.base, scale_factor: 1.3 } },
      'elevation',
    ).find((shape) => shape.id === 'base');

    expect(large?.points).not.toBe(small?.points);
  });

  it('is deterministic', () => {
    expect(buildScene(visual, 'isometric')).toEqual(buildScene(visual, 'isometric'));
  });
});
