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
- **Accessibility & i18n**:
  - Verify WCAG AA accessibility compliance and AXE rules.
  - Never hardcode user-facing strings; use quad-lingual translation keys (it, en, de, fr).
- **Credentials & Security**:
  - Never hardcode secrets or test passwords in specs; use `TEST_PASSWORD` from `src/testing/credentials.ts`.
