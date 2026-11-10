# Frontend Implementation Progress & Coverage Matrix

Last updated: 2026-11-09

## Measured API coverage (source of truth)

The matrix below was written by hand and overstates the state. The real figure is measured against `web-api/docs/api/openapi.json` with `node scripts/api-coverage.mjs ../web-api/docs/api/openapi.json src/app [full]` (an endpoint counts as covered when its path appears in a non-spec .ts file under `src/app`; non-deprecated operations only; template-built URLs are not seen).

| Date | Covered | Total | % |
|---|---|---|---|
| 2026-11-09 (before this pass) | 821 | 2135 | 38% |
| 2026-11-09 (after: sales/CRM, inventory/procurement/manufacturing, ledger/treasury/assets/projects, HR/payroll) | 1605 | 2135 | 75% |
| 2026-11-10 (after: associations, ESM/helpdesk, customs/construction/childcare/retail, payroll/HR compliance, exports) | 2129 | 2151 | 99% |

Still uncovered (22): the 7 server-to-server webhooks and callbacks (SDI, e-commerce, payment links, incoming invoices), the Swagger/docs routes, the deprecated legacy `/subscriptions/{id}/*` routes (the page uses `/sub/contracts`), and a few meeting/ballot actions on the member area that still need a page. Most pages for the newest areas are config-driven (`shared/ui/resource-panel`); where the API has no list endpoint a row id is typed in by hand.

Pages in the inventory, procurement, purchases and manufacturing areas run on a config-driven panel (`shared/ui/resource-panel`, page configs in `features/*/*.page.ts`) rather than bespoke typed components; many list responses are `any` in the OpenAPI, so their columns are inferred. The older `inventory`, `purchases` and `manufacturing` components were not adapted to the new backend rules (BOM draft/activate, `signed_quantity`, bin-to-bin transfers).

---

## Architectural Conventions
- **Angular:** v22 Standalone Components (strictly no `standalone: true`, default `ChangeDetectionStrategy.OnPush`, inject() dependency injection, signals & computed for local/shared reactive state).
- **Styling & UI:** `ng-zorro-antd` v22, responsive layouts with `nz-layout`, `nz-table` (server-side pagination `nzFrontPagination=false`), `nz-form`, `nz-modal`, `nz-drawer`, `nz-dropdown`, `nz-tabs`.
- **Icons:** Only icons registered in `src/app/icons-provider.ts` are used across templates and tests.
- **Amounts & Currency:** Kept as string/number representations without floating point arithmetic; formatted strictly using `MoneyPipe` and Angular currency/decimal formatters.
- **QR Codes:** Implemented using `NzQRCodeComponent` (`nz-qrcode`) from `ng-zorro-antd/qr-code`.
- **API Communication:** Relative URLs via proxy `/api/v1`, Sanctum cookie authentication, `withCredentials: true`, multi-tenant headers (`X-Tenant-Id`, `X-User-Id`, `X-Language-Code`), RFC 7807 problem+json error handling.

---

## Coverage Matrix

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
| **11** | **Invoicing & SDI** | 52 | 24 | Invoices table, Electronic Invoices (IT/CH), SDI FatturaPA XML generate, Bulk SDI send, SDI logs, Credit Notes, Installments, Swiss QR-Bill (nz-qrcode) | 16 | **Done** | Covered `/sales/invoices` lifecycle, SDI transmission & logs, `/invoicing/credit-notes`, `/invoicing/invoices/{id}/installments`, `/sales/invoices/{id}/qr-bill` |
| **12** | **Procurement & AP** | 36 | 28 | Purchase Orders lifecycle, Goods Receipts & inspection, 3-Way Matching & variance approval, Supplier Invoices & SDI/QR-Bill import | 15 | **Done** | Covered `/procurement/purchase-orders`, `/procurement/goods-receipts`, `/procurement/three-way-match`, `/purchases/supplier-invoices`, `/purchases/passive-invoices/import-sdi` |
| **13** | **Treasury & Banking** | 40 | 32 | Bank accounts CRUD, CAMT/CBI import & auto-reconcile, Statement reconciliation, Payment batches (pain.001 / RiBa) export/XML, Cash flow forecasts | 13 | **Done** | Covered `/treasury/bank-accounts`, `/treasury/transactions`, `/treasury/import-camt`, `/treasury/payment-batches`, `/treasury/cash-forecasts` |
| **14** | **General Ledger & Accounting**| 48 | 34 | Chart of Accounts, Journal Entries (`/general-ledger/journals`), Fiscal periods, VAT Settlements, Intrastat Declarations, Trial Balance | 13 | **Done** | Covered `/general-ledger/journals` (post/reverse), `/general-ledger/accounts`, `/fiscal-periods`, `/tax-settlements`, `/intrastat/declarations`, `/financial-statements/trial-balance` |
| **15** | **Manufacturing & MRP** | 26 | 22 | Production Orders lifecycle, BOMs (revisions, explode, activate), MRP runs & planned orders convert, Work Centers & Routings | 11 | **Done** | Covered `/v1/manufacturing/production-orders` (release/start/complete/close/cancel), `/v1/manufacturing/boms` (activate/revise/explode), `/v1/manufacturing/mrp` (runs, planned-orders convert, shortages), `/v1/manufacturing/work-centers`, `/v1/manufacturing/routings` |
| **16** | **HR & Payroll (IT/CH)** | 30 | 22 | Employees lifecycle (hire, confirm probation, promote, terminate), Leave requests (approve/reject), Timesheets approval, Monthly Payroll runs, IT/CH Frontier workers | 9 | **Done** | Covered `/v1/hr/employees` (probation/promote/terminate), `/v1/hr/leave-requests` (approve/reject), `/v1/hr/timesheets` (approve), `/v1/payroll/runs`, `/v1/payroll/frontier-workers` |
| **17** | **Verticals & Minor Modules** | 65 | 40 | Retail/POS telematic documents & daily corrispettivi, Automotive tire hotel check-in/out, Construction SAL progress billings, Fleet Rent bookings & check-in, Legal cases & time logs | 13 | **Done** | Covered `/v1/fiscal-retail/commercial-documents`, `/v1/fiscal-retail/corrispettivi`, `/v1/automotive/tire-hotel`, `/v1/construction/sal`, `/v1/rent/bookings`, `/v1/professionals/time-logs` |
| **18** | **Final Polish & Dashboards** | 15 | 15 | Executive Dashboard KPIs, Cash Flow & Tax Deadlines, Global Search, Accessibility & WCAG AA audits, Full test suite | 3 | **Done** | Covered `/v1/dashboard/kpi-summary`, `/v1/dashboard/cash-flow-forecast`, `/v1/dashboard/tax-deadlines`, 77/77 test suites passing (444 unit tests) |
| **19** | **Customs & Logistics (/customs)** | 66 | 66 | Customs Dossiers, Declarations, Assessment Decisions (eVV), Tariff Grids, Shipments, Profitability | 10 | **Done** | Covered /customs/dossiers, /customs/declarations, /customs/assessment-decisions, /customs/tariff-grids, /customs/shipment-requests |
| **20** | **Approval Workflows (/workflows)** | 23 | 23 | Tasks Inbox, Running Instances, Process Definitions, Out-of-Office Delegations, Escalation Rules, SLA Metrics, SHA-256 Audit Trail | 12 | **Done** | Covered /workflows/my-tasks, /workflows/my-pending, /workflows/steps/{id}/decide, /workflows/instances, /workflows/definitions, /workflows/delegations, /workflows/escalation-rules, /workflows/sla-report |
| **21** | **Document Management (/dms)** | 37 | 37 | Document Explorer, Folders Hierarchy, SHA-256 Versioning, Legal Hold, OCR Extractions, Linked ERP Entities, Retention Policies | 11 | **Done** | Covered /dms/documents, /dms/folders, /dms/tags, /dms/retention-policies, /dms/documents/{id}/versions, /dms/documents/{id}/check-out, /dms/documents/{id}/legal-hold, /dms/documents/{id}/links, /dms/documents/{id}/extractions, /dms/ai-settings |
| **22** | **Contract Register (/contract-register)** | 23 | 23 | Active & Passive Contracts, Term Renewals, Termination Notices, Obligations Schedule, Milestone Tracking, Alert Notifications | 11 | **Done** | Covered /contract-register, /contract-register/{kind}/{id}/terms, /contract-register/{kind}/{id}/renew, /contract-register/{kind}/{id}/notice, /contract-register/{kind}/{id}/parties, /contract-register/obligations, /contract-register/alerts |
| **23** | **Associations & Third Sector (/associations)** | 216 | 216 | Members Register, Fees & Collections, Sports Courses, Donations & 5x1000, RUNTS Volunteers, Expense Reimbursements, General Meetings | 12 | **Done** | Covered /associations/members, /associations/fee-assignments, /associations/courses, /associations/donations, /associations/five-per-mille, /associations/volunteers, /associations/reimbursements, /associations/meetings |
| **24** | **Automotive Workshop & Job Cards (/automotive/workshop)** | 18 | 18 | Repair Orders, Job Lines & Spare Parts, Mechanic Time Tracking & Billing, Vehicle History, Vehicle Stock & Sales, Scheduled Maintenance | 13 | **Done** | Covered /workshop/folders, /workshop/folders/{id}/lines, /workshop/folders/{id}/status, quote/DDT/invoice conversions, /time-entries, /vehicle-stock, /recurring-services |
| **25** | **Childcare & Early Childhood Education (/childcare)** | 41 | 41 | Children Registry, Groups & Sections, Daily Attendance Register, Daily Log Diary, Fee Plans & Monthly Billing, Document Requirements & Digital Signature | 12 | **Done** | Covered /childcare/children, /groups, /attendances/check-in/check-out/absence/register, /notes, /daily-report, /fee-plans, /billing/runs, /bills, /document-requirements, /childcare-family |
| **26** | **Construction Trades & Cantieri Edili (/construction & /construction-trades)** | 37 | 37 | Sites, Progress Billings (SAL), Tender Bids, Bill of Quantities & Measurements, Site Diary, Safety Documents (POS/DURC), Subcontracts & Certifications | 9 | **Done** | Covered /construction/sites, /sal, /construction-trades/bids, /positions, /measurements, /billings, /site-costs, /budget-control, /sites/{id}/diary, /sites/{id}/documents, /subcontractors, /subcontracts |
| **27** | **Hospitality & POS Comande (/hospitality)** | 20 | 20 | Dining Rooms & Tables Layout, Table Orders, Kitchen Display System (KDS), Course Firing, Pre-Bill Printing, Order Payment, Reservations & Seating | 16 | **Done** | Covered /hospitality/rooms, /hospitality/rooms/{id}/tables, /hospitality/orders, /hospitality/orders/{id}/items, /hospitality/orders/{id}/fire, /hospitality/orders/{id}/bill, /hospitality/orders/{id}/pay, /hospitality/orders/{id}/move, /hospitality/kitchen-tickets, /hospitality/reservations, /hospitality/reservations/{id}/seat |
| **28** | **Practice Management & Studi Professionali (/practice & /professionals)** | 16 | 16 | Legal/Fiscal Cases, Unbilled Activity Control & Time Logs, Fee Notes from Activities, Client Trust Retainers & Balances, Period Closings & Checklists | 14 | **Done** | Covered /professionals/cases, /professionals/time-logs, /professionals/fee-notes, /practice/activity-control, /practice/fee-notes/from-activities, /practice/fee-notes/{id}/activities, /practice/closing-overview, /practice/closings, /practice/closings/{id}/checklist, /practice/closings/{id}/close, /practice/closings/{id}/reopen, /practice/retainers, /practice/retainers/balances, /practice/retainers/{id}/apply, /practice/retainers/{id}/void, /practice/fee-notes/{id}/retainers |
| **29** | **Appointments & Calendar Scheduling (/appointments)** | 6 | 6 | Appointment Booking, Resource & Technician Calendar View, Real-Time Conflict Detection, Attendance Details, Service Report Conversion, Cancellation Flow | 12 | **Done** | Covered /appointments, /appointments/calendar, /appointments/check-conflicts, /appointments/{id}, /appointments/{id}/cancel, /appointments/{id}/convert-to-service-report |
| **30** | **Multi-Channel Communication (/communication)** | 10 | 10 | Delivery Logs, Channel Gateways (Email, WhatsApp, Telegram, SMS), Credentials Config, Driver Connectivity Test, Message Templates CRUD & Preview, Direct Dispatch | 17 | **Done** | Covered /communication/documents/send, /deliveries, /deliveries/{id}, /channels, /channels/{channel}, /channels/{channel}/test, /messages/send, /templates, /templates/{id}, /templates/{id}/preview |
| **31** | **Visitors & Reception Kiosk (/visitors & /visitor-kiosk)** | 19 | 19 | Visitors Registry, Pre-Registrations & Visits Log, Badge Issue & Check-In, Real-Time On-Site Evacuation Muster List, Kiosk Device Management, Secret Rotation, Self-Service Kiosk Simulator | 18 | **Done** | Covered /visitors/visitors, /visitors/visits, /visitors/visits/{id}/check-in, /visitors/visits/{id}/check-out, /visitors/visits/{id}/cancel, /visitors/on-site, /visitors/kiosks, /visitors/kiosks/{id}/rotate-secret, /visitors/kiosks/{id}, /visitor-kiosk/expected, /visitor-kiosk/check-in, /visitor-kiosk/check-out |
| **32** | **Sistema Tessera Sanitaria (/tessera-sanitaria)** | 8 | 8 | Health Expenses Registry, Annual 730 Tax Deductibility Breakdown, Patient Opposition Management, Traceable Payment Tracking, Sogei Electronic Export (JSON/CSV), STS Credentials Setup | 13 | **Done** | Covered /tessera-sanitaria/settings, /tessera-sanitaria/expenses, /tessera-sanitaria/expenses/{id}, /tessera-sanitaria/summary, /tessera-sanitaria/export |

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
11. `[DONE]` **Module 11: Invoicing & SDI**
12. `[DONE]` **Module 12: Procurement & AP**
13. `[DONE]` **Module 13: Treasury & Banking**
14. `[DONE]` **Module 14: General Ledger & Accounting**
15. `[DONE]` **Module 15: Manufacturing & MRP**
16. `[DONE]` **Module 16: HR & Payroll**
17. `[DONE]` **Module 17: Verticals & Minor Modules**
18. `[DONE]` **Module 18: Final Polish & KPI Dashboards**
19. `[DONE]` **Module 19: Customs & Cross-Border Logistics (`/customs`)**
20. `[DONE]` **Module 20: Approval Workflows & BPMN Inbox (`/workflows`)**
21. `[DONE]` **Module 21: Document Management System (`/dms`)**
22. `[DONE]` **Module 22: Contract Register & Obligations (`/contract-register`)**
23. `[DONE]` **Module 23: Third Sector & Non-Profit Associations (`/associations`)**
24. `[DONE]` **Module 24: Automotive Workshop & Job Cards (`/automotive/workshop`)**
25. `[DONE]` **Module 25: Childcare & Early Childhood Education (`/childcare`)**
26. `[DONE]` **Module 26: Construction Trades & Cantieri Edili (`/construction`)**
27. `[DONE]` **Module 27: Hospitality & POS Comande (`/hospitality`)**
28. `[DONE]` **Module 28: Practice Management & Studi Professionali (`/practice` & `/professionals`)**
29. `[DONE]` **Module 29: Appointments & Calendar Scheduling (`/appointments`)**
30. `[DONE]` **Module 30: Multi-Channel Communication (`/communication`)**
31. `[DONE]` **Module 31: Visitors & Reception Kiosk (`/visitors` & `/visitor-kiosk`)**
32. `[DONE]` **Module 32: Sistema Tessera Sanitaria (`/tessera-sanitaria`)**
33. `[DONE]` **Module 33: European Intrastat Reporting (`/intrastat`)**
34. `[DONE]` **Module 34: Customer & Partner Self-Service Portal (`/portal`)**
35. `[DONE]` **Module 35: Electronic Document Networks & Digital Trust (`/edocument-networks` & `/document-trust`)**
36. `[DONE]` **Module 36: E-Commerce Channels, Marketplace Connectors & API Integrations (`/ecommerce`, `/integrations`, `/payment-links`)**
37. `[DONE]` **Module 37: Vehicle Rental Fleet & Inspection Management (`/rent` & `/automotive/vehicles`)**
38. `[DONE]` **Module 38: AI Business Assistant & Data Copilot (`/assistant`)**
39. `[DONE]` **Module 39: Customer Loyalty Cards & Points Engine (`/loyalty-cards`)**
40. `[DONE]` **Module 40: Multi-Provider Cloud Workspace Sync (`/workspace`)**

---

### Overall Status: 99% of the API surface is covered (2129/2151 endpoints, measured). The per-module "Done" marks above predate the backend extensions of November 2026 and are not a completeness claim. Build and tests: ng build passes (initial bundle 1.58 MB, within budget), 1707 tests pass, eslint clean.
