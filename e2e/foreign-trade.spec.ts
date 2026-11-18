import { test, expect } from '@playwright/test';

test.describe('Critical Flow: Foreign Trade & Customs hub', () => {
  test('lists the four foreign trade areas and computes the customs value by Incoterm', async ({ page }) => {
    await page.route('**/api/v1/foreign-trade/customs-value', async (route) => {
      const body = route.request().postDataJSON() as { incoterm: string; goods_value: number; freight: number; insurance: number };
      expect(body.incoterm).toBe('EXW');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            incoterm: body.incoterm,
            goods_value: body.goods_value,
            freight_added: body.freight,
            insurance_added: body.insurance,
            customs_value: body.goods_value + body.freight + body.insurance,
            statistical_value: body.goods_value + body.freight + body.insurance,
          },
        }),
      });
    });

    await page.goto('/customs/foreign-trade');

    await expect(page.locator('a.hub-card')).toHaveCount(4);

    const inputs = page.locator('nz-input-number input');
    await inputs.nth(0).fill('1000');
    await inputs.nth(1).fill('80');
    await inputs.nth(2).fill('20');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByTestId('customs-value')).toContainText('1100');
  });
});
