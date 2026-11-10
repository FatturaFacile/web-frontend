// Frontend -> API contract check: every HttpClient call found in the frontend must hit an operation
// (method + path) that exists in the OpenAPI document, and must not be deprecated.
// Usage: node scripts/api-contract-check.mjs ../web-api/docs/api/openapi.json src/app
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const [openapiPath, srcDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(openapiPath, 'utf8'));

const operations = [];
for (const [path, ops] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    const rel = path.replace(/^(\/api)?\/v1/, '');
    const regex = new RegExp('^' + rel.split(/\{[^}]+\}/).map((s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('[^/]+') + '$');
    operations.push({ method: method.toUpperCase(), path, rel, regex, deprecated: !!op.deprecated });
  }
}

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!['generated', 'node_modules', '.claude'].includes(name)) walk(full);
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) files.push(full);
  }
};
walk(srcDir);

const problems = [];
let checked = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const fields = {};
  const resolve = (value) => {
    let out = value.replace(/\$\{environment\.apiBaseUrl\}/g, '');
    out = out.replace(/\$\{this\.(\w+)\}/g, (all, name) => (name in fields ? fields[name] : all));
    return out;
  };
  for (let pass = 0; pass < 3; pass++) {
    for (const m of text.matchAll(/(?:readonly|private|protected|public)\s+(?:readonly\s+)?(\w+)\s*=\s*[`'"]([^`'"]*)[`'"]/g)) fields[m[1]] = resolve(m[2]);
  }
  for (const m of text.matchAll(/\.(get|post|put|patch|delete)\s*(?:<[^()]*?>)?\(\s*(?:`([^`]*)`|'([^']*)'|"([^"]*)"|this\.(\w+))/g)) {
    const method = m[1].toUpperCase();
    let raw = m[2] ?? m[3] ?? m[4] ?? (m[5] in fields ? fields[m[5]] : null);
    if (raw === null) continue;
    raw = resolve(raw).split('?')[0].replace(/\$\{[^}]*\}/g, '{p}');
    if (!raw.startsWith('/')) continue;
    if (raw.includes('${')) continue;
    const line = text.slice(0, m.index).split('\n').length;
    checked++;
    const hit = operations.find((o) => o.method === method && o.regex.test(raw));
    if (!hit) {
      const samePath = operations.filter((o) => o.regex.test(raw)).map((o) => o.method);
      problems.push({ kind: samePath.length ? `WRONG METHOD (API has ${samePath.join('/')})` : 'NO SUCH ENDPOINT', file: relative(srcDir, file), line, call: `${method} ${raw}` });
    } else if (hit.deprecated) {
      problems.push({ kind: 'DEPRECATED', file: relative(srcDir, file), line, call: `${method} ${raw}` });
    }
  }
}
console.log(`checked ${checked} http calls in ${files.length} files, problems ${problems.length}`);
for (const p of problems) console.log(`${p.kind}\t${p.file}:${p.line}\t${p.call}`);
