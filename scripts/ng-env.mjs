#!/usr/bin/env node
// Runs `ng serve` / `ng build` with the environment configuration resolved from environment variables.
//
// Usage: node scripts/ng-env.mjs <serve|build> [ng options]   (e.g. --configuration production,demo)
//
// Variables are resolved in this order, the first one found wins:
//   1. the process environment (shell, CI)
//   2. .env in the project root (git-ignored, personal overrides)
//   3. env/<configuration>.env for each selected configuration (later ones override earlier ones)
// The values are injected into src/environments/environment.ts with `--define`, and passed on to the
// dev server so proxy.conf.mjs can read API_PROXY_TARGET.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

/** Configurations from -c/--configuration, falling back to the target's defaultConfiguration in angular.json. */
function resolveConfigurations(target, ngArgs) {
  let value;
  for (let i = 0; i < ngArgs.length; i++) {
    const arg = ngArgs[i];
    if (arg === '-c' || arg === '--configuration') {
      value = ngArgs[i + 1];
    } else if (arg.startsWith('-c=') || arg.startsWith('--configuration=')) {
      value = arg.slice(arg.indexOf('=') + 1);
    }
  }
  if (!value) {
    const workspace = JSON.parse(readFileSync(join(root, 'angular.json'), 'utf8'));
    const project = Object.values(workspace.projects)[0];
    value = project.architect[target].defaultConfiguration;
  }
  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Merges env/<configuration>.env files, then .env, then the process environment (empty values are ignored). */
function loadEnv(names) {
  const files = [...names.map((name) => join(root, 'env', `${name}.env`)), join(root, '.env')];
  const merged = {};
  for (const file of files) {
    if (existsSync(file)) {
      Object.assign(merged, parseEnv(readFileSync(file, 'utf8')));
    }
  }
  for (const key of new Set([
    ...Object.keys(merged),
    'API_BASE_URL',
    'API_PROXY_TARGET',
    'DEMO_MODE',
    'TERMS_URL',
    'PRIVACY_URL',
  ])) {
    if (process.env[key]) {
      merged[key] = process.env[key];
    }
  }
  return merged;
}

function fail(message) {
  console.error(`[ng-env] ${message}`);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...args] = process.argv.slice(2);

if (command !== 'serve' && command !== 'build') {
  fail('usage: node scripts/ng-env.mjs <serve|build> [ng options]');
}

const configurations = resolveConfigurations(command, args);
const env = loadEnv(configurations);

const apiBaseUrl = env.API_BASE_URL;
if (!apiBaseUrl) {
  fail(
    `API_BASE_URL is not set for configuration "${configurations.join(',')}": add it to env/<configuration>.env, .env or the environment.`,
  );
}
if (!/^(https?:\/\/[^/]+)?\/\S*$/.test(apiBaseUrl)) {
  fail(
    `API_BASE_URL must be a path starting with "/" or an absolute http(s) URL, got "${apiBaseUrl}".`,
  );
}
if (command === 'serve' && apiBaseUrl.startsWith('/') && !env.API_PROXY_TARGET) {
  fail(
    `API_PROXY_TARGET is required to serve a relative API_BASE_URL ("${apiBaseUrl}"): set the backend the dev server proxies to.`,
  );
}
const demoMode = env.DEMO_MODE === 'true';

console.log(
  `[ng-env] ${command} (${configurations.join(',')}): API_BASE_URL=${apiBaseUrl}` +
    (command === 'serve' && env.API_PROXY_TARGET ? `, proxy -> ${env.API_PROXY_TARGET}` : '') +
    (demoMode ? ', DEMO_MODE=true' : ''),
);

const ngBin = createRequire(import.meta.url).resolve('@angular/cli/bin/ng.js');
const ngArgs = [
  ngBin,
  command,
  ...args,
  '--define',
  `NG_APP_API_BASE_URL=${JSON.stringify(apiBaseUrl)}`,
  '--define',
  `NG_APP_DEMO_MODE=${demoMode}`,
  '--define',
  `NG_APP_TERMS_URL=${JSON.stringify(env.TERMS_URL ?? '')}`,
  '--define',
  `NG_APP_PRIVACY_URL=${JSON.stringify(env.PRIVACY_URL ?? '')}`,
];
const result = spawnSync(process.execPath, ngArgs, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ...env },
});
process.exit(result.status ?? 1);
