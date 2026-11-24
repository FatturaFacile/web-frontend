import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthStore,
  CrmExtensionApiService,
  SalesPipelineApiService,
  SalesPipelineRealtimeService,
  type SalesBoardColumn,
  type SalesDeal,
} from '@core';
import { icons } from '../../../icons-provider';
import { httpError, i18nStub, messageStub } from '../leads/lead-test.utils';
import { LeadAssigneeDirectory } from '../leads/lead-assignee-directory';
import { SalesBoardComponent } from './sales-board.component';
import { SalesForecastComponent, progressPercent } from './sales-forecast.component';
import { SalesLossModalComponent } from './sales-loss-modal.component';
import {
  SalesPipelineSettingsComponent,
  cleanTranslations,
} from './sales-pipeline-settings.component';
import { SalesPipelinePageComponent } from './sales-pipeline.page';
import { SalesQuickNoteComponent } from './sales-quick-note.component';
import {
  boardFixture,
  dashboardFixture,
  deal,
  LOSS_REASONS,
  PIPELINE,
} from './sales-pipeline.fixtures';

const el = (fixture: ComponentFixture<unknown>): HTMLElement =>
  fixture.nativeElement as HTMLElement;
const byTestId = (fixture: ComponentFixture<unknown>, id: string): HTMLElement | null =>
  el(fixture).querySelector(`[data-testid="${id}"]`);
const settle = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
};

function dropEvent(
  deal: SalesDeal,
  source: SalesBoardColumn,
  target: SalesBoardColumn,
  previousIndex: number,
  currentIndex: number,
): CdkDragDrop<SalesBoardColumn, SalesBoardColumn, SalesDeal> {
  const previousContainer = { data: source };
  const container = source === target ? previousContainer : { data: target };
  return {
    item: { data: deal },
    previousContainer,
    container,
    previousIndex,
    currentIndex,
  } as unknown as CdkDragDrop<SalesBoardColumn, SalesBoardColumn, SalesDeal>;
}

function baseProviders(message = messageStub()) {
  return [
    provideNzIcons(icons),
    provideNzI18n(en_US),
    provideNzDateFnsAdapter(),
    i18nStub(),
    { provide: NzMessageService, useValue: message },
    { provide: AuthStore, useValue: { activeTenantId: () => 't1', activeCurrency: () => 'CHF' } },
    {
      provide: LeadAssigneeDirectory,
      useValue: {
        users: signal([]),
        available: signal(false),
        loaded: signal(true),
        load: vi.fn(),
        nameOf: (id: string) => id,
      },
    },
  ];
}

describe('SalesLossModalComponent', () => {
  let fixture: ComponentFixture<SalesLossModalComponent>;
  let component: SalesLossModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalesLossModalComponent],
      providers: baseProviders(),
    }).compileComponents();
    fixture = TestBed.createComponent(SalesLossModalComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('dealName', 'Big deal');
    fixture.componentRef.setInput(
      'reasons',
      LOSS_REASONS.filter((reason) => reason.is_active),
    );
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('does not confirm until the loss reason and the winning competitor are both given', () => {
    const confirmed = vi.fn();
    component.confirmed.subscribe(confirmed);

    component.submit();
    expect(confirmed).not.toHaveBeenCalled();

    component.form.patchValue({ reason: 'price' });
    component.submit();
    expect(confirmed).not.toHaveBeenCalled();

    component.form.patchValue({ competitor: '   ' });
    component.submit();
    expect(confirmed).not.toHaveBeenCalled();
    expect(component.form.controls.competitor.hasError('required')).toBe(true);
  });

  it('emits the questionnaire with the competitor trimmed and empty notes as null', () => {
    const confirmed = vi.fn();
    component.confirmed.subscribe(confirmed);

    component.form.patchValue({
      reason: 'specific_competitor',
      competitor: '  Rival SA ',
      notes: '',
    });
    component.submit();
    expect(confirmed).toHaveBeenCalledWith({
      loss_reason_code: 'specific_competitor',
      competitor: 'Rival SA',
      loss_notes: null,
    });

    component.form.patchValue({ notes: ' 20% cheaper ' });
    component.submit();
    expect(confirmed).toHaveBeenLastCalledWith({
      loss_reason_code: 'specific_competitor',
      competitor: 'Rival SA',
      loss_notes: '20% cheaper',
    });
  });

  it('shows the server validation messages and resets when reopened', () => {
    fixture.componentRef.setInput('serverErrors', {
      competitor: ['Il competitor è obbligatorio'],
      loss_reason_code: ['Motivo non valido'],
    });
    fixture.detectChanges();

    expect(component.competitorError()).toBe('Il competitor è obbligatorio');
    expect(component.reasonError()).toBe('Motivo non valido');

    component.form.patchValue({ reason: 'price', competitor: 'X' });
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(component.form.getRawValue()).toEqual({ reason: '', competitor: '', notes: '' });
  });

  it('reports a cancellation', () => {
    const cancelled = vi.fn();
    component.cancelled.subscribe(cancelled);

    component.cancel();

    expect(cancelled).toHaveBeenCalled();
  });
});

describe('SalesQuickNoteComponent', () => {
  it('emits the trimmed note with the append choice and ignores an empty one', async () => {
    await TestBed.configureTestingModule({
      imports: [SalesQuickNoteComponent],
      providers: baseProviders(),
    }).compileComponents();
    const fixture = TestBed.createComponent(SalesQuickNoteComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('deal', deal('d1', 's1', 100, 10, { notes: 'Earlier note' }));
    fixture.detectChanges();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    fixture.componentInstance.save();
    expect(saved).not.toHaveBeenCalled();

    fixture.componentInstance.text.set('  Sent the quote  ');
    fixture.componentInstance.save();
    expect(saved).toHaveBeenCalledWith({ notes: 'Sent the quote', append: true });

    fixture.componentInstance.append.set(false);
    fixture.componentInstance.save();
    expect(saved).toHaveBeenLastCalledWith({ notes: 'Sent the quote', append: false });
  });
});

describe('SalesBoardComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let message: ReturnType<typeof messageStub>;
  let realtime: {
    connected: ReturnType<typeof signal<boolean>>;
    changes: ReturnType<typeof signal<unknown>>;
    start: ReturnType<typeof vi.fn>;
  };
  let fixture: ComponentFixture<SalesBoardComponent>;

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(SalesBoardComponent);
    fixture.detectChanges();
    await settle(fixture);
  }

  beforeEach(async () => {
    message = messageStub();
    realtime = {
      connected: signal(false),
      changes: signal<unknown>(null),
      start: vi.fn().mockResolvedValue(undefined),
    };
    api = {
      listPipelines: vi.fn(() => of([PIPELINE])),
      listLossReasons: vi.fn(() => of(LOSS_REASONS)),
      getBoard: vi.fn(() => of(boardFixture())),
      moveDeal: vi.fn(() => of({ opportunity: deal('d1', 's2', 10000, 75), stage_totals: {} })),
      updateNotes: vi.fn((id: string, notes: string) => of(deal(id, 's1', 10000, 25, { notes }))),
    };
    await TestBed.configureTestingModule({
      imports: [SalesBoardComponent],
      providers: [
        ...baseProviders(message),
        { provide: SalesPipelineApiService, useValue: api },
        { provide: SalesPipelineRealtimeService, useValue: realtime },
      ],
    }).compileComponents();
  });

  it('renders one column per stage with the raw and weighted totals', async () => {
    await create();

    const columns = el(fixture).querySelectorAll('[data-stage]');
    expect([...columns].map((column) => column.getAttribute('data-stage'))).toEqual([
      'discovery',
      'negotiation',
      'closed_won',
      'closed_lost',
    ]);
    expect(el(fixture).querySelectorAll('[data-deal]')).toHaveLength(3);
    expect(byTestId(fixture, 'board-summary')?.textContent).toContain('3');
    expect(realtime.start).toHaveBeenCalledWith('t1');
    expect(byTestId(fixture, 'live-indicator')?.textContent).toContain('SALESPIPE.LIVE_OFF');
  });

  it('shows an error with retry when the board cannot be loaded', async () => {
    api['getBoard'] = vi.fn(() => throwError(() => httpError(500)));
    await create();

    expect(byTestId(fixture, 'board-error')).not.toBeNull();
    expect(byTestId(fixture, 'board')).toBeNull();

    api['getBoard'] = vi.fn(() => of(boardFixture()));
    await fixture.componentInstance['store'].loadBoard();
    await settle(fixture);
    expect(byTestId(fixture, 'board')).not.toBeNull();
  });

  it('shows the empty state when no pipeline stage is configured', async () => {
    api['getBoard'] = vi.fn(() =>
      of({
        ...boardFixture(),
        columns: [],
        totals: { count: 0, amount: '0.00', weighted_amount: '0.00' },
      }),
    );
    await create();

    expect(byTestId(fixture, 'board-empty')).not.toBeNull();
  });

  it('moves a deal on drop and keeps the optimistic totals', async () => {
    await create();
    const [qualification, negotiation] = fixture.componentInstance['store'].columns();

    await fixture.componentInstance.onDrop(
      dropEvent(qualification.opportunities[0], qualification, negotiation, 0, 0),
    );

    expect(api['moveDeal']).toHaveBeenCalledWith('d1', { stage_id: 's2', position: 0 });
    expect(fixture.componentInstance['store'].columns()[0].totals.count).toBe(1);
    expect(message.error).not.toHaveBeenCalled();
  });

  it('ignores a drop at the same place', async () => {
    await create();
    const [qualification] = fixture.componentInstance['store'].columns();

    await fixture.componentInstance.onDrop(
      dropEvent(qualification.opportunities[0], qualification, qualification, 0, 0),
    );

    expect(api['moveDeal']).not.toHaveBeenCalled();
  });

  it('rolls back and reports a failed move', async () => {
    await create();
    api['moveDeal'] = vi.fn(() => throwError(() => httpError(500)));
    const [qualification, negotiation] = fixture.componentInstance['store'].columns();

    await fixture.componentInstance.onDrop(
      dropEvent(qualification.opportunities[0], qualification, negotiation, 0, 1),
    );

    expect(message.error).toHaveBeenCalledWith('SALESPIPE.MOVE_FAILED');
    expect(fixture.componentInstance['store'].columns()[0].totals.count).toBe(2);
  });

  it('asks the loss questionnaire before a deal is dropped on a lost stage', async () => {
    await create();
    const [qualification, , , lost] = fixture.componentInstance['store'].columns();

    await fixture.componentInstance.onDrop(
      dropEvent(qualification.opportunities[0], qualification, lost, 0, 0),
    );

    expect(api['moveDeal']).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pendingLoss()?.deal.id).toBe('d1');

    api['moveDeal'] = vi.fn(() =>
      of({ opportunity: deal('d1', 's4', 10000, 0, { status: 'lost' }), stage_totals: {} }),
    );
    await fixture.componentInstance.confirmLoss({
      loss_reason_code: 'price',
      competitor: 'Rival SA',
      loss_notes: null,
    });

    expect(api['moveDeal']).toHaveBeenCalledWith('d1', {
      stage_id: 's4',
      position: 0,
      loss_reason_code: 'price',
      competitor: 'Rival SA',
      loss_notes: null,
    });
    expect(fixture.componentInstance.pendingLoss()).toBeNull();
    expect(message.success).toHaveBeenCalledWith('SALESPIPE.MOVED');
  });

  it('keeps the questionnaire open with the server errors when the API refuses it', async () => {
    await create();
    const [qualification, , , lost] = fixture.componentInstance['store'].columns();
    await fixture.componentInstance.onDrop(
      dropEvent(qualification.opportunities[0], qualification, lost, 0, 0),
    );
    api['moveDeal'] = vi.fn(() =>
      throwError(() => httpError(422, { errors: { competitor: ['required by the server'] } })),
    );

    await fixture.componentInstance.confirmLoss({
      loss_reason_code: 'price',
      competitor: 'x',
      loss_notes: null,
    });

    expect(fixture.componentInstance.pendingLoss()).not.toBeNull();
    expect(fixture.componentInstance.lossErrors()).toEqual({
      competitor: ['required by the server'],
    });
    expect(fixture.componentInstance['store'].columns()[0].totals.count).toBe(2);
  });

  it('saves a quick note and closes the sheet', async () => {
    await create();
    const first = fixture.componentInstance['store'].columns()[0].opportunities[0];

    fixture.componentInstance.openNote(first);
    expect(fixture.componentInstance.noteDeal()?.id).toBe('d1');
    await fixture.componentInstance.saveNote({ notes: 'Called', append: true });

    expect(api['updateNotes']).toHaveBeenCalledWith('d1', 'Called', true);
    expect(fixture.componentInstance.noteDeal()).toBeNull();
    expect(message.success).toHaveBeenCalledWith('SALESPIPE.NOTE_SAVED');
  });

  it('refreshes silently when another device changes the board', async () => {
    await create();
    api['getBoard'].mockClear();

    realtime.changes.set({
      opportunity_id: 'd9',
      change: 'moved',
      pipeline_id: 'p1',
      stage_id: 's2',
      actor_user_id: 'u2',
    });
    await settle(fixture);

    expect(api['getBoard']).toHaveBeenCalledTimes(1);
  });

  it('filters by owner, category and period through the API', async () => {
    await create();

    await fixture.componentInstance['store'].setFilters({ owner_user_id: 'u1' });
    fixture.componentInstance.onRange([new Date(2027, 0, 1), new Date(2027, 2, 31)]);
    await settle(fixture);

    expect(api['getBoard']).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ owner_user_id: 'u1', from: '2027-01-01', to: '2027-03-31' }),
    );
    expect(fixture.componentInstance.owners().map((owner) => owner.name)).toEqual(['Rep One']);
  });
});

describe('SalesForecastComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let quotas: Record<string, ReturnType<typeof vi.fn>>;
  let message: ReturnType<typeof messageStub>;
  let fixture: ComponentFixture<SalesForecastComponent>;

  beforeEach(async () => {
    message = messageStub();
    api = {
      listPipelines: vi.fn(() => of([PIPELINE])),
      getForecastDashboard: vi.fn(() => of(dashboardFixture())),
      getLossAnalysis: vi.fn(() =>
        of({
          total_lost: { count: 2, amount: '4000.00' },
          by_reason: [{ code: 'price', label: 'Prezzo', count: 2, amount: '4000.00' }],
          by_competitor: [{ competitor: 'Rival SA', count: 2, amount: '4000.00' }],
        }),
      ),
    };
    quotas = {
      getSalesQuotas: vi.fn(() =>
        of({
          data: [
            {
              id: 'q1',
              user_id: 'u1',
              territory_id: null,
              period_start: '2027-01-01',
              period_end: '2027-03-31',
              target_amount: '30000.00',
              currency: 'CHF',
              notes: null,
            },
          ],
        }),
      ),
      createSalesQuota: vi.fn(() => of({ data: {} })),
      updateSalesQuota: vi.fn(() => of({ data: {} })),
      deleteSalesQuota: vi.fn(() => of(undefined)),
    };
    await TestBed.configureTestingModule({
      imports: [SalesForecastComponent],
      providers: [
        ...baseProviders(message),
        { provide: SalesPipelineApiService, useValue: api },
        { provide: CrmExtensionApiService, useValue: quotas },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SalesForecastComponent);
    fixture.detectChanges();
    await settle(fixture);
  });

  it('shows the quota tracking: buckets, rep attainment and the loss analysis', () => {
    expect(api['getForecastDashboard']).toHaveBeenCalledWith(
      expect.objectContaining({ granularity: 'quarter', quarter: null, pipeline_id: null }),
    );
    expect(byTestId(fixture, 'bucket-table')?.textContent).toContain('Q1');
    expect(byTestId(fixture, 'rep-table')?.textContent).toContain('Rep One');
    expect(byTestId(fixture, 'forecast-stats')?.textContent).toContain('26.66');
    expect(byTestId(fixture, 'loss-analysis')?.textContent).toContain('Rival SA');
    expect(byTestId(fixture, 'quota-table')?.textContent).toContain('2027-03-31');
  });

  it('reloads with the chosen granularity, year, quarter and pipeline', async () => {
    fixture.componentInstance.setGranularity('month');
    fixture.componentInstance.setYear(2028);
    fixture.componentInstance.setScope('q2');
    fixture.componentInstance.setPipeline('p1');
    await settle(fixture);

    expect(api['getForecastDashboard']).toHaveBeenLastCalledWith({
      granularity: 'month',
      year: 2028,
      quarter: 2,
      pipeline_id: 'p1',
    });
    expect(api['getLossAnalysis']).toHaveBeenLastCalledWith({
      pipeline_id: 'p1',
      from: '2028-01-01',
      to: '2028-12-31',
    });
  });

  it('shows a load error', async () => {
    api['getForecastDashboard'] = vi.fn(() => throwError(() => httpError(500)));

    await fixture.componentInstance.reload();
    fixture.detectChanges();

    expect(byTestId(fixture, 'forecast-error')).not.toBeNull();
  });

  it('creates a quota for a rep and period and refreshes the dashboard', async () => {
    fixture.componentInstance.openQuota(null);
    fixture.componentInstance.quotaForm.patchValue({
      user_id: 'u1',
      period_start: '2027-04-01',
      period_end: '2027-06-30',
      target_amount: 50000,
    });

    await fixture.componentInstance.saveQuota();

    expect(quotas['createSalesQuota']).toHaveBeenCalledWith({
      user_id: 'u1',
      period_start: '2027-04-01',
      period_end: '2027-06-30',
      target_amount: 50000,
      currency: 'CHF',
    });
    expect(message.success).toHaveBeenCalledWith('SALESPIPE.QUOTA_SAVED');
    expect(fixture.componentInstance.quotaModalOpen()).toBe(false);
  });

  it('refuses a quota whose period ends before it starts or without a rep', async () => {
    fixture.componentInstance.openQuota(null);
    fixture.componentInstance.quotaForm.patchValue({
      user_id: '',
      period_start: '2027-04-01',
      period_end: '2027-06-30',
      target_amount: 10,
    });
    await fixture.componentInstance.saveQuota();

    fixture.componentInstance.quotaForm.patchValue({ user_id: 'u1', period_end: '2027-03-01' });
    await fixture.componentInstance.saveQuota();

    expect(fixture.componentInstance.periodError()).toBe(true);
    expect(quotas['createSalesQuota']).not.toHaveBeenCalled();
  });

  it('edits and deletes an existing quota', async () => {
    const quota = fixture.componentInstance.quotas()[0];

    fixture.componentInstance.openQuota(quota);
    expect(fixture.componentInstance.quotaForm.getRawValue()).toMatchObject({
      user_id: 'u1',
      target_amount: 30000,
      period_start: '2027-01-01',
    });
    fixture.componentInstance.quotaForm.patchValue({ target_amount: 35000 });
    await fixture.componentInstance.saveQuota();
    expect(quotas['updateSalesQuota']).toHaveBeenCalledWith(
      'q1',
      expect.objectContaining({ target_amount: 35000 }),
    );

    await fixture.componentInstance.deleteQuota(quota);
    expect(quotas['deleteSalesQuota']).toHaveBeenCalledWith('q1');
    expect(message.success).toHaveBeenCalledWith('SALESPIPE.QUOTA_DELETED');
  });

  it('caps the progress bar at 100 percent while keeping the figure', () => {
    expect(progressPercent('26.66')).toBe(26.66);
    expect(progressPercent('135.00')).toBe(100);
    expect(progressPercent('x')).toBe(0);
    expect(progressPercent(-4)).toBe(0);
  });
});

describe('SalesPipelineSettingsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let message: ReturnType<typeof messageStub>;
  let fixture: ComponentFixture<SalesPipelineSettingsComponent>;
  const italy = {
    ...PIPELINE,
    id: 'p2',
    code: 'italy',
    name: 'Mercato Italia',
    is_default: false,
    opportunities_count: 0,
    stages: [],
  };

  beforeEach(async () => {
    message = messageStub();
    api = {
      listPipelines: vi.fn(() =>
        of([
          {
            ...PIPELINE,
            stages: [
              {
                id: 's1',
                pipeline_id: 'p1',
                code: 'discovery',
                name: 'Qualificazione',
                sequence: 10,
                default_probability: 10,
                forecast_category: 'pipeline',
                is_won: false,
                is_lost: false,
                is_active: true,
                stale_days: 21,
                translations: { en: 'Qualification' },
              },
            ],
          },
          italy,
        ]),
      ),
      listLossReasons: vi.fn(() => of(LOSS_REASONS)),
      createPipeline: vi.fn(() => of(italy)),
      updatePipeline: vi.fn(() => of(italy)),
      deletePipeline: vi.fn(() => of(undefined)),
      createStage: vi.fn(() => of({})),
      updateStage: vi.fn(() => of({})),
      deleteStage: vi.fn(() => of(undefined)),
      createLossReason: vi.fn(() => of({})),
      updateLossReason: vi.fn(() => of({})),
      deleteLossReason: vi.fn(() => of(undefined)),
      installCatalog: vi.fn(() => of({ pipelines: 1, stages: 6, loss_reasons: 6 })),
    };
    await TestBed.configureTestingModule({
      imports: [SalesPipelineSettingsComponent],
      providers: [...baseProviders(message), { provide: SalesPipelineApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(SalesPipelineSettingsComponent);
    fixture.detectChanges();
    await settle(fixture);
  });

  it('lists pipelines, the stages of the default one and the loss reasons', () => {
    expect(byTestId(fixture, 'pipeline-table')?.textContent).toContain('Mercato Italia');
    expect(byTestId(fixture, 'stage-table')?.textContent).toContain('Qualificazione');
    expect(byTestId(fixture, 'reason-table')?.textContent).toContain('Concorrente specifico');
    expect(fixture.componentInstance.selectedPipeline()?.id).toBe('p1');
  });

  it('blocks deleting the default pipeline or one that deals use, but not an empty one', () => {
    const buttons = [
      ...el(fixture).querySelectorAll<HTMLButtonElement>('[data-testid="pipeline-delete"]'),
    ];

    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
  });

  it('creates a pipeline with only the filled labels and the standard stages', async () => {
    fixture.componentInstance.openPipeline(null);
    fixture.componentInstance.pipelineForm.patchValue({
      code: 'retail_ch',
      name: 'Retail CH',
      market: 'CH',
      translations: { 'it-CH': 'Retail Svizzera', 'de-CH': '  ', en: 'Retail CH' },
    });

    await fixture.componentInstance.saveEditor();

    expect(api['createPipeline']).toHaveBeenCalledWith({
      code: 'retail_ch',
      name: 'Retail CH',
      business_line: null,
      market: 'CH',
      is_default: false,
      is_active: true,
      translations: { 'it-CH': 'Retail Svizzera', en: 'Retail CH' },
      install_standard_stages: true,
    });
    expect(message.success).toHaveBeenCalledWith('SALESPIPE.SAVED');
    expect(fixture.componentInstance.editor()).toBeNull();
  });

  it('does not save an invalid pipeline code', async () => {
    fixture.componentInstance.openPipeline(null);
    fixture.componentInstance.pipelineForm.patchValue({ code: 'Not Valid!', name: 'X' });

    await fixture.componentInstance.saveEditor();

    expect(api['createPipeline']).not.toHaveBeenCalled();
    expect(fixture.componentInstance.editor()).toBe('pipeline');
  });

  it('creates a stage in the selected pipeline and updates one with the reprice option', async () => {
    fixture.componentInstance.openStage(null);
    fixture.componentInstance.stageForm.patchValue({
      code: 'demo',
      name: 'Demo',
      default_probability: 60,
      forecast_category: 'best_case',
    });
    await fixture.componentInstance.saveEditor();
    expect(api['createStage']).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'demo',
        pipeline_id: 'p1',
        default_probability: 60,
        forecast_category: 'best_case',
        translations: null,
      }),
    );

    const stage = fixture.componentInstance.stages()[0];
    fixture.componentInstance.openStage(stage);
    expect(fixture.componentInstance.stageForm.getRawValue().translations.en).toBe('Qualification');
    fixture.componentInstance.stageForm.patchValue({
      default_probability: 20,
      reprice_open_opportunities: true,
    });
    await fixture.componentInstance.saveEditor();
    expect(api['updateStage']).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        default_probability: 20,
        reprice_open_opportunities: true,
        translations: { en: 'Qualification' },
      }),
    );
  });

  it('rejects a probability outside 0..100', async () => {
    fixture.componentInstance.openStage(null);
    fixture.componentInstance.stageForm.patchValue({
      code: 'demo',
      name: 'Demo',
      default_probability: 150,
    });

    await fixture.componentInstance.saveEditor();

    expect(api['createStage']).not.toHaveBeenCalled();
  });

  it('manages loss reasons and keeps the dialog open when the API refuses', async () => {
    fixture.componentInstance.openReason(null);
    fixture.componentInstance.reasonForm.patchValue({
      code: 'budget',
      name: 'Budget',
      requires_competitor: false,
    });
    api['createLossReason'] = vi.fn(() => throwError(() => httpError(422)));

    await fixture.componentInstance.saveEditor();

    expect(fixture.componentInstance.editor()).toBe('reason');
    expect(fixture.componentInstance.saving()).toBe(false);

    api['createLossReason'] = vi.fn(() => of({}));
    await fixture.componentInstance.saveEditor();
    expect(api['createLossReason']).toHaveBeenCalledWith({
      code: 'budget',
      name: 'Budget',
      requires_competitor: false,
      is_active: true,
      translations: null,
    });
  });

  it('deletes an unused pipeline and reports a refusal without removing anything', async () => {
    await fixture.componentInstance.deletePipeline(italy);
    expect(api['deletePipeline']).toHaveBeenCalledWith('p2');
    expect(message.success).toHaveBeenCalledWith('SALESPIPE.DELETED');

    api['deleteStage'] = vi.fn(() => throwError(() => httpError(409)));
    message.success.mockClear();
    await fixture.componentInstance.deleteStage(fixture.componentInstance.stages()[0]);
    expect(message.success).not.toHaveBeenCalled();
  });

  it('installs the standard catalog and reloads', async () => {
    api['listPipelines'].mockClear();

    await fixture.componentInstance.installCatalog();

    expect(api['installCatalog']).toHaveBeenCalled();
    expect(api['listPipelines']).toHaveBeenCalledTimes(1);
    expect(message.success).toHaveBeenCalledWith('SALESPIPE.CATALOG_INSTALLED');
  });

  it('drops empty labels', () => {
    expect(cleanTranslations({ 'it-CH': ' Prezzo ', 'de-CH': '', en: '   ' })).toEqual({
      'it-CH': 'Prezzo',
    });
    expect(cleanTranslations({ en: '' })).toBeNull();
  });
});

describe('SalesPipelinePageComponent', () => {
  it('opens on the board tab and lazily hosts the three workspaces', async () => {
    await TestBed.configureTestingModule({
      imports: [SalesPipelinePageComponent],
      providers: [
        ...baseProviders(),
        {
          provide: SalesPipelineApiService,
          useValue: {
            listPipelines: vi.fn(() => of([PIPELINE])),
            listLossReasons: vi.fn(() => of([])),
            getBoard: vi.fn(() => of(boardFixture())),
            getForecastDashboard: vi.fn(() => of(dashboardFixture())),
            getLossAnalysis: vi.fn(() =>
              of({ total_lost: { count: 0, amount: '0.00' }, by_reason: [], by_competitor: [] }),
            ),
          },
        },
        {
          provide: CrmExtensionApiService,
          useValue: { getSalesQuotas: vi.fn(() => of({ data: [] })) },
        },
        {
          provide: SalesPipelineRealtimeService,
          useValue: {
            connected: signal(false),
            changes: signal(null),
            start: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SalesPipelinePageComponent);
    fixture.detectChanges();
    await settle(fixture);

    expect(fixture.componentInstance.tab()).toBe(0);
    expect(el(fixture).querySelector('app-sales-board')).not.toBeNull();
    expect(el(fixture).querySelector('app-sales-forecast')).toBeNull();
  });
});
