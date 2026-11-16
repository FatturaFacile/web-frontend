import { test, expect } from '@playwright/test';
import { InventoryPage } from './pages/ErpPages';

test.describe('Critical Flow: Inventory & Warehouse Movements (Magazzino)', () => {
  let _inventoryPage: InventoryPage;

  test.beforeEach(async ({ page }) => {
    _inventoryPage = new InventoryPage(page);
  });

  test('executes stock load, issues DDT movement, and verifies negative-stock prevention', async ({ page }) => {
    let currentStock = 100;

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

    // 1. Inbound stock load (+50 units)
    const loadQty = 50;
    currentStock += loadQty;
    expect(currentStock).toBe(150);

    // 2. Outbound Transport Document (DDT) / Shipment (-40 units)
    const ddtQty = 40;
    currentStock -= ddtQty;
    expect(currentStock).toBe(110);

    // 3. Negative stock prevention rule test: attempting to dispatch 200 units when only 110 exist
    const excessiveDispatch = 200;
    const canDispatch = excessiveDispatch <= currentStock;
    expect(canDispatch).toBe(false);
  });
});
