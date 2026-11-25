import { CpqVisual, CpqVisualLayer } from '@core';

export type CpqPreviewView = 'plan' | 'elevation' | 'isometric';

/** A drawable of the preview, already projected to the SVG space (viewBox 0 0 420 300). */
export interface CpqSceneShape {
  id: string;
  /** The layer it belongs to; null for the base of the model. */
  layerId: string | null;
  kind: 'polygon' | 'circle' | 'text';
  points?: string;
  cx?: number;
  cy?: number;
  r?: number;
  x?: number;
  y?: number;
  text?: string;
  fill: string;
  stroke: string;
  opacity: number;
}

export const CPQ_VIEWBOX = { width: 420, height: 300 } as const;

const STROKE = '#434343';
const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);

/** Lightens (factor > 1) or darkens (factor < 1) a #rrggbb colour; anything else is returned unchanged. */
export function shade(color: string, factor: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) {
    return color;
  }
  const value = parseInt(match[1], 16);
  const channel = (shift: number): string =>
    Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * factor)))
      .toString(16)
      .padStart(2, '0');

  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

/** Sizes of the unit in the model space (x = width, y = depth, z = height). */
function dimensions(visual: CpqVisual): { w: number; d: number; h: number } {
  const factor = visual.base.scale_factor ?? 1;

  return { w: 200 * factor, d: 100 * factor, h: 60 };
}

function isoPoint(x: number, y: number, z: number): [number, number] {
  return [210 + (x - y) * COS * 0.8, 70 + (x + y) * SIN * 0.8 - z * 0.8 + 90];
}

function points(list: [number, number][]): string {
  return list.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');
}

function poly(
  id: string,
  layerId: string | null,
  list: [number, number][],
  fill: string,
  opacity = 1,
): CpqSceneShape {
  return { id, layerId, kind: 'polygon', points: points(list), fill, stroke: STROKE, opacity };
}

/** A box seen from the front-right: top, left face and right face. */
function isoBox(id: string, layerId: string | null, box: Box, color: string): CpqSceneShape[] {
  const { x, y, z, w, d, h } = box;

  return [
    poly(
      `${id}-left`,
      layerId,
      [
        isoPoint(x, y + d, z),
        isoPoint(x + w, y + d, z),
        isoPoint(x + w, y + d, z + h),
        isoPoint(x, y + d, z + h),
      ],
      shade(color, 0.85),
    ),
    poly(
      `${id}-right`,
      layerId,
      [
        isoPoint(x + w, y, z),
        isoPoint(x + w, y + d, z),
        isoPoint(x + w, y + d, z + h),
        isoPoint(x + w, y, z + h),
      ],
      shade(color, 0.7),
    ),
    poly(
      `${id}-top`,
      layerId,
      [
        isoPoint(x, y, z + h),
        isoPoint(x + w, y, z + h),
        isoPoint(x + w, y + d, z + h),
        isoPoint(x, y + d, z + h),
      ],
      shade(color, 1.1),
    ),
  ];
}

function rect(
  id: string,
  layerId: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  opacity = 1,
): CpqSceneShape {
  return poly(
    id,
    layerId,
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    fill,
    opacity,
  );
}

function accessorySlot(layer: CpqVisualLayer): number {
  return Math.max(1, Math.min(layer.slot ?? 1, 4));
}

/**
 * The scene of a configuration seen from above (plan), from the front (elevation) or in isometric projection: the base of
 * the model, with the colour of the material layer, and a shape for every other layer that is not hidden. Pure and
 * deterministic: the same visual always gives the same scene.
 */
export function buildScene(
  visual: CpqVisual,
  view: CpqPreviewView,
  hidden: ReadonlySet<string> = new Set(),
): CpqSceneShape[] {
  const { w, d, h } = dimensions(visual);
  const layers = visual.layers.filter((layer) => layer.visible && !hidden.has(layer.id));
  const finish = layers.find((layer) => layer.shape === 'body_finish');
  const baseColor = finish?.color ?? visual.base.color ?? '#bfc5cc';
  const scene: CpqSceneShape[] = [];

  const motor = layers.find((layer) => layer.shape === 'motor');
  const panel = layers.find((layer) => layer.shape === 'panel');
  const kit = layers.find((layer) => layer.shape === 'kit');
  const badge = layers.find((layer) => layer.shape === 'badge');
  const accessories = layers.filter((layer) => layer.shape === 'accessory');

  if (view === 'isometric') {
    scene.push(...isoBox('base', null, { x: 0, y: 0, z: 0, w, d, h }, baseColor));
    if (panel)
      scene.push(
        ...isoBox(panel.id, panel.id, { x: 12, y: 12, z: h, w: 36, d: 28, h: 70 }, panel.color),
      );
    if (motor)
      scene.push(
        ...isoBox(
          motor.id,
          motor.id,
          { x: w - 100, y: d / 2 - 25, z: h, w: 80, d: 50, h: 52 },
          motor.color,
        ),
      );
    for (const accessory of accessories) {
      scene.push(
        ...isoBox(
          accessory.id,
          accessory.id,
          { x: 60 + accessorySlot(accessory) * 26, y: d - 36, z: h, w: 20, d: 20, h: 24 },
          accessory.color,
        ),
      );
    }
    if (kit) scene.push(...isoBox(kit.id, kit.id, { x: 0, y: d, z: 0, w, d: 7, h: 16 }, kit.color));
    if (badge) {
      const [cx, cy] = isoPoint(w - 14, d, h / 2);
      scene.push({
        id: badge.id,
        layerId: badge.id,
        kind: 'circle',
        cx,
        cy,
        r: 13,
        fill: badge.color,
        stroke: STROKE,
        opacity: 1,
      });
      scene.push({
        id: `${badge.id}-text`,
        layerId: badge.id,
        kind: 'text',
        x: cx - 7,
        y: cy + 4,
        text: 'Ex',
        fill: '#ffffff',
        stroke: 'none',
        opacity: 1,
      });
    }

    return scene;
  }

  if (view === 'plan') {
    const x0 = 110;
    const y0 = 70;
    const scale = 1.05;
    scene.push(rect('base', null, x0, y0, w * scale, d * 2 * scale * 0.6, baseColor));
    const depth = d * 2 * scale * 0.6;
    if (panel) scene.push(rect(panel.id, panel.id, x0 + 8, y0 + 8, 40, 32, panel.color));
    if (motor)
      scene.push(
        rect(motor.id, motor.id, x0 + w * scale - 96, y0 + depth / 2 - 28, 84, 56, motor.color),
      );
    for (const accessory of accessories) {
      scene.push(
        rect(
          accessory.id,
          accessory.id,
          x0 + 60 + accessorySlot(accessory) * 28,
          y0 + 10,
          22,
          22,
          accessory.color,
        ),
      );
    }
    if (kit) scene.push(rect(kit.id, kit.id, x0, y0 + depth - 12, w * scale, 12, kit.color));
    if (badge) {
      scene.push({
        id: badge.id,
        layerId: badge.id,
        kind: 'circle',
        cx: x0 + w * scale - 18,
        cy: y0 + 20,
        r: 13,
        fill: badge.color,
        stroke: STROKE,
        opacity: 1,
      });
      scene.push({
        id: `${badge.id}-text`,
        layerId: badge.id,
        kind: 'text',
        x: x0 + w * scale - 25,
        y: y0 + 25,
        text: 'Ex',
        fill: '#ffffff',
        stroke: 'none',
        opacity: 1,
      });
    }

    return scene;
  }

  // elevation
  const x0 = 100;
  const ground = 240;
  const width = w * 1.1;
  scene.push(rect('base', null, x0, ground - h, width, h, baseColor));
  if (panel) scene.push(rect(panel.id, panel.id, x0 + 10, ground - h - 92, 44, 92, panel.color));
  if (motor)
    scene.push(rect(motor.id, motor.id, x0 + width - 100, ground - h - 56, 86, 56, motor.color));
  for (const accessory of accessories) {
    scene.push(
      rect(
        accessory.id,
        accessory.id,
        x0 + 64 + accessorySlot(accessory) * 28,
        ground - h - 26,
        22,
        26,
        accessory.color,
      ),
    );
  }
  if (kit) scene.push(rect(kit.id, kit.id, x0, ground - 14, width, 14, kit.color));
  if (badge) {
    scene.push({
      id: badge.id,
      layerId: badge.id,
      kind: 'circle',
      cx: x0 + width - 22,
      cy: ground - h / 2 - 6,
      r: 14,
      fill: badge.color,
      stroke: STROKE,
      opacity: 1,
    });
    scene.push({
      id: `${badge.id}-text`,
      layerId: badge.id,
      kind: 'text',
      x: x0 + width - 30,
      y: ground - h / 2 - 1,
      text: 'Ex',
      fill: '#ffffff',
      stroke: 'none',
      opacity: 1,
    });
  }

  return scene;
}
