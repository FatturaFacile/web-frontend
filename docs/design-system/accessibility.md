# Accessibility: WCAG 2.2 Level AA

Target: every screen passes axe and meets the AA success criteria. This page lists how each criterion that concerns the
design system is met and where it is tested.

## Criteria and how they are met

| Criterion | How | Checked by |
| --- | --- | --- |
| 1.4.3 Contrast (minimum), 4.5:1 text | Colour tokens in pairs; text colours reach 4.5:1 on every surface in both themes; status text on its tint; button labels in every state | `ff.tokens.spec.ts` (all pairs, light and dark) |
| 1.4.11 Non-text contrast, 3:1 | Input borders (`border-input`) and the focus colour reach 3:1 on every surface | `ff.tokens.spec.ts` |
| 1.4.1 Use of colour | Badges, alerts and toasts carry text and an icon, never colour alone; invalid fields have a message and a thicker border | Review, `ui-components.spec.ts` |
| Brand colours | Tones computed at runtime keep 4.5:1 for any colour an administrator picks | `contrast.util.spec.ts`, `brand-theme.spec.ts` |
| 2.4.7 Focus visible, 2.4.13 Focus appearance | One global `:focus-visible` ring: 3px, offset 2px, `--ff-color-focus` | `_a11y.scss`, token contrast |
| 2.4.11 Focus not obscured | `scroll-padding-top` is the sticky header height plus 16px; dialogs trap the focus inside | `_a11y.scss`, `ui-components.spec.ts` |
| 2.5.8 Target size (minimum), 24x24px | `--ff-a11y-target-min` is applied to buttons, menu items, tabs, selects and inputs; every density profile keeps controls and rows at or above it | `ff.tokens.spec.ts`, `_a11y.scss`, `_density.scss` |
| 2.4.1 Bypass blocks | Skip link "Skip to main content" (`a11y.skipToContent`) is the first element of the shell and targets `<main id="main-content">`; landmarks: `header` (top bar), `navigation` (sidebar, named by `DESIGN_SYSTEM.NAV_MAIN`), `main`, breadcrumb | `app.component.html` |
| 4.1.3 Status messages | Toasts, form errors and alerts use live regions that exist before their content changes | `ui-components.spec.ts` |
| 2.1.1 Keyboard, 2.1.2 No keyboard trap | Native controls; the dialog traps the focus on purpose and releases it with Escape or the close button; the switcher opens and closes from the keyboard | `ui-components.spec.ts`, `appearance-switcher.component.spec.ts` |
| 2.2.1 Timing adjustable | Toasts pause while hovered or focused; errors never close by themselves | `ui-components.spec.ts` |
| 2.3.3 Animation from interactions | `prefers-reduced-motion` and the user preference `data-reduced-motion` switch animations off | `_a11y.scss`, `_base.scss`, `theme.service.spec.ts` |
| 1.3.1, 4.1.2 Structure and names | Real headings, labels bound to controls, `fieldset` with `legend` for radio groups, `caption` and `scope` on tables, dialogs named by their title | axe on the catalog |
| 3.3.1, 3.3.3 Error identification and suggestion | The error text says what is wrong and how to fix it (see ux-microcopy.md) | Review |
| Forced colours | The focus ring becomes `Highlight` | `_a11y.scss` |

## Automated audit

`src/app/features/design-system/design-system.a11y.spec.ts` runs axe-core with the tags `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa` and `wcag22aa` on:

- the whole `/design-system` catalog (every core component) in the light theme, in the dark theme, and in each density;
- the catalog with the dialog, the drawer and the destructive confirmation open, in both themes;
- the header appearance switcher, open, in both themes;
- the toast regions with a success and an error toast, in both themes.

The suite expects zero violations. A last test feeds axe an unlabelled input and expects a violation, so the audit
cannot pass by running no rules.

### What the audit cannot see, and what covers it

jsdom has no layout engine. Three axe rules give no reliable answer there and are switched off in
`src/testing/axe.ts`; each one has another check:

| Rule | Covered by |
| --- | --- |
| `color-contrast` | the token spec computes every foreground and background pair of both themes with the WCAG formula, including translucent tints composed over the surface |
| `target-size` | the 24px minimum is a token, asserted for every density profile, and applied by `_a11y.scss` |
| `region` | the fixtures are components, not pages; the shell provides the landmarks |

Not covered by any automated test, and to be checked by a person before a release: real screen reader behaviour
(NVDA, VoiceOver), zoom to 400% (1.4.10), text spacing (1.4.12), and the NG-ZORRO screens that are not in the catalog.
Run the browser axe extension on those screens in both themes and in the three densities.

## Rules for new code

- Use `app-form-field` around every control; never rely on a placeholder as the label.
- Icon-only buttons need an accessible name (`ariaLabel` or `appIconAction`).
- A message that appears after an action goes through `ToastService`, `app-alert` or a form error, not a bare `div`.
- Use semantic colour tokens only; never a literal colour, never a colour pair that is not in the token spec.
- Do not remove the focus outline. Do not set `tabindex` above 0.
- A new overlay uses `app-modal` (focus trap and return) instead of hand-made markup.
