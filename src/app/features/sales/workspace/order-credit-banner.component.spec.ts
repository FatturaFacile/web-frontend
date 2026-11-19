import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '@core';
import { icons } from '../../../icons-provider';
import { OrderCreditBannerComponent } from './order-credit-banner.component';
import { CreditExposure } from './sales-workspace.models';

const exposure = (overrides: Partial<CreditExposure> = {}): CreditExposure => ({
  credit_limit: '10000.00',
  open_receivables: '6000.00',
  committed_orders: '3000.00',
  overdue_amount: '0.00',
  overdue_invoices_count: 0,
  max_overdue_days: 0,
  order_total: '1500.00',
  total_exposure: '10500.00',
  over_limit: true,
  has_overdue: false,
  block_reason: 'credit_limit_exceeded',
  ...overrides,
});

describe('OrderCreditBannerComponent', () => {
  let fixture: ComponentFixture<OrderCreditBannerComponent>;

  beforeEach(() => {
    const i18n = { translate: vi.fn((key: string) => key), currentLanguage: signal('en') };
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: i18n },
        provideNzIcons(icons),
        provideNzI18n(en_US),
      ],
    });
    fixture = TestBed.createComponent(OrderCreditBannerComponent);
  });

  function text(): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows nothing for a customer well inside the credit limit', () => {
    fixture.componentRef.setInput(
      'exposure',
      exposure({ over_limit: false, total_exposure: '2000.00' }),
    );

    expect(text()).not.toContain('SWK.CREDIT.');
  });

  it('warns near the limit without offering a release', () => {
    fixture.componentRef.setInput(
      'exposure',
      exposure({ over_limit: false, total_exposure: '9500.00' }),
    );
    fixture.componentRef.setInput('canRelease', true);

    const content = text();
    expect(content).toContain('SWK.CREDIT.WARNING_TITLE');
    expect(content).not.toContain('SWK.CREDIT.AUTHORIZE');
  });

  it('explains a blocked order with the exposure figures and lets a credit manager release it', () => {
    fixture.componentRef.setInput('exposure', exposure());
    fixture.componentRef.setInput('blocked', true);
    fixture.componentRef.setInput('canRelease', true);

    const content = text();
    expect(content).toContain('SWK.CREDIT.BLOCKED_TITLE');
    expect(content).toContain('10,000.00');
    expect(content).toContain('10,500.00');
    expect(content).toContain('SWK.CREDIT.AUTHORIZE');
  });

  it('hides the release button from users without the credit manager permission', () => {
    fixture.componentRef.setInput('exposure', exposure());
    fixture.componentRef.setInput('blocked', true);
    fixture.componentRef.setInput('canRelease', false);

    expect(text()).not.toContain('SWK.CREDIT.AUTHORIZE');
  });

  it('emits the trimmed justification only when it is long enough', () => {
    const released: string[] = [];
    fixture.componentRef.instance.release.subscribe((notes) => released.push(notes));
    const component = fixture.componentRef.instance as unknown as {
      notes: { set(value: string): void };
      confirm(): void;
    };

    component.notes.set('abc');
    component.confirm();
    expect(released).toEqual([]);

    component.notes.set('  Approved by the CFO  ');
    component.confirm();
    expect(released).toEqual(['Approved by the CFO']);
  });
});
