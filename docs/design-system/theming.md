# Theming, density and brand

## Preferences

| Preference | Values | Stored for | Applied as |
| --- | --- | --- | --- |
| Theme | `light`, `dark`, `system` | the user | `data-theme="light|dark"` on `<html>` |
| Density | `compact`, `comfortable` (default), `spacious` | the user | `data-density` on `<html>` |
| Reduced motion | `true`, `false`, `null` (follow the system) | the user | `data-reduced-motion` on `<html>` |
| Default theme | `light`, `dark`, `system` | the tenant | used when the user's theme is `system` |
| Brand primary / secondary colour | `#RRGGBB` or empty | the tenant | `--ff-color-primary*`, `--ff-color-accent*` on `<html>` |
| Brand logo | HTTPS URL or storage path | the tenant | returned by the API for the shell to show |

### What `system` means

For the user, `system` means "what my organisation chose". If the tenant default is `light` or `dark` that wins; if it
is `system` too, the operating system decides (`prefers-color-scheme`). An explicit `light` or `dark` of the user always
wins over both.

## Services (`src/app/core/theme/`)

- `UiPreferencesService`: signals for the preferences and the branding, `resolvedTheme`, `isDark`, `reducedMotion`.
  Every setter writes `localStorage` (`ff_ui`) at once and, when signed in, sends a `PATCH /user/preferences`. The
  signals reflect the choice immediately; a failed request keeps the local value.
- `ThemeService`: puts the preferences on the page (attributes, the dark NG-ZORRO stylesheet, brand variables, the
  `theme-color` meta) with `effect`s, and loads `GET /user/preferences` and `GET /tenant/branding` after the sign-in
  and after a tenant switch. The server copy replaces the local one.
- `brand-theme.ts` and `contrast.util.ts`: pure functions for the brand tones and the WCAG maths.
- `UiPreferencesApiService` (`src/app/core/api/`): the four endpoints.

`AuthStore.isDarkMode` and `AuthStore.toggleTheme()` still exist and delegate to `UiPreferencesService`.

## No flash on a cold refresh

`public/ff-theme-init.js` is a small blocking script in `<head>`. Before the first paint it reads `ff_ui` and
`ff_ui_brand` from localStorage and sets `data-theme`, `data-density`, `data-reduced-motion`, the brand variables and,
for dark, the dark NG-ZORRO stylesheet. `ThemeService` writes `ff_ui_brand` (the variables of both themes), so the
script needs no colour maths. It is an external file, so it works with a strict `script-src 'self'` policy. Keep its
`system` rules in step with `UiPreferencesService.resolvedTheme`.

## Brand colours

`buildBrandTones(colour, mode, surface)` returns, for one theme:

| Tone | Rule |
| --- | --- |
| `base` | The colour, moved lighter (dark theme) or darker (light theme) until it has 4.5:1 on the surface and on its own `subtle` tint. A colour that already passes is kept as it is. |
| `hover`, `active` | `base` shifted 7% and 13% in the same direction; if the text on it would drop below 4.5:1 the base is used. |
| `subtle` | 12% (light) or 22% (dark) of `base` over the surface. |
| `contrastText` | White, near-black or black: the first that reaches 4.5:1 on `base`. |

The result is checked for ten brand colours in both themes, including black, white and mid grey. The colour of an
administrator is therefore never a way to ship an unreadable button. Hover and active states are separate tones so a
state change is visible, not only a different hue.

Variables set per theme: `--ff-color-primary`, `-primary-hover`, `-primary-active`, `-primary-subtle`, `-on-primary`,
`--ff-color-text-link`, `--ff-color-focus`, and the same family for `accent` (the secondary colour).

## Density

| Profile | Control height | Table row | Card padding | Font |
| --- | --- | --- | --- | --- |
| compact | 28px | 32px | 12px | 13px |
| comfortable | 32px | 40px | 16px | 14px |
| spacious | 44px | 56px | 24px | 16px |

Density only changes custom properties, so switching it re-flows the page without a layout jump, and because the
attribute is set before the first paint there is no shift on load. Every profile keeps controls and rows at or above
the 24px target size minimum.

## Quick switcher

`app-appearance-switcher` in the header: a disclosure button with a theme group and a density group of native radios.
Tab reaches the button, Enter or Space opens the panel, Tab and the arrow keys move between the radios, Escape closes
it and returns the focus to the button. The full catalog with the brand editor is at `/design-system`.

## API

| Endpoint | Who | Body |
| --- | --- | --- |
| `GET /api/v1/user/preferences` | any member | |
| `PATCH /api/v1/user/preferences` | the user, for themselves | `theme_preference`, `ui_density`, `reduced_motion` (all optional) |
| `GET /api/v1/tenant/branding` | any member | |
| `PATCH /api/v1/tenant/branding` | the `system` module (owner, admin) | `brand_primary_color`, `brand_secondary_color`, `brand_logo_url`, `default_theme` (all optional, `null` clears) |

Colours must be `#RRGGBB`; the logo is an `https://` URL or a relative storage path (no `data:` or `javascript:`).
The branding lives in the tenant settings and is isolated per tenant like all tenant data.
