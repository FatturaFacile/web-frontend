import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService, PermissionsService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import {
  agent,
  pageMeta,
  preview,
  statement,
  translateSpy,
  wrap,
} from './agent-commissions.testing';
import {
  AGENT_COMMISSIONS_MODULE,
  AGENT_COMMISSIONS_SETTLE_MODULE,
} from './agent-commissions.util';
import { StatementDetailDrawerComponent } from './statement-detail-drawer.component';
import {
  generatePayloadOf,
  StatementGenerateModalComponent,
} from './statement-generate-modal.component';
import { StatementsComponent } from './statements.component';
import { StatementsStore } from './statements.store';

const messageSpy = { success: vi.fn(), error: vi.fn() };
const problem = (code: string) =>
  throwError(() => new HttpErrorResponse({ status: 422, error: { code, detail: code } }));
const rows = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('tbody tr')).filter((row) => row.querySelector('td'));

const approved = statement('2', {
  status: 'approved',
  approved_at: '2026-04-01T10:00:00+00:00',
  blocked_amount: '120.00',
  massimale_reached: true,
});

function configure(access: Record<string, boolean>, api: Record<string, ReturnType<typeof vi.fn>>) {
  TestBed.configureTestingModule({
    providers: [
      { provide: AgentCommissionsApiService, useValue: api },
      { provide: PermissionsService, useValue: { canWrite: (module: string) => access[module] } },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy() },
      provideNzIcons(icons),
    ],
  });
}

function buildApi(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    listAgents: vi.fn(() => of(wrap([agent('a-1')]))),
    listStatements: vi.fn(() =>
      of({
        success: true,
        message: 'OK',
        data: [statement('1'), approved],
        meta: pageMeta,
      }),
    ),
    getStatement: vi.fn((id: string) => of(wrap(id === '2' ? approved : statement(id)))),
    previewStatement: vi.fn(() => of(wrap(preview))),
    generateStatement: vi.fn(() => of(wrap(statement('7')))),
    approveStatement: vi.fn(() =>
      of(wrap(statement('1', { status: 'approved', lines: undefined }))),
    ),
    voidStatement: vi.fn(() => of(wrap(statement('1', { status: 'void', lines: undefined })))),
    prepareSelfBilling: vi.fn(() =>
      of(
        wrap({
          ...approved,
          status: 'invoiced',
          self_billing_number: 'AF-2026-0001',
          self_billing_date: '2026-04-02',
          self_billing_payload: {
            document_kind: 'agent_commission_invoice',
            number: 'AF-2026-0001',
            date: '2026-04-02',
            currency: 'EUR',
            statement_number: approved.number,
            period: { from: '2026-03-01', to: '2026-03-31' },
            agent: {
              name: 'Agent a-1',
              email: null,
              fiscal_regime: 'enasarco',
              enasarco_registration_number: null,
            },
            taxable_amount: '500.00',
            vat_rate: '22.0000',
            vat_amount: '110.00',
            document_total: '610.00',
            enasarco_agent: '13.50',
            withholding_base: '243.25',
            withholding_rate: '20.0000',
            withholding_amount: '48.65',
            net_payable: '547.85',
            lines: [],
          },
        }),
      ),
    ),
    payStatement: vi.fn(() => of(wrap({ ...approved, status: 'paid', lines: undefined }))),
    sendStatement: vi.fn(() =>
      of(wrap({ ...approved, sent_count: 1, sent_to: 'agent@example.test', lines: undefined })),
    ),
    downloadStatementPdf: vi.fn(() => of(new Blob(['%PDF']))),
  };
}

describe('StatementsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let access: Record<string, boolean>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = buildApi();
    access = { [AGENT_COMMISSIONS_MODULE]: true, [AGENT_COMMISSIONS_SETTLE_MODULE]: true };
    configure(access, api);
  });

  async function render() {
    const fixture = TestBed.createComponent(StatementsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lists the statements with period, status and amounts', async () => {
    const fixture = await render();
    const body = rows(fixture.nativeElement as HTMLElement);

    expect(body).toHaveLength(2);
    expect(body[0].textContent).toContain('ST-2026-0001');
    expect(body[0].textContent).toContain('Agent a-1');
    expect(body[0].textContent).toContain('2026-03-01');
    expect(body[0].textContent).toContain('agentCommissions.statementStatus.draft');
    expect(body[1].textContent).toContain('agentCommissions.statementStatus.approved');
  });

  it('shows the blocked amount with a lock only when there is one', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('.lock')).toHaveLength(1);
    expect(rows(root)[1].querySelector('.lock i.fa-lock')).not.toBeNull();
    expect(rows(root)[0].querySelector('.lock')).toBeNull();
  });

  it('filters by status from the first page', async () => {
    const fixture = await render();

    await fixture.componentInstance.store.setStatus('approved');

    expect(api['listStatements']).toHaveBeenLastCalledWith({
      per_page: 20,
      page: 1,
      status: 'approved',
    });
  });

  it('offers to generate a statement to those who can manage the commissions', async () => {
    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.action.generate',
    );
  });

  it('hides the generation from a read-only member', async () => {
    access[AGENT_COMMISSIONS_MODULE] = false;

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'agentCommissions.action.generate',
    );
    expect(rows(fixture.nativeElement as HTMLElement)).toHaveLength(2);
  });

  it('shows the empty state', async () => {
    api['listStatements'].mockReturnValue(
      of({ success: true, message: 'OK', data: [], meta: { ...pageMeta, total: 0 } }),
    );

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.statements.empty',
    );
  });

  it('opens the generated statement in the drawer and closes the dialog', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;
    component.generateOpen.set(true);

    component.onGenerated('2');

    expect(component.generateOpen()).toBe(false);
    await vi.waitFor(() => expect(component.store.detail()?.id).toBe('2'));
  });
});

describe('generatePayloadOf', () => {
  const input = {
    type: 'monthly' as const,
    month: '2026-03',
    year: 2026,
    quarter: 1,
    from: '',
    to: '',
  };

  it('builds the request from the agent and the period', () => {
    expect(generatePayloadOf('a-1', input)).toEqual({
      agent_profile_id: 'a-1',
      period_start: '2026-03-01',
      period_end: '2026-03-31',
      period_type: 'monthly',
    });
  });

  it('is null without an agent or with an invalid period', () => {
    expect(generatePayloadOf(null, input)).toBeNull();
    expect(generatePayloadOf('a-1', { ...input, type: 'custom' })).toBeNull();
  });
});

describe('StatementGenerateModalComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = buildApi();
    configure({}, api);
    TestBed.configureTestingModule({ providers: [StatementsStore] });
  });

  async function render() {
    const store = TestBed.inject(StatementsStore);
    await store.init();
    const fixture = TestBed.createComponent(StatementGenerateModalComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    return { fixture, store, modal: fixture.componentInstance };
  }

  it('cannot generate before an agent and a period are chosen, and previews nothing', async () => {
    const { fixture, modal } = await render();
    await fixture.whenStable();

    expect(modal.payload()).toBeNull();
    expect(modal.canGenerate()).toBe(false);
    expect(api['previewStatement']).not.toHaveBeenCalled();
  });

  it('previews the statement as soon as the agent and the period are known', async () => {
    const { fixture, store, modal } = await render();

    modal.agentId.set('a-1');
    modal.month.set('2026-03');
    fixture.detectChanges();

    await vi.waitFor(() => expect(store.preview()).not.toBeNull());
    expect(api['previewStatement']).toHaveBeenCalledWith({
      agent_profile_id: 'a-1',
      period_start: '2026-03-01',
      period_end: '2026-03-31',
      period_type: 'monthly',
    });
    expect(modal.canGenerate()).toBe(true);
    expect(modal.summary()?.net_payable).toBe('632.63');
    expect(modal.summary()?.massimale_reached).toBe(true);
  });

  it('asks for a new preview when the period type changes', async () => {
    const { fixture, store, modal } = await render();
    modal.agentId.set('a-1');
    fixture.detectChanges();
    await vi.waitFor(() => expect(store.preview()).not.toBeNull());

    modal.type.set('quarterly');
    modal.year.set(2026);
    modal.quarter.set(2);
    fixture.detectChanges();

    await vi.waitFor(() =>
      expect(api['previewStatement']).toHaveBeenLastCalledWith({
        agent_profile_id: 'a-1',
        period_start: '2026-04-01',
        period_end: '2026-06-30',
        period_type: 'quarterly',
      }),
    );
  });

  it('does not generate when the preview is refused', async () => {
    api['previewStatement'].mockReturnValue(problem('nothing_to_settle'));
    const { fixture, store, modal } = await render();

    modal.agentId.set('a-1');
    fixture.detectChanges();

    await vi.waitFor(() =>
      expect(store.previewError()).toBe('agentCommissions.error.nothing_to_settle'),
    );
    expect(modal.canGenerate()).toBe(false);
    await modal.generate();
    expect(api['generateStatement']).not.toHaveBeenCalled();
  });

  it('generates the statement and announces it', async () => {
    const { fixture, store, modal } = await render();
    const generated = vi.fn();
    modal.generated.subscribe(generated);
    modal.agentId.set('a-1');
    fixture.detectChanges();
    await vi.waitFor(() => expect(store.preview()).not.toBeNull());

    await modal.generate();

    expect(api['generateStatement']).toHaveBeenCalledWith(
      expect.objectContaining({ agent_profile_id: 'a-1', period_type: 'monthly' }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.generated');
    expect(generated).toHaveBeenCalledWith('7');
  });

  it('shows the refusal of an overlapping period and keeps the dialog', async () => {
    api['generateStatement'].mockReturnValue(problem('period_overlap'));
    const { fixture, store, modal } = await render();
    const generated = vi.fn();
    modal.generated.subscribe(generated);
    modal.agentId.set('a-1');
    fixture.detectChanges();
    await vi.waitFor(() => expect(store.preview()).not.toBeNull());

    await modal.generate();

    expect(modal.error()?.errorKey).toBe('agentCommissions.error.period_overlap');
    expect(generated).not.toHaveBeenCalled();
  });

  it('renders the breakdown of the preview in the dialog', async () => {
    const { fixture, store, modal } = await render();
    modal.agentId.set('a-1');
    fixture.detectChanges();
    await vi.waitFor(() => expect(store.preview()).not.toBeNull());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = document.body.textContent as string;
    expect(text).toContain('agentCommissions.statements.previewTitle');
    expect(text).toContain('agentCommissions.statements.gross');
    expect(text).toContain('agentCommissions.statements.enasarcoAgent');
    expect(text).toContain('agentCommissions.statements.enasarcoCompany');
    expect(text).toContain('agentCommissions.statements.firr');
    expect(text).toContain('agentCommissions.statements.withholding');
    expect(text).toContain('agentCommissions.statements.vat');
    expect(text).toContain('agentCommissions.statements.netPayable');
    expect(text).toContain('agentCommissions.statements.blocked');
    expect(text).toContain('agentCommissions.statements.massimaleReached');
  });
});

describe('StatementDetailDrawerComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let access: Record<string, boolean>;
  let downloads: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    api = buildApi();
    access = { [AGENT_COMMISSIONS_MODULE]: true, [AGENT_COMMISSIONS_SETTLE_MODULE]: true };
    downloads = [];
    // The browser download is a click on an anchor: record the file name instead of navigating.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    URL.createObjectURL = vi.fn(() => 'blob:pdf');
    URL.revokeObjectURL = vi.fn();
    configure(access, api);
    TestBed.configureTestingModule({ providers: [StatementsStore] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function open(id: string) {
    const store = TestBed.inject(StatementsStore);
    const fixture = TestBed.createComponent(StatementDetailDrawerComponent);
    await store.init();
    await store.openDetail(id);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store, drawer: fixture.componentInstance };
  }

  const overlay = () => document.body.textContent as string;

  it('offers approve and void on a draft, with the PDF', async () => {
    await open('1');

    expect(overlay()).toContain('agentCommissions.action.approve');
    expect(overlay()).toContain('agentCommissions.action.void');
    expect(overlay()).toContain('agentCommissions.action.downloadPdf');
    expect(overlay()).not.toContain('agentCommissions.action.pay');
    expect(overlay()).not.toContain('agentCommissions.action.selfBilling');
  });

  it('offers the invoice, the payment, the send and the void on an approved statement', async () => {
    await open('2');

    expect(overlay()).not.toContain('agentCommissions.action.approve');
    expect(overlay()).toContain('agentCommissions.action.selfBilling');
    expect(overlay()).toContain('agentCommissions.action.pay');
    expect(overlay()).toContain('agentCommissions.action.send');
    expect(overlay()).toContain('agentCommissions.action.void');
  });

  it('shows the breakdown, the lines and the notice of the reached ceiling', async () => {
    await open('2');

    expect(overlay()).toContain('agentCommissions.statements.massimaleReached');
    expect(overlay()).toContain('agentCommissions.statements.summary');
    expect(overlay()).toContain('agentCommissions.statements.lines');
    expect(overlay()).toContain('Acme Spa');
    expect(overlay()).toContain('FA-1');
  });

  it('keeps the workflow actions from a member who cannot settle, but lets them download the PDF', async () => {
    access[AGENT_COMMISSIONS_SETTLE_MODULE] = false;

    await open('2');

    expect(overlay()).toContain('agentCommissions.action.downloadPdf');
    expect(overlay()).not.toContain('agentCommissions.action.approve');
    expect(overlay()).not.toContain('agentCommissions.action.pay');
    expect(overlay()).not.toContain('agentCommissions.action.send');
    expect(overlay()).not.toContain('agentCommissions.action.selfBilling');
    expect(overlay()).not.toContain('agentCommissions.action.void');
  });

  it('does not offer the invoice for an agent settled on salary', async () => {
    api['getStatement'].mockReturnValue(of(wrap({ ...approved, settlement_channel: 'salary' })));

    await open('2');

    expect(overlay()).not.toContain('agentCommissions.action.selfBilling');
    expect(overlay()).toContain('agentCommissions.action.pay');
  });

  it('offers nothing but the PDF on a statement that is paid or void', async () => {
    api['getStatement'].mockReturnValue(of(wrap(statement('5', { status: 'paid' }))));

    await open('5');

    expect(overlay()).toContain('agentCommissions.action.downloadPdf');
    expect(overlay()).not.toContain('agentCommissions.action.approve');
    expect(overlay()).not.toContain('agentCommissions.action.pay');
    expect(overlay()).not.toContain('agentCommissions.action.void');
  });

  it('approves and reports it', async () => {
    const { drawer } = await open('1');

    await drawer.approve('1');

    expect(api['approveStatement']).toHaveBeenCalledWith('1');
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.approved');
    expect(drawer.actionError()).toBeNull();
  });

  it('voids and reports it', async () => {
    const { drawer } = await open('1');

    await drawer.voidStatement('1');

    expect(api['voidStatement']).toHaveBeenCalledWith('1');
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.voided');
  });

  it('prepares the invoice with the chosen date and shows the prepared data', async () => {
    const { drawer, fixture } = await open('2');
    drawer.openDialog('selfBilling');
    drawer.billingDate.set('2026-04-02');

    await drawer.confirmDialog();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['prepareSelfBilling']).toHaveBeenCalledWith('2', '2026-04-02');
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.invoiced');
    expect(drawer.dialog()).toBeNull();
    expect(overlay()).toContain('agentCommissions.statements.selfBillingTitle');
    expect(overlay()).toContain('AF-2026-0001');
    expect(overlay()).toContain('agentCommissions.statements.documentTotal');
  });

  it('pays with the reference and the date', async () => {
    const { drawer } = await open('2');
    drawer.openDialog('pay');
    drawer.payReference.set(' BON-77 ');
    drawer.paidOn.set('2026-04-05');

    await drawer.confirmDialog();

    expect(api['payStatement']).toHaveBeenCalledWith('2', {
      reference: 'BON-77',
      paid_on: '2026-04-05',
    });
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.paid');
    expect(drawer.dialog()).toBeNull();
  });

  it('pays without a reference by sending null', async () => {
    const { drawer } = await open('2');
    drawer.openDialog('pay');
    drawer.payReference.set('  ');
    drawer.paidOn.set('');

    await drawer.confirmDialog();

    expect(api['payStatement']).toHaveBeenCalledWith('2', { reference: null, paid_on: null });
  });

  it('shows the translated refusal of a blocked payout', async () => {
    api['payStatement'].mockReturnValue(problem('payout_blocked'));
    const { drawer, fixture } = await open('2');
    drawer.openDialog('pay');

    await drawer.confirmDialog();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(drawer.actionError()).toBe('agentCommissions.error.payout_blocked');
    expect(messageSpy.success).not.toHaveBeenCalled();
    expect(overlay()).toContain('agentCommissions.error.payout_blocked');
  });

  it('sends the PDF to the agent, or to the recipient typed', async () => {
    const { drawer } = await open('2');
    drawer.openDialog('send');

    await drawer.confirmDialog();
    expect(api['sendStatement']).toHaveBeenLastCalledWith('2', { recipient: null });
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.sent');

    drawer.openDialog('send');
    drawer.recipient.set(' other@example.test ');
    await drawer.confirmDialog();
    expect(api['sendStatement']).toHaveBeenLastCalledWith('2', { recipient: 'other@example.test' });
  });

  it('shows the refusal of an agent without an email address', async () => {
    api['sendStatement'].mockReturnValue(problem('no_recipient'));
    const { drawer } = await open('2');
    drawer.openDialog('send');

    await drawer.confirmDialog();

    expect(drawer.actionError()).toBe('agentCommissions.error.no_recipient');
  });

  it('shows the refusal to prepare the invoice of an agent settled on salary', async () => {
    api['prepareSelfBilling'].mockReturnValue(problem('settled_on_salary'));
    const { drawer } = await open('2');
    drawer.openDialog('selfBilling');

    await drawer.confirmDialog();

    expect(drawer.actionError()).toBe('agentCommissions.error.settled_on_salary');
  });

  it('downloads the PDF with the file name of the statement', async () => {
    const { drawer } = await open('1');

    await drawer.downloadPdf();

    expect(api['downloadStatementPdf']).toHaveBeenCalledWith('1');
    expect(downloads).toEqual(['statement-ST-2026-0001.pdf']);
  });

  it('shows the refusal of a failed PDF without downloading anything', async () => {
    api['downloadStatementPdf'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: new Blob([JSON.stringify({ code: 'generic' })], { type: 'application/json' }),
          }),
      ),
    );
    const { drawer } = await open('1');

    await drawer.downloadPdf();

    expect(downloads).toEqual([]);
    expect(drawer.actionError()).toBe('agentCommissions.error.generic');
  });

  it('titles the confirmation dialog with the action', async () => {
    const { drawer } = await open('2');

    drawer.openDialog('pay');
    expect(drawer.dialogTitle()).toBe('agentCommissions.action.pay');
    drawer.openDialog('send');
    expect(drawer.dialogTitle()).toBe('agentCommissions.action.send');
    drawer.openDialog('selfBilling');
    expect(drawer.dialogTitle()).toBe('agentCommissions.action.selfBilling');
  });
});
