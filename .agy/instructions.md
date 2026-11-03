# Agent Optimization & Execution Guidelines

## Context & Token Saving Rules
1. **Never read whole files unless strictly necessary:** Prefer inspecting interfaces, declarations, and method signatures over entire multi-thousand-line implementations.
2. **Concise diffs only:** When modifying code, emit only the updated methods or focused contextual diffs. Do not reproduce the entire source file.
3. **No conversational padding:** Do not start answers with polite filler phrases ("Sure, I can help with that", "Certainly!"). Start directly with the code solution, patch, or command.
4. **No post-explanation unsolicited text:** Do not explain standard framework syntax unless explicitly asked with "explain" or "why".

## Package Management & Sandboxing Rules
- **Package Manager**: Use `pnpm` exclusively (`packageManager: pnpm@12.16.1`). Never run `npm` or `yarn`.
- **Sandbox Boundary**: Do not read or leak `.env*`, `.git/`, or cryptographic keys in `certs/`.
- **Ephemeral Scratch**: Confine scratch work and intermediary outputs to `.sandbox/scratch/` and `.sandbox/output/`.
- **Sandboxed Runner**: Execute tasks inside process/container sandbox via `pnpm run agent:sandbox -- <command>`.

## Architectural Constraints
- Follow Clean Architecture:
  - Domain: pure business logic, entities, value objects, repository contracts.
  - Data Access: DTOs, mappers, HTTP repository implementations.
  - Core: auth, interceptors, i18n, global app-wide services.
  - Presentation: Feature SignalStores, standalone components, accessible templates.
- Do not add external third-party dependencies unless strictly required.
