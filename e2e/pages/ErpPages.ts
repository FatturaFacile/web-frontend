import { type Page, type Locator, expect } from '@playwright/test';

export class InvoicingPage {
  readonly page: Page;
  readonly newInvoiceButton: Locator;
  readonly customerSelect: Locator;
  readonly addLineItemButton: Locator;
  readonly lineDescriptionInput: Locator;
  readonly lineQuantityInput: Locator;
  readonly lineUnitPriceInput: Locator;
  readonly vatRateSelect: Locator;
  readonly discountInput: Locator;
  readonly subtotalText: Locator;
  readonly totalTaxText: Locator;
  readonly totalGrossText: Locator;
  readonly saveDraftButton: Locator;
  readonly issueInvoiceButton: Locator;
  readonly downloadPdfButton: Locator;
  readonly qrBillContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newInvoiceButton = page.locator('[data-testid="btn-new-invoice"], button:has-text("Nuova Fattura")');
    this.customerSelect = page.locator('[data-testid="select-customer"], nz-select[formcontrolname="contact_id"]');
    this.addLineItemButton = page.locator('[data-testid="btn-add-line"], button:has-text("Aggiungi Riga")');
    this.lineDescriptionInput = page.locator('[data-testid="input-line-description"], input[placeholder*="Descrizione"]');
    this.lineQuantityInput = page.locator('[data-testid="input-line-qty"], input[type="number"][placeholder*="Qta"]');
    this.lineUnitPriceInput = page.locator('[data-testid="input-line-price"], input[type="number"][placeholder*="Prezzo"]');
    this.vatRateSelect = page.locator('[data-testid="select-vat-rate"]');
    this.discountInput = page.locator('[data-testid="input-discount"]');
    this.subtotalText = page.locator('[data-testid="summary-subtotal"]');
    this.totalTaxText = page.locator('[data-testid="summary-tax"]');
    this.totalGrossText = page.locator('[data-testid="summary-gross"]');
    this.saveDraftButton = page.locator('[data-testid="btn-save-draft"], button:has-text("Salva Bozza")');
    this.issueInvoiceButton = page.locator('[data-testid="btn-issue-invoice"], button:has-text("Emetti Fattura")');
    this.downloadPdfButton = page.locator('[data-testid="btn-download-pdf"], button:has-text("Scarica PDF")');
    this.qrBillContainer = page.locator('[data-testid="swiss-qrbill-preview"]');
  }

  async goto() {
    await this.page.goto('/invoicing/sales');
  }
}

export class PaymentsPage {
  readonly page: Page;
  readonly registerPaymentButton: Locator;
  readonly amountInput: Locator;
  readonly paymentMethodSelect: Locator;
  readonly paymentDateInput: Locator;
  readonly submitPaymentButton: Locator;
  readonly invoiceStatusBadge: Locator;
  readonly balanceDueText: Locator;

  constructor(page: Page) {
    this.page = page;
    this.registerPaymentButton = page.locator('[data-testid="btn-record-payment"], button:has-text("Registra Incasso")');
    this.amountInput = page.locator('[data-testid="input-payment-amount"]');
    this.paymentMethodSelect = page.locator('[data-testid="select-payment-method"]');
    this.paymentDateInput = page.locator('[data-testid="input-payment-date"]');
    this.submitPaymentButton = page.locator('[data-testid="btn-confirm-payment"]');
    this.invoiceStatusBadge = page.locator('[data-testid="badge-payment-status"]');
    this.balanceDueText = page.locator('[data-testid="text-balance-due"]');
  }

  async goto(invoiceId?: string) {
    if (invoiceId) {
      await this.page.goto(`/invoicing/sales/${invoiceId}`);
    } else {
      await this.page.goto('/treasury/payments');
    }
  }
}

export class InventoryPage {
  readonly page: Page;
  readonly stockItemsTable: Locator;
  readonly newMovementButton: Locator;
  readonly productSelect: Locator;
  readonly movementTypeSelect: Locator;
  readonly quantityInput: Locator;
  readonly warehouseSelect: Locator;
  readonly submitMovementButton: Locator;
  readonly createDdtButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.stockItemsTable = page.locator('[data-testid="table-stock-items"]');
    this.newMovementButton = page.locator('[data-testid="btn-new-movement"], button:has-text("Nuovo Movimento")');
    this.productSelect = page.locator('[data-testid="select-product"]');
    this.movementTypeSelect = page.locator('[data-testid="select-movement-type"]');
    this.quantityInput = page.locator('[data-testid="input-quantity"]');
    this.warehouseSelect = page.locator('[data-testid="select-warehouse"]');
    this.submitMovementButton = page.locator('[data-testid="btn-submit-movement"]');
    this.createDdtButton = page.locator('[data-testid="btn-create-ddt"], button:has-text("Crea DDT")');
    this.errorMessage = page.locator('.ant-alert-error, [data-testid="alert-error"]');
  }

  async goto() {
    await this.page.goto('/inventory');
  }
}
