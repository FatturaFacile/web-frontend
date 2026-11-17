# Fattura Facile Frontend (`web-frontend`) — AI Agent Instructions

Single source of truth for all AI coding agents working on the Angular 22 enterprise ERP frontend for cross-border Italy (IT) & Switzerland (CH) fiscal compliance.

---

## 1. Project & Stack Overview

- **Core Framework & Compiler**: Angular `22.2.5`, Angular CLI/CDK/Build `22.2.6`, TypeScript `6.0.3` (strict mode, isolated modules).
- **Package Manager**: `pnpm@12.18.0` strictly enforced via `only-allow pnpm` and `packageManager`. Do NOT use `npm` or `yarn`.
- **UI Components & Icons**: NG-ZORRO (`ng-zorro-antd` `^22.2.0`), Ant Design Icons (`^22.1.1`), FontAwesome Free (`^7.3.1`).
- **Styling & Preprocessors**: Component-scoped SCSS and Less theme bundles (`theme.less`, `theme-dark.less` for dynamic light/dark theming).
- **Architectural Pattern**: Layered Clean Architecture / Domain-Driven Design (DDD) with 100% Standalone components:
  - `src/app/domain/` (`@domain`): Pure domain models, value objects, and abstract repository tokens/interfaces decoupled from Angular UI or wire DTOs.
  - `src/app/data-access/` (`@data-access`): Wire DTOs, bidirectional mappers, and concrete HTTP repository implementations communicating with backend APIs.
  - `src/app/core/` (`@core`): Application singletons, AuthStore, HTTP interceptor pipeline (credentials, CSRF refresh, tenant headers, idempotency keys, optimistic locking, error handling), i18n translation service, PWA services, and theming.
  - `src/app/shared/` (`@shared`): Reusable UI widgets (ResourcePanel, BaseTable, SignaturePad, PageHeader), DOM directives, formatting pipes, and export utilities.
  - `src/app/features/` (`@features/*`): Lazy-loaded vertical business domains (accounting, automotive, crm, customs, dashboard, dms, field-service, inventory, manufacturing, procurement, purchases, rent, retail, sales, settings, time-attendance, treasury).
  - `src/app/layout/`: Application shell (`HeaderComponent`, `SidebarComponent`, `BreadcrumbComponent`).

---

## 2. Coding & Quality Standards

- **TypeScript Strictness**: Strict typing enabled. Zero-warning tolerance. Never use `any`; use `unknown` with type guards or pattern matching.
- **Angular 22 Component Standards**:
  - 100% Standalone components, directives, and pipes (`bootstrapApplication` in `src/main.ts`).
  - Do NOT set `standalone: true` (it is the default in Angular 20+).
  - Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly (`OnPush` is the default in Angular 22+).
  - Native control flow only (`@if`, `@for`, `@switch`). Never use `*ngIf`, `*ngFor`, or `*ngSwitch`.
  - Signal-based inputs and outputs: use `input()`, `output()`, and `model()`. Never use `@Input()`, `@Output()` decorators.
  - No `@HostBinding` or `@HostListener` decorators: configure host properties in the `host` object of `@Component` or `@Directive`.
  - Prefer Signal Forms (`@angular/forms/signals`) or Reactive forms over Template-driven forms.
  - Do NOT use `ngClass` or `ngStyle`; use native `class` and `style` bindings.
  - Do NOT import `CommonModule`; import only specific required pipes/directives (e.g. `AsyncPipe`, `DatePipe`).
- **Reactive State Management**:
  - Fine-grained reactivity using Angular core signals (`signal()`, `computed()`, `linkedSignal()`).
  - Global and feature state management via `@ngrx/signals` (`signalStore`, `withState`, `withComputed`, `withMethods`, `rxMethod`).
  - Never call `.mutate()` on signals; use `.update()` or `.set()`. Keep state transformations pure and deterministic.
- **Accessibility (a11y)**:
  - Must pass all AXE checks (`@axe-core/playwright`, `axe-core`).
  - Strict WCAG AA compliance across all components (semantic HTML, keyboard focus management, ARIA roles/labels, tap target sizing, color contrast).
- **Localization (i18n)**:
  - Quad-lingual architecture: Italian (`it`), English (`en`), German (`de`), French (`fr`).
  - All user-facing strings must use translation keys via `TranslatePipe` (`'KEY' | translate`) or `I18nService`.
  - Every new key must be added across all four languages (`database/seeders/Translations/{Italian,English,German,French}FrontendTranslations.php` in backend).
- **Security & Secret Hygiene**:
  - Never commit credentials, passwords, secrets, or API keys.
  - In unit tests, never write fixed passwords or secret strings; import and use `TEST_PASSWORD` from `src/testing/credentials.ts` (or derive from it).

---

## 3. Exact Verification & Quality Gate Commands

Run with `pnpm` (`pnpm.cmd` on Windows). Never use `npm` or `yarn`.

```bash
# Install dependencies (frozen lockfile)
pnpm install --frozen-lockfile

# Local HTTPS Development Server
pnpm start
pnpm run start:local

# Production Build (AOT, minified, strict budgets)
pnpm run build

# Code Formatting (Prettier)
pnpm run format:check
pnpm run format

# Static Analysis & Linting (ESLint, angular-eslint, typescript-eslint)
pnpm run lint
pnpm run lint --fix

# Type Checking
pnpm exec tsc --noEmit -p tsconfig.app.json

# Unit & Component Tests (Vitest + jsdom + AnalogJs)
pnpm test
pnpm run test:ci

# Run single test file or name pattern
pnpm exec vitest run src/app/features/sales/state/qr-bill.store.spec.ts
pnpm exec vitest run -t "SCOR Reference"

# End-to-End Tests (Playwright)
pnpm run e2e
pnpm run e2e:a11y

# Backend OpenAPI Contract Synchronization & Coverage
pnpm run api:contract
pnpm run api:coverage
pnpm run api:generate

# Design Tokens Verification & Build
pnpm run tokens:check
pnpm run tokens:build
```

---

## 4. Database & Testing Policy (Backend Integration)

- This repository is the Angular frontend (`web-frontend`). It pairs with the Laravel backend repository (`web-api`).
- **Local & Automated Testing Database**:
  - When running full-stack integration, backend services, or automated CI/local tests, always use a fresh SQLite database (`DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:` or isolated test SQLite database with foreign keys enabled). Never require or connect to PostgreSQL locally.
  - In Laravel (`web-api`), tests run via `php artisan test` on SQLite `:memory:` with `RefreshDatabase` / `LazilyRefreshDatabase` and seeders enabled. Clean local reset uses `php artisan migrate:fresh --seed --env=testing`.
- **PostgreSQL vs SQLite Invariants**:
  - PostgreSQL is strictly reserved for CI pipelines and the Production environment.
  - All database schemas, migrations, seeders, and query interfaces must remain 100% compatible with both SQLite and PostgreSQL. Avoid driver-locked SQL syntax.
- **Frontend API Alignment**:
  - Wire DTOs and API clients in `src/app/data-access/` must stay 100% synchronized with `../web-api/docs/api/openapi.json`.
  - Always verify API contract integrity with `pnpm run api:contract` when altering remote data structures.
