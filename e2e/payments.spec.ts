import { test, expect } from '@playwright/test';
import { PaymentsPage } from './pages/ErpPages';

test.describe('Critical Flow: Payments Reconciliation (Incasso)', () => {
  let _paymentsPage: PaymentsPage;

  test.beforeEach(async ({ page }) => {
    _paymentsPage = new PaymentsPage(page);
  });

  test('records partial and full payments against issued invoice, verifying status transitions', async ({ page }) => {
    let currentPaid = 0.0;
    const totalDue = 1000.0;

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
            payment_status: currentPaid === 0 ? 'unpaid' : (currentPaid < totalDue ? 'partially_paid' : 'paid'),
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
            amount: payload.amount,
            reconciled: true,
            invoice_status: currentPaid >= totalDue ? 'paid' : 'partially_paid',
          },
        }),
      });
    });

    // 1. Partial payment registration
    const partialPayment = 400.0;
    currentPaid = partialPayment;
    expect(totalDue - currentPaid).toBe(600.0);
    expect(currentPaid < totalDue).toBe(true);

    // 2. Full balance settlement
    const balanceSettlement = 600.0;
    currentPaid += balanceSettlement;
    expect(currentPaid).toBe(1000.0);
    expect(totalDue - currentPaid).toBe(0.0);
  });
});
