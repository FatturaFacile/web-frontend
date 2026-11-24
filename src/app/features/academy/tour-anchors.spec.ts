import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The `data-tour` anchors the Academy product tours (AcademyLearningContentSeeder) point to. A tour step whose
 * selector matches nothing cannot be spotlighted, so every anchor must exist in a template or page config.
 */
const TOUR_ANCHORS = [
  'employee-hire',
  'goods-receipt',
  'invoice-post',
  'invoice-save-draft',
  'invoice-send-sdi',
  'journal-post',
  'leave-approve',
  'mrp-run',
  'order-approve',
  'order-create',
  'payroll-finalize',
  'period-close',
  'po-approve',
  'reconcile',
  'stock-move',
];

const root = resolve(process.cwd(), 'src/app/features');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sources(path);
    }
    return /\.(html|ts)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('Academy tour anchors', () => {
  const code = sources(root).map((file) => readFileSync(file, 'utf8'));

  it.each(TOUR_ANCHORS)('has a data-tour anchor for %s', (anchor) => {
    const html = new RegExp(`data-tour="${anchor}"`);
    const resourceAction = new RegExp(`tour: '${anchor}'`);
    expect(code.some((text) => html.test(text) || resourceAction.test(text))).toBe(true);
  });
});
