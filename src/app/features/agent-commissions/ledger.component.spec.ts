import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService, PermissionsService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { agent, entry, translateSpy, wrap } from './agent-commissions.testing';
import { LedgerComponent } from './ledger.component';

const messageSpy = { success: vi.fn(), error: vi.fn() };
const totals = { commission: '1500.00', eligible: '1000.00', settled: '200.00', blocked: '300.00' };

describe('LedgerComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    api = {
      listAgents: vi.fn(() => of(wrap([agent('a-1')]))),
      listLedger: vi.fn(() =>
        of({
          success: true,
          message: 'OK',
          data: [
            entry('1'),
            entry('2', {
              accrual_basis: 'collected',
              status: 'awaiting_reconciliation',
              eligible_amount: '0.00',
              payable_amount: '0.00',
              blocked_amount: '50.00',
              role: 'parent_override',
            }),
            entry('3', { accrual_basis: 'collected', status: 'eligible' }),
          ],
          meta: { current_page: 1, last_page: 1, per_page: 25, total: 3, totals },
        }),
      ),
      getLedgerEntry: vi.fn(() =>
        of(
          wrap(
            entry('2', {
              accrual_basis: 'collected',
              status: 'awaiting_reconciliation',
              blocked_amount: '50.00',
              movements: [
                { kind: 'accrual', amount: '50.00', occurred_on: '2026-03-10', note: null },
                { kind: 'release', amount: '20.00', occurred_on: '2026-03-20', note: 'Bank match' },
              ],
            }),
          ),
        ),
      ),
      sync: vi.fn(() => of(wrap({ period_invoices: 1, open_invoices: 2 }))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AgentCommissionsApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(LedgerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const rows = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('tbody tr')).filter(
      (row) => row.querySelector('td') && !row.closest('nz-drawer'),
    );

  it('shows the four totals cards', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent as string;

    expect(root.querySelectorAll('nz-statistic')).toHaveLength(4);
    expect(text).toContain('agentCommissions.ledger.totalCommission');
    expect(text).toContain('agentCommissions.ledger.totalEligible');
    expect(text).toContain('agentCommissions.ledger.totalSettled');
    expect(text).toContain('agentCommissions.ledger.totalBlocked');
    // The amounts are formatted for the active language: the separators differ, the digits do not.
    expect(text).toMatch(/1\D?500\D00/);
  });

  it('lists the entries with the status tag and the basis', async () => {
    const fixture = await render();
    const body = rows(fixture.nativeElement as HTMLElement);

    expect(body).toHaveLength(3);
    expect(body[0].textContent).toContain('FA-1');
    expect(body[0].textContent).toContain('agentCommissions.entryStatus.eligible');
    expect(body[0].textContent).toContain('agentCommissions.accrualBasis.invoiced');
    expect(body[1].textContent).toContain('agentCommissions.entryStatus.awaiting_reconciliation');
    expect(body[1].textContent).toContain('agentCommissions.role.parent_override');
    expect(body[1].textContent).toContain('5%');
  });

  it('marks as locked only the cash-basis entries that wait for a reconciled collection', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const body = rows(root);

    expect(body[0].classList.contains('locked')).toBe(false);
    expect(body[1].classList.contains('locked')).toBe(true);
    expect(body[2].classList.contains('locked')).toBe(false);
    expect(root.querySelectorAll('.lock')).toHaveLength(1);
    expect(root.querySelector('.lock i.fa-lock')).not.toBeNull();
    expect(root.querySelector('.lock')?.getAttribute('aria-label')).toBe(
      'agentCommissions.ledger.lockHint',
    );
    expect(root.textContent).toContain('agentCommissions.ledger.lockHint');
  });

  it('applies a filter from the first page and the search term of the invoice', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;

    await component.setFilter({ status: 'awaiting_reconciliation', accrual_basis: 'collected' });
    expect(api['listLedger']).toHaveBeenLastCalledWith({
      per_page: 25,
      page: 1,
      status: 'awaiting_reconciliation',
      accrual_basis: 'collected',
    });

    component.search.set(' FA-2 ');
    await component.applySearch();
    expect(api['listLedger']).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'FA-2' }));
  });

  it('does not search again when the term did not change', async () => {
    const fixture = await render();
    api['listLedger'].mockClear();

    await fixture.componentInstance.applySearch();

    expect(api['listLedger']).not.toHaveBeenCalled();
  });

  it('shows the empty state', async () => {
    api['listLedger'].mockReturnValue(
      of({
        success: true,
        message: 'OK',
        data: [],
        meta: { current_page: 1, last_page: 1, per_page: 25, total: 0, totals },
      }),
    );

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.ledger.empty',
    );
  });

  it('shows the load failure', async () => {
    api['listLedger'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'generic' } })),
    );

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.error.generic',
    );
  });

  it('opens the detail of an entry with its movements', async () => {
    const fixture = await render();

    await fixture.componentInstance.store.openDetail('2');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['getLedgerEntry']).toHaveBeenCalledWith('2');
    const text = document.body.textContent as string;
    expect(text).toContain('agentCommissions.movement.accrual');
    expect(text).toContain('agentCommissions.movement.release');
    expect(text).toContain('Bank match');
  });

  it('synchronises the period and the open commissions, then reports it', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;
    component.syncFrom.set('2026-01-01');
    component.syncTo.set('2026-03-31');

    await component.sync();

    expect(api['sync']).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-03-31' });
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.synced');
    expect(component.syncOpen()).toBe(false);
  });

  it('synchronises only the open commissions when no period is given', async () => {
    const fixture = await render();

    await fixture.componentInstance.sync();

    expect(api['sync']).toHaveBeenCalledWith({});
  });

  it('shows the translated refusal of a synchronisation', async () => {
    api['sync'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'invalid_period' } })),
    );
    const fixture = await render();
    const component = fixture.componentInstance;
    component.syncFrom.set('2026-04-01');
    component.syncTo.set('2026-03-01');

    await component.sync();
    fixture.detectChanges();

    expect(component.syncError()).toBe('agentCommissions.error.invalid_period');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.error.invalid_period',
    );
    expect(messageSpy.success).not.toHaveBeenCalled();
  });

  it('hides the synchronisation from a read-only member', async () => {
    canWrite = false;

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'agentCommissions.action.sync',
    );
  });

  it('turns the collected and reconciled fractions into percentages', async () => {
    const component = (await render()).componentInstance;

    expect(component.percentOf('0.5')).toBe(50);
    expect(component.percentOf('1.000000')).toBe(100);
    expect(component.percentOf('x')).toBeNull();
  });
});
