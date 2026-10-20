# Fattura Facile - Enterprise ERP Frontend (IT / CH)

Enterprise ERP web application built with **Angular 22**, **NG-ZORRO (Ant Design)**, **FontAwesome 6 Free**, and **Clean Architecture / DDD**, tailored for cross-border operations between **Italy (IT)** and **Switzerland (CH)**.

---

## 1. Enterprise Architecture & Layout Shell

The application layout shell is located in `src/app/layout/` and implements:

- **Multi-Level Collapsible Sidebar (`SidebarComponent`)**:
  - Tree navigation across all 17 ERP business modules with dynamic route matching (`nzMatchRouter`).
  - Integrated FontAwesome 6 Free icons (`fa-solid fa-*`).
  - Collapsed state synchronization with `@ngrx/signals` (`AppStore`).
- **Global Header (`HeaderComponent`)**:
  - **Multi-Tenant / Company Selector**: Instant switching between legal entities (e.g., *Rossi Impianti S.r.l. - IT* vs. *Helvetia Tech SA - CH*).
  - **Active Jurisdiction Switcher**: `IT` (Italia - SDI, F24, D.Lgs. 66/2003) vs. `CH` (Svizzera - QR-Bill, ArG OLL 1, KMU/PME).
  - **Currency Selector**: `EUR (€)` vs. `CHF`.
  - **Locale Switcher**: Quad-lingual support (`IT`, `DE`, `FR`, `EN`) with flags.
  - **Dark / Light Mode**: Dynamic CSS custom property switching persisted to `localStorage`.
  - **User Profile Dropdown**: Role verification, tenant details, and logout action.
- **Dynamic Breadcrumbs (`BreadcrumbComponent`)**: Auto-derived from activated route `data.breadcrumb` hierarchies.

---

## 2. All 17 ERP Business Modules

| Module | Route | Icon | Description |
|---|---|---|---|
| **Dashboard** | `/dashboard` | `fa-gauge-high` | Executive KPIs, financial charts, and jurisdiction banners |
| **CRM & Anagrafiche** | `/crm/clients` | `fa-users` | Cross-border clients with IT (P.IVA, SDI, PEC) and CH (IDI/UID, QR-IBAN) profiles |
| **Vendite & Fatturazione** | `/sales/qr-bill` | `fa-file-invoice-dollar` | Italian SDI e-invoicing & Swiss QR-Bill (QR-Rechnung) |
| **Acquisti & AP** | `/purchases/sdi-inbox` | `fa-cart-flatbed` | Passive SDI XML reception, QR-Bill scanner, and ISO 20022 `pain.001` payment batches |
| **Tesoreria & Banche** | `/treasury` | `fa-building-columns` | ISO 20022 bank statements (`camt.053` / `camt.054`), CBI import, auto-reconciliation |
| **Magazzino & Logistica** | `/inventory/stock` | `fa-boxes-stacked` | Multimagazzino (Milano / Chiasso), DDT, HS/TARIC customs codes, CMR |
| **Assistenza & Interventi** | `/field-service/tickets` | `fa-screwdriver-wrench` | Helpdesk tickets with SLA countdown and mobile field technician work orders |
| **Automotive & Gomme** | `/automotive/tire-hotel` | `fa-car` | Workshop job sheets, Hotel Pneumatici (tread depth mm, rack allocation, seasonal reminders) |
| **Noleggio Flotte** | `/rent/fleet` | `fa-car-side` | Rental fleet schedule, digital damage check-in/out appraisal, Swiss Highway Vignette |
| **Cantieri & Impianti** | `/construction` | `fa-person-digging` | Cantieri, SAL, SIA 118 & CRB/NPK, Italian DiCo (DM 37/08) and Swiss NIV/OIBT electrical compliance |
| **Studi Professionali** | `/professionals` | `fa-scale-balanced` | Practice registry (Fascicoli), AML/KYC checks, billable time, parcelle with CPA & ritenuta |
| **Produzione & MRP** | `/manufacturing` | `fa-industry` | Multilevel BOM, routing, machine capacity, production orders (OdP), CE/CH compliance |
| **Vendita al Banco & POS** | `/retail` | `fa-cash-register` | Touch POS, Italian RT cash register, Swiss terminal integrations (Twint, SumUp, Worldline) |
| **Presenze & Cartellino** | `/time-attendance` | `fa-clock` | Virtual clock-in/out terminal, Swiss ArG 45h/50h limit tracker, D.Lgs. 66/2003 rest monitoring |
| **Payroll & HR IT-CH** | `/hr/employees` | `fa-user-tie` | Cross-border commuters (*Frontalieri*), Swiss social security (AVS/LPP) and Italian LUL/INPS |
| **Contabilità & Fiscale** | `/accounting` | `fa-landmark` | Dual-ledger: Italian General Ledger & Swiss SME Chart of Accounts (*KMU / PME Kontenrahmen*) |
| **Impostazioni & Tenant** | `/settings` | `fa-gears` | Multi-tenant company config, ECB/SNB exchange rate sync, RBAC, GDPR & Swiss revised FADP (LPD) |

---

## 3. Interactive Showcase Implementations

### Swiss QR-Bill (`/sales/qr-bill`)
- **Clean Architecture**: `SwissQrBillStore` + `QrBillRepository` + `QrBillMapper` + `QrBillDto` + `QrBill` model.
- **Swiss 0.05 CHF Rounding**: Deterministic cash rounding (`Math.round(amount * 20) / 20`) with live display of rounding differences.
- **SCOR Structured Reference**: 27-digit QR reference generator and validator (`21 00000 00003 13947 14300 09017`).
- **Visual Swiss QR Voucher**: Payment Part (*Zahlteil*) and Receipt (*Empfangsschein*) featuring the Swiss cross in the center.

### Time Attendance & Labor Compliance (`/time-attendance`)
- **Clean Architecture**: `TimeAttendanceStore` + `TimeAttendanceRepository` + `TimeAttendanceMapper` + `TimeAttendanceDto` + `TimeAttendance` model.
- **Virtual Terminal**: Interactive toggle between clock-in and clock-out with session timers.
- **Swiss ArG Tracker**: Real-time gauge tracking weekly statutory limits (45h / 50h max under ArG Art. 9).
- **Italian Compliance**: D.Lgs. 66/2003 mandatory 11-hour daily rest monitoring.
- **Accruals**: Vacation days (*Ferie*) and ROL / *Banca Ore* counters.

---

## 4. Demo Mock Engine & Offline Data

When running in **Demo Mode**, the application operates 100% autonomously without external backends:

- **`MockDataInterceptor`** (`src/app/core/interceptors/mock-data.interceptor.ts`):
  - Automatically enabled when `environment.demoMode === true`.
  - Intercepts `/api/*` calls and serves realistic mock JSON datasets with simulated network latency (200ms).
- **Datasets** located in `public/assets/mock-data/`:
  - `auth-user.json`: User profile, roles, tenants, and permissions.
  - `crm-clients.json`: Cross-border clients with IT (P.IVA, SDI, PEC) and CH (IDI/UID, QR-IBAN) profiles.
  - `sales-qr-bills.json`: Swiss QR-bill dataset (creditor, debtor, SCOR reference, amount in CHF).
  - `sales-sdi-invoices.json`: Italian electronic invoice metadata and SDI transmission states.
  - `automotive-tire-hotel.json`: Tire Hotel storage records with tread depths (mm) and shelf locations.
  - `time-attendance.json`: Clocking sessions, daily balances, and ArG compliance notes.

---

## 5. Development & Testing Commands

### Start Development Server
```bash
npm start
```
Starts the local dev server at `http://localhost:4200/` with demo mode enabled.

### Run Unit Tests (Vitest)
```bash
npm test -- --watch=false
```
Executes all 24 unit tests across mappers, repositories, SignalStores, and components.

### Build Production Bundle
```bash
npm run build
```
Generates optimized and code-split production bundles in `dist/fatturafacile` with zero warnings.
