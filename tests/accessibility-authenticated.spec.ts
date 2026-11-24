import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// WCAG 2.2 AA audit of the authenticated shell (sidebar, header, breadcrumb) and of representative module pages.
// The API is stubbed: `/auth/profile` returns a member with every permission and any other `/api/v1` call an empty
// collection, so the audit is deterministic and needs no backend. Any violation fails the test.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PAGES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'invoices', path: '/sales/invoices' },
  { name: 'crm', path: '/crm' },
  { name: 'inventory', path: '/inventory' },
  { name: 'treasury', path: '/treasury' },
  { name: 'settings', path: '/settings' },
  { name: 'design-system', path: '/design-system' },
];
const THEMES = ['light', 'dark'] as const;
const DENSITIES = ['compact', 'comfortable'] as const;

const PROFILE = {
  id: 'usr-001',
  name: 'Marco Rossi',
  email: 'm.rossi@rossiimpianti.it',
  role: 'owner',
  roles: ['owner', 'admin'],
  permissions: ['*'],
  active_tenant: { id: 't-it-01', name: 'Rossi Impianti S.r.l.', country: 'IT', role: 'owner' },
  tenants: [
    { id: 't-it-01', name: 'Rossi Impianti S.r.l.', country: 'IT', role: 'owner', permissions: ['*'] },
  ],
};

async function stubSession(page: Page, theme: string, density: string): Promise<void> {
  await page.addInitScript(
    ([t, d, profile]) => {
      localStorage.setItem('theme', t);
      localStorage.setItem('ff-density', d);
      localStorage.setItem('ff_is_authenticated', 'true');
      localStorage.setItem('ff_active_user_id', 'usr-001');
      localStorage.setItem('ff_user_profile', profile);
      localStorage.setItem('ff_active_tenant_id', 't-it-01');
    },
    [theme, density, JSON.stringify(PROFILE)] as const,
  );
  await page.route('**/api/v1/**', (route) => {
    const url = route.request().url();
    // The app does not boot until translations arrive, so they must be served (a minimal dictionary is enough).
    const body = /\/translations\//.test(url)
      ? { translations: { 'a11y.skipToContent': 'Skip to content' } }
      : /\/auth\/profile|\/auth\/me/.test(url)
        ? { data: PROFILE }
        : { data: [], meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 } };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

for (const entry of PAGES) {
  for (const theme of THEMES) {
    for (const density of DENSITIES) {
      test(`a11y authenticated ${entry.name} · ${theme} · ${density}`, async ({ page }) => {
        await stubSession(page, theme, density);
        await page.goto(entry.path);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page).not.toHaveURL(/\/login/);

        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
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

test('keyboard: the skip link and the sidebar are reachable with Tab and show a focus ring', async ({ page }) => {
  await stubSession(page, 'light', 'comfortable');
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
  }
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el && el !== document.body ? getComputedStyle(el).outlineStyle : 'none';
  });
  expect(outline).not.toBe('none');
});
