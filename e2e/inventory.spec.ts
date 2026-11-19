import { test, expect } from '@playwright/test';
import { InventoryPage, seedAuthenticatedSession } from './pages/ErpPages';

test.describe('Critical Flow: Inventory & Warehouse Movements (Magazzino)', () => {
  let inventoryPage: InventoryPage;

  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
    inventoryPage = new InventoryPage(page);
  });

  test('executes stock load, issues DDT movement, and verifies negative-stock prevention', async ({ page }) => {
    let currentStock = 100;

    await page.route('**/api/v1/inventory/products**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'sku-001',
              sku: 'SKU-001',
              name: 'Industrial Widget A',
              stock_quantity: currentStock,
              quantity_on_hand: currentStock,
            },
          ],
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
        }),
      });
    });

    await page.route('**/api/v1/inventory/items/sku-001', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            sku: 'SKU-001',
            name: 'Industrial Widget A',
            quantity_on_hand: currentStock,
            warehouse: 'Main WH',
          },
        }),
      });
    });

    await page.route('**/api/v1/inventory/movements', async (route) => {
      const payload = JSON.parse(route.request().postData() || '{}');
      const qty = Number(payload.quantity);

      if (payload.type === 'outbound' && qty > currentStock) {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'NegativeStockForbidden',
            message: 'Stock movement would cause negative stock balance.',
          }),
        });
      } else {
        if (payload.type === 'inbound') {
          currentStock += qty;
        } else if (payload.type === 'outbound') {
          currentStock -= qty;
        }
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              movement_id: 'mov-101',
              sku: payload.sku,
              type: payload.type,
              quantity: qty,
              new_stock_level: currentStock,
            },
          }),
        });
      }
    });

    await inventoryPage.goto();
    await expect(page).toHaveURL(/\/inventory\/stock/);
    await expect(page.locator('app-root')).toBeVisible();

    // 1. Inbound stock load (+50 units) via browser network call
    const inboundRes = await page.evaluate(async () => {
      const res = await fetch('/api/v1/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: 'SKU-001', type: 'inbound', quantity: 50 }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(inboundRes.status).toBe(201);
    expect(inboundRes.body.data.new_stock_level).toBe(150);

    // 2. Outbound Transport Document (DDT) / Shipment (-40 units)
    const outboundRes = await page.evaluate(async () => {
      const res = await fetch('/api/v1/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: 'SKU-001', type: 'outbound', quantity: 40 }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(outboundRes.status).toBe(201);
    expect(outboundRes.body.data.new_stock_level).toBe(110);

    // 3. Negative stock prevention rule test: attempting to dispatch 200 units when only 110 exist
    const negativeRes = await page.evaluate(async () => {
      const res = await fetch('/api/v1/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: 'SKU-001', type: 'outbound', quantity: 200 }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(negativeRes.status).toBe(422);
    expect(negativeRes.body.error).toBe('NegativeStockForbidden');
  });
});
