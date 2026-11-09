# Fattura Facile - Enterprise ERP Frontend (IT / CH)

Enterprise ERP web application built with **Angular 22**, **NG-ZORRO (Ant Design)**, **FontAwesome 6 Free**, and **Clean Architecture / DDD**, tailored for cross-border operations between **Italy (IT)** and **Switzerland (CH)**.

[![CI](https://github.com/FatturaFacile/web-frontend/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/FatturaFacile/web-frontend/actions/workflows/ci.yml)
[![Deploy Dev](https://github.com/FatturaFacile/web-frontend/actions/workflows/deploy-dev.yml/badge.svg)](https://github.com/FatturaFacile/web-frontend/actions/workflows/deploy-dev.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 1. Enterprise Architecture & Layout Shell

The application layout shell is located in `src/app/layout/` and implements:

- **Multi-Level Collapsible Sidebar (`SidebarComponent`)**:
  - Tree navigation across all 17 ERP business modules with dynamic route matching (`nzMatchRouter`).
  - FontAwesome 6 Free icon integrations (`fa-solid fa-*`).
  - Collapsed state synchronization managed with `@ngrx/signals` (`AppStore`).
- **Global Header (`HeaderComponent`)**:
  - **Multi-Tenant / Company Selector**: Instant switching between legal entities (e.g., *Rossi Impianti S.r.l. - IT* vs. *Helvetia Tech SA - CH*).
  - **Active Jurisdiction Switcher**: `IT` (Italy - SDI, F24, D.Lgs. 66/2003) vs. `CH` (Switzerland - QR-Bill, ArG OLL 1, KMU/PME).
  - **Currency Selector**: `EUR (€)` vs. `CHF`.
  - **Locale Switcher**: Quad-lingual support (`IT`, `DE`, `FR`, `EN`) with native labels and flags.
  - **Dark / Light Mode**: Dynamic CSS custom property switching persisted to `localStorage`.
  - **User Profile Dropdown**: Accessible menu for role verification, tenant details, security settings, 2FA policies, and secure logout.
- **Dynamic Breadcrumbs (`BreadcrumbComponent`)**: Derived automatically from active route `data.breadcrumb` hierarchies.

---

## 2. ERP Business Modules

| Module | Route | Icon | Description |
|---|---|---|---|
| **Dashboard** | `/dashboard` | `fa-gauge-high` | Executive KPIs, revenue growth, receivables, and jurisdiction notices. |
| **CRM & Master Data** | `/crm/clients` | `fa-users` | Cross-border accounts with IT (VAT, SDI code, PEC) and CH (UID/IDI, QR-IBAN) profiles, leads, scoring, and duplicate detection. |
| **Sales & Invoicing** | `/sales/invoices` | `fa-file-invoice-dollar` | Quotes, orders, delivery notes (DDT), Italian SDI e-invoicing (FatturaPA XML), and Swiss QR-Bill (*QR-Rechnung*). |
| **Purchases & AP** | `/purchases` | `fa-cart-flatbed` | Supplier purchase orders, goods receipts, 3-way matching, passive SDI XML intake, and ISO 20022 `pain.001` payment batches. |
| **Treasury & Banking** | `/treasury` | `fa-building-columns` | Bank account management, ISO 20022 statements (`camt.053` / `camt.054`), CBI import, auto-reconciliation, and cash flow forecasting. |
| **Inventory & Warehouses** | `/inventory` | `fa-boxes-stacked` | Multi-warehouse management (e.g. Milan vs. Chiasso), stock transfers, inventory adjustments, physical count sessions, and valuation snapshots. |
| **Field Service** | `/field-service` | `fa-screwdriver-wrench` | Helpdesk ticketing, priority/SLA timers, field technician work orders, and internal notes. |
| **Automotive & Tires** | `/automotive` | `fa-car` | Workshop job cards, vehicle profiles, and Tire Hotel management (tread depth mm, seasonal storage rack allocations). |
| **Fleet Rental** | `/rent` | `fa-car-side` | Rental fleet booking calendar, digital condition check-in/out reports, and Swiss Highway Vignette tracking. |
| **Construction & Sites** | `/construction` | `fa-person-digging` | Job sites, progress billings (SAL), SIA 118 / CRB-NPK standards, Italian DiCo (DM 37/08), and Swiss NIV/OIBT electrical compliance. |
| **Professional Services** | `/professionals` | `fa-scale-balanced` | Practice client matters, AML/KYC audits, billable time logs, and fee notes (*parcelle*) with withholding tax and professional funds. |
| **Manufacturing & MRP** | `/manufacturing` | `fa-industry` | Multilevel Bills of Materials (BOM), routings, work centers, MRP computation runs, and production orders (OdP). |
| **Retail & POS** | `/retail` | `fa-cash-register` | Touch-screen POS, Italian RT fiscal receipts (*corrispettivi telematici*), and Swiss terminal integrations (Twint, SumUp, Worldline). |
| **Time & Attendance** | `/time-attendance` | `fa-clock` | Virtual clock-in/out terminal, Swiss ArG weekly work limit monitoring (45h/50h), and Italian D.Lgs. 66/2003 mandatory daily rest checks. |
| **HR & Payroll** | `/hr` | `fa-user-tie` | Employee lifecycle, cross-border commuter (*Frontalieri*) management, leaves, timesheets, Swiss AVS/LPP and Italian LUL/INPS payroll. |
| **Accounting & General Ledger** | `/accounting` | `fa-landmark` | Dual-ledger system: Italian Libro Giornale & Swiss SME Chart of Accounts (*KMU / PME Kontenrahmen*), VAT settlements, Intrastat declarations. |
| **Settings & Security** | `/settings` | `fa-gears` | Multi-tenant organization settings, ECB/SNB currency exchange rate sync, role-based access control (RBAC), 2FA enforcement, and audit logs. |

---

## 3. Interactive Cross-Border Features

### Swiss QR-Bill (`/sales/qr-bill`)
- **Clean Architecture**: `SwissQrBillStore` + `QrBillRepository` + `QrBillMapper` + `QrBillDto` + `QrBill` model.
- **Swiss 0.05 CHF Cash Rounding**: Deterministic currency rounding (`Math.round(amount * 20) / 20`) displaying exact rounding differences.
- **SCOR Structured Reference**: 27-digit QR reference generator with Modulo 10 recursive validation.
- **Visual Swiss QR Voucher**: Payment Part (*Zahlteil*) and Receipt (*Empfangsschein*) including the official Swiss Cross emblem rendered with `nz-qrcode`.

### Time Attendance & Labor Compliance (`/time-attendance`)
- **Virtual Terminal**: Instant toggle between clock-in and clock-out with elapsed session counters.
- **Swiss ArG Tracker**: Real-time gauge for statutory weekly maximums (45h / 50h under ArG Art. 9).
- **Italian Compliance**: Monitoring for D.Lgs. 66/2003 mandatory consecutive 11-hour rest periods.
- **Accrual Balances**: Live counters for Vacation (*Ferie*) and ROL / Paid Time Off banking.

---

## 4. Development & Testing Commands

This repository enforces **pnpm** exclusively (`packageManager: pnpm@12.16.1` with a `preinstall` guard). Running `npm install` directly will abort with an error.

### Dependency Installation

```bash
pnpm install --frozen-lockfile
```

### Start Development Server

```bash
pnpm start
```

Starts the local development server at `https://localhost:4200/`. API requests (`/api` and `/sanctum`) are automatically proxied to the target configured in `env/development.env` (default: `https://dev-api.fatturafacile.eu`).

### Run Against Local Backend

```bash
pnpm run start:local
```

Proxies `/api` and `/sanctum` to `http://localhost:8000` for seamless local development with Laravel Sanctum cookie authentication.

### Local HTTPS Certificates

The dev server operates over HTTPS and requires a locally trusted certificate in `certs/`, generated once using [mkcert](https://github.com/FiloSottile/mkcert):

```bash
mkcert -install
mkcert -cert-file certs/localhost.crt -key-file certs/localhost.key localhost 127.0.0.1
```

*(Certificate files are git-ignored so each developer creates their own).*

### Linting & Static Analysis

```bash
# Run ESLint across all TypeScript and HTML template files
pnpm run lint

# Automatically fix linting issues where supported
pnpm run lint --fix
```

### Unit Tests (Vitest)

```bash
# Run the full unit test suite (444 tests across 77 test files)
pnpm test --run

# Run tests in watch mode during development
pnpm test

# Run tests with code coverage report
pnpm test --coverage
```

### Production Build

```bash
pnpm run build
```

Compiles the Angular application with ahead-of-time (AOT) compilation, tree-shaking, and lazy-chunk route splitting into `dist/fatturafacile`.

### End-to-End (E2E) Testing (Playwright)

```bash
# Install browsers once
pnpm exec playwright install --with-deps

# Run Playwright tests headlessly
pnpm exec playwright test
```

---

## 5. Environment Configuration

API endpoints and operational modes are configured dynamically via [`scripts/ng-env.mjs`](scripts/ng-env.mjs):

| Variable | Required | Description |
|---|---|---|
| `API_BASE_URL` | Yes | API base endpoint used by the client (relative `/api/v1` or absolute URL). |
| `API_PROXY_TARGET` | For `pnpm start` | Target host that the dev proxy forwards `/api` and `/sanctum` requests to. |
| `DEMO_MODE` | No | Pre-fills the login form with demo credentials when enabled. |

Configurations are resolved in precedence order:
1. Shell / CI environment variables.
2. Root `.env` file (git-ignored, customized per developer).
3. Preset configurations under `env/<configuration>.env` (`development`, `local`, `dev`, `production`, `demo`).

---

## 6. Continuous Integration & Quality Standards

Every push and pull request executes our automated CI pipeline defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

- **Validation**: ESLint static analysis (strict type rules, accessibility checks, no `any`, template validations) and Vitest unit test suite with coverage thresholds.
- **Production Build**: Full Angular production compilation with budget validations.
- **E2E Testing**: Automated Playwright browser verification against self-signed local HTTPS endpoints.
- **Qodana Code Inspection**: Deep static analysis with JetBrains Qodana engine.
- **Notifications**: Automated Telegram status updates on pipeline success or failure.

---

## 7. License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
