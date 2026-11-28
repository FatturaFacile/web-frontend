import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsService, TranslateService, WithholdingRecipientsApiService } from '@core';
import { icons } from '../../icons-provider';
import { AnnualPanelComponent } from './annual-panel.component';
import { BatchPanelComponent } from './batch-panel.component';
import { FlowsPanelComponent } from './flows-panel.component';
import { PostPanelComponent } from './post-panel.component';
import { SettlementCenterComponent } from './settlement-center.component';
import { SettlementsStore } from './settlements.store';
import {
  annualRecord,
  f24Preview,
  inlNotice,
  pageMeta,
  recipient,
  settlement,
  simulation,
  translateSpy,
  wrap,
} from './withholding-recipients.testing';
import { WITHHOLDING_RECIPIENTS_SETTLE_MODULE } from './withholding-recipients.util';

const messageSpy = { success: vi.fn(), error: vi.fn() };

function buildApi(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    listRecipients: vi.fn(() =>
      of(
        wrap([
          recipient('r-1', { display_name: 'Occasional Olga' }),
          recipient('r-2', { display_name: 'Agent Aldo', regime: 'agent_25bis' }),
        ]),
      ),
    ),
    getRecipient: vi.fn((id: string) => of(wrap(recipient(id, { inl_notifications: [] })))),
    listSettlements: vi.fn(() =>
      of({
        ...wrap([
          settlement('s-1', {
            warnings: ['inps_threshold_exceeded'],
            notes: ['revenue_stamp_applied'],
          }),
          settlement('s-2', {
            recipient_name: 'Swiss Sam',
            currency: 'CHF',
            regime: 'swiss_de_minimis',
          }),
        ]),
        meta: pageMeta,
      }),
    ),
    simulate: vi.fn(() => of(wrap(simulation()))),
    postPayment: vi.fn(() => of(wrap(settlement('s-3')))),
    postBatch: vi.fn(() => of(wrap([settlement('s-3')]))),
    getF24: vi.fn(() => of(wrap(f24Preview))),
    exportF24: vi.fn(() => of(new Blob(['csv']))),
    exportUniEmens: vi.fn(() => of(new Blob(['<xml/>']))),
    listAnnualReturns: vi.fn(() => of(wrap([annualRecord('a-1')]))),
    generateAnnualReturns: vi.fn(() => of(wrap([annualRecord('a-1')]))),
    exportAnnualReturns: vi.fn(() => of(new Blob(['csv']))),
  };
}

function configure(api: Record<string, ReturnType<typeof vi.fn>>, canSettle: () => boolean) {
  TestBed.configureTestingModule({
    providers: [
      { provide: WithholdingRecipientsApiService, useValue: api },
      {
        provide: PermissionsService,
        useValue: {
          canWrite: (module: string) =>
            module === WITHHOLDING_RECIPIENTS_SETTLE_MODULE && canSettle(),
        },
      },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy() },
      provideNzIcons(icons),
    ],
  });
}

const text = (root: HTMLElement) => root.textContent ?? '';

describe('SettlementCenterComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canSettle: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    canSettle = true;
    api = buildApi();
    configure(api, () => canSettle);
  });

  async function render() {
    const fixture = TestBed.createComponent(SettlementCenterComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lists the posted compensations of the register with amounts, F24 due date, warnings and notes', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const rows = Array.from(root.querySelectorAll('tbody tr')).filter((row) =>
      row.querySelector('td'),
    );

    expect(api['listSettlements']).toHaveBeenCalledTimes(1);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const first = rows[0].textContent ?? '';
    expect(first).toContain('Recipient r-1');
    expect(first).toContain('withholdingRecipients.regime.occasional_worker');
    expect(first).toContain('685.40');
    expect(first).toContain('2026-06-16');
    expect(first).toContain('withholdingRecipients.settlementStatus.posted');
    expect(first).toContain('withholdingRecipients.warning.inps_threshold_exceeded');
    expect(first).toContain('withholdingRecipients.note.revenue_stamp_applied');
    expect(rows[1].textContent).toContain('CHF');
  });

  it('filters the register and goes back to the first page', async () => {
    const fixture = await render();

    await fixture.componentInstance.store.setRegisterFilters({ filterRegime: 'amateur_sports' });
    await fixture.componentInstance.store.setPage(2);
    await fixture.componentInstance.store.setRegisterFilters({ filterMonth: '2026-05' });

    const last = api['listSettlements'].mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ regime: 'amateur_sports', accrual_month: '2026-05', page: 1 });
  });

  it('shows the posting, flows and annual tabs to the settle ability', async () => {
    const fixture = await render();
    const content = text(fixture.nativeElement);

    expect(content).toContain('withholdingRecipients.tab.register');
    expect(content).toContain('withholdingRecipients.tab.post');
    expect(content).toContain('withholdingRecipients.tab.batch');
    expect(content).toContain('withholdingRecipients.tab.flows');
    expect(content).toContain('withholdingRecipients.tab.annual');
    expect(content).not.toContain('withholdingRecipients.settle.readOnly');
  });

  it('leaves only the register to a member without the settle ability', async () => {
    canSettle = false;

    const fixture = await render();
    const content = text(fixture.nativeElement);

    expect(content).toContain('withholdingRecipients.tab.register');
    expect(content).not.toContain('withholdingRecipients.tab.post');
    expect(content).not.toContain('withholdingRecipients.tab.flows');
    expect(content).not.toContain('withholdingRecipients.tab.annual');
    expect(content).toContain('withholdingRecipients.settle.readOnly');
  });

  it('shows the failure of the register with its translation key', async () => {
    api['listSettlements'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'generic' } })),
    );

    const fixture = await render();

    expect(text(fixture.nativeElement)).toContain('withholdingRecipients.error.generic');
  });

  it('adds the tax withheld on Italian and Swiss payments', async () => {
    const fixture = await render();

    expect(fixture.componentInstance.withheld('200.00', '0.00')).toBe('200');
    expect(fixture.componentInstance.withheld('0', '35.5')).toBe('35.5');
  });
});

describe('PostPanelComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = buildApi();
    configure(api, () => true);
    TestBed.configureTestingModule({ providers: [SettlementsStore] });
  });

  async function render() {
    const store = TestBed.inject(SettlementsStore);
    await store.init();
    const fixture = TestBed.createComponent(PostPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store, panel: fixture.componentInstance };
  }

  it('blocks the posting of an occasional worker without a covering INL communication', async () => {
    const { fixture, store, panel } = await render();

    panel.patch({ gross_amount: 100 });
    panel.pickRecipient('r-1');
    await store.loadCoverage('r-1');
    fixture.detectChanges();

    expect(panel.blocked()).toBe(true);
    expect(panel.canPost()).toBe(false);
    expect(text(fixture.nativeElement)).toContain('withholdingRecipients.inl.gateBlocked');
    await panel.post();
    expect(api['postPayment']).not.toHaveBeenCalled();
  });

  it('lets the posting through once a communication sent in time covers the service', async () => {
    api['getRecipient'].mockReturnValue(
      of(
        wrap(
          recipient('r-1', {
            inl_notifications: [
              inlNotice('n-1', {
                status: 'sent',
                work_start_date: '2000-01-01',
                work_end_date: '2100-12-31',
                sent_before_start: true,
              }),
            ],
          }),
        ),
      ),
    );
    const { fixture, store, panel } = await render();

    panel.patch({ gross_amount: 100 });
    panel.pickRecipient('r-1');
    await store.loadCoverage('r-1');
    fixture.detectChanges();

    expect(panel.blocked()).toBe(false);
    expect(panel.canPost()).toBe(true);
    expect(text(fixture.nativeElement)).toContain('withholdingRecipients.inl.gateCovered');

    await panel.post();

    expect(api['postPayment']).toHaveBeenCalledTimes(1);
    expect(api['postPayment'].mock.calls[0][0]).toMatchObject({
      recipient_profile_id: 'r-1',
      gross_amount: 100,
    });
    expect(messageSpy.success).toHaveBeenCalledWith('withholdingRecipients.message.posted');
    expect(panel.form().gross_amount).toBeNull();
  });

  it('does not ask for an INL communication for an agent', async () => {
    const { panel } = await render();

    panel.patch({ gross_amount: 100 });
    panel.pickRecipient('r-2');

    expect(panel.blocked()).toBe(false);
    expect(panel.canPost()).toBe(true);
  });

  it('shows the translated refusal of the API when posting', async () => {
    api['getRecipient'].mockReturnValue(
      of(
        wrap(
          recipient('r-2', {
            regime: 'agent_25bis',
          }),
        ),
      ),
    );
    api['postPayment'].mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { code: 'inl_notification_expired' } }),
      ),
    );
    const { fixture, panel } = await render();

    panel.patch({ gross_amount: 100 });
    panel.pickRecipient('r-2');
    await panel.post();
    fixture.detectChanges();

    expect(panel.error()?.errorKey).toBe('withholdingRecipients.error.inl_notification_expired');
    expect(text(fixture.nativeElement)).toContain(
      'withholdingRecipients.error.inl_notification_expired',
    );
    expect(messageSpy.success).not.toHaveBeenCalled();
  });

  it('previews the payment with the simulator', async () => {
    const { panel } = await render();

    panel.patch({ gross_amount: 100, recipient_profile_id: 'r-1' });
    await panel.refreshPreview();

    expect(api['simulate']).toHaveBeenCalledTimes(1);
    expect(panel.preview()?.net_payable).toBe('685.40');
  });
});

describe('BatchPanelComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = buildApi();
    configure(api, () => true);
    TestBed.configureTestingModule({ providers: [SettlementsStore] });
  });

  async function render() {
    const store = TestBed.inject(SettlementsStore);
    await store.init();
    const fixture = TestBed.createComponent(BatchPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, panel: fixture.componentInstance };
  }

  it('starts with one empty row that cannot be posted', async () => {
    const { panel } = await render();

    expect(panel.rows()).toHaveLength(1);
    expect(panel.canPost()).toBe(false);
  });

  it('adds and removes rows, up to the limit of 200', async () => {
    const { panel } = await render();

    panel.addRow();
    expect(panel.rows()).toHaveLength(2);
    panel.removeRow(panel.rows()[0].key);
    expect(panel.rows()).toHaveLength(1);

    for (let index = 0; index < 250; index++) {
      panel.addRow();
    }
    expect(panel.rows()).toHaveLength(panel.max);
  });

  it('posts the valid rows in one call and starts again', async () => {
    const { panel } = await render();
    const first = panel.rows()[0].key;
    panel.patch(first, { recipient_profile_id: 'r-2', gross_amount: 100 });
    panel.addRow();
    panel.patch(panel.rows()[1].key, { recipient_profile_id: 'r-2', gross_amount: 200 });

    expect(panel.canPost()).toBe(true);
    await panel.post();

    expect(api['postBatch']).toHaveBeenCalledTimes(1);
    expect(api['postBatch'].mock.calls[0][0]).toHaveLength(2);
    expect(messageSpy.success).toHaveBeenCalledWith('withholdingRecipients.message.batchPosted');
    expect(panel.rows()).toHaveLength(1);
  });

  it('blocks the batch when a row of an occasional worker has no covering communication', async () => {
    const { fixture, panel } = await render();
    const key = panel.rows()[0].key;

    panel.pickRecipient(key, 'r-1');
    panel.patch(key, { gross_amount: 100 });
    await TestBed.inject(SettlementsStore).loadCoverage('r-1');
    fixture.detectChanges();

    expect(panel.isRowBlocked(panel.rows()[0])).toBe(true);
    expect(panel.canPost()).toBe(false);
    expect(text(fixture.nativeElement)).toContain('withholdingRecipients.batch.inlBlocked');
  });

  it('previews a row with the simulator and shows the refusal of a batch', async () => {
    const { fixture, panel } = await render();
    const key = panel.rows()[0].key;
    panel.patch(key, { recipient_profile_id: 'r-2', gross_amount: 100 });

    await panel.previewRow(key);
    fixture.detectChanges();
    expect(panel.rows()[0].preview?.net_payable).toBe('685.40');
    expect(text(fixture.nativeElement)).toContain('685.40');

    api['postBatch'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'net_not_positive' } })),
    );
    await panel.post();
    expect(panel.error()?.errorKey).toBe('withholdingRecipients.error.net_not_positive');
    expect(panel.rows()).toHaveLength(1);
  });
});

describe('FlowsPanelComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = buildApi();
    configure(api, () => true);
    TestBed.configureTestingModule({ providers: [SettlementsStore] });
  });

  async function render() {
    const fixture = TestBed.createComponent(FlowsPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the F24 of the month grouped by section with tax code, due date and total', async () => {
    const fixture = await render();
    const content = text(fixture.nativeElement);

    expect(api['getF24']).toHaveBeenCalledTimes(1);
    expect(content).toContain('2026-06-16');
    expect(content).toContain('withholdingRecipients.f24.section.erario');
    expect(content).toContain('withholdingRecipients.f24.section.inps');
    expect(content).toContain('1040 05/2026');
    expect(content).toContain('C10 05/2026');
    expect(content).toContain('withholdingRecipients.f24.code.1040');
    expect(content).toContain('737.20');
  });

  it('downloads the F24 CSV and the UniEmens XML of the month', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;
    // The browser download is a click on an anchor: record it instead of navigating.
    const files: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      files.push(this.download);
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();

    await component.download(component.store.exportF24());
    await component.download(component.store.exportUniEmens());

    expect(api['exportF24']).toHaveBeenCalledTimes(1);
    expect(api['exportUniEmens']).toHaveBeenCalledTimes(1);
    expect(files).toEqual([
      `f24-${component.store.flowMonth()}.csv`,
      `uniemens-${component.store.flowMonth()}.xml`,
    ]);
  });

  it('does not read or export a month that is not complete', async () => {
    const fixture = await render();
    api['getF24'].mockClear();

    fixture.componentInstance.store.setFlowMonth('2026-');
    fixture.detectChanges();
    await fixture.componentInstance.store.loadF24();

    expect(fixture.componentInstance.monthValid()).toBe(false);
    expect(api['getF24']).not.toHaveBeenCalled();
  });
});

describe('AnnualPanelComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = buildApi();
    configure(api, () => true);
    TestBed.configureTestingModule({ providers: [SettlementsStore] });
  });

  async function render() {
    const fixture = TestBed.createComponent(AnnualPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lists the CU records of the year with causal and totals', async () => {
    const fixture = await render();
    const content = text(fixture.nativeElement);

    expect(api['listAnnualReturns']).toHaveBeenCalledTimes(1);
    expect(content).toContain('Recipient r-1');
    expect(content).toContain('withholdingRecipients.annual.returnType.CU');
    expect(content).toContain('withholdingRecipients.causal.M');
    expect(content).toContain('600.00');
  });

  it('generates the records of the year and reports it', async () => {
    const fixture = await render();

    await fixture.componentInstance.generate();

    expect(api['generateAnnualReturns']).toHaveBeenCalledTimes(1);
    expect(messageSpy.success).toHaveBeenCalledWith(
      'withholdingRecipients.message.returnsGenerated',
    );
  });

  it('shows the refusal of the generation with its translation key', async () => {
    api['generateAnnualReturns'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'generic' } })),
    );
    const fixture = await render();

    await fixture.componentInstance.generate();
    fixture.detectChanges();

    expect(text(fixture.nativeElement)).toContain('withholdingRecipients.error.generic');
    expect(messageSpy.success).not.toHaveBeenCalled();
  });

  it('shows the empty state for a year without records', async () => {
    api['listAnnualReturns'].mockReturnValue(of(wrap([])));

    const fixture = await render();

    expect(text(fixture.nativeElement)).toContain('withholdingRecipients.annual.empty');
  });
});
