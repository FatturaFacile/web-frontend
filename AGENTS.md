# FatturaFacile ERP — Frontend (`web-frontend`) AI Instructions

Angular 22 / TypeScript single-page application for the IT/CH Enterprise ERP platform.

---

## 1. Architecture & Coding Standards

- **Component Model**:
  - 100% Standalone components, directives, and pipes (`bootstrapApplication` in `src/main.ts`).
  - Native control flow syntax (`@if`, `@for`, `@switch`).
  - Signal-based inputs, outputs, and models (`input()`, `output()`, `model()`).
  - Default `ChangeDetectionStrategy.OnPush` across all components.
- **State Management**:
  - Fine-grained reactivity using Angular signals (`signal()`, `computed()`).
  - State management powered by `@ngrx/signals` (`signalStore`, `withState`, `withComputed`, `withMethods`, `rxMethod`).
- **Layered Clean Architecture / DDD**:
  - `src/app/domain/`: Pure domain models, value objects, and abstract repository tokens/interfaces.
  - `src/app/data-access/`: DTOs, mappers, and concrete HTTP repository implementations.
  - `src/app/core/`: Interceptors (CSRF refresh, multi-tenant headers, idempotency), auth, global services.
  - `src/app/features/`: Lazy-loaded business feature modules with smart pages and presentational components.
  - `src/app/shared/`: Reusable UI widgets, directives, pipes, NG-ZORRO base components.
  - `src/app/layout/`: Application shell (`header`, `sidebar`, `breadcrumb`).
- **UI & Theming**:
  - NG-ZORRO (`ng-zorro-antd`) design system.
  - Strict WCAG AA accessibility compliance across interactive forms and navigation.
- **Language**: English for code, comments, commit messages, and tests. All user-facing strings must use translation keys.

---

## 2. Exact Build, Lint, Test & API Commands

```bash
# Package manager: pnpm
pnpm install

# Dev Server
pnpm start
pnpm run start:local

# Strict Production Build
pnpm run build

# Code Linting & Formatting
pnpm run lint
pnpm run format:check
pnpm run format

# Unit & Component Tests (Vitest)
pnpm test
pnpm run test:ci

# End-to-End Tests (Playwright)
pnpm run e2e
pnpm run e2e:a11y

# OpenAPI / API Contracts Synchronization
pnpm run api:coverage
pnpm run api:contract
pnpm run api:generate

# Design Tokens
pnpm run tokens:build
pnpm run tokens:check
```

---

## 3. Database & Testing Policy Integration

- Frontend mock integration and tests must align with backend contract standards.
- In E2E / local testing setups, backend runs against SQLite test environments or mock servers.
- Always verify API contracts against `../web-api/docs/api/openapi.json` via `pnpm run api:contract`.
