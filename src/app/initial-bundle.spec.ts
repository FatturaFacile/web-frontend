import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The files the shell loads before any route (app component, config, routes, layout, the translate pipe) must import
 * from the files that define what they use, never from the `@core` or `@shared` barrels: a barrel drags every API
 * service and every resource page (date picker, tables, selects ...) into the initial bundle, which has a 2 MB budget.
 */
const root = resolve(process.cwd(), 'src/app');

const SHELL_FILES = [
  'app.component.ts',
  'app.config.ts',
  'app.routes.ts',
  'shared/pipes/translate.pipe.ts',
  'shared/pipes/money.pipe.ts',
  'shared/ui/page-header/page-header.component.ts',
];

function sourcesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return sourcesIn(path);
    }
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

const BARREL_IMPORT = /from\s+'(@core|@shared|@features\/[^']*\/index|\.\.?\/layout)'/;

describe('initial bundle', () => {
  const files = [...SHELL_FILES.map((file) => join(root, file)), ...sourcesIn(join(root, 'layout'))].filter(
    (file) => !file.endsWith(join('layout', 'index.ts')),
  );

  it.each(files.map((file) => [file.replace(root, 'src/app').replaceAll('\\', '/'), file]))(
    '%s does not import a barrel',
    (_name, file) => {
      const offending = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => BARREL_IMPORT.test(line) && !line.includes('./layout'));
      expect(offending).toEqual([]);
    },
  );

  it('the root component only reaches the two-factor modal through a @defer block', () => {
    const template = readFileSync(join(root, 'app.component.html'), 'utf8');
    expect(template).toMatch(/@defer ([^
]*) {s*<app-two-factor-setup-modal/);
  });
});
