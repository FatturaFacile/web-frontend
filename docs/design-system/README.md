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

## Why a catalog route and not Storybook

The repository has no Storybook and adding it means a second build toolchain, extra dependencies and a separate
Angular builder to keep in step with Angular 22. The `/design-system` route renders the real components with the real
styles, theme, density and brand controls, and the same page is what the axe audit runs on. It is part of the normal
build, so it can never drift from the application. If Storybook is wanted later, the components are standalone and take
only inputs, so stories need no changes to them.
