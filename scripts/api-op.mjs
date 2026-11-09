// Usage:
//   node scripts/api-op.mjs ../web-api/docs/api/openapi.json list <substring>        -> non-deprecated operations whose path contains <substring>
//   node scripts/api-op.mjs ../web-api/docs/api/openapi.json show <METHOD> v1/<path>  -> parameters, request body and success response as TypeScript-like types
import { readFileSync } from 'node:fs';

/** Git Bash rewrites arguments starting with "/" into Windows paths (C:/Program Files/Git/v1/...): undo that, and accept "v1/..." too. */
const unmangle = (value) => {
  if (typeof value !== 'string') return value;
  if (value.includes('/v1')) return value.slice(value.indexOf('/v1'));
  return value.startsWith('v1/') ? `/${value}` : value;
};
const [file, cmd, rawA, rawB] = process.argv.slice(2);
const a = cmd === 'list' ? unmangle(rawA) : rawA;
const b = unmangle(rawB);
const spec = JSON.parse(readFileSync(file, 'utf8'));

const resolveRef = (ref) => ref.replace('#/', '').split('/').reduce((node, key) => node?.[key], spec);

/** Compact TypeScript-like rendering of a schema (depth-limited, refs inlined once per branch). */
const render = (schema, depth = 0, seen = new Set()) => {
  if (!schema) return 'unknown';
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop();
    if (seen.has(name) || depth > 5) return name;
    return render(resolveRef(schema.$ref), depth, new Set([...seen, name]));
  }
  if (schema.allOf) return schema.allOf.map((s) => render(s, depth, seen)).join(' & ');
  const alt = schema.oneOf ?? schema.anyOf;
  if (alt) return alt.map((s) => render(s, depth, seen)).join(' | ');
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(' | ');
  const nullable = schema.nullable ? ' | null' : '';
  switch (schema.type) {
    case 'array':
      return `${render(schema.items, depth + 1, seen)}[]${nullable}`;
    case 'object':
    case undefined: {
      if (!schema.properties) return (schema.type ? 'Record<string, unknown>' : 'unknown') + nullable;
      const required = new Set(schema.required ?? []);
      const pad = '  '.repeat(depth + 1);
      const rows = Object.entries(schema.properties).map(
        ([key, value]) => `${pad}${key}${required.has(key) ? '' : '?'}: ${render(value, depth + 1, seen)}${value.description ? `  // ${String(value.description).split('\n')[0].slice(0, 90)}` : ''}`,
      );
      return `{\n${rows.join('\n')}\n${'  '.repeat(depth)}}${nullable}`;
    }
    case 'integer':
    case 'number':
      return `number${nullable}`;
    case 'string':
      return `${schema.format === 'binary' ? 'File' : 'string'}${schema.format && schema.format !== 'binary' ? `(${schema.format})` : ''}${nullable}`;
    default:
      return `${schema.type}${nullable}`;
  }
};

const operations = () => {
  const out = [];
  for (const [path, ops] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(ops)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      out.push({ method: method.toUpperCase(), path, op });
    }
  }
  return out;
};

if (cmd === 'list') {
  for (const { method, path, op } of operations()) {
    if (!path.includes(a) || op.deprecated) continue;
    console.log(`${method.padEnd(6)} ${path}  [${(op.tags ?? []).join(',')}]  ${op.summary ?? ''}`);
  }
} else if (cmd === 'show') {
  const found = operations().find((o) => o.method === a.toUpperCase() && o.path === b);
  if (!found) {
    console.error('not found');
    process.exit(1);
  }
  const { method, path, op } = found;
  console.log(`${method} ${path}${op.deprecated ? '  (DEPRECATED)' : ''}`);
  console.log(`${op.summary ?? ''}\n${(op.description ?? '').slice(0, 600)}`);
  const params = [...(spec.paths[path].parameters ?? []), ...(op.parameters ?? [])].map((p) => (p.$ref ? resolveRef(p.$ref) : p));
  if (params.length) {
    console.log('\nPARAMETERS');
    for (const p of params) console.log(`  ${p.in}:${p.name}${p.required ? '' : '?'}: ${render(p.schema)}`);
  }
  const body = op.requestBody?.content?.['application/json']?.schema ?? op.requestBody?.content?.['multipart/form-data']?.schema;
  if (body) console.log(`\nREQUEST BODY\n${render(body)}`);
  for (const [status, response] of Object.entries(op.responses ?? {})) {
    const r = response.$ref ? resolveRef(response.$ref) : response;
    const schema = r.content?.['application/json']?.schema;
    if (/^2/.test(status)) console.log(`\nRESPONSE ${status}\n${schema ? render(schema) : '(no body)'}`);
    else if (/^(403|404|409|422)$/.test(status)) console.log(`RESPONSE ${status}: ${r.description ?? ''}`);
  }
}
