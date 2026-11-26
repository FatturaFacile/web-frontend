# Antigravity (`agy`) Rules

See `@AGENTS.md` for project architecture, coding standards, commands, and conventions.

## Antigravity Execution Rules
- Canonical source of truth: `AGENTS.md`.
- Strict typing, zero warnings, ESLint clean (`pnpm run lint`).
- Vitest unit tests must pass (`pnpm test`).
- Angular 22 standalone components, signal inputs/outputs, and `@ngrx/signals`.
- Strict WCAG AA accessibility compliance and quad-lingual translation key coverage.

## TypeScript Lint Conventions (`@typescript-eslint`)
- **Array Syntax (`array-type`):** Always use `T[]` (or `readonly T[]`) instead of `Array<T>` / `ReadonlyArray<T>`.
- **Object Shapes (`consistent-type-definitions`):** Always use `interface` instead of `type` for object shapes and DTOs (reserve `type` strictly for unions, intersections, mapped types, or primitives).
- **Unused Symbols (`no-unused-vars`):** Remove unused imports/variables (e.g., unused `vi` in `.spec.ts` files) or prefix intentionally unused parameters with `_`.

## Angular Templates & Accessibility (`@angular-eslint`)
- **Explicit Label Association:** Every `<label>` in Angular templates MUST be associated with a form control (`@angular-eslint/template/label-has-associated-control`).
- **Native Inputs (`<input>`, `<select>`, `<textarea>`):** Pair `<label for="unique-id">` with a matching `id="unique-id"` on the control (or wrap the native control directly inside `<label>`).
- **NG-ZORRO Controls (`nz-select`, `nz-date-picker`, `nz-input-number`, `nz-switch`, `nz-time-picker`, `nz-cascader`, `nz-tree-select`):** Pair `<label for="unique-id">` with `nzId="unique-id"` (and `id="unique-id"` if `nzId` is unsupported) on the component, keeping the selector listed under `controlComponents` in `eslint.config.js`.
- **Read-Only Captions:** Never use `<label>` for static display values, badges, or non-interactive summaries—use `<span>` or `<div>` instead.
