import { expect, test } from '@playwright/test';

test.describe('VAT Calculator', () => {
  test.beforeEach(async ({ page }) => {
    // The route is protected by authGuard: stub the session profile so no backend is required.
    await page.route('**/auth/profile', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'usr-e2e',
            name: 'E2E User',
            email: 'e2e@example.com',
            avatar: '',
            role: 'ADMIN',
            roles: ['ADMIN'],
          },
        }),
      }),
    );

    await page.goto('/tools/vat-calculator');
  });

  test('should load the page with the default values', async ({ page }) => {
    await expect(page).toHaveURL(/\/tools\/vat-calculator$/);
    await expect(page.getByTestId('vat-amount').locator('input')).toHaveValue('100.00');
    await expect(page.getByTestId('vat-gross')).toContainText('122,00');
  });

  test('should calculate the gross amount from a net amount and a VAT rate', async ({ page }) => {
    const amount = page.getByTestId('vat-amount').locator('input');
    await amount.fill('200');
    await amount.blur();

    await page.getByTestId('vat-rate').click();
    await page.locator('nz-option-item[title="10%"]').click();

    await expect(page.getByTestId('vat-net')).toContainText('200,00');
    await expect(page.getByTestId('vat-vat')).toContainText('20,00');
    await expect(page.getByTestId('vat-gross')).toContainText('220,00');
  });

  test('should extract the net amount from a gross amount', async ({ page }) => {
    await page.getByTestId('vat-mode').click();
    await page.locator('nz-option-item').nth(1).click();

    const amount = page.getByTestId('vat-amount').locator('input');
    await amount.fill('122');
    await amount.blur();

    await expect(page.getByTestId('vat-net')).toContainText('100,00');
    await expect(page.getByTestId('vat-vat')).toContainText('22,00');
  });
});

