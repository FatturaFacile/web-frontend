import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [openapiPath, srcDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(openapiPath, 'utf8'));

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== 'generated') walk(full);
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
      files.push(full);
    }
  }
};
walk(srcDir);
/** Resolves `${environment.apiBaseUrl}` and `${this.someUrl}` fields so composed URLs become plain paths. */
const resolveFile = (text) => {
  let out = text.replace(/\$\{environment\.apiBaseUrl}/g, '').replace(/\$\{this\.apiUrl}/g, '');
  const fields = {};
  for (let pass = 0; pass < 3; pass++) {
    for (const m of out.matchAll(/(?:readonly|private|protected|public)\s+(?:readonly\s+)?(\w+)\s*=\s*[`'"]([^`'"]*)[`'"]/g)) {
      fields[m[1]] = m[2];
    }
    out = out.replace(/\$\{this\.(\w+)}/g, (all, name) => (name in fields ? fields[name] : all));
  }
  return out;
};
const source = files.map((f) => resolveFile(readFileSync(f, 'utf8'))).join('\n');

const toRegex = (path) => {
  const rel = path.replace(/^(\/api)?\/v1/, '');
  const escaped = rel
    .split(/\{[^}]+}/)
    .map((part) => part.replace(/[.*+?^$()|[\]\\]/g, '\\$&'))
    .join('[^\'"`/]*');
  return new RegExp(escaped + '(?![\\w-])');
};

const byTag = {};
let total = 0;
let covered = 0;
for (const [path, ops] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method) || op.deprecated) continue;
    const tag = (op.tags && op.tags[0]) || 'untagged';
    byTag[tag] ??= { total: 0, covered: 0, missing: [] };
    byTag[tag].total++;
    total++;
    const rel = path.replace(/^(\/api)?\/v1/, '');
    const hit = rel.length > 1 && (toRegex(path).test(source));
    if (hit) {
      byTag[tag].covered++;
      covered++;
    } else {
      byTag[tag].missing.push(`${method.toUpperCase()} ${path}`);
    }
  }
}

console.log(`TOTAL ${covered}/${total}`);
const rows = Object.entries(byTag).sort((a, b) => b[1].total - b[1].covered - (a[1].total - a[1].covered));
for (const [tag, row] of rows) {
  if (row.covered < row.total) console.log(`${String(row.total - row.covered).padStart(4)} missing  ${row.covered}/${row.total}  ${tag}`);
}
if (process.argv[4]) {
  for (const [tag, row] of rows) for (const m of row.missing) console.log(`MISSING\t${tag}\t${m}`);
}
