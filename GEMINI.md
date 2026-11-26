@AGENTS.md

# Gemini CLI Instructions

All instructions, coding standards, and commands are governed by `AGENTS.md`.

- **Architecture & State**: Follow Angular 22 standalone, native control flow (`@if`, `@for`, `@switch`), signals (`input()`, `output()`, `model()`, `computed()`), and `@ngrx/signals` patterns.
- **TypeScript & Lint (`pnpm run lint`)**:
  - Use `T[]` / `readonly T[]` instead of `Array<T>` (`@typescript-eslint/array-type`).
  - Use `interface` instead of `type` for object shapes and DTOs (`@typescript-eslint/consistent-type-definitions`).
  - Remove unused imports/variables or prefix intentionally unused parameters with `_` (`@typescript-eslint/no-unused-vars`).
- **Angular Templates & Accessibility (`@angular-eslint`)**:
  - Pair every `<label for="unique-id">` with a matching `id="unique-id"` on native controls (`<input>`, `<select>`, `<textarea>`) or `nzId="unique-id"` on NG-ZORRO controls (`nz-select`, `nz-date-picker`, `nz-input-number`, `nz-switch`, `nz-time-picker`, `nz-cascader`, `nz-tree-select`, registered in `controlComponents` inside `eslint.config.js`).
  - Never use `<label>` for static display values or read-only captions—use `<span>` or `<div>`.
- **Quality & i18n**: Ensure zero lint errors/warnings, passing Vitest suites (`pnpm test`), and quad-lingual translation coverage (`it`, `en`, `de`, `fr`).
