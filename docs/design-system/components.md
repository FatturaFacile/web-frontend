# Core components

All live in `src/app/shared/ui/`, are standalone, take signal inputs and use only `--ff-*` tokens. Import the class you
use (`@shared/ui/<name>/<name>.component`). Every visible string is passed in already translated: components never
contain text of their own except `app-modal` and `app-toast-host`, which translate the "Close" and "Dismiss" labels with
the keys `DESIGN_SYSTEM.CLOSE` and `DESIGN_SYSTEM.DISMISS`.

| Component | Use | Accessibility built in |
| --- | --- | --- |
| `app-button` | `variant` primary, secondary, danger, ghost; `loading`, `disabled`, `block`, `ariaLabel` | Native `<button type="button">`; `loading` sets `aria-busy` and ignores clicks; 24px minimum target; icon-only needs `ariaLabel` |
| `app-form-field` | `label`, `hint`, `error`, `required` around one control | Label bound with `for`; hint and error linked by `aria-describedby`; the error is in a polite live region that exists from the start; `aria-invalid` and `aria-required` set on the control |
| `app-input` | Text, email, password, search, tel, url, number; two-way `[(value)]` | Takes id and description from the field; native `autocomplete` and `inputmode` |
| `app-select` | Native select with `options`, optional `placeholder`; `[(value)]` | Platform keyboard and screen reader behaviour |
| `app-card` | A grouped surface; `heading` makes it a labelled region | `section` with `aria-labelledby` |
| `app-badge` | Status label, `tone` neutral, primary, success, warning, danger, info | Text carries the meaning; colours are token pairs with 4.5:1 |
| `app-alert` | Inline message with `tone` and `heading` | `role="alert"` for danger, `role="status"` otherwise; icon plus title plus colour |
| `app-empty-state` | `heading`, `description`, `icon`, projected next step | Real heading; the icon is decorative |
| `app-data-table` | `caption`, `columns`, `rows`, empty slot `appDataTableEmpty` | `caption`, `th scope="col"`, focusable scroll region with a name; row height follows density |
| `app-modal` | Dialog (`placement="center"`) or drawer (`placement="end"`); `[(open)]`, `heading`; footer buttons in `appModalFooter` | `role="dialog"`, `aria-modal`, named by its title, focus trapped, Escape, backdrop and close button, focus returns to the opener |
| `app-toast-host` + `ToastService` | Short feedback after an action: `success()`, `error()`, `show()` | Polite `status` region and `alert` region present from the start; errors stay until dismissed; the countdown pauses on hover and focus |

Use the NG-ZORRO table for sorting, selection and virtual scrolling; `app-data-table` is for compact summaries.

## Example

```html
<app-form-field [label]="'INVOICE.CUSTOMER' | translate" [error]="customerError()" required>
  <app-input [(value)]="customer" autocomplete="organization" />
</app-form-field>

<app-modal [(open)]="confirmOpen" [heading]="'INVOICE.DELETE_TITLE' | translate">
  <p>{{ 'INVOICE.DELETE_BODY' | translate }}</p>
  <div appModalFooter>
    <app-button variant="secondary" (click)="confirmOpen.set(false)">{{ 'COMMON.CANCEL' | translate }}</app-button>
    <app-button variant="danger" (click)="remove()">{{ 'INVOICE.DELETE_ACTION' | translate }}</app-button>
  </div>
</app-modal>
```

## Adding a component

1. Standalone component in `src/app/shared/ui/<name>/`, selector `app-<name>`, inputs with `input()`, styles from tokens.
2. Export it from `src/app/shared/index.ts`.
3. Add it to `/design-system` and to the audit in `design-system.a11y.spec.ts` (nothing else is needed: the catalog
   page is what is audited, in both themes and every density).
4. Add a behaviour spec in `ui-components.spec.ts` for what axe cannot see: ids, roles, keyboard, focus.
