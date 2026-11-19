import { expect, Page, test } from '@playwright/test';
import { seedAuthenticatedSession } from './pages/ErpPages';

/**
 * Critical flow: the report and pivot studio. The API is mocked; the flow is the user's: open the studio on the sales
 * lines, drag a dimension to the rows and a measure to the values, see the pivot, switch to the chart, export, save the
 * report and schedule it every Monday.
 */

const catalog = {
  datasets: [
    {
      key: 'sales_lines',
      label: 'Sales lines',
      module: 'invoicing',
      supports_period: true,
      period_dimension: 'date',
      dimensions: [
        { key: 'customer', label: 'Customer', type: 'string', operators: ['eq', 'in', 'contains'] },
        {
          key: 'date',
          label: 'Invoice date',
          type: 'date',
          operators: ['gte', 'between'],
          granularities: ['day', 'month', 'year'],
        },
      ],
      measures: [{ key: 'line_total', label: 'Line total (net)', unit: 'currency' }],
    },
  ],
  options: {
    filter_logic: ['and', 'or'],
    filter_max_depth: 3,
    measure_operators: ['eq', 'gt'],
    granularities: ['day', 'week', 'month', 'quarter', 'year'],
    period_presets: ['month_to_date', 'year_to_date'],
    max_dimensions: 4,
    max_measures: 8,
    formats: ['csv', 'excel_csv', 'xlsx', 'pdf', 'json'],
    locales: ['it-CH', 'de-CH', 'fr-CH', 'it-IT', 'en'],
    chart_types: ['bar', 'stacked_bar', 'line', 'area', 'pie', 'donut', 'combo'],
    formatting_operators: ['gt', 'lt', 'between'],
    background_tokens: ['none', 'red', 'green'],
    text_tokens: ['default', 'white'],
    calculated: {
      functions: ['ABS', 'ROUND', 'COALESCE', 'NULLIF'],
      formats: ['currency', 'number', 'percentage', 'integer'],
      max_fields: 10,
    },
    visibilities: ['private', 'role_shared', 'tenant_public'],
    delivery_channels: ['email', 'telegram', 'dms', 'webhook', 'sftp'],
    schedule_modes: ['daily', 'weekly', 'monthly', 'cron'],
  },
};

const pivot = {
  row_dimensions: [{ key: 'customer', label: 'Customer', type: 'string', granularity: null }],
  column_dimensions: [],
  values: [
    {
      key: 'line_total',
      label: 'Line total (net)',
      unit: 'currency',
      format: 'currency',
      calculated: false,
    },
  ],
  column_headers: [],
  has_total_column: false,
  rows: [
    {
      type: 'data',
      level: 1,
      keys: ['Alpha Srl'],
      label: 'Alpha Srl',
      cells: [],
      total: { values: { line_total: '1234.50' }, styles: {} },
    },
    {
      type: 'data',
      level: 1,
      keys: ['Beta Srl'],
      label: 'Beta Srl',
      cells: [],
      total: { values: { line_total: '300.00' }, styles: {} },
    },
    {
      type: 'grand_total',
      level: 0,
      keys: [],
      label: '',
      cells: [],
      total: { values: { line_total: '1534.50' }, styles: {} },
    },
  ],
  chart: {
    type: 'bar',
    categories: ['Alpha Srl', 'Beta Srl'],
    series: [{ name: 'Line total (net)', data: ['1234.50', '300.00'] }],
    show_legend: true,
    show_data_labels: false,
  },
  meta: {
    dataset: 'sales_lines',
    truncated: false,
    layout: { rows: ['customer'], columns: [], subtotals: true, grand_totals: true },
  },
};

const savedReport = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'usr-001',
  name: 'Sales by customer',
  description: null,
  dataset: 'sales_lines',
  spec: { dimensions: ['customer'], measures: ['line_total'] },
  pivot: { rows: ['customer'], columns: [], subtotals: true, grand_totals: true },
  calculated_fields: [],
  conditional_formatting: [],
  chart_config: {},
  visibility: 'private',
  shared_role_ids: [],
  is_shared: false,
  shared_with: [],
  is_owner: true,
  created_at: null,
  updated_at: null,
};

const json = (data: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, message: '', data }),
});

async function mockStudioApi(page: Page) {
  const calls = {
    pivot: [] as unknown[],
    exports: [] as unknown[],
    saves: [] as unknown[],
    schedules: [] as unknown[],
  };

  await page.route('**/api/v1/analytics/semantic/catalog', (route) => route.fulfill(json(catalog)));
  await page.route('**/api/v1/analytics/designer/pivot', async (route) => {
    calls.pivot.push(route.request().postDataJSON());
    await route.fulfill(json(pivot));
  });
  await page.route('**/api/v1/analytics/designer/export', async (route) => {
    calls.exports.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      headers: { 'Content-Disposition': 'attachment; filename="report.xlsx"' },
      body: 'PK',
    });
  });
  await page.route('**/api/v1/analytics/designed-reports**', async (route) => {
    if (route.request().method() === 'POST') {
      calls.saves.push(route.request().postDataJSON());
      await route.fulfill(json(savedReport, 201));

      return;
    }
    await route.fulfill(json([savedReport]));
  });
  await page.route('**/api/v1/analytics/export-schedules/cron-preview', (route) =>
    route.fulfill(json({ next_runs: ['2027-03-22T07:00:00+01:00', '2027-03-29T07:00:00+02:00'] })),
  );
  await page.route('**/api/v1/analytics/export-schedules', async (route) => {
    if (route.request().method() === 'POST') {
      calls.schedules.push(route.request().postDataJSON());
      await route.fulfill(
        json(
          {
            schedule: { id: 's1', frequency: 'cron', cron_expression: '0 7 * * 1' },
            webhook_secret: null,
          },
          201,
        ),
      );

      return;
    }
    await route.fulfill(json([]));
  });
  await page.route('**/api/v1/users**', (route) =>
    route.fulfill(
      json([
        {
          id: 'usr-001',
          name: 'Marco Rossi',
          email: 'm.rossi@rossiimpianti.it',
          role: 'owner',
          is_active: true,
        },
      ]),
    ),
  );
  await page.route('**/api/v1/dms/folders**', (route) =>
    route.fulfill(json([{ id: 'f1', name: 'Reports' }])),
  );

  return calls;
}

test.describe('Critical Flow: Report & Pivot Studio', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
  });

  test('builds a pivot from the sales lines, switches view, exports, saves and schedules it weekly', async ({
    page,
  }) => {
    const calls = await mockStudioApi(page);
    await page.goto('/analytics/reports/designer');

    // Drag a dimension to the rows and a measure to the values.
    await expect(page.getByTestId('dim-customer')).toBeVisible();
    await page.getByTestId('dim-customer').dragTo(page.getByTestId('shelf-rows'));
    await page.getByTestId('measure-line_total').dragTo(page.getByTestId('shelf-values'));
    await expect(page.getByTestId('shelf-rows')).toContainText('Customer');
    await expect(page.getByTestId('shelf-values')).toContainText('Line total (net)');

    // The pivot runs on its own and shows the matrix with its grand total.
    const grid = page.getByTestId('pivot-grid');
    await expect(grid).toContainText('Alpha Srl');
    await expect(grid).toContainText(/1\D534[.,]50/);
    expect(calls.pivot.at(-1)).toMatchObject({
      dataset: 'sales_lines',
      pivot: { rows: ['customer'] },
      spec: { measures: ['line_total'] },
    });

    // Pivot grid <-> chart.
    await page.getByTestId('view-switcher').locator('label').nth(1).click();
    await expect(page.getByTestId('pivot-chart')).toBeVisible();
    await expect(grid).toBeHidden();
    await page.getByTestId('view-switcher').locator('label').first().click();
    await expect(grid).toBeVisible();

    // Export as XLSX in the chosen locale.
    const download = page.waitForEvent('download');
    await page.getByTestId('export-button').click();
    await page.getByTestId('export-xlsx').click();
    await download;
    expect(calls.exports.at(-1)).toMatchObject({ format: 'xlsx', dataset: 'sales_lines' });

    // Save the report.
    await page.getByTestId('save-button').click();
    await page.locator('#save-name').fill('Sales by customer');
    await page.getByTestId('save-confirm').click();
    await expect.poll(() => calls.saves.length).toBe(1);
    expect(calls.saves[0]).toMatchObject({
      name: 'Sales by customer',
      visibility: 'private',
      dataset: 'sales_lines',
    });

    // Schedule it every Monday.
    await page.getByTestId('schedule-button').click();
    await expect(page.locator('#sched-cron')).toHaveValue('0 7 * * 1');
    await expect(page.getByTestId('cron-preview')).toContainText('2027-03-22 07:00');
    await page.getByTestId('schedule-save').click();
    await expect.poll(() => calls.schedules.length).toBe(1);
    expect(calls.schedules[0]).toMatchObject({
      designed_report_id: savedReport.id,
      cron_expression: '0 7 * * 1',
      timezone: 'Europe/Zurich',
      delivery_channels: { email: true },
    });
  });

  test('the hub lists the saved reports under their tabs', async ({ page }) => {
    await mockStudioApi(page);
    await page.goto('/analytics/reports');

    await expect(page.getByTestId('report-cards')).toContainText('Sales by customer');
    await expect(page.getByTestId('new-report')).toBeVisible();
  });
});
