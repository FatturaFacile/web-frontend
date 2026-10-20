You are an expert Principal Frontend and Enterprise Software Architect specializing in modern Angular 22, NG-ZORRO (Ant Design), and Clean Architecture / DDD patterns.

Scaffold and implement the complete enterprise ERP navigation layout, routing hierarchy, authentication, and demo mock engine for an Angular 22 application tailored to Italian and Swiss jurisdictions. 

Strictly adhere to the established architectural conventions:
- Strict layering per feature (`domain/models`, `data-access/dtos`, `data-access/mappers`, `data-access/repositories`, `state/*.store.ts`, `ui/`, `pages/`).
- Angular 22 idiomatic standards: 100% Standalone (no NgModules), functional DI via `inject()`, Signal-based reactivity (`signal`, `computed`, `input()`, `output()`, `model()`, `viewChild()`), native control flow (`@if`, `@for` with `track`, `@switch`, `@defer`), and `ChangeDetectionStrategy.OnPush`.
- Reactive state management with `@ngrx/signals` (`signalStore` using `withState`, `withComputed`, `withMethods`, `rxMethod`).
- Data access abstraction: Repositories consumed via `InjectionToken`, returning Domain Models via pure bidirectional Mappers.
- Path aliases: Use `@core/*`, `@shared/*`, `@features/*`, `@domain/*`, `@data-access/*`, `@env/*` without deep relative imports.
- Barrel exports (`index.ts`) maintained at layer and module boundaries.

---

### 1. Application Layout & Design System (NG-ZORRO + FontAwesome 6 Free)

Implement the enterprise layout shell under `src/app/layout/`:
1. `SidebarComponent`:
   - Multi-level collapsible tree using NG-ZORRO menu components (`nz-menu`, `nz-submenu`, `nz-menu-item`).
   - FontAwesome 6 Free icon mapping across all modules and submodules (`fa-solid fa-*`).
   - Dynamic active route highlighting, collapsed state toggle, and keyboard accessibility.
2. `HeaderComponent`:
   - Company / Multi-tenant selector dropdown (`nz-select`).
   - Active Jurisdiction toggle: `IT` (Italia) / `CH` (Svizzera) syncing app-wide state.
   - Active Currency selector: `EUR` / `CHF`.
   - Locale switcher: `IT`, `DE`, `FR`, `EN` with active language flag.
   - Dark / Light mode toggle using CSS variables and NG-ZORRO theme tokens, persisted to `localStorage`.
   - User profile dropdown with tenant details and logout action.
3. `BreadcrumbComponent`: Dynamic path breadcrumbs derived from activated route `data.breadcrumb`.

---

### 2. Authentication, Route Guards & Lazy Routing (`app.routes.ts`)

1. Auth Flow:
   - Functional route guard `authGuard` verifying authentication via `AuthStore`.
   - Standalone `/auth/login` page featuring NG-ZORRO login form, jurisdiction/tenant preset selector, and mock sign-in triggering redirection to `/dashboard`.
2. Master Routing Configuration (`app.routes.ts`):
   - Set up lazy-loaded routes with `canActivate: [authGuard]` for all 17 business modules using `loadChildren` / `loadComponent`.
   - Each route definition must include route `data` (`breadcrumb`, `roles`, `title`).

---

### 3. Complete Business Modules & Menu Specifications

Implement the route structure, side-menu entries with the specified FontAwesome icons, and sample functional views for all of the following domains:

1. **Dashboard & Overview** (`/dashboard`, icon: `fa-solid fa-gauge-high`):
   - Executive KPIs, financial charts, and global schedule/alerts.
2. **CRM & Address Book (Cross-Border IT / CH)** (`/crm`, icon: `fa-solid fa-users`):
   - Clients (`fa-solid fa-address-book`): IT fiscal data (P.IVA, Codice Fiscale, SDI Code, PEC) & CH fiscal data (IDI/UID, QR-IBAN, structured address).
   - Suppliers & Vendor Pricelists (`fa-solid fa-truck-field`).
3. **Sales & Billing** (`/sales`, icon: `fa-solid fa-file-invoice-dollar`):
   - Quotes & Sales Orders (`fa-solid fa-cart-shopping`).
   - Italian Electronic Invoicing (SDI) (`fa-solid fa-receipt`): XML FatturaPA generator view, transmission monitor.
   - Swiss QR-Bill (`QR-Rechnung`) (`fa-solid fa-qrcode`): QR-Bill generator with QR-IBAN, Structured Reference (SCOR), and 0.05 CHF rounding logic.
   - Credit notes & Proforma invoices.
4. **Purchasing & AP** (`/purchases`, icon: `fa-solid fa-cart-flatbed`):
   - Purchase requests & Purchase orders.
   - IT Passive Cycle: SDI XML reception and reconciliation (`fa-solid fa-inbox`).
   - CH Passive Cycle: Swiss QR-Bill scanner (OCR/QR reader) & ISO 20022 `pain.001` payment batch exporter (`fa-solid fa-file-import`).
   - Expense notes and multi-currency employee reimbursements (`fa-solid fa-wallet`).
5. **Treasury & Banking** (`/treasury`, icon: `fa-solid fa-building-columns`):
   - ISO 20022 bank statements (`camt.053` / `camt.054`) and Italian CBI format imports.
   - Auto-reconciliation view, payment scheduling, SEPA & Swiss `pain.001` payment triggers.
6. **Inventory & Logistics** (`/inventory`, icon: `fa-solid fa-boxes-stacked`):
   - Items catalog and multi-warehouse stock balances (`fa-solid fa-warehouse`).
   - Transport documents (DDT / Waybills) (`fa-solid fa-truck-ramp-box`).
   - Customs & Export IT-CH: HS/TARIC codes, customs export docs, CMR (`fa-solid fa-passport`).
   - Lot and serial number tracking.
7. **Service Tickets & Field Assistance** (`/field-service`, icon: `fa-solid fa-screwdriver-wrench`):
   - Helpdesk tickets with SLA counters (`fa-solid fa-ticket`).
   - Field technician dispatch map, job work orders (*rapportini*) with digital signature capture, hourly and parts cost tracking.
8. **Automotive & Tire Center (Gommista)** (`/automotive`, icon: `fa-solid fa-car`):
   - Customer vehicles registry (IT plates & CH cantonal plates, vehicle registration cards).
   - Workshop job sheets (`fa-solid fa-wrench`).
   - Tire Hotel (`Hotel Pneumatici`) (`fa-solid fa-circle-dot`): Seasonal storage (Summer/Winter/All-Season), tread depth tracking (mm), shelf/rack warehouse allocation, automatic seasonal reminder dispatch.
   - Statutory inspections: IT *Revisione* & CH *Collaudo MFK*.
9. **Vehicle Fleet & Car Rental** (`/rent`, icon: `fa-solid fa-car-side`):
   - Rental fleet catalog and booking schedule grid (`fa-solid fa-calendar-week`).
   - Bilingual rental agreements (IT/DE/FR/EN).
   - Digital damage check-in / check-out appraisal tool (`fa-solid fa-car-burst`).
   - Security deposits, deductibles, Swiss Highway Vignette, and Telepass management.
10. **Construction, Craftsmen & Installations** (`/construction`, icon: `fa-solid fa-person-digging`):
    - Construction site management (*Cantieri*), bills of quantities, IT regional price lists.
    - Swiss SIA norms & CRB / NPK standard compliance.
    - Progress billings (*SAL*), work logbook (*Giornale dei Lavori*).
    - Declarations of Conformity (IT: DiCo / DiRi; CH: NIV / OIBT electrical inspection).
    - Subcontractors, Italian Reverse Charge (Art. 17 c. 6), and Swiss posted workers registry (*Lavoratori distaccati* & CCL compliance).
11. **Professional Practices & Advisory (Legal, Tax, Engineering)** (`/professionals`, icon: `fa-solid fa-scale-balanced`):
    - Client case files / practice registry (*Fascicoli*), engagement letters, fiduciary mandates (`fa-solid fa-folder-tree`).
    - Anti-Money Laundering (AML / KYC) checks.
    - Billable time-tracking by partner/associate with hourly fee tables, disbursements, and non-taxable client expenses.
    - Fee notes (*Parcelle / Proforma*) with IT social security funds (*Casse Previdenziali*, *Ritenuta d'Acconto*) and CH fiduciary invoicing.
12. **Manufacturing & MRP** (`/manufacturing`, icon: `fa-solid fa-industry`):
    - Multi-level Bills of Materials (BOM), routing, work centers, and machine capacity.
    - Production orders (OdP), MRP material requirement runs, shop-floor terminal view (MES / barcode).
    - Quality assurance, batch release certificates (CE & CH compliance).
13. **Retail & POS** (`/retail`, icon: `fa-solid fa-cash-register`):
    - Touchscreen Point of Sale interface.
    - Italian Electronic Cash Register (RT) integration.
    - Swiss receipt printer & payment terminals (Worldline, SumUp, Twint).
14. **Time Tracking, Shifts & Absences (Italian & Swiss Compliance)** (`/time-attendance`, icon: `fa-solid fa-clock`):
    - Virtual check-in/out terminal, badge scan, mobile GPS geofenced clocking (privacy-compliant, check-in point only).
    - Swiss ArG / OLL 1 compliance: Systemic detailed recording, simplified recording (*Vereinfachte Zeiterfassung*), opt-out management, statutory breaks, and weekly hour limits (45h/50h).
    - Italian compliance: D.Lgs. 66/2003, LUL compliance, 11-hour mandatory daily rest monitoring.
    - Shift scheduling, on-call roasters, overtime calculation, and working-time accounts (*Banca Ore*).
    - Absence management: IT accruals (*Ferie*, *ROL*, *Ex Festività*, Legge 104); CH statutory leave (4–5 weeks vacation, reduction calculations).
    - Medical illness tracking: IT INPS protocol (PUC); CH health daily allowance (*IGM / KTG*).
    - Accidents (IT INAIL; CH SUVA / UVG) and Swiss military / civil service (*APG / EO*).
    - Payroll export: LUL format exports (Zucchetti, TeamSystem) & Swissdec ELM salary transmission.
15. **Cross-Border Payroll & HR** (`/hr`, icon: `fa-solid fa-user-tie`):
    - Cross-border commuters (*Frontalieri IT-CH*), local employees, posted staff.
    - Swiss social security deductions (AVS/AI/IPG, AD, LPP 2nd Pillar, LAINF) and cantonal withholding taxes (*Imposta alla Fonte*).
    - Italian social charges, INPS/INAIL, and F24 tax mapping.
16. **Fiscal & Statutory Accounting** (`/accounting`, icon: `fa-solid fa-landmark`):
    - Dual ledger support: Italian General Ledger & Swiss SME Chart of Accounts (*KMU / PME Kontenrahmen*).
    - IT VAT liquidations, periodic returns, and *Esterometro*.
    - CH VAT reporting (*AFC / ESTV* effective rate & net tax rate methods).
17. **Multi-Tenant Administration & System Settings** (`/settings`, icon: `fa-solid fa-gears`):
    - Tenant, subsidiaries, and branch manager.
    - Exchange rates sync (ECB / SNB).
    - Granular RBAC (Roles & Permissions) management.
    - GDPR & Swiss revised FADP (LPD) audit log.

---

### 4. Demo Mode Engine & Realistic Mock JSON Data

1. `MockDataInterceptor`:
   - An `HttpInterceptorFn` enabled when `environment.demoMode === true`.
   - Intercepts outgoing API calls and serves static JSON files from `src/assets/mock-data/` with simulated network delay (200ms).
2. Mock JSON Datasets:
   - Provide realistic sample data files in `src/assets/mock-data/`:
     - `auth-user.json`: Mock user profile with roles, default tenant, and permissions.
     - `crm-clients.json`: Cross-border clients with both IT (P.IVA, SDI, PEC) and CH (IDI/UID, QR-IBAN) profiles.
     - `sales-qr-bills.json`: Swiss QR-bill dataset (creditor, debtor, amount in CHF, SCOR reference, QR-IBAN).
     - `sales-sdi-invoices.json`: Italian electronic invoices (FatturaPA XML metadata, status, recipient code).
     - `automotive-tire-hotel.json`: Tire storage records (wheel sets, summer/winter, tread depths in mm, shelf rack locations).
     - `time-attendance.json`: Clocking sessions, daily balances, compliance flags (ArG / D.Lgs. 66), vacation accruals.
3. Every page component must connect to its respective SignalStore, Repository, and mock endpoints, displaying realistic data tables with NG-ZORRO pagination, sorting, status badges, and action buttons.

---

### 5. Detailed Implementation Deliverables

Deliver production-ready code with complete implementations for:
1. `src/app/core/interceptors/mock-data.interceptor.ts`.
2. `src/app/layout/sidebar/` and `src/app/layout/header/` components with NG-ZORRO and FontAwesome.
3. Two fully interactive showcase pages following Clean Architecture (Store + Repository + Mapper + UI):
   - `SwissQrBillComponent` (`/sales/qr-bill`): NG-ZORRO form and table displaying QR-Bill generation, 0.05 CHF rounding, SCOR reference validation, and visual QR voucher preview.
   - `TimeAttendanceComponent` (`/time-attendance`): Interactive clock-in/out widget, working time table, Swiss ArG 45h/50h limit tracker, and vacation accrual cards.
4. Update `README.md` and architecture documentation with instructions on running the app in Demo Mode.