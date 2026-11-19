# JetBrains Junie / AI Assistant Guidelines

Canonical specification: refer to `AGENTS.md` in repository root.

## Architectural & Coding Standards
- **Framework**: Angular 22 standalone components with TypeScript 6.
- **State**: Angular core signals and `@ngrx/signals` stores (`signalStore`).
- **Templates**: Native control flow syntax (`@if`, `@for`, `@switch`).
- **Styling**: NG-ZORRO (`ng-zorro-antd`) + component-level SCSS and Less theme bundles.
- **Accessibility**: Full WCAG AA compliance and zero AXE violations.
- **Localization**: Quad-lingual translations (`it`, `en`, `de`, `fr`) using `TranslatePipe`.

## Local Verification Commands
- `pnpm run build` — Production build verification
- `pnpm run lint` — ESLint validation
- `pnpm exec tsc --noEmit -p tsconfig.app.json` — TypeScript static analysis
- `pnpm test` — Vitest unit test suite
- `pnpm run api:contract` — Backend OpenAPI schema alignment check
