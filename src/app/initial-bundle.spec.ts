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

const BARREL_IMPORT = /from\s+'(@core|@shared)'/;

describe('initial bundle', () => {
  const files = [...SHELL_FILES.map((file) => join(root, file)), ...sourcesIn(join(root, 'layout'))];

  it.each(files.map((file) => [file.replace(root, 'src/app').replaceAll('\\', '/'), file]))(
    '%s does not import a barrel',
    (_name, file) => {
      const offending = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => BARREL_IMPORT.test(line));
      expect(offending).toEqual([]);
    },
  );

  it('the root component does not load the two-factor modal eagerly', () => {
    // The mandatory-MFA setup lives on its own lazy route (two-factor-required), so the shell must not import the modal.
    const template = readFileSync(join(root, 'app.component.html'), 'utf8');
    const component = readFileSync(join(root, 'app.component.ts'), 'utf8');
    expect(template).not.toContain('app-two-factor-setup-modal');
    expect(component).not.toContain('TwoFactorSetupModalComponent');
  });
});
