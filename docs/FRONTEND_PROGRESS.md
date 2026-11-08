# FatturaFacile ERP - Frontend Implementation Progress

## Architectural Conventions & Stack Overview

- **Angular Version:** 22.2.4 (Standalone components exclusively; no `standalone: true` decorator flag per Angular v20+ default; `OnPush` default in v22+).
- **UI Framework:** `ng-zorro-antd` v22.1.2 with custom styling in `src/styles.scss` and `src/theme.less`.
- **State Management:** Angular Signals (`signal`, `computed`, `effect`, `linkedSignal`) and `@ngrx/signals` Signal Stores (`AuthStore`, `AppStore`).
- **HTTP & API Integration:**
  - Base URL: `/api/v1` with relative routing via local development proxy (`proxy.conf.json`).
  - Single central interceptor pipeline: credentials (`withCredentials: true`), CSRF refresh (`X-XSRF-TOKEN`), tenant/user headers (`X-Tenant-Id`, `X-User-Id`, `X-Language-Code`, `Accept: application/json`), and RFC 7807 Problem Details error handler.
  - OpenAPI Code Generation: `openapi-typescript` targeting `src/app/core/api/generated/schema.d.ts` from `../web-api/docs/api/openapi.json`.
  - Modules exposed via dedicated API services (`<module>-api.service.ts`) providing strictly typed responses.
- **Forms & Validation:** Typed Reactive Forms (`NonNullableFormBuilder`) using `applyServerErrors(form, err)` to display backend 422 validation errors via `nzErrorTip`.
- **Monetary & Quantities Conventions:** Monetary values handled as decimal strings (never calculated using `parseFloat`/`Number` on the client), formatted using `MoneyPipe` (`Intl.NumberFormat`). Warehouse movements distinguish `quantity` (positive) and `signed_quantity` (signed).
- **Testing:** Vitest 5.0.5 unit test runner (`pnpm run test`, `pnpm test --run`).

---

## Module Coverage Matrix

| # | Module / Tag | Total Endpoints | Covered Endpoints | Pages (List, Detail, Form, Actions) | Tests | Status | Notes |
|---|---|---|---|---|---|---|---|
| **01** | **Foundations & Auth** | 18 | 18 | Login, Register, Verify Email, Reset Password, 2FA Wizard, Sessions Security | 45+ | **Done** | Cookie auth, 2FA challenge/confirm, sessions table, RFC 7807 interceptors |
| **02** | **Tenant Settings & Admin** | 12 | 12 | Tenant Profile Form, Branches, Members, Roles, Audit Logs, 2FA Policy | 18 | **Done** | Covered tenant settings, branches, exchange rates sync, roles, audit logs, 2FA policy & reset |
| **03** | **Anagrafiche (Master Data)** | 35 | 30 | Clients table, Suppliers table, Contact drawer, Products, Warehouses, Price Lists | 24 | **Done** | Covered `/crm/contacts`, `/crm/clients`, `/crm/suppliers`, `/inventory/products`, `/inventory/warehouses`, `/catalog/price-lists`, `resolvePrice` |
| **04** | **CRM & Cross-Border** | 45 | 38 | CRM Contacts, Clients, Suppliers, Leads scoring, Pipeline Kanban & Stages, Duplicates scan & merges, Consents | 20 | **Done** | Covered `/crm/contacts`, `/crm/leads`, `/crm/opportunities`, `/crm/pipeline-stages`, `/crm/duplicates`, `/crm/contact-merges`, `/crm/consents` |
| **05** | **Helpdesk & Ticketing** | 15 | 12 | Ticket List (server filters), Ticket Detail Drawer (3 tabs), Create Drawer, Action Modals | 18 | **Done** | Covered `/v1/esm/tickets` CRUD, status, assign, resolve, close, reopen, messages, activities |
| **06** | **Projects & Field Service** | 32 | 26 | Projects list & lifecycle (start, pause, complete, close), Detail Drawer, Tasks & WBS, Timesheets & approval workflow, EVM indicators | 14 | **Done** | Covered `/projects` CRUD + lifecycle, `/projects/{id}/tasks`, `/projects/{id}/timesheets`, `/projects/{id}/financial-summary`, `/projects/{id}/recalculate-evm` |
| **07** | **Asset Management (`/eam`)** | 28 | 24 | Fixed Assets table, Parallel Books (statutory/tax/managerial), Depreciation Schedules, QR tag generator (nz-qrcode), Maintenance work orders | 16 | **Done** | Covered `/eam/assets` CRUD & lifecycle, `/eam/assets/{id}/books`, `/eam/assets/{id}/depreciation-schedules`, `/eam/assets/{id}/tag`, `/eam/depreciation/runs`, `/eam/maintenance/work-orders` |
| **08** | **Subscriptions (`/sub`)** | 22 | 18 | Plans catalog, Contract table & lifecycle (renew/pause/resume/cancel), MRR/ARR/churn metrics, Dunning trigger | 8 | **Done** | Covered `/sub/contracts`, `/subscriptions/plans`, `/subscriptions/metrics`, `/subscriptions/dunning` |
| **09** | **Inventory & Logistics** | 38 | 28 | Stock balances, Signed movements, Transfer modal, Adjustments approve/reject, Physical counts reconcile, Valuation summary | 23 | **Done** | Covered `/inventory/stock-levels`, `/inventory/movements`, `/inventory/movements/transfer`, `/inventory/adjustments`, `/inventory/counts`, `/inventory/valuation` |
| **10** | **Sales & Orders** | 42 | 26 | Quotes list & approval workflow, Orders list & lifecycle (reserve, DDT, invoice), Delivery notes list (dispatch, confirm) | 12 | **Done** | Covered `/invoicing/quotes`, `/invoicing/orders`, `/invoicing/delivery-notes`, convert/reserve/invoice actions |
| **11** | **Invoicing & SDI** | 52 | 8 | Electronic Invoices (IT/CH), Credit Notes, SDI send bulk, Swiss QR-Bill | 12 | **Todo** | Server assigns invoice numbering strictly |
| **12** | **Procurement & AP** | 36 | 4 | Purchase Requests, RfQ, Purchase Orders, Goods Receipt, AP Invoices matching | 6 | **Todo** | Backend evolving; sync OpenAPI before starting |
| **13** | **Treasury & Banking** | 40 | 8 | Bank Accounts, Statements, Reconciliation, Categorization, Cash flow schedule | 10 | **Todo** | Backend evolving; sync OpenAPI before starting |
| **14** | **General Ledger & Accounting**| 48 | 6 | Chart of Accounts, Journal Entries (`/general-ledger/journals`), Fiscal periods, VAT, Intrastat | 10 | **Todo** | Use `/general-ledger/journals` |
| **15** | **Manufacturing & MRP** | 26 | 0 | Bill of Materials (BOM), Production Orders, Routing cycles, MRP runs | 0 | **Todo** | Backend evolving; sync OpenAPI before starting |
| **16** | **HR & Payroll (IT/CH)** | 30 | 2 | Employees, Employment Contracts, Attendance records, Leave requests, Payslips | 4 | **Todo** | Backend evolving; sync OpenAPI before starting |
| **17** | **Verticals & Minor Modules** | 65 | 0 | Retail/POS, Automotive/Workshop, Construction, Fleet Rent, Legal Practice, Documents | 0 | **Todo** | Covers remaining industry specific tags |
| **18** | **Final Polish & Dashboards** | 15 | 4 | Executive Dashboard KPIs, Global Search, Accessibility & WCAG AA audits | 8 | **Todo** | Performance & accessibility verification |

---

## Autonomous Execution Queue

1. `[DONE]` **Module 01: Foundations & Auth**
2. `[DONE]` **Module 05: Helpdesk & Ticketing (`/v1/esm/tickets`)**
3. `[DONE]` **Module 02: Tenant Settings & Administration**
4. `[DONE]` **Module 03: Anagrafiche (Master Data)**
5. `[DONE]` **Module 04: CRM (Pipeline, Duplicates, Leads)**
6. `[DONE]` **Module 06: Projects (Tasks, Gantt, Timesheets)**
7. `[DONE]` **Module 07: Asset Management (`/eam`)**
8. `[DONE]` **Module 08: Subscriptions (`/sub/contracts`)**
9. `[DONE]` **Module 09: Inventory & Logistics**
10. `[DONE]` **Module 10: Sales & Orders**
11. `[NEXT]` **Module 11: Invoicing & SDI**
12. `[TODO]` **Module 12: Procurement & AP**
13. `[TODO]` **Module 13: Treasury & Banking**
14. `[TODO]` **Module 14: General Ledger & Accounting**
15. `[TODO]` **Module 15: Manufacturing & MRP**
16. `[TODO]` **Module 16: HR & Payroll**
17. `[TODO]` **Module 17: Verticals & Minor Modules**
18. `[TODO]` **Module 18: Final Polish & KPI Dashboards**
