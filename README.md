# Fattura Facile - Enterprise ERP Frontend (IT / CH)

[![CI](https://github.com/FatturaFacile/web-frontend/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/FatturaFacile/web-frontend/actions/workflows/ci.yml)
[![Deploy Dev](https://github.com/FatturaFacile/web-frontend/actions/workflows/deploy-dev.yml/badge.svg)](https://github.com/FatturaFacile/web-frontend/actions/workflows/deploy-dev.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise Resource Planning (ERP) single-page application engineered with **Angular 22**, **NG-ZORRO (Ant Design)**, **NgRx SignalStore**, and a layered **Clean Architecture / Domain-Driven Design (DDD)** approach. The application is purpose-built for compliant, cross-border business and fiscal operations between **Italy (IT)** and **Switzerland (CH)**.

---

## 1. Overview

**Fattura Facile** provides a multi-tenant, multi-jurisdiction business management platform that unifies Italian and Swiss statutory accounting, labor compliance, billing, and supply chain processes into a single administrative interface.

### Target Domain & Regulatory Compliance

- **Italy (IT)**:
  - Italian SDI electronic invoicing intake and transmission (_FatturaPA_ XML, PEC, and recipient codes).
  - Split payment, withholding tax (_ritenuta d'acconto_), and stamp duty (_bollo virtuale_).
  - Italian labor compliance (D.Lgs. 66/2003 mandatory consecutive 11-hour daily rest tracking).
  - Italian General Ledger (_Libro Giornale_) and periodic VAT liquidations.
- **Switzerland (CH)**:
  - Swiss QR-Bill (_QR-Rechnung_) generation and rendering (Payment Part and Receipt with official Swiss Cross, SCOR reference numbers, and 0.05 CHF cash rounding).
  - Swiss Federal Labor Act tracking (ArG / OLL 1 weekly limits: 45h/50h statutory overtime caps).
  - Swiss SME Chart of Accounts (_KMU / PME Kontenrahmen_).
  - Multi-currency banking with ISO 20022 payments (`pain.001`) and account statements (`camt.053` / `camt.054`).

### Core Business Modules

| Module                     | Route              | Icon                     | Description                                                                                                      |
| -------------------------- | ------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Dashboard**              | `/dashboard`       | `fa-gauge-high`          | Operational KPIs, revenue summaries, pending tasks, and jurisdiction alerts.                                     |
| **CRM & Master Data**      | `/crm/clients`     | `fa-users`               | Accounts, contacts, leads, scoring, IT tax IDs (Codice Fiscale / Partita IVA), and Swiss UID/IDI.                |
| **Sales & Invoicing**      | `/sales/invoices`  | `fa-file-invoice-dollar` | Quotes, proforma, orders, delivery notes (DDT), SDI electronic invoices, and Swiss QR-Bills.                     |
| **Purchases & AP**         | `/purchases`       | `fa-cart-flatbed`        | Supplier orders, goods receipts, three-way matching, passive invoice intake, and payment orders.                 |
| **Procurement**            | `/procurement`     | `fa-boxes-packing`       | Strategic vendor evaluation, requisition workflows, and purchasing cycles.                                       |
| **Treasury & Banking**     | `/treasury`        | `fa-building-columns`    | Bank accounts, ISO 20022 bank reconciliation (`camt.053`), payment files (`pain.001`), and cash flow.            |
| **Inventory & Warehouses** | `/inventory`       | `fa-boxes-stacked`       | Multi-warehouse tracking, stock movements, picking/packing, lots, serials, and inventory audits.                 |
| **Customs (IT-CH)**        | `/customs`         | `fa-passport`            | Cross-border trade declarations, customs item mapping, and carrier shipments between IT and CH.                  |
| **Accounting & GL**        | `/accounting`      | `fa-landmark`            | Dual-ledger system (Italian Libro Giornale & Swiss KMU/PME), VAT settlements, Intrastat, and charts of accounts. |
| **HR & Payroll**           | `/hr`              | `fa-user-tie`            | Cross-border commuter (_Frontalieri_) management, leaves, Swiss AVS/LPP, and Italian LUL/INPS payroll.           |
| **Time & Attendance**      | `/time-attendance` | `fa-clock`               | Virtual clock-in/out terminal, Swiss ArG weekly work hour tracking, and Italian daily rest monitors.             |
| **Field Service**          | `/field-service`   | `fa-screwdriver-wrench`  | Service tickets, SLA monitoring, field technician dispatches, and work logs.                                     |
| **Automotive & Workshop**  | `/automotive`      | `fa-car`                 | Vehicle registry, repair orders, and seasonal Tire Hotel storage rack management.                                |
| **Fleet & Rental**         | `/rent`            | `fa-car-side`            | Vehicle/equipment rental bookings, return inspection checklists, and Swiss highway vignette records.             |
| **Construction & Sites**   | `/construction`    | `fa-person-digging`      | Construction site diaries, progress billings (SAL), SIA 118 standards, and DM 37/08 compliance.                  |
| **Manufacturing & MRP**    | `/manufacturing`   | `fa-industry`            | Multi-level Bills of Materials (BOM), production routing, work centers, and MRP calculation runs.                |
| **Retail & POS**           | `/retail`          | `fa-cash-register`       | Cash register interface, Italian RT fiscal receipts (_corrispettivi_), and payment terminal integrations.        |
| **DMS & Documents**        | `/dms`             | `fa-folder-open`         | Centralized digital archive, OCR indexing, versioning, and document attachments.                                 |
| **Settings & Security**    | `/settings`        | `fa-gears`               | Multi-tenant organization configuration, RBAC, exchange rates (ECB/SNB), 2FA, and audit logs.                    |

---

## 2. Architecture & Design

The application follows modern Angular best practices, emphasizing modularity, functional APIs, and clean boundaries between the UI layer, reactive state, domain logic, and remote API contracts.

### Key Architectural Patterns

- **100% Standalone Component Architecture**: All components, directives, and pipes are standalone without Angular NgModules. Application bootstrapping uses `bootstrapApplication` in [`src/main.ts`](src/main.ts) powered by configuration in [`src/app/app.config.ts`](src/app/app.config.ts).
- **Default OnPush Change Detection & Native Control Flow**: All components leverage native control flow syntax (`@if`, `@for`, `@switch`) and standard input/output signals (`input()`, `output()`, `model()`).
- **Reactive State Management with Signals & NgRx SignalStore**:
  - Fine-grained reactivity using Angular core signals (`signal()`, `computed()`).
  - Feature state and global stores (e.g., `AuthStore`, `AppStore`, `SwissQrBillStore`) implemented via `@ngrx/signals` (`signalStore`, `withState`, `withComputed`, `withMethods`, `rxMethod`).
- **Layered Clean Architecture / DDD**:
  - **Domain Layer (`src/app/domain/`)**: Pure domain models (e.g., `QrBill`, `Order`) and abstract repository tokens/interfaces (`QrBillRepository`, `OrderRepository`), completely decoupled from Angular UI or wire DTOs.
  - **Data Access Layer (`src/app/data-access/`)**: Wire DTOs (`QrBillDto`), bidirectional mappers (`QrBillMapper`), and concrete HTTP repository implementations (`QrBillHttpRepository`) communicating with the backend.
  - **Core Layer (`src/app/core/`)**: Application singletons, authentication, HTTP interceptors, global lookups, PWA services, and theming.
  - **Shared Layer (`src/app/shared/`)**: Reusable UI widgets, generic resource panels, base data tables, export utilities, directives, and formatting pipes.
  - **Features Layer (`src/app/features/`)**: Lazy-loaded business modules containing smart pages, presentation components, local routes, and feature state stores.
  - **Layout Layer (`src/app/layout/`)**: Application shell consisting of `HeaderComponent`, `SidebarComponent`, and `BreadcrumbComponent`.

### HTTP Interceptor Pipeline

Registered in [`src/app/app.config.ts`](src/app/app.config.ts) through `provideHttpClient(withFetch(), withXsrfConfiguration(), withInterceptors([...]))`:

1. **`credentialsInterceptor`**: Ensures all outgoing requests include credentials (`withCredentials: true`) to support cookie-based sessions.
2. **`csrfRefreshInterceptor`**: Automatically requests and refreshes the Laravel Sanctum CSRF token cookie (`XSRF-TOKEN` / `X-XSRF-TOKEN`) prior to mutating HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`).
3. **`tenantAuthInterceptor`**: Injects active multi-tenant identification headers (`X-Tenant-ID`) and Bearer authorization tokens when operating in token mode.
4. **`idempotencyInterceptor`**: Generates and attaches unique UUID `Idempotency-Key` headers on mutating requests to guard against double-submissions.
5. **`optimisticLockInterceptor`**: Injects optimistic concurrency headers (e.g., `If-Match` ETags) and monitors `412 Precondition Failed` responses.
6. **`paginatedResponseInterceptor`**: Unwraps API pagination envelopes and standardizes metadata for tabular data grids.
7. **`errorInterceptor`**: Catches unhandled HTTP status codes (`401`, `403`, `404`, `422`, `500`), formats validation errors, and presents actionable notifications to the user.

### Route & Role Guards

Routes in [`src/app/app.routes.ts`](src/app/app.routes.ts) are protected by functional guards:

- **`authGuard`**: Protects private routes. Validates client authentication state in `AuthStore` or initiates a verification call to `GET /auth/profile`. Unauthenticated visitors are redirected to `/login` with a `returnUrl` query parameter.
- **`guestGuard`**: Restricts authentication pages (`/login`, `/register`, `/forgot-password`) from already-authenticated users, redirecting them to their destination.
- **`roleGuard(allowedRoles)`**: Enforces role-based access control (RBAC), verifying user roles against required privileges.
- **`moduleGuard(module, mode)`**: Checks whether the active tenant membership grants read/write permissions for a specific ERP module.
- **`menuEnabledGuard`**: Prevents navigation to incomplete or unverified routes, keeping URL-based navigation strictly synchronized with enabled sidebar menu entries (`TESTED_MENU_ROUTES`).
- **`platformAdminGuard`**: Restricts platform administration and internal monitoring pages to users with platform admin privileges (`is_platform_admin`).

### Localization & i18n Strategy

- **Quad-Lingual Architecture**: Full support for Italian (`it`), English (`en`), German (`de`), and French (`fr`).
- **Dynamic Translation Loading**: [`I18nService`](src/app/core/i18n/i18n.service.ts) bootstraps translations during application initialization using `provideAppInitializer()` (`waitForInitialTranslations()`), preventing layout shifts or untranslated UI flash.
- **Unified Sync**: Automatically synchronizes the active locale across:
  - Angular common locale data (`registerLocaleData` for date, number, and currency formatting).
  - NG-ZORRO component language pack (`NzI18nService`).
  - Dynamic page title resolution via custom [`PageTitleStrategy`](src/app/core/i18n/page-title.strategy.ts).
  - Reusable template translation through `TranslatePipe` (`'KEY' | translate`).

---

## 3. Tech Stack & Prerequisites

### Core Framework & Compiler

| Technology                    | Exact Version | Description                                                                                    |
| ----------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| **Angular**                   | `22.2.5`      | Core framework (`@angular/core`, `@angular/common`, `@angular/forms`, `@angular/router`, etc.) |
| **Angular CDK / CLI / Build** | `22.2.6`      | Component Dev Kit, CLI tooling, and application builder (`@angular/build:application`)         |
| **TypeScript**                | `6.0.3`       | Strongly-typed JavaScript with strict compilation flags and isolated modules                   |
| **RxJS**                      | `~7.8.2`      | Reactive programming library used alongside Signals                                            |
| **@ngrx/signals**             | `^22.0.1`     | Fine-grained, signal-based reactive state stores                                               |

### UI Components & Styling

| Library                     | Version     | Description                                                                                             |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| **NG-ZORRO (Ant Design)**   | `^22.2.0`   | Comprehensive enterprise UI component suite (`ng-zorro-antd`)                                           |
| **Ant Design Icons**        | `^22.1.1`   | Official SVG icons for NG-ZORRO (`@ant-design/icons-angular`)                                           |
| **FontAwesome Free**        | `^7.3.1`    | Global web font icons (`@fortawesome/fontawesome-free`)                                                 |
| **Styling & Preprocessors** | Less & SCSS | Component-scoped SCSS and Less theme bundles (`theme.less` and `theme-dark.less` for dynamic dark mode) |

### Key Libraries & Tooling

- **ExcelJS** (`^4.4.0`): Client-side spreadsheet generation and table export.
- **OpenAPI TypeScript** (`^7.13.0`): Type-safe schema generator compiling backend OpenAPI schemas directly into TypeScript typings.
- **Angular Service Worker** (`22.2.5`): PWA support configured via [`ngsw-config.json`](ngsw-config.json).

### Prerequisites

- **Node.js**: `>=22.0.0`
- **pnpm**: `>=10.0.0` (Project repository is locked to `pnpm@12.18.0` via `packageManager` and strictly guarded against `npm`/`yarn` with `only-allow pnpm`).
- **mkcert**: Required for generating trusted local HTTPS development certificates.

---

## 4. Project Structure

Path aliases defined in [`tsconfig.json`](tsconfig.json) map directly to architectural layers:

```
src/
├── app/
│   ├── core/                  # Path alias: @core
│   │   ├── api/               # Typed HTTP client services & generated API contracts
│   │   ├── auth/              # AuthStore, guards (auth, guest, role, menu), permissions, SSO
│   │   ├── http/              # HTTP utilities and Laravel Sanctum response wrappers
│   │   ├── i18n/              # Quad-lingual translation service, types, and title strategy
│   │   ├── interceptors/      # Credentials, CSRF, tenant, idempotency, locks, errors
│   │   ├── lookups/           # Global dropdown data, fiscal codes, and lookup stores
│   │   ├── models/            # Core cross-cutting entities and pagination types
│   │   ├── pwa/               # PWA update notification and cache management
│   │   ├── services/          # Cross-cutting application services
│   │   ├── state/             # Global application state (AppStore)
│   │   └── theme/             # Theme switching service (Dark / Light mode CSS variables)
│   │
│   ├── domain/                # Path alias: @domain
│   │   ├── models/            # Pure enterprise models (e.g., QrBill, Order)
│   │   └── repositories/      # Abstract repository interfaces and InjectionTokens
│   │
│   ├── data-access/           # Path alias: @data-access
│   │   ├── dtos/              # Remote API wire representations
│   │   ├── mappers/           # Bidirectional DTO <-> Domain entity transformers
│   │   └── repositories/      # Concrete HTTP repository implementations
│   │
│   ├── layout/                # Application shell components
│   │   ├── breadcrumb/        # Route-driven dynamic breadcrumbs
│   │   ├── header/            # Company/tenant, jurisdiction, currency, language, theme controls
│   │   └── sidebar/           # Multi-level collapsible navigation tree
│   │
│   ├── shared/                # Path alias: @shared
│   │   ├── components/        # Reusable UI components (BaseTable, SignaturePad, GlobalSearch)
│   │   ├── directives/        # DOM utility directives (autofocus, grid-export)
│   │   ├── pipes/             # Presentation pipes (TranslatePipe, MoneyPipe, CurrencyFormatPipe)
│   │   ├── ui/                # Generic ResourcePanel, PageHeader, and ActionIcon controls
│   │   └── utils/             # Blob download, XLSX export, and file helpers
│   │
│   └── features/              # Path alias: @features/*
│       ├── accounting/        # Dual-ledger, VAT, tax statements, Intrastat
│       ├── automotive/        # Workshop repair orders and Tire Hotel storage
│       ├── crm/               # Client and supplier master data, leads, scoring
│       ├── customs/           # Cross-border IT-CH shipment and customs declarations
│       ├── dashboard/         # Executive overview and operational charts
│       ├── dms/               # Document archive and indexing
│       ├── inventory/         # Warehouses, stock transfers, physical count audits
│       ├── manufacturing/     # Bills of materials (BOM) and production orders (OdP)
│       ├── procurement/       # Requisitions, vendor ratings, RFQs
│       ├── purchases/         # Purchase orders, AP invoices, 3-way matching
│       ├── rent/              # Fleet scheduling, condition checks, vignette tracking
│       ├── retail/            # Touch POS interface, Italian RT receipts, payment terminals
│       ├── sales/             # Invoices, quotes, orders, delivery notes, Swiss QR-Bill
│       ├── settings/          # Tenant setup, currencies, users, audit log
│       ├── time-attendance/   # Clock-in/out terminal, Swiss ArG & Italian rest checks
│       ├── treasury/          # Bank accounts, ISO 20022 reconciliation (camt/pain)
│       └── ...                # Additional vertical ERP modules
│
├── environments/              # Path alias: @env
│   └── environment.ts         # Runtime configuration injected via --define
│
├── assets/                    # Static image and localized assets
├── theme.less                 # Ant Design light theme overrides
├── theme-dark.less            # Ant Design dark theme overrides
└── styles.scss                # Global typography and base layout styling
```

---

## 5. Local Setup & Configuration

### 1. Install Dependencies

This project uses **pnpm** exclusively. A `preinstall` hook prevents unintended execution via `npm` or `yarn`:

```bash
pnpm install --frozen-lockfile
```

### 2. Generate Local HTTPS Certificates

The development server serves over HTTPS (`https://localhost:4200`) and expects certificates in `certs/` (git-ignored):

```bash
# Install mkcert root CA (once per machine)
mkcert -install

# Generate certificate and private key for localhost
mkcert -cert-file certs/localhost.crt -key-file certs/localhost.key localhost 127.0.0.1
```

### 3. Environment Configuration & Precedence

Application runtime settings are managed via [`scripts/ng-env.mjs`](scripts/ng-env.mjs) which compiles values into [`src/environments/environment.ts`](src/environments/environment.ts) using `--define`:

| Variable           | Description                                | Default                                                                             |
| ------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `API_BASE_URL`     | Base path/URL for API endpoints            | `/api/v1`                                                                           |
| `API_PROXY_TARGET` | Backend target URL forwarded by dev proxy  | `https://dev-api.fatturafacile.eu` (development) / `https://localhost:8080` (local) |
| `DEMO_MODE`        | Pre-fills demo credentials on login screen | `false` (default) / `true` (demo)                                                   |
| `TERMS_URL`        | Optional external terms of service URL     | `""`                                                                                |
| `PRIVACY_URL`      | Optional external privacy policy URL       | `""`                                                                                |

**Resolution Order (first defined wins):**

1. System/CI environment variables (`process.env`).
2. Local root `.env` file (git-ignored, optional developer overrides).
3. Preset files under `env/<configuration>.env`:
   - [`env/development.env`](env/development.env): Targets shared development server (`https://dev-api.fatturafacile.eu`).
   - [`env/local.env`](env/local.env): Targets local Docker/Laravel backend (`https://localhost:8080`).
   - [`env/dev.env`](env/dev.env): Production-like development configuration.
   - [`env/production.env`](env/production.env): Production API configuration (`https://api.fatturafacile.eu/api/v1`).
   - [`env/demo.env`](env/demo.env): Public showcase configuration with `DEMO_MODE=true`.

### 4. Dev-Server Proxy (`proxy.conf.mjs`)

To enable same-origin cookie authentication with Laravel Sanctum, [`proxy.conf.mjs`](proxy.conf.mjs) intercepts `/api` and `/sanctum` paths and forwards them to `API_PROXY_TARGET` with rewritten cookie paths and forwarded HTTPS headers.

---

## 6. Development & Production Build

All build and serve routines run through the [`scripts/ng-env.mjs`](scripts/ng-env.mjs) runner:

### Start Development Server

```bash
# Starts dev server with 'development' configuration proxied to dev-api.fatturafacile.eu
pnpm start

# Starts dev server with 'local' configuration proxied to https://localhost:8080
pnpm run start:local

# Opens the browser at:
# https://localhost:4200
```

### Build for Production & Target Environments

```bash
# Builds production configuration by default (AOT, minified, hashed) into dist/fatturafacile/browser
pnpm run build

# Builds specific configuration preset
pnpm run build --configuration production
pnpm run build --configuration dev
pnpm run build --configuration production,demo

# Builds development target continuously on file changes
pnpm run watch
```

### Sandboxed / Docker Agent Execution

For containerized or sandboxed command execution:

```bash
# Run command inside local sandboxed runner
pnpm run agent:sandbox -- <command>

# Run command inside containerized Docker sandbox (.sandbox/Dockerfile)
pnpm run agent:docker -- <command>
```

---

## 7. Testing & Code Quality

### Unit Testing (Vitest & jsdom)

Unit tests utilize **Vitest**, **AnalogJs Vite Angular Plugin**, and **jsdom** configured in [`vitest.config.ts`](vitest.config.ts):

```bash
# Run the complete unit test suite once
pnpm test

# Run tests with code coverage report (v8 coverage provider)
pnpm run test:ci

# Run an individual test file
pnpm exec vitest run src/app/features/sales/state/qr-bill.store.spec.ts

# Run tests matching a specific pattern or name
pnpm exec vitest run -t "SCOR Reference"
```

### End-to-End Testing (Playwright)

Browser E2E tests are located in `tests/` and configured via [`playwright.config.ts`](playwright.config.ts) across Chromium, Firefox, and WebKit:

```bash
# Install browser binaries and OS dependencies (run once)
pnpm exec playwright install --with-deps

# Run E2E tests headlessly
pnpm run e2e
```

### Linting & Formatting

```bash
# Check code and template rules with ESLint (angular-eslint & typescript-eslint)
pnpm run lint

# Auto-fix linting issues where supported
pnpm run lint --fix

# Check formatting with Prettier
pnpm run format:check

# Auto-format all supported files with Prettier
pnpm run format
```

### API Contract Verification & Code Generation

```bash
# Check frontend API implementation against backend OpenAPI specification
pnpm run api:contract

# Audit endpoint coverage between OpenAPI and frontend API services
pnpm run api:coverage

# Generate updated TypeScript API models from OpenAPI schema
pnpm run api:generate
```

---

## 8. License

This project is licensed under the terms of the [MIT License](LICENSE).  
Copyright (c) 2026 FatturaFacile.
