import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// WCAG 2.2 AA audit (axe-core rules tagged wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa). Any violation fails the
// test, so a regression is blocking. Public pages only: authenticated screens are audited the same way once a
// seeded session is available to the e2e suite.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PAGES = [{ name: 'login', path: '/login' }];
const THEMES = ['light', 'dark'] as const;
const DENSITIES = ['compact', 'comfortable'] as const;
const BRANDS = ['teal', 'indigo', 'purple', 'amber'] as const;

for (const page of PAGES) {
  for (const theme of THEMES) {
    for (const density of DENSITIES) {
      for (const brand of BRANDS) {
        test(`a11y ${page.name} · ${theme} · ${density} · ${brand}`, async ({ page: p }) => {
          await p.addInitScript(
            ([t, d, b]) => {
              localStorage.setItem('theme', t);
              localStorage.setItem('ff-density', d);
              localStorage.setItem('ff-brand', b);
            },
            [theme, density, brand],
          );
          await p.goto(page.path);
          await p.waitForLoadState('networkidle');
          await expect(p.locator('html')).toHaveAttribute('data-theme', theme);
          await expect(p.locator('html')).toHaveAttribute('data-brand', brand);

          const results = await new AxeBuilder({ page: p }).withTags(WCAG_TAGS).analyze();
          expect(
            results.violations,
            JSON.stringify(
              results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
            ),
          ).toEqual([]);
        });
      }
    }
  }
}

test('keyboard: Tab reaches an interactive element with a visible focus ring', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input').first().waitFor();
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? getComputedStyle(el).outlineStyle : 'none';
  });
  expect(outline).not.toBe('none');
});
