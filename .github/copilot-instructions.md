# GitHub Copilot Instructions

Canonical reference: see `AGENTS.md` at repository root for complete architecture, rules, and verification procedures.

## Core Directives & Quality Gates
- **Package Manager**: Use `pnpm` exclusively (`pnpm install --frozen-lockfile`).
- **Framework & Language**: Angular 22 standalone components (`bootstrapApplication`), TypeScript strict mode, NG-ZORRO (`ng-zorro-antd`).
- **Templates & Control Flow**: Native control flow (`@if`, `@for`, `@switch`). No `*ngIf`, `*ngFor`.
- **Reactivity & State**: Angular signals (`input()`, `output()`, `model()`, `computed()`, `linkedSignal()`) and `@ngrx/signals` (`signalStore`).
- **Accessibility & i18n**: WCAG AA / AXE compliant UI, quad-lingual i18n keys (`it`, `en`, `de`, `fr`).
- **Secret Hygiene**: Use `TEST_PASSWORD` from `src/testing/credentials.ts` for tests; never hardcode plain text credentials.

## Primary Verification Commands
- Build: `pnpm run build`
- Lint: `pnpm run lint`
- Type Check: `pnpm exec tsc --noEmit -p tsconfig.app.json`
- Tests: `pnpm test`
- API Contracts: `pnpm run api:contract`
