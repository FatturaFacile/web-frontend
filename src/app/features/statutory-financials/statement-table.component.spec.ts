import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SfLine, TranslateService } from '@core';
import { StatementTableComponent } from './statement-table.component';
import { line, translateSpy } from './statutory-financials.testing';

describe('StatementTableComponent', () => {
  const lines: SfLine[] = [
    line('A', {
      level: 0,
      is_leaf: false,
      is_total: true,
      label: 'Total assets',
      amount: '1234567.5000',
      comparative_amount: '1000000.0000',
    }),
    line('A.I', { parent_code: 'A', level: 1, label: 'Fixed assets', amount: '1234.5600' }),
    line('A.R', {
      parent_code: 'A',
      level: 1,
      is_rounding: true,
      label: 'Arrotondamenti attivi',
      amount: '1.0000',
      comparative_amount: null,
    }),
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translateSpy() }],
    });
  });

  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(StatementTableComponent);
    fixture.componentRef.setInput('lines', lines);
    fixture.componentRef.setInput('currentLabel', '2025');
    fixture.componentRef.setInput('comparativeLabel', '2024');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('indents the lines by level and bolds the totals', () => {
    const root = render();
    const rows = Array.from(root.querySelectorAll('tbody tr'));

    expect(rows).toHaveLength(3);
    const labelOf = (row: Element) => row.querySelector('.line-label') as HTMLElement;
    expect(labelOf(rows[0] as Element).style.paddingLeft).toBe('0px');
    expect(labelOf(rows[1] as Element).style.paddingLeft).toBe('20px');
    expect(rows[0]?.querySelector('th.strong')).not.toBeNull();
    expect(rows[1]?.querySelector('th.strong')).toBeNull();
  });

  it('highlights the rounding lines with a tag', () => {
    const root = render();
    const rows = Array.from(root.querySelectorAll('tbody tr'));

    expect(rows[2]?.classList.contains('rounding-row')).toBe(true);
    expect(rows[2]?.textContent).toContain('statutoryFinancials.statement.roundingTag');
    expect(rows[1]?.classList.contains('rounding-row')).toBe(false);
  });

  it('shows the current and comparative columns formatted for Italy', () => {
    const root = render({ jurisdiction: 'IT', scale: 2 });
    const first = root.querySelector('tbody tr') as HTMLElement;

    expect(root.querySelectorAll('thead th')).toHaveLength(3);
    expect(first.textContent).toContain('1.234.567,50');
    expect(first.textContent).toContain('1.000.000,00');
  });

  it('formats Swiss amounts in whole francs from the quadrature scale', () => {
    const root = render({ jurisdiction: 'CH', scale: 0 });
    const text = root.textContent ?? '';

    expect(text).toContain("1'234'568");
    expect(text).toContain("1'235");
  });

  it('hides the comparative column when there is no comparative year', () => {
    const root = render({ showComparative: false });

    expect(root.querySelectorAll('thead th')).toHaveLength(2);
    expect(root.textContent).not.toContain('1.000.000,00');
  });

  it('collapses the children of a line', () => {
    const fixture = TestBed.createComponent(StatementTableComponent);
    fixture.componentRef.setInput('lines', lines);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('button.toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(root.querySelector('button.toggle')?.getAttribute('aria-expanded')).toBe('false');
  });
});
