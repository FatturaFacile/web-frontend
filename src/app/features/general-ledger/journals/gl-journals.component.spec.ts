import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountingApiService, AuthStore, GeneralLedgerApiService, GlJournalEntry, PermissionsService } from '@core';
import { GlJournalsComponent } from './gl-journals.component';

function journal(status: GlJournalEntry['status'], id = 'j1'): GlJournalEntry {
  return {
    id,
    entry_number: 'JE-1',
    journal_number: 1,
    fiscal_period_id: 'p1',
    posting_date: '2026-11-01',
    document_date: '2026-11-01',
    ledger_type: 'statutory',
    journal_type: 'standard',
    description: 'Manual journal',
    status,
    total_amount: '100.00',
    auto_reverse_on: null,
    created_by: 'u1',
    submitted_by: null,
    submitted_at: null,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    recurring_journal_id: null,
  };
}

describe('GlJournalsComponent', () => {
  const api = {
    getJournals: vi.fn(),
    getJournal: vi.fn(),
    submitJournal: vi.fn(),
    approveJournal: vi.fn(),
    rejectJournal: vi.fn(),
    reverseJournalEntry: vi.fn(),
    getAccountList: vi.fn(),
    getCostCenters: vi.fn(),
    getProfitCenters: vi.fn(),
  };
  const accountingApi = { postJournal: vi.fn() };

  async function create(status: GlJournalEntry['status']) {
    api.getJournals.mockReturnValue(
      of({ success: true, message: '', data: [journal(status)], meta: { total: 1, current_page: 1, last_page: 1, per_page: 20 } }),
    );
    await TestBed.configureTestingModule({
      imports: [GlJournalsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GeneralLedgerApiService, useValue: api },
        { provide: AccountingApiService, useValue: accountingApi },
        { provide: AuthStore, useValue: { activeCurrency: () => 'EUR', user: () => ({ id: 'me' }) } },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(GlJournalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    api.getAccountList.mockReturnValue(of({ data: [] }));
    api.getCostCenters.mockReturnValue(of({ data: [] }));
    api.getProfitCenters.mockReturnValue(of({ data: [] }));
    api.approveJournal.mockReturnValue(of({ success: true, data: journal('posted') }));
    api.rejectJournal.mockReturnValue(of({ success: true, data: journal('rejected') }));
    api.submitJournal.mockReturnValue(of({ success: true, data: journal('pending_approval') }));
    accountingApi.postJournal.mockReturnValue(of({ success: true, data: {} }));
  });

  it('loads the journals waiting for approval by default', async () => {
    const fixture = await create('pending_approval');
    expect(api.getJournals).toHaveBeenCalledWith({ status: 'pending_approval', page: 1, per_page: 20 });
    const buttons = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('tbody button[nz-button]'));
    expect(buttons.length).toBe(2);
  });

  it('approves a journal and reloads the list', async () => {
    const fixture = await create('pending_approval');
    const component = fixture.componentInstance as unknown as { approve(e: GlJournalEntry): void };
    component.approve(journal('pending_approval'));
    expect(api.approveJournal).toHaveBeenCalledWith('j1');
    expect(api.getJournals).toHaveBeenCalledTimes(2);
  });

  it('rejects only with a reason', async () => {
    const fixture = await create('pending_approval');
    const component = fixture.componentInstance as unknown as {
      openReject(e: GlJournalEntry): void;
      confirmReject(): void;
      rejectReason: string;
    };
    component.openReject(journal('pending_approval'));
    component.confirmReject();
    expect(api.rejectJournal).not.toHaveBeenCalled();
    component.rejectReason = 'Wrong account';
    component.confirmReject();
    expect(api.rejectJournal).toHaveBeenCalledWith('j1', 'Wrong account');
  });

  it('offers submit and post on a draft', async () => {
    const fixture = await create('draft');
    const component = fixture.componentInstance as unknown as { submit(e: GlJournalEntry): void; post(e: GlJournalEntry): void };
    component.submit(journal('draft'));
    component.post(journal('draft'));
    expect(api.submitJournal).toHaveBeenCalledWith('j1');
    expect(accountingApi.postJournal).toHaveBeenCalledWith('j1');
  });

  it('does not offer the approval to the author or the submitter', async () => {
    const fixture = await create('pending_approval');
    const component = fixture.componentInstance as unknown as { canApprove(e: GlJournalEntry): boolean };
    expect(component.canApprove({ ...journal('pending_approval'), created_by: 'me' })).toBe(false);
    expect(component.canApprove({ ...journal('pending_approval'), submitted_by: 'me' })).toBe(false);
    expect(component.canApprove(journal('pending_approval'))).toBe(true);
  });
});
