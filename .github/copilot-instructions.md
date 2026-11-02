# Agent Optimization & Execution Guidelines

## Context & Token Saving Rules

1. **Never read whole files unless strictly necessary:** Prefer inspecting interfaces, declarations, and method signatures over entire multi-thousand-line implementations.
2. **Concise diffs only:** Keep modifications focused; avoid reproducing unchanged source.
3. **No conversational padding:** Start with the requested result, code, or command.
4. **No post-explanation unsolicited text:** Do not explain standard language or framework syntax unless explicitly asked.

## Repository workflow

- Do not add third-party dependencies unless they are required.
- This repository uses pnpm (`packageManager` is declared in `package.json`). Install dependencies with `pnpm install --frozen-lockfile`.

## Build, test, and lint

- `pnpm start` runs the HTTPS development server with the development environment.
- `pnpm run start:local` runs the `local` Angular configuration and proxy; check `proxy.conf.json` and `src/environments/environment.local.ts` for the current targets.
- `pnpm run build` builds the production configuration by default. CI uses `pnpm run build --configuration production`.
- `pnpm run lint` runs ESLint across the repository.
- `pnpm test` runs the Vitest suite once. To run one spec, use `pnpm exec vitest run src/app/features/sales/state/qr-bill.store.spec.ts`; add `-t "test name"` to select a test by name.
- `pnpm test:ci` runs tests with coverage. `pnpm run format:check` checks Prettier formatting.

## Application architecture

- This is an Angular 22 standalone application. `src/main.ts` boots the app through `app.config.ts`; global providers, HTTP/XSRF configuration, and the ordered HTTP interceptors are registered there.
- `src/app/app.routes.ts` is the route map. Business areas under `src/app/features/` are lazy-loaded through feature route files; keep feature-specific pages, components, and state within their feature.
- `src/app/layout/` contains the shared authenticated application shell. `src/app/core/` holds app-wide concerns such as auth, API services, interceptors, configuration, i18n, and global state. `src/app/shared/` contains reusable UI and presentation helpers.
- The order, QR-Bill, and time-attendance slices demonstrate the layered data flow: domain models and repository tokens/contracts in `domain/`, wire DTOs, mappers, and HTTP repository implementations in `data-access/`, and feature SignalStores consuming repository contracts. Other features may use the existing `core/api` services or feature facades; follow the pattern already used in the area being changed rather than imposing a repository refactor across the app.
- Feature stores use NgRx SignalStore (`withState`, `withComputed`, `withMethods`); async repository work commonly uses `rxMethod`. Keep DTO/API shapes at the data boundary and use domain models in stores and UI where that slice already follows this pattern.
- API base URLs and the `demoMode` flag come from the selected environment file; all checked-in environments currently set `demoMode` to `false`. Check the file replacement in `angular.json` before changing environment-specific behavior.

## Repository conventions

- Use the path aliases declared in `tsconfig.json` (`@core`, `@domain`, `@data-access`, `@shared`, `@features`, and `@env`) instead of long relative imports. Vitest repeats these aliases in `vitest.config.ts`; keep both configurations aligned when changing them.
- Components use standalone imports and feature-local SCSS/HTML files; global theme styles are configured in `angular.json`. Follow the existing Angular template and component style in the target feature.
- Tests use Vitest with Angular `TestBed` and jsdom (`vitest.config.ts`, `src/test-setup.ts`). Test files live alongside their code and use the `.spec.ts` suffix. Pure mapper tests do not need Angular TestBed.
- Feature routes and the root route table carry page title and breadcrumb data consumed by the application shell. Preserve that metadata when adding or changing navigable pages.
- The documented cross-border business rules and showcase behavior are described in `README.md`; use it together with the relevant feature/domain code when modifying those flows.
