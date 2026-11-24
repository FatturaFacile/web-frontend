import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@core/i18n';
import { provideNzI18n, en_US } from 'ng-zorro-antd/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceMatchLinesTableComponent } from './invoice-match-lines-table.component';
import {
  blockingPriceLine,
  blockingQuantityLine,
  matchLine,
  withinToleranceLine,
} from './invoice-matching.fixtures';

describe('InvoiceMatchLinesTableComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideNzI18n(en_US),
        {
          provide: I18nService,
          useValue: { currentLanguage: signal<'en'>('en'), translate: vi.fn((key: string) => key) },
        },
      ],
    });
  });

  function render(
    lines = [matchLine('l-ok'), withinToleranceLine(), blockingPriceLine(), blockingQuantityLine()],
  ) {
    const fixture = TestBed.createComponent(InvoiceMatchLinesTableComponent);
    fixture.componentRef.setInput('lines', lines);
    fixture.componentRef.setInput('currency', 'EUR');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const cell = (lineId: string, field: string): HTMLElement =>
      root.querySelector(
        `[data-testid="line-row-${lineId}"] [data-cell="${field}"]`,
      ) as HTMLElement;
    return { root, cell };
  }

  it('does not highlight the cells of an exact match', () => {
    const { cell } = render();
    for (const field of ['quantity', 'price', 'amount']) {
      const element = cell('l-ok', field);
      expect(element.classList.contains('variance-out')).toBe(false);
      expect(element.classList.contains('variance-within')).toBe(false);
    }
  });

  it('marks a variance inside the tolerance as within', () => {
    const { cell } = render();
    expect(cell('l-within', 'price').classList.contains('variance-within')).toBe(true);
    expect(cell('l-within', 'amount').classList.contains('variance-within')).toBe(true);
    expect(cell('l-within', 'price').classList.contains('variance-out')).toBe(false);
    expect(cell('l-within', 'quantity').classList.contains('variance-within')).toBe(false);
  });

  it('marks the cells that block the payment as out of tolerance', () => {
    const { cell } = render();
    expect(cell('l-blocking', 'price').classList.contains('variance-out')).toBe(true);
    expect(cell('l-blocking', 'amount').classList.contains('variance-out')).toBe(true);
    expect(cell('l-blocking', 'quantity').classList.contains('variance-out')).toBe(false);
    expect(cell('l-qty', 'quantity').classList.contains('variance-out')).toBe(true);
    expect(cell('l-qty', 'price').classList.contains('variance-out')).toBe(false);
  });

  it('renders the quantities, the prices, the status and the reasons of every line', () => {
    const { root } = render();
    const blocking = root.querySelector('[data-testid="line-row-l-blocking"]') as HTMLElement;

    expect(root.querySelectorAll('[data-testid^="line-row-"]')).toHaveLength(4);
    expect(blocking.classList.contains('line-blocking')).toBe(true);
    expect(blocking.textContent).toContain('invoiceMatching.lineStatus.price_variance');
    expect(blocking.textContent).toContain('invoiceMatching.reason.price_above_tolerance');
    expect(root.querySelector('[data-testid="lines-legend"]')?.textContent).toContain(
      'invoiceMatching.legend.blocking',
    );
  });
});
