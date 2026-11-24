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
import { InvoiceMatchingBlockedPageComponent } from './invoice-matching-blocked-page.component';
import { InvoiceMatchingWorkbenchPageComponent } from './invoice-matching-workbench-page.component';
import { matchRun, matchSummary } from './invoice-matching.fixtures';

const meta = { current_page: 1, from: 1, last_page: 1, per_page: 20, to: 3, total: 3 };

const runs = [
  matchRun({ id: 'r-1', status: 'matched', is_blocking: false, reasons: [], variance_amount: 0 }),
  matchRun({ id: 'r-2', status: 'blocked_discrepancy' }),
  matchRun({ id: 'r-3', status: 'pending_credit_note', invoice_number: 'FA-3' }),
];

describe('Invoice matching workbench and blocked queue', () => {
  const api = {
    summary: vi.fn(),
    listRuns: vi.fn(),
    run: vi.fn(),
    batchRun: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    api.summary.mockReturnValue(of(matchSummary()));
    api.listRuns.mockReturnValue(of({ success: true, message: '', data: runs, meta }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        { provide: InvoiceMatchingApiService, useValue: api },
        {
          provide: NzMessageService,
          useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
        },
        {
          provide: I18nService,
          useValue: { currentLanguage: signal<'en'>('en'), translate: vi.fn((key: string) => key) },
        },
      ],
    });
  });

  async function render<T>(component: new () => T): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the KPI cards from the summary', async () => {
    const root = await render(InvoiceMatchingWorkbenchPageComponent);
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';

    expect(api.summary).toHaveBeenCalledTimes(1);
    expect(text('kpi-total')).toContain('12');
    expect(text('kpi-blocked')).toContain('2');
    expect(text('kpi-blocked-amount')).toContain('2,500.00');
    expect(text('kpi-auto-rate')).toContain('75');
    expect(text('kpi-gr-ir-cleared')).toContain('9,800.00');
  });

  it('lists the runs with a coloured status tag per run', async () => {
    const root = await render(InvoiceMatchingWorkbenchPageComponent);
    const rows = root.querySelectorAll('[data-testid^="run-row-"]');

    expect(rows).toHaveLength(3);
    expect(rows[1].textContent).toContain('FA-2026-001');
    expect(rows[1].textContent).toContain('invoiceMatching.status.blocked_discrepancy');
    expect(rows[2].textContent).toContain('invoiceMatching.status.pending_credit_note');

    const tags = root.querySelectorAll('[data-testid="status-tag"]');
    expect(tags[0].className).toContain('ant-tag-green');
    expect(tags[1].className).toContain('ant-tag-red');
    expect(tags[2].className).toContain('ant-tag-orange');
  });

  it('shows the run and batch actions and the filters of the workbench', async () => {
    const root = await render(InvoiceMatchingWorkbenchPageComponent);

    expect(root.querySelector('[data-testid="open-run"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="open-batch"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="filter-status"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="filter-type"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="filter-search"]')).not.toBeNull();
    expect(api.listRuns).toHaveBeenCalledWith({ page: 1, per_page: 20 });
  });

  it('asks the API for the blocked queue and hides the status filter', async () => {
    const root = await render(InvoiceMatchingBlockedPageComponent);

    expect(api.listRuns).toHaveBeenCalledWith({ page: 1, per_page: 20, queue: 'blocked' });
    expect(root.querySelector('[data-testid="filter-status"]')).toBeNull();
    expect(root.querySelectorAll('[data-testid^="run-row-"]')).toHaveLength(3);
    expect(root.querySelector('a[href="/procurement/invoice-matching/r-2"]')).not.toBeNull();
  });
});
