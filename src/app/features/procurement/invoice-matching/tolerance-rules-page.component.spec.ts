import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService } from '@core/i18n';
import { InvoiceMatchingApiService } from '@data-access/procurement/invoice-matching-api.service';
import { provideNzI18n, en_US } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { toleranceRule } from './invoice-matching.fixtures';
import { ToleranceRulesPageComponent } from './tolerance-rules-page.component';

/** The form is protected: the spec drives it the way the dialog does. */
interface Harness {
  form: {
    invalid: boolean;
    patchValue(value: unknown): void;
    controls: { scope: { setValue(value: string): void } };
  };
  usesSupplier(): boolean;
  usesCategory(): boolean;
}

describe('ToleranceRulesPageComponent', () => {
  const api = {
    listRules: vi.fn(),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    api.listRules.mockReturnValue(
      of([
        toleranceRule('t', { name: 'Tenant default', scope: 'tenant' }),
        toleranceRule('s', {
          name: 'Supplier Acme',
          scope: 'supplier',
          supplier_id: 'sup-1',
          priority: 3,
        }),
      ]),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        { provide: InvoiceMatchingApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        {
          provide: I18nService,
          useValue: { currentLanguage: signal<'en'>('en'), translate: vi.fn((key: string) => key) },
        },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(ToleranceRulesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      harness: fixture.componentInstance as unknown as Harness,
      root: fixture.nativeElement as HTMLElement,
    };
  }

  it('lists the rules from the most specific scope and shows the precedence hint', async () => {
    const { root } = await render();
    const rows = root.querySelectorAll('[data-testid^="rule-row-"]');

    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Supplier Acme');
    expect(rows[1].textContent).toContain('Tenant default');
    expect(root.querySelector('[data-testid="precedence-hint"]')?.textContent).toContain(
      'invoiceMatching.form.precedenceHint',
    );
  });

  it('shows the supplier and category targets only for the scopes that use them', async () => {
    const { component, harness } = await render();
    component.openCreate();

    expect(harness.usesSupplier()).toBe(false);
    expect(harness.usesCategory()).toBe(false);

    harness.form.controls.scope.setValue('supplier');
    expect(harness.usesSupplier()).toBe(true);
    expect(harness.usesCategory()).toBe(false);

    harness.form.controls.scope.setValue('item_category');
    expect(harness.usesSupplier()).toBe(false);
    expect(harness.usesCategory()).toBe(true);

    harness.form.controls.scope.setValue('rule');
    expect(harness.usesSupplier()).toBe(true);
    expect(harness.usesCategory()).toBe(true);
  });

  it('requires a name before the rule can be saved', async () => {
    const { component, harness } = await render();
    component.openCreate();
    expect(harness.form.invalid).toBe(true);

    harness.form.patchValue({ name: 'New rule' });
    expect(harness.form.invalid).toBe(false);
  });

  it('creates a rule with the tolerances typed in the form', async () => {
    api.createRule.mockReturnValue(of(toleranceRule('n', { name: 'New rule' })));
    const { component, harness } = await render();

    component.openCreate();
    harness.form.patchValue({
      name: 'New rule',
      scope: 'supplier',
      supplier_id: 'sup-9',
      item_category: 'ignored',
      match_type: '3_way',
      priority: 5,
      price_tolerance_percent: 1.5,
      price_tolerance_amount: 10,
      quantity_tolerance_percent: 2,
      currency: 'eur',
    });
    await component.submit();

    expect(api.createRule).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New rule',
        scope: 'supplier',
        supplier_id: 'sup-9',
        item_category: null,
        match_type: '3_way',
        priority: 5,
        price_tolerance_percent: 1.5,
        price_tolerance_amount: 10,
        quantity_tolerance_percent: 2,
        quantity_tolerance_amount: null,
        currency: 'EUR',
        is_active: true,
      }),
    );
    expect(message.success).toHaveBeenCalledWith('invoiceMatching.message.ruleSaved');
  });

  it('updates an existing rule and deletes another one', async () => {
    api.updateRule.mockReturnValue(of(toleranceRule('s', { name: 'Renamed' })));
    api.deleteRule.mockReturnValue(of(undefined));
    const { component } = await render();
    const rule = toleranceRule('s', {
      name: 'Supplier Acme',
      scope: 'supplier',
      supplier_id: 'sup-1',
    });

    component.openEdit(rule);
    await component.submit();
    expect(api.updateRule).toHaveBeenCalledWith(
      's',
      expect.objectContaining({ name: 'Supplier Acme', supplier_id: 'sup-1' }),
    );

    await component.remove(rule);
    expect(api.deleteRule).toHaveBeenCalledWith('s');
    expect(message.success).toHaveBeenCalledWith('invoiceMatching.message.ruleDeleted');
  });
});
