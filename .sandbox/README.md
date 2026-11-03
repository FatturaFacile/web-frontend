# Agent Sandboxing Boundary

This directory defines the security configuration and execution wrappers for autonomous agents, CI scripts, and automated code generation tools operating on the `fatturafacile` codebase.

## Security Constraints

1. **Workspace Confinement**:
   - Write operations are restricted to designated working source paths (`src/`, `public/`) or ephemeral scratch/build directories (`dist/`, `.angular/cache/`, `.sandbox/scratch/`, `.sandbox/output/`, `.sandbox/cache/`).
   - Protected assets (`.git/`, `certs/`, `.env*`, `**/*.key`, `**/*.pem`) are strictly read-only and must never be modified or exported.

2. **Environment Sanitization**:
   - All secret environment variable patterns (`*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`, `*_AUTH`, `SSH_*`, `GITHUB_*`, `TELEGRAM_*`) are scrubbed before child process execution.
   - Child processes receive only safe whitelisted runtime variables (`NODE_ENV`, `PATH`, `CI`, `TEMP`, `SYSTEMROOT`, etc.).

3. **Package Manager Enforcement**:
   - `pnpm` is enforced exclusively. Invocations of `npm` or `yarn` are blocked with an immediate policy violation.

## Available Runners

- **Native Process Sandbox**:
  ```bash
  pnpm run agent:sandbox -- <command>
  ```
  Applies process-level environment sanitization, boundary checks, and timeout enforcement.

- **Containerized Sandbox**:
  ```bash
  pnpm run agent:docker -- <command>
  # or
  docker compose -f .sandbox/docker-compose.sandbox.yml run --rm agent-sandbox <command>
  ```
  Applies a read-only root filesystem, dropped capabilities (`cap_drop: [ALL]`), unprivileged user UID 10001, isolated tmpfs mounts for outputs, and complete network isolation (`network_mode: "none"`).
