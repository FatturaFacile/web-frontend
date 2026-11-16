import type { Meta, StoryObj } from '@storybook/angular';

// Renders the design tokens (styles/_tokens.scss) so that the light/dark, density and brand toolbar switches can be
// checked visually against the real values.
const SURFACES = [
  '--bg-primary',
  '--bg-card',
  '--bg-card-secondary',
  '--bg-elevated',
  '--bg-hover',
  '--bg-selected',
];
const ACTION = ['--primary-color', '--primary-hover', '--primary-active', '--primary-light'];
const TEXT = ['--text-primary', '--text-secondary', '--border-color'];

function swatches(vars: string[]): string {
  return vars
    .map(
      (v) => `<div style="display:flex;align-items:center;gap:12px;margin:4px 0">
        <span style="width:48px;height:32px;border-radius:6px;border:1px solid var(--border-color);background:var(${v})"></span>
        <code>${v}</code></div>`,
    )
    .join('');
}

const meta: Meta = { title: 'Foundations/Design tokens' };
export default meta;

export const Colors: StoryObj = {
  render: () => ({
    template: `<h3>Surfaces</h3>${swatches(SURFACES)}<h3>Primary action</h3>${swatches(ACTION)}<h3>Text and borders</h3>${swatches(TEXT)}`,
  }),
};
