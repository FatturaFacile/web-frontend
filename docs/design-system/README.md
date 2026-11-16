# Design system

Issue #263. The look, the accessibility rules and the theming of the FatturaFacile web application.

| Document | Content |
| --- | --- |
| [tokens.md](tokens.md) | Token source, generated CSS, naming, how to add a token |
| [theming.md](theming.md) | Light, dark and system theme, brand colours per tenant, density, persistence and API sync |
| [components.md](components.md) | The core components and how to use them |
| [accessibility.md](accessibility.md) | WCAG 2.2 AA rules, how they are met and tested |
| [ux-microcopy.md](ux-microcopy.md) | Tone of voice, error messages, confirmations, empty states, i18n rules |

## Where things are

| What | Where |
| --- | --- |
| Token source (W3C Design Tokens) | `src/design-tokens/ff.tokens.json` |
| Generator and its check | `scripts/build-design-tokens.mjs`, `pnpm tokens:build`, `pnpm tokens:check` |
| Generated `--ff-*` custom properties | `src/styles/_generated-tokens.scss` (do not edit) |
| Legacy variable names (aliases of `--ff-*`) | `src/styles/_tokens.scss` |
| NG-ZORRO brand overrides, density, accessibility, native controls | `src/styles/_brand.scss`, `_density.scss`, `_a11y.scss`, `_components.scss` |
| Theme, density, motion and brand logic | `src/app/core/theme/` |
| First-paint script (no flash on cold refresh) | `public/ff-theme-init.js`, loaded in `src/index.html` |
| Core components | `src/app/shared/ui/` |
| Header quick switcher | `src/app/layout/header/appearance-switcher.component.ts` |
| Live catalog | route `/design-system` (`src/app/features/design-system/`) |
| Accessibility audit | `src/app/features/design-system/design-system.a11y.spec.ts`, `src/testing/axe.ts` |
| API | `GET/PATCH /api/v1/user/preferences`, `GET/PATCH /api/v1/tenant/branding` (web-api) |

## Storybook and the catalog route

Components in `src/app/shared/ui/` are documented in Storybook 10 (`@storybook/angular`, with the `addon-a11y` and
`addon-docs` addons). Stories sit next to each component (`*.stories.ts`), plus `src/stories/tokens.stories.ts` and
`src/stories/controls.stories.ts`.

| Command | Purpose |
| --- | --- |
| `pnpm storybook` | Local Storybook |
| `pnpm build-storybook` | Static build in `storybook-static/` |
| `pnpm e2e:a11y` | Playwright + axe accessibility audit (`tests/accessibility*.spec.ts`) |

The `/design-system` route stays as a live catalog rendered with the real application styles; the axe audit
(`design-system.a11y.spec.ts`) runs on it.

## Sharing tokens with mobile and desktop

`pnpm tokens:sync` copies the generated Dart and XAML files into the sibling repositories
(`mobile/lib/design/ff_tokens.dart`, `desktop/src/FatturaFacile.Wpf/Themes/FfTokens.*.xaml`). Run it after every
`pnpm tokens:build`.
