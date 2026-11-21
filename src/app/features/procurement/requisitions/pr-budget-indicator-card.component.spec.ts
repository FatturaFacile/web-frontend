import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '@core/i18n';
import { PrBudgetCheckSnapshot } from '@domain/procurement/purchase-requisition.models';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { PrBudgetIndicatorCardComponent } from './pr-budget-indicator-card.component';

function buildSnapshot(overrides: Partial<PrBudgetCheckSnapshot>): PrBudgetCheckSnapshot {
  return {
    cost_center_id: 'cc-1',
    cost_center_code: 'CC-OPS',
    cost_center_name: 'Operations Lugano',
    fiscal_year: 2026,
    period_label: 'FY 2026',
    currency: 'CHF',
    allocated_budget: 20000,
    committed_amount: 12000,
    available_budget: 8000,
    requisition_amount: 3000,
    remaining_after_requisition: 5000,
    utilization_percent: 75,
    status: 'ok',
    is_warning: false,
    is_hard_blocked: false,
    ...overrides,
  };
}

describe('PrBudgetIndicatorCardComponent', () => {
  let fixture: ComponentFixture<PrBudgetIndicatorCardComponent>;
  let component: PrBudgetIndicatorCardComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PrBudgetIndicatorCardComponent],
      providers: [
        provideNzIcons(icons),
        provideNzI18n(en_US),
        {
          provide: I18nService,
          useValue: {
            currentLanguage: signal<'en'>('en'),
            translate: vi.fn((key: string) => key),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(PrBudgetIndicatorCardComponent);
    component = fixture.componentInstance;
  });

  it('shows selection hint when no cost center is chosen yet', () => {
    fixture.componentRef.setInput('hasCostCenter', false);
    fixture.componentRef.setInput('preview', null);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('PR.BUDGET.SELECT_COST_CENTER_HINT');
  });

  it('renders available residual budget, post-PR remaining balance, and ok alert', () => {
    fixture.componentRef.setInput('hasCostCenter', true);
    fixture.componentRef.setInput('currency', 'CHF');
    fixture.componentRef.setInput('preview', buildSnapshot({ status: 'ok' }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(component.isHardBlock()).toBe(false);
    expect(component.isWarning()).toBe(false);
    expect(text).toContain('PR.BUDGET.STATUS_OK');
    expect(text).toContain('PR.BUDGET.ALERT_OK_TITLE');
    expect(text).toContain('8');
    expect(text).toContain('5');
    expect(el.querySelector('.balance-ok')).not.toBeNull();
  });

  it('renders warning state when soft budget threshold is exceeded', () => {
    fixture.componentRef.setInput('hasCostCenter', true);
    fixture.componentRef.setInput('currency', 'EUR');
    fixture.componentRef.setInput(
      'preview',
      buildSnapshot({
        currency: 'EUR',
        available_budget: 2000,
        requisition_amount: 1900,
        remaining_after_requisition: 100,
        utilization_percent: 99,
        status: 'warning',
        is_warning: true,
      }),
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(component.isWarning()).toBe(true);
    expect(component.isHardBlock()).toBe(false);
    expect(el.textContent ?? '').toContain('PR.BUDGET.ALERT_WARNING_TITLE');
    expect(el.querySelector('.balance-warning')).not.toBeNull();
  });

  it('renders hard-block alert and negative balance styling when budget is exceeded', () => {
    fixture.componentRef.setInput('hasCostCenter', true);
    fixture.componentRef.setInput('currency', 'CHF');
    fixture.componentRef.setInput(
      'preview',
      buildSnapshot({
        available_budget: 1000,
        requisition_amount: 2500,
        remaining_after_requisition: -1500,
        utilization_percent: 112,
        status: 'hard_block',
        is_hard_blocked: true,
      }),
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(component.isHardBlock()).toBe(true);
    expect(component.progressPercent()).toBe(100);
    expect(component.progressStatus()).toBe('exception');
    expect(el.textContent ?? '').toContain('PR.BUDGET.STATUS_HARD_BLOCK');
    expect(el.textContent ?? '').toContain('PR.BUDGET.ALERT_HARD_BLOCK_TITLE');
    expect(el.querySelector('.balance-negative')).not.toBeNull();
  });
});
