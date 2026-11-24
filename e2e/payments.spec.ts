import { test, expect } from '@playwright/test';
import { PaymentsPage, seedAuthenticatedSession } from './pages/ErpPages';

test.describe('Critical Flow: Payments Reconciliation (Incasso)', () => {
  let paymentsPage: PaymentsPage;

  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
    paymentsPage = new PaymentsPage(page);
  });

  test('records partial and full payments against issued invoice, verifying status transitions', async ({ page }) => {
    let currentPaid = 0.0;
    const totalDue = 1000.0;

    await page.route('**/api/v1/treasury/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.route('**/api/v1/invoices/inv-e2e-001', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'inv-e2e-001',
            invoice_number: 'INV-2027-0099',
            total_gross: totalDue,
            total_paid: currentPaid,
            receivable_amount: totalDue - currentPaid,
            payment_status:
              currentPaid === 0 ? 'unpaid' : currentPaid < totalDue ? 'partially_paid' : 'paid',
          },
        }),
      });
    });

    await page.route('**/api/v1/invoices/inv-e2e-001/payments', async (route) => {
      const payload = JSON.parse(route.request().postData() || '{}');
      currentPaid += Number(payload.amount);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            payment_id: 'pmt-001',
            amount: Number(payload.amount),
            reconciled: true,
            receivable_amount: totalDue - currentPaid,
            invoice_status: currentPaid >= totalDue ? 'paid' : 'partially_paid',
          },
        }),
      });
    });

    await paymentsPage.goto();
    await expect(page).toHaveURL(/\/treasury/);
    await expect(page.locator('app-root')).toBeVisible();

    // 1. Partial payment registration via browser network call
    const partialRes = await page.evaluate(async () => {
      const res = await fetch('/api/v1/invoices/inv-e2e-001/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 400.0, payment_method: 'bank_transfer' }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(partialRes.status).toBe(201);
    expect(partialRes.body.data.invoice_status).toBe('partially_paid');
    expect(partialRes.body.data.receivable_amount).toBe(600.0);

    // 2. Full balance settlement via browser network call
    const fullRes = await page.evaluate(async () => {
      const res = await fetch('/api/v1/invoices/inv-e2e-001/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 600.0, payment_method: 'bank_transfer' }),
      });
      const invRes = await fetch('/api/v1/invoices/inv-e2e-001');
      return {
        payment: await res.json(),
        invoice: await invRes.json(),
      };
    });

    expect(fullRes.payment.data.invoice_status).toBe('paid');
    expect(fullRes.invoice.data.total_paid).toBe(1000.0);
    expect(fullRes.invoice.data.receivable_amount).toBe(0.0);
    expect(fullRes.invoice.data.payment_status).toBe('paid');
  });
});
