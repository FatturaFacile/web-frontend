# Agent Sandboxing & Execution Boundary Guide

## 1. Overview & Threat Model

Autonomous agents, automated scaffolding generators, and continuous integration runners require strong execution boundaries to guarantee:
1. **Confidentiality**: Host secrets, private keys (`certs/localhost.key`), API tokens, and `.env` credentials are never leaked to external endpoints or logged into artifacts.
2. **Integrity**: Critical repositories and configuration structures (such as `.git/`, certificates, and package manager lockfiles) cannot be corrupted or bypassed.
3. **Reproducibility**: Only the declared package manager (`pnpm`) is used for resolving, linking, and executing tasks, eliminating phantom dependencies and non-deterministic `node_modules` states.

```
+-------------------------------------------------------------------------+
|                         Host Environment                                |
|  - .env secrets & tokens (STRIPPED)                                     |
|  - .git / certs / private keys (PROTECTED READ-ONLY)                    |
+-------------------------------------------------------------------------+
                                    |
           [ Sandboxing Policy Engine (.sandbox/sandbox.config.json) ]
                                    |
         +--------------------------+--------------------------+
         |                                                     |
         v                                                     v
+-------------------------------+             +-------------------------------+
|  Process Sandbox Runner       |             |  Containerized Walled Runner  |
|  (scripts/agent-sandbox.mjs)  |             |  (.sandbox/Dockerfile)        |
|  - Scrubbed Env Whitelist     |             |  - Read-Only Root FS (:ro)    |
|  - Path Traversal Validation  |             |  - Dropped Capabilities [ALL] |
|  - pnpm-Only Execution Guard  |             |  - Network Mode: "none"       |
|  - Process Timeout Watchdog   |             |  - Ephemeral Tmpfs Volumes    |
+-------------------------------+             +-------------------------------+
```

---

## 2. Security Boundaries & Protection Rules

### 2.1 Protected Paths
The following files and folders must never be modified, deleted, or traversed outside by agent processes:
- `.git/**`: Version control index and commit logs
- `certs/**`: Local HTTPS certificates and private keys
- `.env` & `.env.*`: Local configuration secrets
- `**/*.key`, `**/*.pem`, `**/*.pfx`: Cryptographic key stores
- `package-lock.json`: Permanently forbidden (blocked by `only-allow pnpm`)

### 2.2 Ephemeral Workspace Directories
All scratch work, intermediary output, and build caches should use designated ephemeral paths:
- `.sandbox/scratch/`: Temporary files, scratch scripts, and patches
- `.sandbox/output/`: Agent-generated summaries, logs, or reports
- `.sandbox/cache/`: Transformed metadata and temporary bundle caches
- `dist/`: Angular application distribution bundles
- `.angular/cache/`: Angular compiler build cache

These directories are ignored by git (`.gitignore`) and excluded from agent indexing (`.agyignore`).

### 2.3 Environment Variable Filtering
Child processes spawned by the runner do not inherit unconstrained host environments. All variables matching the following patterns are stripped:
- `*_KEY*`, `*_SECRET*`, `*_TOKEN*`, `*_PASSWORD*`, `*_AUTH*`
- `SSH_*`, `GITHUB_*`, `QODANA_*`, `TELEGRAM_*`
- `API_PROXY_TARGET`, `DEV_*`

Only safe whitelisted variables (`PATH`, `NODE_ENV`, `CI`, `TEMP`, `SYSTEMROOT`, `APPDATA`, etc.) are exposed.

---

## 3. Sandboxed Execution Usage

### 3.1 Local Process Sandbox
The local sandbox runs natively across Windows, Linux, and macOS without requiring virtualization or Docker:

```bash
# Run unit test suite inside sandbox
pnpm run agent:sandbox -- pnpm test

# Run linter
pnpm run agent:sandbox -- pnpm run lint

# Run production build
pnpm run agent:sandbox -- pnpm run build

# Preview sanitized environment without execution
node scripts/agent-sandbox.mjs --dry-run -- pnpm test

# Wipe ephemeral scratch folders before execution
node scripts/agent-sandbox.mjs --clean -- pnpm test
```

### 3.2 Containerized Docker Sandbox
For complete filesystem isolation and zero-network execution:

```bash
# Run test suite in isolated container with network=none
pnpm run agent:docker -- pnpm test

# Build production bundle in isolated container
pnpm run agent:docker -- pnpm run build
```

The container profile runs as an unprivileged user (UID `10001`), drops all Linux capabilities, sets the root filesystem to `read_only: true`, mounts the repository read-only, and redirects scratch/cache writes to in-memory `tmpfs` mounts.

---

## 4. Package Manager Safeguards

The workspace strictly enforces **pnpm 12.16.1**:
- `package.json` specifies `"packageManager": "pnpm@12.16.1"` and `"preinstall": "npx only-allow pnpm"`.
- `.npmrc` sets `engine-strict=true`, `package-lock=false`, `strict-peer-dependencies=false`, and `auto-install-peers=true`.
- Any invocation of `npm install` fails immediately with an informative error blocking `package-lock.json` generation.
- CI workflows and developer configs invoke `pnpm` exclusively.
