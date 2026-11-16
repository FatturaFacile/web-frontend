# Design tokens

## Source of truth

`src/design-tokens/ff.tokens.json` follows the W3C Design Tokens format: every token has `$value`, groups carry a
`$type`. It holds:

| Group | Tokens |
| --- | --- |
| `color.light`, `color.dark` | The semantic palette of each theme. Both groups have the same names (a spec checks it). |
| `shadow.light`, `shadow.dark` | `card`, `elevated` |
| `space` | `1`..`6`, a 4px grid |
| `radius` | `sm`, `md`, `lg` |
| `font.family`, `font.size` | `base`, `mono`; `xs`..`2xl` |
| `a11y` | `target-min` (24px), `focus-width`, `focus-offset` |
| `density.compact`, `.comfortable`, `.spacious` | `control-height`, `row-height`, `card-padding`, `input-padding-x`, `font-size`, `gap` |

The file is platform neutral: it can feed other platforms later with Style Dictionary or a small script, without
changing the format. Today it is applied to the web application only.

## Generated CSS

`pnpm tokens:build` runs `scripts/build-design-tokens.mjs` and writes `src/styles/_generated-tokens.scss`:

```css
:root { color-scheme: light; --ff-color-primary: #0f766e; /* ... */ --ff-density-control-height: 32px; }
[data-theme='dark'] { color-scheme: dark; --ff-color-primary: #2dd4bf; /* ... */ }
[data-density='compact'] { --ff-density-control-height: 28px; /* ... */ }
```

`pnpm tokens:check` fails when the generated file is stale; a Vitest spec runs the same check, so a change to the JSON
without a rebuild fails `pnpm test`.

## Names

`--ff-<group>-<name>`: `--ff-color-surface`, `--ff-space-3`, `--ff-radius-md`, `--ff-font-size-sm`,
`--ff-shadow-card`, `--ff-a11y-target-min`, `--ff-density-row-height`.

Colours are semantic (what they are for, not what they look like): `surface`, `text`, `text-muted`, `primary`,
`on-primary`, `danger`, `danger-bg`, `border-input`, `focus`.

The names used before this system (`--primary-color`, `--bg-card`, `--text-secondary`, `--status-danger`, `--space-3`,
...) still work: `src/styles/_tokens.scss` defines each of them as an alias of its `--ff-*` token. Use the `--ff-*`
names in new code and move old code over when you touch it.

## NG-ZORRO

NG-ZORRO is compiled from `src/theme.less` and `src/theme-dark.less` with a fixed palette (build time). The runtime
part is in `src/styles/_ng-zorro.scss` (surfaces, tables, overlays, tags) and `src/styles/_brand.scss` (primary
surfaces: buttons, checkbox, radio, switch, tabs, pagination, focus borders), which point at the `--ff-*` variables.
That is how a tenant brand colour set at runtime reaches NG-ZORRO components. `_density.scss` scales NG-ZORRO inputs,
buttons, table rows and cards with the density tokens.

## Adding or changing a token

1. Edit `ff.tokens.json`. A colour needs a light and a dark value.
2. `pnpm tokens:build`.
3. `pnpm test src/design-tokens`: the contrast checks fail when a colour pair no longer meets WCAG AA.
4. If the value is a surface, keep `BRAND_SURFACES` in `src/app/core/theme/brand-theme.ts` equal (a spec checks it).
