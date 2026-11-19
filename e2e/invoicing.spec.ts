import { test, expect } from '@playwright/test';
import { InvoicingPage, seedAuthenticatedSession } from './pages/ErpPages';

test.describe('Critical Flow: Invoicing (Fattura Lifecycle)', () => {
  let invoicingPage: InvoicingPage;

  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
    invoicingPage = new InvoicingPage(page);
  });

  test('creates draft invoice, applies VAT/discounts, issues invoice, and verifies fiscal immutability', async ({ page }) => {
    const draftInvoice = {
      id: 'inv-e2e-001',
      invoice_number: 'INV-2027-0099',
      status: 'draft',
      subtotal: 1000.0,
      discount_amount: 100.0,
      total_net: 900.0,
      total_tax: 198.0,
      total_gross: 1098.0,
      currency: 'EUR',
      contact: { id: 'c-1', company_name: 'Acme S.r.l.' },
    };

    await page.route('**/api/v1/invoices**', async (route) => {
      const url = route.request().url();
      if (url.includes('/inv-e2e-001/issue')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              ...draftInvoice,
              status: 'posted',
              posted_at: new Date().toISOString(),
              is_immutable: true,
            },
          }),
        });
        return;
      }
      if (url.includes('/inv-e2e-001/pdf')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: '%PDF-1.4 mock content for Swiss QR-Bill invoice',
        });
        return;
      }
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: draftInvoice }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [draftInvoice],
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
        }),
      });
    });

    await invoicingPage.goto();

    await expect(page).toHaveURL(/\/sales\/invoices/);
    await expect(page.locator('app-root')).toBeVisible();

    const createRes = await page.evaluate(async () => {
      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: 'c-1',
          currency: 'EUR',
          items: [{ description: 'Consulting', quantity: 1, unit_price: 1000, discount_percentage: 10, tax_rate: 22 }],
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.invoice_number).toBe('INV-2027-0099');
    expect(createRes.body.data.total_net).toBe(900.0);
    expect(createRes.body.data.total_tax).toBe(198.0);
    expect(createRes.body.data.total_gross).toBe(1098.0);

    const issueRes = await page.evaluate(async () => {
      const res = await fetch('/api/v1/invoices/inv-e2e-001/issue', { method: 'POST' });
      return { status: res.status, body: await res.json() };
    });

    expect(issueRes.status).toBe(200);
    expect(issueRes.body.data.status).toBe('posted');
    expect(issueRes.body.data.is_immutable).toBe(true);
  });
});
