# Fattura Facile - Enterprise ERP Frontend (IT / CH)

Enterprise ERP web application built with **Angular 22**, **NG-ZORRO (Ant Design)**, **FontAwesome 6 Free**, and **Clean Architecture / DDD**, tailored for cross-border operations between **Italy (IT)** and **Switzerland (CH)**.

---

# FatturaFacile - Web Client Demo

[![CI](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml)
[![Deploy to Pages](https://github.com/<OWNER>/<REPO>/actions/workflows/deploy.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/deploy.yml)
[![GitHub Release](https://img.shields.io/github/v/release/<OWNER>/<REPO>?sort=semver&logo=github&color=blue)](https://github.com/<OWNER>/<REPO>/releases/latest)
[![Demo](https://demo.fatturafacile.eu)](https://demo.fatturafacile.eu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

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

| Module                      | Route                    | Icon                     | Description                                                                                        |
|-----------------------------|--------------------------|--------------------------|----------------------------------------------------------------------------------------------------|
| **Dashboard**               | `/dashboard`             | `fa-gauge-high`          | Executive KPIs, financial charts, and jurisdiction banners                                         |
| **CRM & Anagrafiche**       | `/crm/clients`           | `fa-users`               | Cross-border clients with IT (P.IVA, SDI, PEC) and CH (IDI/UID, QR-IBAN) profiles                  |
| **Vendite & Fatturazione**  | `/sales/qr-bill`         | `fa-file-invoice-dollar` | Italian SDI e-invoicing & Swiss QR-Bill (QR-Rechnung)                                              |
| **Acquisti & AP**           | `/purchases/sdi-inbox`   | `fa-cart-flatbed`        | Passive SDI XML reception, QR-Bill scanner, and ISO 20022 `pain.001` payment batches               |
| **Tesoreria & Banche**      | `/treasury`              | `fa-building-columns`    | ISO 20022 bank statements (`camt.053` / `camt.054`), CBI import, auto-reconciliation               |
| **Magazzino & Logistica**   | `/inventory/stock`       | `fa-boxes-stacked`       | Multimagazzino (Milano / Chiasso), DDT, HS/TARIC customs codes, CMR                                |
| **Assistenza & Interventi** | `/field-service/tickets` | `fa-screwdriver-wrench`  | Helpdesk tickets with SLA countdown and mobile field technician work orders                        |
| **Automotive & Gomme**      | `/automotive/tire-hotel` | `fa-car`                 | Workshop job sheets, Hotel Pneumatici (tread depth mm, rack allocation, seasonal reminders)        |
| **Noleggio Flotte**         | `/rent/fleet`            | `fa-car-side`            | Rental fleet schedule, digital damage check-in/out appraisal, Swiss Highway Vignette               |
| **Cantieri & Impianti**     | `/construction`          | `fa-person-digging`      | Cantieri, SAL, SIA 118 & CRB/NPK, Italian DiCo (DM 37/08) and Swiss NIV/OIBT electrical compliance |
| **Studi Professionali**     | `/professionals`         | `fa-scale-balanced`      | Practice registry (Fascicoli), AML/KYC checks, billable time, parcelle with CPA & ritenuta         |
| **Produzione & MRP**        | `/manufacturing`         | `fa-industry`            | Multilevel BOM, routing, machine capacity, production orders (OdP), CE/CH compliance               |
| **Vendita al Banco & POS**  | `/retail`                | `fa-cash-register`       | Touch POS, Italian RT cash register, Swiss terminal integrations (Twint, SumUp, Worldline)         |
| **Presenze & Cartellino**   | `/time-attendance`       | `fa-clock`               | Virtual clock-in/out terminal, Swiss ArG 45h/50h limit tracker, D.Lgs. 66/2003 rest monitoring     |
| **Payroll & HR IT-CH**      | `/hr/employees`          | `fa-user-tie`            | Cross-border commuters (*Frontalieri*), Swiss social security (AVS/LPP) and Italian LUL/INPS       |
| **Contabilità & Fiscale**   | `/accounting`            | `fa-landmark`            | Dual-ledger: Italian General Ledger & Swiss SME Chart of Accounts (*KMU / PME Kontenrahmen*)       |
| **Impostazioni & Tenant**   | `/settings`              | `fa-gears`               | Multi-tenant company config, ECB/SNB exchange rate sync, RBAC, GDPR & Swiss revised FADP (LPD)     |

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

This repository enforces **pnpm** exclusively (`packageManager: pnpm@12.16.1` and `preinstall` guard). Any unintentional `npm install` execution will fail immediately.

### Dependency Installation

```bash
pnpm install --frozen-lockfile
```

### Start Development Server

```bash
pnpm start
```

Starts the local dev server at `https://localhost:4200/`. `/api` and `/sanctum` are proxied to the shared dev
API (`https://dev-api.fatturafacile.eu`, set in `env/development.env`).

### Environment Configuration

The API endpoint is never hardcoded in the source: it is read from environment variables and injected at build
time. `pnpm start`, `pnpm run start:local`, `pnpm run build` and `pnpm run watch` go through
[`scripts/ng-env.mjs`](scripts/ng-env.mjs), which resolves the variables and passes them to the Angular CLI
(`--define`) and to the dev-server proxy ([`proxy.conf.mjs`](proxy.conf.mjs)).

| Variable           | Required                          | Description                                                                                          |
|--------------------|-----------------------------------|------------------------------------------------------------------------------------------------------|
| `API_BASE_URL`     | yes                               | API base URL used by the app: a same-origin path (`/api/v1`) or an absolute URL.                      |
| `API_PROXY_TARGET` | with `pnpm start` and a path URL  | Backend that the dev server proxies `/api` and `/sanctum` to.                                         |
| `DEMO_MODE`        | no (default `false`)              | `true` pre-fills the login form with the demo account credentials.                                   |

Values are resolved in this order, the first one found wins:

1. **Shell / CI environment variables**, e.g. `API_BASE_URL=https://api.example.com/api/v1 pnpm run build`.
2. **`.env`** in the project root: personal overrides, git-ignored. Start from [`.env.example`](.env.example).
3. **`env/<configuration>.env`**: committed defaults for each Angular configuration. With several configurations
   (`--configuration production,demo`) the files are applied in order, later ones overriding earlier ones.

| Environment | Command                                            | Env file(s)                           | API                                               |
|-------------|----------------------------------------------------|---------------------------------------|---------------------------------------------------|
| development | `pnpm start`                                       | `env/development.env`                 | `/api/v1`, proxied to `https://dev-api.fatturafacile.eu` |
| local       | `pnpm run start:local`                             | `env/local.env`                       | `/api/v1`, proxied to `http://localhost:8000`     |
| dev         | `pnpm run build -- --configuration dev`            | `env/dev.env`                         | `/api/v1`, served on the same origin by nginx on dev.fatturafacile.eu |
| demo        | `pnpm run build -- --configuration production,demo`   | `env/production.env`, `env/demo.env` | `https://api.fatturafacile.eu/api/v1`             |
| production  | `pnpm run build`                                   | `env/production.env`                  | `https://api.fatturafacile.eu/api/v1`             |

The CI workflows use the same commands: `deploy-dev.yml` builds `dev` on every push to `dev`, `deploy.yml` builds
`production,demo` for GitHub Pages. To point an environment to another API, change its `env/<configuration>.env`
(or set the variable in the workflow); no source change is needed.

Sanctum cookie authentication needs the browser to read the `XSRF-TOKEN` cookie, so a relative `/api/v1` served on
the frontend origin (proxy or nginx) is preferred. With an absolute URL, the API must share the frontend's site and
set `SESSION_DOMAIN` so the cookie is visible to the frontend host.

Running `ng serve` / `ng build` directly skips the wrapper: the app falls back to `/api/v1` and the dev-server proxy
refuses to start without `API_PROXY_TARGET`. Vitest uses the same fallback; specs set `environment.apiBaseUrl` to the
fictitious host in `src/testing/api.ts`.

### Local HTTPS Certificates

The dev server runs over HTTPS and needs a locally trusted certificate in `certs/`, generated once per machine
with [mkcert](https://github.com/FiloSottile/mkcert). The certificate files are git-ignored, so every developer
creates their own:

```bash
mkcert -install
mkcert -cert-file certs/localhost.crt -key-file certs/localhost.key localhost 127.0.0.1
```

See [`certs/README.md`](certs/README.md) for the full macOS and Windows steps.

### Run Against a Local Backend

```bash
# In web-api: php artisan serve   (or ./vendor/bin/sail up, with APP_PORT=8000)
pnpm run start:local
```

Starts the dev server with demo mode off. `/api` and `/sanctum` are proxied to `http://localhost:8000`
(`API_PROXY_TARGET` in `env/local.env`, override it in `.env` if your backend runs elsewhere), so requests stay
same-origin and Sanctum cookie authentication works with the backend's default `SANCTUM_STATEFUL_DOMAINS`
(`localhost:4200`).

### Run Unit Tests (Vitest)

```bash
pnpm test --watch=false
```

Executes all 24 unit tests across mappers, repositories, SignalStores, and components.

### Build Production Bundle

```bash
pnpm run build
```

Generates optimized and code-split production bundles in `dist/fatturafacile` with zero warnings, using the
production API from `env/production.env` (see [Environment Configuration](#environment-configuration) for the other
environments).

### Agent Sandboxing

This repository includes a secure sandboxing boundary for autonomous agents, CI runners, and automated generation tools:

```bash
# Execute command inside the isolated sandbox runner
pnpm run agent:sandbox -- pnpm test

# Run inside the walled Docker container profile (if Docker is available)
pnpm run agent:docker -- pnpm run build
```

See [`docs/agent-sandboxing.md`](docs/agent-sandboxing.md) for comprehensive architectural details and security policies.
