import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const shards = Number.parseInt(process.env.VITEST_SHARDS ?? '4', 10);
const maxWorkers = process.env.VITEST_MAX_WORKERS ?? '1';
// CI runs one shard per matrix job (--shard-only=N) and a final job that only merges the reports (--merge-only):
// with no flag the script runs every shard in sequence and merges them, as before.
const args = process.argv.slice(2);
const mergeOnly = args.includes('--merge-only');
const shardOnlyArg = args.find((arg) => arg.startsWith('--shard-only='));
const shardOnly = shardOnlyArg ? Number.parseInt(shardOnlyArg.split('=')[1], 10) : null;
const shardsToRun = mergeOnly
  ? []
  : shardOnly !== null
    ? [shardOnly]
    : Array.from({ length: shards }, (_, idx) => idx + 1);
const thresholds = {
  lines: 70,
  functions: 60,
  branches: 55,
  statements: 70,
};

const coverageRoot = resolve('coverage');
const vitestEntry = resolve('node_modules/vitest/vitest.mjs');

for (const i of shardsToRun) {
  const shardDir = resolve(coverageRoot, `shard-${i}`);
  rmSync(shardDir, { recursive: true, force: true });
}

const existingNodeOptions = process.env.NODE_OPTIONS ?? '';
const nodeOptions = existingNodeOptions.includes('--max-old-space-size')
  ? existingNodeOptions
  : `${existingNodeOptions} --max-old-space-size=4096`.trim();

for (const i of shardsToRun) {
  console.log(`\n=== Running Vitest shard ${i}/${shards} (maxWorkers=${maxWorkers}) ===`);
  const shardDir = `coverage/shard-${i}`;
  const result = spawnSync(
    process.execPath,
    [
      '--max-old-space-size=4096',
      vitestEntry,
      'run',
      `--shard=${i}/${shards}`,
      `--maxWorkers=${maxWorkers}`,
      '--coverage',
      '--coverage.reporter=json',
      `--coverage.reportsDirectory=${shardDir}`,
      '--coverage.thresholds.lines=0',
      '--coverage.thresholds.functions=0',
      '--coverage.thresholds.branches=0',
      '--coverage.thresholds.statements=0',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: nodeOptions,
      },
    },
  );

  if (result.error) {
    console.error(`Failed to spawn shard ${i}/${shards}:`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Vitest shard ${i}/${shards} failed with exit code ${result.status ?? 1}.`);
    process.exit(result.status ?? 1);
  }
}

if (shardOnly !== null) {
  console.log(`\nShard ${shardOnly}/${shards} done: coverage report in coverage/shard-${shardOnly}.`);
  process.exit(0);
}

const merged = {};
for (let i = 1; i <= shards; i += 1) {
  const reportPath = resolve(coverageRoot, `shard-${i}`, 'coverage-final.json');
  if (!existsSync(reportPath)) {
    console.error(`Missing shard coverage report: ${reportPath}`);
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(reportPath, 'utf8'));
  for (const [filePath, cov] of Object.entries(data)) {
    if (!merged[filePath]) {
      merged[filePath] = structuredClone(cov);
      continue;
    }

    const target = merged[filePath];
    for (const [k, count] of Object.entries(cov.s ?? {})) {
      target.s[k] = (target.s[k] ?? 0) + count;
    }
    for (const [k, count] of Object.entries(cov.f ?? {})) {
      target.f[k] = (target.f[k] ?? 0) + count;
    }
    for (const [k, arr] of Object.entries(cov.b ?? {})) {
      const existing = target.b[k] ?? arr.map(() => 0);
      target.b[k] = existing.map((v, idx) => v + (arr[idx] ?? 0));
    }
  }
}

mkdirSync(coverageRoot, { recursive: true });
writeFileSync(resolve(coverageRoot, 'coverage-final.json'), JSON.stringify(merged), 'utf8');

let statementsTotal = 0;
let statementsCovered = 0;
let functionsTotal = 0;
let functionsCovered = 0;
let branchesTotal = 0;
let branchesCovered = 0;
let linesTotal = 0;
let linesCovered = 0;

for (const cov of Object.values(merged)) {
  const lineHits = {};
  for (const [k, count] of Object.entries(cov.s ?? {})) {
    statementsTotal += 1;
    if (count > 0) {
      statementsCovered += 1;
    }
    const loc = cov.statementMap?.[k];
    if (loc?.start?.line != null) {
      lineHits[loc.start.line] = (lineHits[loc.start.line] ?? 0) + count;
    }
  }
  for (const hits of Object.values(lineHits)) {
    linesTotal += 1;
    if (hits > 0) {
      linesCovered += 1;
    }
  }
  for (const count of Object.values(cov.f ?? {})) {
    functionsTotal += 1;
    if (count > 0) {
      functionsCovered += 1;
    }
  }
  for (const arr of Object.values(cov.b ?? {})) {
    for (const count of arr) {
      branchesTotal += 1;
      if (count > 0) {
        branchesCovered += 1;
      }
    }
  }
}

const pct = (covered, total) => (total === 0 ? 100 : (covered / total) * 100);
const summary = {
  statements: pct(statementsCovered, statementsTotal),
  branches: pct(branchesCovered, branchesTotal),
  functions: pct(functionsCovered, functionsTotal),
  lines: pct(linesCovered, linesTotal),
};

console.log('\n=== Merged Vitest Coverage Summary ===');
console.log(`Files:      ${Object.keys(merged).length}`);
console.log(`Statements: ${statementsCovered}/${statementsTotal} (${summary.statements.toFixed(2)}%, min ${thresholds.statements}%)`);
console.log(`Branches:   ${branchesCovered}/${branchesTotal} (${summary.branches.toFixed(2)}%, min ${thresholds.branches}%)`);
console.log(`Functions:  ${functionsCovered}/${functionsTotal} (${summary.functions.toFixed(2)}%, min ${thresholds.functions}%)`);
console.log(`Lines:      ${linesCovered}/${linesTotal} (${summary.lines.toFixed(2)}%, min ${thresholds.lines}%)`);

const failures = Object.entries(thresholds).filter(([metric, min]) => summary[metric] < min);
if (failures.length > 0) {
  for (const [metric, min] of failures) {
    console.error(`ERROR: Coverage for ${metric} (${summary[metric].toFixed(2)}%) does not meet global threshold (${min}%)`);
  }
  process.exit(1);
}

console.log('\nAll coverage thresholds satisfied.');
