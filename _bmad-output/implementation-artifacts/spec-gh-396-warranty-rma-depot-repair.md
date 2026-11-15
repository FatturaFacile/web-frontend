---
title: 'GH-396 Warranty lookup, RMA depot-repair bench, passports, loaners, vendor claims and public estimate page (web frontend)'
type: 'feature'
created: '2026-11-15'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The web app has no UI for warranty checks by serial number, depot repair (RMA) handling, equipment passports, loaner units, vendor claim-backs, nor a public page where a customer accepts/declines a repair estimate or tracks an RMA. The backend slice (Module 17 ServiceManagement, `api/v1/esm/...` and `api/v1/public/rma/...`) is specified in `web-api` story `spec-gh-396-warranty-rma-depot-repair.md`, which is the binding contract. Source: FatturaFacile/FatturaFacile#396 (Mod 150).

**Approach:** Add a lazy feature `src/app/features/warranty-rma` (authenticated, sidebar group under Operations) with: serial lookup + RMA issue (label view/print), repair bench Kanban + RMA detail drawer with transition actions, passport list/detail (warranty, genealogy, extensions), loaner register, vendor claims list; plus two unauthenticated routes (`rma-estimate/:token`, `rma-tracking`). One typed API service and models in `core`, signal stores per page, i18n in the 4 locale files, vitest unit tests. Frontend only.

## Boundaries & Constraints

**Always:**
- Follow `CLAUDE.md`: standalone components (no `standalone: true`), signals, `@if/@for`, `input()/output()`, no `ngClass/ngStyle`, no `CommonModule`, host bindings in `host`, `@Service()` for singleton services, Signal Forms (or Reactive forms) for forms, lazy routes, AXE/WCAG AA (labelled controls, focus return when drawer/modal closes, status never conveyed by colour alone).
- All HTTP through `environment.apiBaseUrl` (`/esm/...`, `/public/rma/...`); tenant/auth headers are added by `tenantAuthInterceptor`, never set manually. Backend envelope is `{data, meta}` / `{message, data}` (no `success` flag): use dedicated `Esm*` envelope types, not `ApiResponse`.
- Backend errors: 409 `invalid_transition` / `already_decided` and 404 `serial_not_found` / `passport_missing` are mapped to translated messages via `code`; 422 bound to forms with `applyServerErrors`.
- Raw tokens (`estimate_token`, `tracking_token`, `estimate_url`, `tracking_url`) are shown once, never persisted to storage or logged; public pages never request or render internal costs/notes.
- All user-visible text via i18n keys (it, en, de, fr); money via `currencyFormat` pipe honouring the RMA `currency` (EUR/CHF); dates ISO from API.
- Actions offered per RMA status mirror the backend state machine (client-side map is only a UI hint; backend remains authoritative).

**Never:**
- Mobile (Flutter) work, backend changes, PDF/DDT generation, accounting UI, drag-and-drop status changes on the Kanban (transitions need payloads), new npm dependencies, changes to the mock `FieldServiceApiService`.
- Setting `Authorization`/tenant headers by hand on public calls; storing tokens in localStorage.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Lookup in warranty | serial with passport | card with status tag, expiry, days remaining, policy, basis, RMA history; "Issue RMA" enabled | N/A |
| Lookup unknown serial | 404 `serial_not_found` | inline "serial not found" + link to create passport | N/A |
| Passport missing | 404 `passport_missing` with `stock_hint` | message + prefilled "Create passport" action | N/A |
| Issue RMA | symptom + threshold | label dialog (barcode payload, tracking URL/token shown once), print button | 422 shown on fields |
| Out-of-warranty diagnosis | total above threshold | card moves to Awaiting estimate approval; `estimate_url` shown once with copy button | 409 toast, board reload |
| Resend estimate | RMA awaiting approval | new `estimate_url` shown once | 409 toast |
| Illegal transition | stale board | 409 `invalid_transition`: toast, board + drawer reloaded | N/A |
| Loaner overdue | `is_overdue` true | row/card flagged with icon + text "Overdue Nd", filter `overdue=1` | N/A |
| Public estimate valid | token ok | read-only estimate, accept (name required) / decline | N/A |
| Public bad/expired token | 404 | neutral "link invalid or expired" page (no detail) | no retry loop |
| Public already decided | 409 `already_decided` | show current decision, buttons disabled | N/A |

</frozen-after-approval>

## Decisions / open questions

Autonomous run, no human available; none blocks implementation. Revisit at approval.

1. Mobile (Flutter) part of the issue is out of scope for this repo; recorded as a decision. Backend `receive` (condition photos) and `lookup` are mobile-ready; web `receive` supports notes and photo URLs/asset ids only.
2. Route layout: `/warranty-rma/{lookup,bench,passports,passports/:id,loaners,vendor-claims}` (`authGuard`); public: `/rma-estimate/:token` and `/rma-tracking?rma=&token=` (no guard). The backend spec fixes `tracking_url` as `{APP_FRONTEND_URL}/rma-tracking?rma=...&token=...` but not the `estimate_url` path: assumed `{APP_FRONTEND_URL}/rma-estimate/{token}`; backend story should confirm.
3. Public pages inside the shell: `AppComponent` renders the layout whenever authenticated; public routes carry `data: { publicPage: true }` and `AppComponent` renders a bare outlet for them so staff previewing a link see the customer view.
4. Data layer: follow the majority convention (`core/api/*-api.service.ts` + `core/models/*.model.ts`, exported through `@core`) rather than the `domain/data-access` repository layering; page state in `@ngrx/signals` stores (pattern of `time-attendance.store.ts`) under `features/warranty-rma/state/`.
5. Barcode on the label: no new dependency; a tiny pure Code128-B SVG generator in `shared/utils/code128.ts` (unit-tested) renders `barcode_payload`; printing via `window.print()` with `@media print` styles on the label dialog.
6. Kanban refresh is manual (button) plus reload after every action; no polling/websocket. Columns = the 7 non-cancelled statuses from `GET /rma-orders/board` (issue lists 6 columns; backend adds `returned`/`closed`, shown behind the `include_closed` toggle). Labels come from i18n keyed by status, not from the API `label`.
7. Diagnosis form lines are an editable table (part/labour, qty, unit cost, unit price, defective part serial, supplier id as free text/uuid input until a supplier lookup is wired; reuse `lookup-select` only if a supplier lookup exists).
8. Permissions: no per-action permission model exists in the frontend; `goodwill` toggle is always shown and the backend rejects (403/422) when not allowed.
9. Existing `FieldServiceApiService`/`/field-service` mock pages stay untouched; new group is separate, not nested under them.
10. Currency from RMA `currency`; no CHF/EUR tenant setting read on the web side.

## Code Map

- `src/app/app.routes.ts` -- add `warranty-rma` (authGuard, lazy `WARRANTY_RMA_ROUTES`) and public routes `rma-estimate/:token`, `rma-tracking` before `**`.
- `src/app/app.component.{ts,html}` -- bare outlet when active route has `data.publicPage` (decision 3); extend `app.component.spec.ts`.
- `src/app/layout/sidebar/sidebar.component.ts` -- add menu group `NAV.WARRANTY_RMA` in `NAV.SECTION_OPERATIONS` after `NAV.FIELD_SERVICE` (pattern lines ~146-160: `key`, `icon` FontAwesome, `children[{key,route,icon}]`); `groupOf` accordion works from child routes.
- `src/app/features/field-service/*` -- reference only (routes with `data:{breadcrumb,title}`, `PageHeaderComponent`, `nz-card`/`nz-table`, `TranslatePipe`); `features/time-attendance/state/*.store.ts(.spec)` -- signalStore + vitest mock pattern.
- `src/app/core/api/field-service-api.service.ts`, `core/api/api-endpoints.spec.ts` -- API service shape (`@Service()`, `inject(HttpClient)`, `environment.apiBaseUrl`) and HttpTestingController test pattern.
- `src/app/core/http/laravel-http.utils.ts` -- `toHttpParams`, `applyServerErrors`, `isValidationError`; `core/models/api.models.ts` -- `LaravelPaginationMeta`; `core/index.ts`, `core/models/index.ts` -- barrels to extend.
- `src/app/core/interceptors/{tenant-auth,error,csrf-refresh}.interceptor.ts` -- headers/401/422/419 handling already global; public calls pass through unchanged (404/409 are not toasted by interceptors except non-422 via `errorInterceptor`: verify it does not redirect on public pages).
- `src/app/core/auth/auth.guard.ts` -- `authGuard` for protected routes.
- `src/app/shared` (`PageHeaderComponent`, `TranslatePipe`, `currencyFormat`, `date.utils`) -- reuse; `@angular/cdk` and `ng-zorro-antd` (drawer, modal, tag, steps, descriptions, tabs, table, badge) available.
- `public/assets/i18n/{it,en,de,fr}.json` -- flat `NAV.*`, `COMMON.*` plus feature prefix keys (e.g. `FIELD_SERVICE.*`); add `NAV.WARRANTY_RMA*` and `RMA.*` to all four (keep keys sorted).
- Backend contract: `web-api` spec `spec-gh-396-warranty-rma-depot-repair.md` ("REST contract", "Public contract", enums, transitions).

## Tasks & Acceptance

**Execution:**
- [ ] `src/app/core/models/warranty-rma.model.ts` + export in `core/models/index.ts` -- types: `EsmEnvelope<T>`, `EsmPaginated<T>`, enums as string unions (`RmaStatus`, `WarrantyStatus`, `EstimateApprovalStatus`, `WarrantyPolicyType`, `VendorClaimStatus`, `LoanerRegisterType`, `DdtCausale`), `EquipmentPassport`, `EquipmentComponent`, `WarrantyExtension`, `WarrantyEvaluation`, `RmaOrder`, `RmaLine`, `RmaBoard*`, `RmaLabel`, `Loaner`, `VendorClaim`, public estimate/tracking DTOs, request payloads -- mirrors backend resources.
- [ ] `src/app/core/api/warranty-rma-api.service.ts` + export in `core/index.ts` -- `@Service()` with passport (list/create/get/update/addExtension/genealogy/lookup), RMA (list/create/get/label/trackingToken/board + receive, diagnosis, approve/decline estimate, resendEstimate, partsReceived, completeRepair, return, close, cancel), loaners (list/issue/return/markLost), vendor claims (list/get/patch/transition); separate `PublicRmaApiService` for `/public/rma/estimates/{token}` (get/accept/decline) and `/public/rma/tracking`.
- [ ] `src/app/features/warranty-rma/warranty-rma.routes.ts` + `src/app/app.routes.ts` -- lazy children with breadcrumb/title data; public routes without guard.
- [ ] `src/app/features/warranty-rma/utils/rma-status.ts` -- status->allowed-actions map, status/warranty/claim tag colour+icon+i18n key helpers, `isLoanerOverdue`/days helpers; pure.
- [ ] `src/app/features/warranty-rma/state/{rma-board,rma-detail,passport,loaner,vendor-claim}.store.ts` -- signalStores (load, filters, action methods that reload on success and on 409).
- [ ] `src/app/features/warranty-rma/components/serial-lookup/*` and `rma-label-dialog/*` -- lookup form, warranty card, RMA history, issue-RMA modal, label view with Code128 SVG and print.
- [ ] `src/app/features/warranty-rma/components/rma-board/*` and `rma-detail-drawer/*` and action dialogs (`receive`, `diagnosis` with lines table, `complete-repair` with replaced components, `return`, `cancel`, estimate resend/approve/decline-on-behalf) -- Kanban columns with count badges, card (serial, customer, warranty tag, estimate status, age, loaner/overdue icon), drawer with tabs (summary, lines, history, loaner, claims), status-dependent action buttons, once-only token reveal with copy.
- [ ] `src/app/features/warranty-rma/components/{passport-list,passport-detail}/*` -- list with filters (serial, customer, jurisdiction, in/out warranty); detail with warranty block, extensions (add-extension modal), genealogy tabs as-built / as-maintained / history.
- [ ] `src/app/features/warranty-rma/components/{loaner-register,vendor-claims}/*` -- loaner table with register-type and overdue filters, return / mark-lost confirm; claims table with filters, edit reference/notes, status transition dialog (only legal next states offered).
- [ ] `src/app/features/warranty-rma/public/{rma-estimate,rma-tracking}.component.ts` -- standalone customer pages (estimate review, accept/decline with name, tracking steps), responsive, no shell.
- [ ] `src/app/shared/utils/code128.ts` -- Code128-B encoder to bar widths/SVG string.
- [ ] `src/app/layout/sidebar/sidebar.component.ts`, `src/app/app.component.{ts,html}`, `public/assets/i18n/{it,en,de,fr}.json` -- menu, public-shell switch, translations.
- [ ] Tests (vitest, `*.spec.ts` next to sources): `warranty-rma-api.service.spec.ts` (URLs, methods, params, public calls), `rma-status.spec.ts`, `code128.spec.ts`, each store spec (mocked API with `vi.fn()`, 409 reload, once-only token not retained after dismiss), `rma-board`/`rma-estimate` component specs (columns render, overdue flag, accept/decline/404/409 states), sidebar/app.component public-route spec.

**Acceptance Criteria:**
- Given a serial with a passport, when it is looked up, then warranty status, expiry, days remaining, policy and RMA history render, and "Issue RMA" opens a form that on success shows the label with barcode and tracking URL once.
- Given RMAs in several statuses, when the bench opens, then one column per status with counts is shown and each card offers only the actions legal for its status; an action that returns 409 reloads the board and informs the user.
- Given an out-of-warranty diagnosis above the threshold, then the `estimate_url` is displayed once and the card sits in Awaiting estimate approval; resend produces a new URL.
- Given a covered RMA diagnosis, then lines show `warranty_provision`, customer total 0.00 and vendor claims appear in the drawer and claims list.
- Given an `issued` loaner past its grace, then it is flagged overdue (icon + text) in register, card and drawer, and `overdue=1` filters it; return and mark-lost update the register.
- Given a vendor claim, then only legal next transitions are offered and `approved_credit_note` requires a credit note reference.
- Given a valid estimate token and no session, when the customer opens `/rma-estimate/:token`, then the estimate (no costs/notes) is shown and accept/decline work; invalid or expired tokens show a neutral page; repeat decisions show the existing decision.
- Given the four locales, then no new key is missing; routes are lazy, menu entry highlights the active child, and `ng build`, `eslint` and `vitest run` pass.

## Implementation Notes

(Agent-owned; empty at planning time.)

## Spec Change Log

## Review Triage Log

## Design Notes

Status -> UI actions (hint only): `awaiting_arrival`: receive, cancel; `in_diagnosis`: diagnosis, cancel; `awaiting_estimate_approval`: approve/decline on behalf, resend; `awaiting_parts`: parts-received; `in_repair_testing`: complete-repair; `ready_for_return`: return; `returned`: close (loaner stays in register). Unknown future statuses render without actions (forward compatible).

Token reveal pattern: action response `estimate_url`/`tracking_token` is held in a component-local signal, shown in a modal with copy, and cleared on close.

## Verification

**Commands:**
- `pnpm test` (`vitest run`) -- expected: all green, new specs included
- `pnpm lint` -- expected: no errors
- `pnpm build` -- expected: production build succeeds, `warranty-rma` emitted as lazy chunk

**Manual checks (if no CLI):**
- Against a backend with the 396 slice (or proxy): lookup, issue RMA, walk one RMA across the board to `closed`, open the public estimate link in a private window; check keyboard navigation and AXE on drawer and public pages; switch locale and verify labels.
