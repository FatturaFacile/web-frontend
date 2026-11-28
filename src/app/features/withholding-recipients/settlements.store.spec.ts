import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WithholdingRecipientsApiService } from '@core';
import { SettlementsStore } from './settlements.store';
import {
  annualRecord,
  f24Preview,
  inlNotice,
  pageMeta,
  recipient,
  settlement,
  simulation,
  wrap,
} from './withholding-recipients.testing';
import { emptyPaymentForm } from './withholding-recipients.util';

const problem = (code: string, status = 422) =>
  throwError(() => new HttpErrorResponse({ status, error: { code, detail: code } }));

const valid = {
  ...emptyPaymentForm(new Date(2026, 4, 10)),
  recipient_profile_id: 'r-1',
  gross_amount: 100,
};

describe('SettlementsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof SettlementsStore>;

  beforeEach(() => {
    api = {
      listRecipients: vi.fn(() =>
        of(wrap([recipient('r-1'), recipient('r-2', { is_active: false })])),
      ),
      listSettlements: vi.fn(() =>
        of({ ...wrap([settlement('s-1'), settlement('s-2')]), meta: pageMeta }),
      ),
      getRecipient: vi.fn(() =>
        of(wrap(recipient('r-1', { inl_notifications: [inlNotice('n-1', { status: 'sent' })] }))),
      ),
      simulate: vi.fn(() => of(wrap(simulation()))),
      postPayment: vi.fn(() => of(wrap(settlement('s-3')))),
      postBatch: vi.fn(() => of(wrap([settlement('s-3'), settlement('s-4')]))),
      getF24: vi.fn(() => of(wrap(f24Preview))),
      exportF24: vi.fn(() => of(new Blob(['csv']))),
      exportUniEmens: vi.fn(() => of(new Blob(['<xml/>']))),
      listAnnualReturns: vi.fn(() => of(wrap([annualRecord('a-1')]))),
      generateAnnualReturns: vi.fn(() => of(wrap([annualRecord('a-1')]))),
      exportAnnualReturns: vi.fn(() => of(new Blob(['csv']))),
    };
    TestBed.configureTestingModule({
      providers: [SettlementsStore, { provide: WithholdingRecipientsApiService, useValue: api }],
    });
    store = TestBed.inject(SettlementsStore);
  });

  it('loads the recipients and keeps the active ones for the pickers', async () => {
    await store.init();

    expect(store.recipients()).toHaveLength(2);
    expect(store.activeRecipients().map((entry) => entry.id)).toEqual(['r-1']);
  });

  it('reads the register with its page, filters and page size', async () => {
    await store.setRegisterFilters({ filterRegime: 'amateur_sports', filterMonth: '2026-05' });

    expect(store.rows()).toHaveLength(2);
    expect(store.meta()?.total).toBe(2);
    const filters = api['listSettlements'].mock.calls[0][0];
    expect(filters).toMatchObject({
      regime: 'amateur_sports',
      accrual_month: '2026-05',
      tax_year: new Date().getFullYear(),
      page: 1,
      per_page: 20,
    });
  });

  it('drops an incomplete month and goes back to the first page when a filter changes', async () => {
    await store.setPage(3);
    expect(api['listSettlements'].mock.calls[0][0].page).toBe(3);

    await store.setRegisterFilters({ filterMonth: '2026-' });

    const filters = api['listSettlements'].mock.calls[1][0];
    expect(filters.page).toBe(1);
    expect(filters.accrual_month).toBeNull();
  });

  it('reports a failed register read', async () => {
    api['listSettlements'].mockReturnValue(problem('generic', 500));

    await store.loadRegister();

    expect(store.error()).toBe('withholdingRecipients.error.generic');
    expect(store.loading()).toBe(false);
  });

  it('reads the INL communications of a recipient for the pre-payment gate', async () => {
    await store.loadCoverage('r-1');

    expect(store.inlByRecipient()['r-1'].map((entry) => entry.id)).toEqual(['n-1']);
  });

  it('previews a payment with the simulator, and answers null when it cannot be computed', async () => {
    const result = await store.preview(valid);
    expect(result?.net_payable).toBe('685.40');
    expect(api['simulate'].mock.calls[0][0]).toMatchObject({
      recipient_profile_id: 'r-1',
      gross_amount: 100,
    });

    expect(await store.preview({ ...valid, gross_amount: null })).toBeNull();
    api['simulate'].mockReturnValue(problem('recipient_inactive'));
    expect(await store.preview(valid)).toBeNull();
  });

  it('posts a payment and reads the register again', async () => {
    const outcome = await store.post(valid);

    expect(outcome.ok).toBe(true);
    expect(outcome.settlement?.id).toBe('s-3');
    expect(api['postPayment']).toHaveBeenCalledTimes(1);
    expect(api['listSettlements']).toHaveBeenCalledTimes(1);
    expect(store.posting()).toBe(false);
  });

  it('answers the INL refusal of the API when posting', async () => {
    api['postPayment'].mockReturnValue(problem('inl_notification_missing', 409));

    const outcome = await store.post(valid);

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('withholdingRecipients.error.inl_notification_missing');
    expect(outcome.settlement).toBeNull();
    expect(api['listSettlements']).not.toHaveBeenCalled();
  });

  it('posts a batch in one call, and sends nothing when a row is invalid or the batch is empty', async () => {
    const posted = await store.postBatch([valid, valid]);
    expect(posted.ok).toBe(true);
    expect(posted.posted).toHaveLength(2);
    expect(api['postBatch'].mock.calls[0][0]).toHaveLength(2);

    expect((await store.postBatch([])).ok).toBe(false);
    expect((await store.postBatch([valid, { ...valid, gross_amount: null }])).ok).toBe(false);
    expect(api['postBatch']).toHaveBeenCalledTimes(1);
  });

  it('answers the refusal of a batch without posting anything', async () => {
    api['postBatch'].mockReturnValue(problem('net_not_positive'));

    const outcome = await store.postBatch([valid]);

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('withholdingRecipients.error.net_not_positive');
    expect(outcome.posted).toEqual([]);
  });

  it('previews the F24 of a month and clears it when the month changes', async () => {
    store.setFlowMonth('2026-05');
    await store.loadF24();

    expect(api['getF24']).toHaveBeenCalledWith('2026-05');
    expect(store.f24()?.total).toBe('737.20');

    store.setFlowMonth('2026-06');
    expect(store.f24()).toBeNull();

    store.setFlowMonth('2026-');
    await store.loadF24();
    expect(api['getF24']).toHaveBeenCalledTimes(1);
  });

  it('downloads the F24 CSV and the UniEmens XML of the month as files', async () => {
    store.setFlowMonth('2026-05');

    const csv = await store.exportF24();
    const xml = await store.exportUniEmens();

    expect(csv.filename).toBe('f24-2026-05.csv');
    expect(xml.filename).toBe('uniemens-2026-05.xml');
    expect(csv.blob).toBeInstanceOf(Blob);
    expect(store.exporting()).toBeNull();

    api['exportUniEmens'].mockReturnValue(problem('generic', 500));
    const failed = await store.exportUniEmens();
    expect(failed.ok).toBe(false);
    expect(store.error()).toBe('withholdingRecipients.error.generic');
  });

  it('reads, generates and exports the annual records of a year', async () => {
    await store.setAnnualYear(2025);
    expect(api['listAnnualReturns']).toHaveBeenCalledWith(2025);
    expect(store.annualRecords()).toHaveLength(1);

    expect((await store.generateAnnual()).ok).toBe(true);
    expect(api['generateAnnualReturns']).toHaveBeenCalledWith(2025, undefined);
    expect(api['listAnnualReturns']).toHaveBeenCalledTimes(2);

    expect((await store.exportAnnual()).filename).toBe('cu-2025.csv');

    api['generateAnnualReturns'].mockReturnValue(problem('generic', 500));
    expect((await store.generateAnnual('r-1')).ok).toBe(false);
  });
});
