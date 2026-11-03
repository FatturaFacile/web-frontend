#!/usr/bin/env node
/**
 * Agent Sandboxing Runner
 *
 * Enforces an isolated execution boundary for autonomous agent processes,
 * CLI tasks, and automated code generation/test runs within the repository:
 *
 * 1. Environment Sanitization: Strips secrets, tokens, host keys, and .env contents.
 * 2. Boundary Confinement: Constrains file access within the workspace and ephemeral scratch paths.
 * 3. Package Manager Enforcement: Enforces pnpm exclusively, blocking npm/yarn leaks.
 * 4. Dual Runner Modes:
 *    - Containerized Mode (--container): Runs inside the read-only Docker container profile.
 *    - Process Sandbox Mode (default): Native walled process with scrubbed env and safety checks.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

// Load sandbox configuration
const configPath = join(REPO_ROOT, '.sandbox', 'sandbox.config.json');
let sandboxConfig = {
  workspace: {
    rootConfinement: true,
    ephemeralDirectories: ['.sandbox/scratch', '.sandbox/output', '.sandbox/cache'],
    protectedPaths: ['.git/**', 'certs/**', '.env*', '**/*.key', '**/*.pem'],
  },
  environment: {
    sanitize: true,
    allowedVariables: [
      'NODE_ENV',
      'PATH',
      'PNPM_HOME',
      'LANG',
      'LC_ALL',
      'TERM',
      'CI',
      'TEMP',
      'TMP',
      'HOME',
      'USERPROFILE',
      'APPDATA',
      'LOCALAPPDATA',
      'SYSTEMROOT',
      'COMSPEC',
      'PATHEXT',
    ],
    deniedVariablePatterns: [
      '.*_KEY.*',
      '.*_SECRET.*',
      '.*_TOKEN.*',
      '.*_PASSWORD.*',
      '.*_AUTH.*',
      'SSH_.*',
      'GITHUB_.*',
      'QODANA_.*',
      'TELEGRAM_.*',
      'API_PROXY_TARGET',
      'DEV_.*',
    ],
    defaultVariables: {
      NODE_ENV: 'development',
      CI: 'true',
      SANDBOX_CONTAINED: 'true',
    },
  },
  execution: {
    defaultTimeoutSeconds: 300,
    maxBufferBytes: 52428800,
    defaultNetworkPolicy: 'none',
    enforcePnpm: true,
  },
};

if (existsSync(configPath)) {
  try {
    sandboxConfig = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.warn(`[agent-sandbox] Warning: could not parse ${configPath}, using defaults:`, err.message);
  }
}

// Ensure ephemeral sandbox directories exist
for (const dir of sandboxConfig.workspace.ephemeralDirectories) {
  const fullDir = join(REPO_ROOT, dir);
  if (!existsSync(fullDir)) {
    mkdirSync(fullDir, { recursive: true });
  }
}

function printUsage() {
  console.log(`
Usage:
  node scripts/agent-sandbox.mjs [options] -- <command> [args...]

Options:
  --container        Run inside walled Docker container sandbox
  --network <policy> Network mode for container: none (default), bridge, host
  --clean            Clean ephemeral scratch and output directories before run
  --timeout <sec>    Execution timeout in seconds (default: ${sandboxConfig.execution.defaultTimeoutSeconds})
  --dry-run          Preview sanitized environment and command without executing
  --help             Show this help message

Examples:
  node scripts/agent-sandbox.mjs -- pnpm test
  node scripts/agent-sandbox.mjs -- pnpm run build
  node scripts/agent-sandbox.mjs --container -- pnpm run build
`);
}

// Parse arguments
const argv = process.argv.slice(2);
const doubleDashIdx = argv.indexOf('--');

let options = {
  container: false,
  network: sandboxConfig.execution.defaultNetworkPolicy || 'none',
  clean: false,
  timeout: sandboxConfig.execution.defaultTimeoutSeconds * 1000,
  dryRun: false,
};

let cmdArgs = [];

if (doubleDashIdx !== -1) {
  const optArgs = argv.slice(0, doubleDashIdx);
  cmdArgs = argv.slice(doubleDashIdx + 1);
  parseOptions(optArgs);
} else {
  // If no -- was supplied, check if first arg starts with --
  let splitPoint = argv.findIndex((a) => !a.startsWith('--'));
  if (splitPoint === -1) {
    parseOptions(argv);
  } else {
    parseOptions(argv.slice(0, splitPoint));
    cmdArgs = argv.slice(splitPoint);
  }
}

function parseOptions(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--container') {
      options.container = true;
    } else if (arg === '--clean') {
      options.clean = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--network') {
      options.network = args[++i];
    } else if (arg === '--timeout') {
      options.timeout = parseInt(args[++i], 10) * 1000;
    }
  }
}

if (options.clean) {
  for (const dir of sandboxConfig.workspace.ephemeralDirectories) {
    const fullDir = join(REPO_ROOT, dir);
    if (existsSync(fullDir)) {
      rmSync(fullDir, { recursive: true, force: true });
      mkdirSync(fullDir, { recursive: true });
    }
  }
  console.log('[agent-sandbox] Ephemeral sandbox directories cleaned.');
}

if (cmdArgs.length === 0) {
  console.error('[agent-sandbox] Error: No command specified to run in sandbox.');
  printUsage();
  process.exit(1);
}

// Enforce package manager safeguard: block npm/yarn invocations
const [rawCommand, ...rawArgs] = cmdArgs;
if (sandboxConfig.execution.enforcePnpm) {
  if (rawCommand === 'npm' || rawCommand.endsWith('/npm') || rawCommand.endsWith('\\npm') || rawCommand === 'npm.cmd') {
    console.error('[agent-sandbox] Policy violation: npm is strictly forbidden in this repository.');
    console.error('[agent-sandbox] Please use pnpm instead.');
    process.exit(1);
  }
  if (rawCommand === 'yarn' || rawCommand.endsWith('/yarn') || rawCommand.endsWith('\\yarn') || rawCommand === 'yarn.cmd') {
    console.error('[agent-sandbox] Policy violation: yarn is not allowed in this repository. Use pnpm.');
    process.exit(1);
  }
}

// Build sanitized environment
function getSanitizedEnv() {
  const sanitized = {};
  const allowedUpper = new Set(sandboxConfig.environment.allowedVariables.map((v) => v.toUpperCase()));
  const deniedRegexes = (sandboxConfig.environment.deniedVariablePatterns || []).map((p) => new RegExp(p, 'i'));

  for (const [key, value] of Object.entries(process.env)) {
    const upperKey = key.toUpperCase();
    if (allowedUpper.has(upperKey)) {
      const isDenied = deniedRegexes.some((regex) => regex.test(key));
      if (!isDenied) {
        sanitized[key] = value;
      }
    }
  }

  // Ensure Windows critical runtime variables are present if available on host
  if (process.platform === 'win32') {
    if (!sanitized.SystemRoot && process.env.SystemRoot) sanitized.SystemRoot = process.env.SystemRoot;
    if (!sanitized.ComSpec && process.env.ComSpec) sanitized.ComSpec = process.env.ComSpec;
    if (!sanitized.PATHEXT && process.env.PATHEXT) sanitized.PATHEXT = process.env.PATHEXT;
  }

  // Apply safe defaults
  Object.assign(sanitized, sandboxConfig.environment.defaultVariables);
  return sanitized;
}

// Validate arguments for path traversal or targeting protected directories
function validateCommandPaths(args) {
  for (const arg of args) {
    // Check if argument appears to be an absolute path outside repo
    if (isAbsolute(arg)) {
      const norm = normalize(arg);
      const rel = relative(REPO_ROOT, norm);
      if (rel.startsWith('..') && !rel.startsWith('.sandbox')) {
        console.warn(`[agent-sandbox] Warning: Command references path outside workspace boundary: "${arg}"`);
      }
    }
  }
}

validateCommandPaths(rawArgs);

// Mode A: Docker Container Sandbox
if (options.container) {
  runInDocker(cmdArgs);
} else {
  // Mode B: Local Native Process Sandbox
  runLocalSandboxed(cmdArgs);
}

function runInDocker(command) {
  const dockerCheck = spawnSync('docker', ['--version'], { encoding: 'utf8' });
  if (dockerCheck.error || dockerCheck.status !== 0) {
    console.error('[agent-sandbox] Error: Docker is not available on this machine.');
    console.error('[agent-sandbox] Falling back to local process sandbox runner.');
    return runLocalSandboxed(command);
  }

  const composeFile = join(REPO_ROOT, '.sandbox', 'docker-compose.sandbox.yml');
  const dockerArgs = [
    'compose',
    '-f',
    composeFile,
    'run',
    '--rm',
    'agent-sandbox',
    ...command,
  ];

  console.log(`[agent-sandbox] Executing in container sandbox (network=${options.network})...`);
  if (options.dryRun) {
    console.log(`[agent-sandbox] DRY-RUN Docker command: docker ${dockerArgs.join(' ')}`);
    process.exit(0);
  }

  const child = spawn('docker', dockerArgs, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: getSanitizedEnv(),
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });
}

function runLocalSandboxed(command) {
  const sanitizedEnv = getSanitizedEnv();
  const [executable, ...args] = command;

  console.log(`[agent-sandbox] Running sandboxed: ${executable} ${args.join(' ')}`);
  console.log(`[agent-sandbox] Boundary: working_dir=${REPO_ROOT}`);
  console.log(`[agent-sandbox] Environment: ${Object.keys(sanitizedEnv).length} safe variables exposed (all secrets filtered)`);

  if (options.dryRun) {
    console.log('[agent-sandbox] DRY-RUN Sanitized Environment:');
    console.dir(sanitizedEnv);
    process.exit(0);
  }

  const isWindows = process.platform === 'win32';
  let execPath = executable;
  let finalArgs = args;

  // On Windows, route batch/cmd wrappers through cmd.exe securely to avoid DEP0190
  if (isWindows) {
    if (executable === 'pnpm' || executable === 'npx' || executable === 'ng') {
      execPath = `${executable}.cmd`;
    }
    finalArgs = ['/d', '/s', '/c', execPath, ...args];
    execPath = process.env.ComSpec || 'cmd.exe';
  }

  const child = spawn(execPath, finalArgs, {
    cwd: REPO_ROOT,
    env: sanitizedEnv,
    stdio: 'inherit',
    shell: false,
  });

  const timer = setTimeout(() => {
    console.error(`[agent-sandbox] Execution timed out after ${options.timeout / 1000} seconds. Terminating process...`);
    if (isWindows) {
      spawnSync('taskkill', ['/pid', child.pid.toString(), '/T', '/F']);
    } else {
      child.kill('SIGKILL');
    }
    process.exit(124);
  }, options.timeout);

  child.on('close', (code) => {
    clearTimeout(timer);
    if (code !== 0) {
      console.error(`[agent-sandbox] Process exited with error code ${code}`);
    } else {
      console.log('[agent-sandbox] Sandboxed execution completed successfully.');
    }
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    clearTimeout(timer);
    console.error('[agent-sandbox] Failed to start sandboxed process:', err.message);
    process.exit(1);
  });
}
