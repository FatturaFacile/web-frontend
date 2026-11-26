@AGENTS.md

# Claude Code Agent Guidelines

Follow `AGENTS.md` in the repository root as the canonical source of truth for Angular architecture, coding standards, commands, and cross-border ERP rules.

## Claude Workflow & Execution Rules
- **Quality Gates First**: Run `pnpm run lint`, `pnpm exec tsc --noEmit -p tsconfig.app.json`, and `pnpm test` to verify changes before finishing.
- **Package Manager**: Use `pnpm` exclusively (never `npm` or `yarn`).
- **Worktree Discipline**: Perform complex explorations and edits in clean, isolated git worktrees. Clean up temporary worktrees and branches upon task completion.
- **Angular 22 Standards**:
  - Keep components standalone, lean, and default to `OnPush`.
  - Use native control flow (`@if`, `@for`, `@switch`) and signal primitives (`input()`, `output()`, `model()`, `computed()`, `linkedSignal()`).
  - Use `@ngrx/signals` for feature/global state stores.
- **TypeScript & Lint Standards (`@typescript-eslint` + `@angular-eslint`)**:
  - Use `T[]` / `readonly T[]` instead of `Array<T>` / `ReadonlyArray<T>` (`@typescript-eslint/array-type`).
  - Use `interface` instead of `type` for object shapes and DTOs; reserve `type` for unions, intersections, or mapped types (`@typescript-eslint/consistent-type-definitions`).
  - Remove unused imports/variables (such as unused `vi` in `.spec.ts` files) or prefix intentionally unused parameters with `_` (`@typescript-eslint/no-unused-vars`).
- **Accessibility & i18n**:
  - Verify WCAG AA accessibility compliance and AXE rules.
  - **Form Label Association (`@angular-eslint/template/label-has-associated-control`)**: Every `<label>` must explicitly link to a form control via `for="unique-id"`. Pair with `id="unique-id"` on native controls (`<input>`, `<select>`, `<textarea>`) or `nzId="unique-id"` (and `id="unique-id"` if unsupported) on NG-ZORRO controls (`nz-select`, `nz-date-picker`, `nz-input-number`, `nz-switch`, `nz-time-picker`, `nz-cascader`, `nz-tree-select`, etc.), keeping custom selectors registered under `controlComponents` in `eslint.config.js`. Never use `<label>` for read-only captions or static values—use `<span>` or `<div>`.
  - Never hardcode user-facing strings; use quad-lingual translation keys (it, en, de, fr).
- **Credentials & Security**:
  - Never hardcode secrets or test passwords in specs; use `TEST_PASSWORD` from `src/testing/credentials.ts`.

## Git Workflow & Direct Merge Policy (STRICT)
- **Target Branch (`dev`):** Integrate all work directly into `dev` via local merge. **NEVER commit, merge, or push directly to `main`**, and **NEVER create Pull Requests (`gh pr create` / `gh pr`).**
- **Worktree Handling:** If running inside a linked git worktree, finish commits and tests on the feature branch, then run the merge on `dev` from the primary repository root (`git checkout dev && git pull --rebase origin dev && git merge --no-ff <branch>`).
- **Conflict Resolution:** Resolve any merge conflict markers autonomously, preserving Standalone Components, Signals, strict TypeScript types, and all 4 i18n JSON files (`it`, `de`, `fr`, `en`).
- **Pre-Push Quality Gate:** Before `git push origin dev`, execute and ensure zero errors on:
  - `pnpm run lint`
  - `pnpm run build`
  - `pnpm test -- --watch=false`
- **Cleanup:** Delete merged local/remote feature branches and remove temporary worktrees (`git worktree remove` + `git branch -D <branch>`).
