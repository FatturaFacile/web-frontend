import { test, expect, type Page } from '@playwright/test';
import { seedAuthenticatedSession } from './pages/ErpPages';

const MONDAY = '2027-02-08';

function cell(period: string, net: number, hard: number, soft: number) {
  const booked = hard + soft;
  const load = net === 0 ? (booked > 0 ? 999 : 0) : Math.round((booked / net) * 10000) / 100;
  return {
    period_start: period,
    contractual_hours: 40,
    leave_and_holiday_hours: 40 - net,
    net_available_hours: net,
    hard_booked_hours: hard,
    soft_booked_hours: soft,
    billable_booked_hours: booked,
    internal_booked_hours: 0,
    load_percent: load,
    band: load > 100 ? 'red' : load >= 80 ? 'yellow' : 'green',
    is_overloaded: load > 100,
  };
}

async function stubPlanningApi(page: Page): Promise<{ rebalanceBodies: unknown[] }> {
  const rebalanceBodies: unknown[] = [];
  const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'ok', data }) });

  await page.route('**/api/v1/resource-planning/capacity/heatmap**', (route) =>
    route.fulfill(
      ok({
        from: MONDAY,
        to: '2027-02-14',
        granularity: 'week',
        thresholds: { yellow: 80, red: 100 },
        periods: [MONDAY],
        rows: [
          { employee_id: 'e-1', employee_name: 'Anna Rossi', department_id: null, department_name: 'Design', cost_center_id: null, weekly_contract_hours: 40, cells: [cell(MONDAY, 40, 30, 20)] },
          { employee_id: 'e-2', employee_name: 'Bruno Bianchi', department_id: null, department_name: 'Build', cost_center_id: null, weekly_contract_hours: 40, cells: [cell(MONDAY, 40, 10, 0)] },
        ],
      }),
    ),
  );

  await page.route('**/api/v1/resource-planning/allocations**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.url().includes('/rebalance')) {
      rebalanceBodies.push(JSON.parse(request.postData() ?? '{}'));
      await route.fulfill(ok({ allocation: {}, allocations: [], overload: { is_overloaded: false, peak_load_percent: 75, weeks: [] }, warnings: [] }));
      return;
    }
    await route.fulfill(ok([]));
  });

  await page.route('**/api/v1/resource-planning/resources**', (route) => route.fulfill(ok([])));
  await page.route('**/api/v1/resource-planning/skills**', (route) => route.fulfill(ok([])));
  await page.route('**/api/v1/resource-planning/employee-skill-profiles**', (route) => route.fulfill(ok([])));
  await page.route('**/api/v1/resource-planning/utilization-targets**', (route) => route.fulfill(ok([])));
  await page.route('**/api/v1/resource-planning/reports/billable-utilization**', (route) =>
    route.fulfill(ok({ from: MONDAY, to: '2027-02-14', group_by: 'resource', default_target_percent: 75, rows: [], totals: null })),
  );

  return { rebalanceBodies };
}

test.describe('Resource planning and capacity saturation (Mod 079)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
  });

  test('shows the capacity heatmap with the saturation bands and flags the overloaded resource', async ({ page }) => {
    await stubPlanningApi(page);

    await page.goto('/resource-planning');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page.locator('.heatmap')).toBeVisible();
    await expect(page.locator('.heat-row')).toHaveCount(2);
    await expect(page.locator('.cell.band-red')).toHaveCount(1);
    await expect(page.locator('.cell.band-green')).toHaveCount(1);
    await expect(page.locator('.overload-badge')).toBeVisible();
  });

  test('opens the billable utilization and the skill matrix pages', async ({ page }) => {
    await stubPlanningApi(page);

    await page.goto('/resource-planning/utilization');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).toHaveURL(/\/resource-planning\/utilization/);

    await page.goto('/resource-planning/skills');
    await expect(page).toHaveURL(/\/resource-planning\/skills/);
    await expect(page.locator('app-root')).toBeVisible();
  });
});
