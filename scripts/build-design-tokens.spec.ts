import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import * as gen from './build-design-tokens.mjs';

const tokens = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/design-tokens/ff.tokens.json'), 'utf8'),
);

describe('token converters', () => {
  it('parses hex, short hex, hex with alpha and rgb()/rgba()', () => {
    expect(gen.parseCssColor('#0f766e')).toEqual({ r: 15, g: 118, b: 110, a: 1 });
    expect(gen.parseCssColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(gen.parseCssColor('#00000080').a).toBeCloseTo(0.502, 3);
    expect(gen.parseCssColor('rgba(20, 184, 166, 0.18)')).toEqual({
      r: 20,
      g: 184,
      b: 166,
      a: 0.18,
    });
    expect(gen.parseCssColor('rgb(255 0 0 / 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(gen.parseCssColor('red')).toBeNull();
    expect(gen.parseCssColor('#12')).toBeNull();
  });

  it('formats colours for CSS, Flutter and WPF', () => {
    const opaque = { r: 15, g: 118, b: 110, a: 1 };
    const translucent = { r: 255, g: 255, b: 255, a: 0.06 };
    expect(gen.colorToCssHex(opaque)).toBe('#0f766e');
    expect(gen.colorToCssHex(translucent)).toBe('#ffffff0f');
    expect(gen.colorToDart(opaque)).toBe('Color(0xFF0F766E)');
    expect(gen.colorToDart(translucent)).toBe('Color(0x0FFFFFFF)');
    expect(gen.colorToXaml(opaque)).toBe('#FF0F766E');
    expect(gen.colorToXaml(translucent)).toBe('#0FFFFFFF');
  });

  it('converts px, rem and em to logical pixels and rejects other values', () => {
    expect(gen.parsePx('14px')).toBe(14);
    expect(gen.parsePx('0.875rem')).toBe(14);
    expect(gen.parsePx('1.5em')).toBe(24);
    expect(gen.parsePx('0')).toBe(0);
    expect(gen.parsePx('0 1px 2px red')).toBeNull();
    expect(gen.parsePx('auto')).toBeNull();
  });

  it('reduces a CSS font stack to installable families', () => {
    expect(gen.parseFontStack("'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif")).toEqual(
      ['Inter', 'Segoe UI'],
    );
  });

  it('builds identifiers', () => {
    expect(gen.pascal('surface-alt')).toBe('SurfaceAlt');
    expect(gen.pascal('2xl')).toBe('2xl');
    expect(gen.camel('surface-alt')).toBe('surfaceAlt');
    expect(gen.camel('2xl', 'size')).toBe('size2xl');
  });
});

describe('generated platform outputs', () => {
  const model = gen.buildModel(tokens);

  it('keeps light and dark colour sets in step', () => {
    expect(Object.keys(model.colors.dark).sort()).toEqual(Object.keys(model.colors.light).sort());
  });

  it('emits every colour token in each platform file', () => {
    const dart = gen.buildDart(model);
    const light = gen.buildXamlColors(model, 'light');
    const flat = JSON.parse(gen.buildFlatJson(model));
    for (const name of Object.keys(model.colors.light)) {
      expect(dart).toContain(`required this.${gen.camel(name)},`);
      expect(light).toContain(`x:Key="Ff.Brush.${gen.pascal(name)}"`);
      expect(flat.color.dark[name]).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
    }
    expect(dart).toContain('ThemeData ffThemeData(');
  });

  it('emits spacing, radius and density resources for WPF', () => {
    const xaml = gen.buildXamlSpacing(model);
    expect(xaml).toContain('<sys:Double x:Key="Ff.Space.4">16</sys:Double>');
    expect(xaml).toContain('<CornerRadius x:Key="Ff.Radius.Lg">8</CornerRadius>');
    expect(xaml).toContain('x:Key="Ff.Density.Compact.ControlHeight"');
  });

  it('outputs the committed files (run `pnpm tokens:build` if this fails)', () => {
    for (const [file, content] of Object.entries(gen.buildAllOutputs(tokens)) as [
      string,
      string,
    ][]) {
      const onDisk = readFileSync(resolve(process.cwd(), file), 'utf8').replaceAll('\r\n', '\n');
      expect(onDisk, file).toBe(content);
    }
  });
});
