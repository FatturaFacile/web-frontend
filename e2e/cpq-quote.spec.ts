import { expect, test, Page } from '@playwright/test';

const totals = (overrides: Record<string, string | null> = {}) => ({
  list_total: '1000.00',
  line_discount_total: '0.00',
  global_discount_percent: '0.00',
  global_discount_amount: '0.00',
  surcharge_amount: '0.00',
  net_total: '1000.00',
  cost_total: '600.00',
  margin_amount: '400.00',
  margin_percent: '40.00',
  ...overrides,
});

const tid = (page: Page, id: string) => page.locator(`[data-test="${id}"]`);

const json = (data: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'ok', data }) });

/** The app waits for its translations before it starts: serve a minimal dictionary for every language. */
async function mockTranslations(page: Page): Promise<void> {
  await page.route('**/api/v1/translations/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ translations: { 'CPQ.SIGN.TITLE': 'Quote signature', 'CPQ.BUILDER.TITLE': 'Quote' } }),
    }),
  );
}

async function mockSigningApi(page: Page): Promise<{ signBody: () => unknown }> {
  let signed: unknown = null;

  await mockTranslations(page);
  await page.route('**/api/v1/public/quote-signatures/tok-e2e', (route) =>
    route.fulfill(
      json({
        locale: 'de',
        expires_at: '2027-12-01T00:00:00Z',
        quote: {
          quote_number: 'Q-2027-0001',
          date: '2027-11-23',
          valid_until: null,
          currency: 'EUR',
          status: 'draft',
          allow_optional_selection: true,
          total_net: '1000.00',
          total_tax: '81.00',
          total_gross: '1081.00',
          items: [
            { id: 'l1', description: 'Hydraulic press', quantity: '1', unit_price: '1000', tax_rate: '8.10', discount_percentage: '0', line_total: '1000.00', is_optional: false, is_selected: true, specs: ['Color: Red'] },
            { id: 'l2', description: 'Extended warranty', quantity: '1', unit_price: '200', tax_rate: '8.10', discount_percentage: '0', line_total: '200.00', is_optional: true, is_selected: false, specs: [] },
          ],
        },
      }),
    ),
  );
  await page.route('**/api/v1/public/quote-signatures/tok-e2e/pdf**', (route) => route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4' }));
  await page.route('**/api/v1/public/quote-signatures/tok-e2e/sign', async (route) => {
    signed = route.request().postDataJSON();
    await route.fulfill(json({ status: 'signed' }));
  });
  await page.route('**/api/v1/public/quote-signatures/tok-e2e/request-changes', (route) => route.fulfill(json({ status: 'changes_requested' })));

  return { signBody: () => signed };
}

test.describe('Critical Flow: CPQ quote — customer e-signature', () => {
  test('the customer reviews the quote, picks an optional line, signs with a typed signature and accepts', async ({ page }) => {
    const api = await mockSigningApi(page);

    await page.goto('/quote-signature/tok-e2e');

    await expect(tid(page, 'lines')).toContainText('Hydraulic press');
    await expect(tid(page, 'lines')).toContainText('Color: Red');
    await expect(tid(page, 'accept')).toBeDisabled();

    await page.getByRole('checkbox', { name: /Extended warranty/ }).check();
    await page.locator('#signer-name').fill('Anna Keller');
    await page.locator('#signer-role').fill('Purchasing, Keller AG');
    await page.locator('#po-number').fill('PO-77');
    await page.locator('#typed-signature').fill('Anna Keller');
    await tid(page, 'accept-terms').click();
    await expect(tid(page, 'accept')).toBeEnabled();

    await tid(page, 'accept').click();

    await expect(tid(page, 'signed')).toBeVisible();
    expect(api.signBody()).toMatchObject({
      signer_name: 'Anna Keller',
      signer_role: 'Purchasing, Keller AG',
      purchase_order_number: 'PO-77',
      signature_type: 'typed',
      selected_optional_item_ids: ['l2'],
      accept_terms: true,
    });
  });

  test('the customer can ask changes instead of signing', async ({ page }) => {
    await mockSigningApi(page);

    await page.goto('/quote-signature/tok-e2e');
    await tid(page, 'start-changes').click();
    await page.locator('#changes-message').fill('Please add the delivery');
    await tid(page, 'send-changes').click();

    await expect(tid(page, 'changes-sent')).toBeVisible();
  });

  test('an unusable link shows the unavailable message', async ({ page }) => {
    await mockTranslations(page);
    await page.route('**/api/v1/public/quote-signatures/expired', (route) => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'This signature link has expired.' }) }));

    await page.goto('/quote-signature/expired');

    await expect(tid(page, 'invalid')).toBeVisible();
  });
});

test.describe('Critical Flow: CPQ quote — margin, approval and revisions in the back office', () => {
  test('the manager simulates a margin, approves the pending level and compares two revisions', async ({ page }) => {
    await page.route('**/api/v1/sales/quotes/q2/margin', (route) => route.fulfill(json({ lines: [], totals: totals() })));
    await page.route('**/api/v1/sales/quotes/q2/simulate', (route) =>
      route.fulfill(json({ mode: 'target_margin_percent', current: totals(), simulated: totals({ margin_percent: '25.00', net_total: '800.00' }), global_discount_percent: '20.00', achievable: true })),
    );
    await page.route('**/api/v1/sales/quotes/q2/approvals', (route) =>
      route.fulfill(
        json({
          evaluation: { required_level: 1, breaches: [] },
          cleared: false,
          requests: [{ id: 'r1', quote_id: 'q2', level: 1, required_role: 'sales_manager', status: 'pending', triggers: [{ type: 'max_line_discount_percent', limit: '10.00', actual: '15.00' }], requested_by: null, approved_by: null, rejected_by: null, decided_at: null, rejection_reason: null }],
        }),
      ),
    );
    await page.route('**/api/v1/sales/quotes/q2/revisions', (route) =>
      route.fulfill(
        json([
          { id: 'q1', quote_number: 'Q-1', revision_number: 1, status: 'superseded', is_current_revision: false, revision_notes: null, total_net: '1000.00', total_gross: '1081.00', created_at: null },
          { id: 'q2', quote_number: 'Q-2', revision_number: 2, status: 'draft', is_current_revision: true, revision_notes: 'Lower price', total_net: '900.00', total_gross: '972.90', created_at: null },
        ]),
      ),
    );
    await page.route('**/api/v1/sales/quotes/q1/diff/q2', (route) =>
      route.fulfill(
        json({
          from: { id: 'q1', quote_number: 'Q-1', revision_number: 1, status: 'superseded', revision_notes: null },
          to: { id: 'q2', quote_number: 'Q-2', revision_number: 2, status: 'draft', revision_notes: 'Lower price' },
          items: { added: [], removed: [], modified: [{ description: 'Press', product_id: null, changes: { unit_price: { from: '1000.0000', to: '900.0000' } } }] },
          totals: { total_net: { from: '1000.00', to: '900.00', delta: '-100.00' } },
        }),
      ),
    );

    await page.goto('/sales/cycle/quotes/q2/cpq');

    await expect(tid(page, 'banner-pending')).toBeVisible();
    await expect(tid(page, 'figures')).toContainText('600.00');

    await tid(page, 'simulate').click();
    await expect(tid(page, 'simulation')).toContainText('20.00 %');

    await page.getByRole('tab').nth(1).click();
    await tid(page, 'compare').click();
    await expect(tid(page, 'modified')).toContainText('1000.0000 → 900.0000');
  });
});
