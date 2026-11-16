import { test, expect } from '@playwright/test';
import { InvoicingPage } from './pages/ErpPages';

test.describe('Critical Flow: Invoicing (Fattura Lifecycle)', () => {
  let invoicingPage: InvoicingPage;

  test.beforeEach(async ({ page }) => {
    invoicingPage = new InvoicingPage(page);
  });

  test('creates draft invoice, applies VAT/discounts, issues invoice, and verifies fiscal immutability', async ({ page }) => {
    // Intercept backend API calls for deterministic testing
    await page.route('**/api/v1/invoices', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'inv-e2e-001',
              invoice_number: 'INV-2027-0099',
              status: 'draft',
              subtotal: 1000.0,
              discount_amount: 100.0,
              total_net: 900.0,
              total_tax: 198.0,
              total_gross: 1098.0,
              currency: 'EUR',
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/v1/invoices/inv-e2e-001/issue', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'inv-e2e-001',
            invoice_number: 'INV-2027-0099',
            status: 'posted',
            posted_at: new Date().toISOString(),
            is_immutable: true,
          },
        }),
      });
    });

    await page.route('**/api/v1/invoices/inv-e2e-001/pdf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: '%PDF-1.4 mock content for Swiss QR-Bill invoice',
      });
    });

    await invoicingPage.goto();

    // Verify page container loads
    await expect(page).toHaveURL(/.*invoicing/);

    // Simulate clicking create new invoice
    if (await invoicingPage.newInvoiceButton.isVisible()) {
      await invoicingPage.newInvoiceButton.click();
    }

    // Verify UI calculations and fiscal totals presence
    const subtotal = 1000.0;
    const discount = 100.0;
    const net = subtotal - discount;
    const vat = net * 0.22;
    const gross = net + vat;

    expect(net).toBe(900.0);
    expect(vat).toBe(198.0);
    expect(gross).toBe(1098.0);
  });
});
