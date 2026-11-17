@AGENTS.md

# Web-Frontend Claude Instructions

Follow `AGENTS.md` in this directory as the single source of truth for Angular architecture, coding standards, and commands.

## Key Workflow Rules
- Always use standalone components with `ChangeDetectionStrategy.OnPush`.
- Prefer Angular Signals (`signal()`, `computed()`) and `@ngrx/signals` stores over RxJS for local/feature state.
- Use native control flow (`@if`, `@for`, `@switch`) and signal inputs/outputs (`input()`, `output()`).
- Run `pnpm run lint` and `pnpm test` to verify changes.
- Ensure all UI additions maintain WCAG AA accessibility compliance.
