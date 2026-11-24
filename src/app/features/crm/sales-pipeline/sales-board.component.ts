import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { debounceTime, Subject } from 'rxjs';
import {
  AuthStore,
  I18nService,
  SALES_FORECAST_CATEGORIES,
  SalesPipelineRealtimeService,
  type SalesBoardColumn,
  type SalesDeal,
  type SalesForecastCategory,
  type SalesLossAnswer,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { SalesPipelineBoardStore } from './sales-pipeline-board.store';
import { SalesLossModalComponent } from './sales-loss-modal.component';
import { SalesQuickNoteComponent } from './sales-quick-note.component';

/** Fallback refresh period while the WebSocket is not connected. */
export const BOARD_POLL_MS = 30_000;

interface PendingLoss {
  deal: SalesDeal;
  stageId: string;
  position: number;
}

/**
 * Interactive Kanban board of the sales pipeline: one column per stage with live raw and weighted totals,
 * drag-and-drop between and inside columns (optimistic, rolled back on failure), the mandatory loss questionnaire
 * when a deal is dropped on a lost stage, filters, real-time sync and the smartphone quick-note sheet.
 */
@Component({
  selector: 'app-sales-board',
  providers: [SalesPipelineBoardStore],
  imports: [
    FormsModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
    SalesLossModalComponent,
    SalesQuickNoteComponent,
  ],
  template: `
    <div class="toolbar">
      <nz-select
        class="filter"
        data-testid="pipeline-select"
        [ngModel]="store.pipelineId()"
        [nzPlaceHolder]="'SALESPIPE.PIPELINE' | translate"
        (ngModelChange)="store.selectPipeline($event)"
      >
        @for (pipeline of store.activePipelines(); track pipeline.id) {
          <nz-option [nzValue]="pipeline.id" [nzLabel]="pipeline.name" />
        }
      </nz-select>
      <nz-select
        class="filter"
        nzAllowClear
        data-testid="owner-select"
        [ngModel]="store.filters().owner_user_id ?? null"
        [nzPlaceHolder]="'SALESPIPE.ALL_OWNERS' | translate"
        (ngModelChange)="store.setFilters({ owner_user_id: $event })"
      >
        @for (owner of owners(); track owner.id) {
          <nz-option [nzValue]="owner.id" [nzLabel]="owner.name" />
        }
      </nz-select>
      <nz-select
        class="filter"
        nzAllowClear
        data-testid="category-select"
        [ngModel]="store.filters().forecast_category ?? null"
        [nzPlaceHolder]="'SALESPIPE.ALL_CATEGORIES' | translate"
        (ngModelChange)="store.setFilters({ forecast_category: $event })"
      >
        @for (category of categories; track category) {
          <nz-option [nzValue]="category" [nzLabel]="categoryLabel(category)" />
        }
      </nz-select>
      <nz-range-picker
        class="filter filter--range"
        (ngModelChange)="onRange($event)"
        [ngModel]="range()"
      />
      <input
        nz-input
        class="filter"
        data-testid="board-search"
        [placeholder]="'SALESPIPE.SEARCH' | translate"
        [ngModel]="search()"
        (ngModelChange)="onSearch($event)"
      />
      <button nz-button type="button" data-testid="board-refresh" (click)="store.loadBoard()">
        <nz-icon nzType="reload" />
        {{ 'SALESPIPE.REFRESH' | translate }}
      </button>
      <nz-tag [nzColor]="realtime.connected() ? 'green' : 'default'" data-testid="live-indicator">
        {{ (realtime.connected() ? 'SALESPIPE.LIVE_ON' : 'SALESPIPE.LIVE_OFF') | translate }}
      </nz-tag>
    </div>

    @if (store.totals(); as totals) {
      <div class="summary" data-testid="board-summary">
        <span>{{ totals.count }} {{ 'SALESPIPE.DEALS' | translate }}</span>
        <span
          >{{ 'SALESPIPE.VALUE' | translate }}:
          <strong>{{ +totals.amount | money: currency() }}</strong></span
        >
        <span
          >{{ 'SALESPIPE.WEIGHTED' | translate }}:
          <strong>{{ +totals.weighted_amount | money: currency() }}</strong></span
        >
      </div>
    }

    @if (store.loading() && store.board() === null) {
      <nz-spin nzSimple class="state" [nzTip]="'SALESPIPE.LOADING' | translate" />
    } @else if (store.error(); as errorKey) {
      <nz-alert
        class="state"
        nzType="error"
        nzShowIcon
        data-testid="board-error"
        [nzMessage]="errorKey | translate"
        [nzAction]="retry"
      />
      <ng-template #retry>
        <button nz-button nzSize="small" type="button" (click)="store.loadBoard()">
          {{ 'SALESPIPE.RETRY' | translate }}
        </button>
      </ng-template>
    } @else if (store.isEmpty()) {
      <nz-empty
        class="state"
        data-testid="board-empty"
        [nzNotFoundContent]="'SALESPIPE.EMPTY_BOARD' | translate"
      />
    } @else {
      <div class="board" cdkDropListGroup data-testid="board">
        @for (column of store.columns(); track column.stage.id) {
          <section
            class="column"
            [class.column--won]="column.stage.is_won"
            [class.column--lost]="column.stage.is_lost"
            [attr.data-stage]="column.stage.code"
          >
            <header class="column__header">
              <div class="column__title">
                <strong>{{ column.stage.name }}</strong>
                <nz-tag>{{ column.totals.count }}</nz-tag>
                <span class="column__probability">{{ column.stage.default_probability }}%</span>
              </div>
              <div class="column__totals" data-testid="column-totals">
                <span>{{ +column.totals.amount | money: currency() }}</span>
                <span class="column__weighted"
                  >{{ 'SALESPIPE.WEIGHTED' | translate }}
                  {{ +column.totals.weighted_amount | money: currency() }}</span
                >
              </div>
            </header>
            <div
              class="column__cards"
              cdkDropList
              [cdkDropListData]="column"
              (cdkDropListDropped)="onDrop($event)"
            >
              @for (deal of column.opportunities; track deal.id) {
                <article
                  class="deal"
                  cdkDrag
                  [cdkDragData]="deal"
                  [class.deal--moving]="store.movingDealId() === deal.id"
                  [attr.data-deal]="deal.id"
                >
                  <div class="deal__top">
                    <strong class="deal__name">{{ deal.name }}</strong>
                    <button
                      nz-button
                      nzType="text"
                      nzSize="small"
                      type="button"
                      class="deal__note-button"
                      data-testid="deal-note-button"
                      [attr.aria-label]="'SALESPIPE.NOTE' | translate"
                      (click)="openNote(deal)"
                    >
                      <nz-icon nzType="edit" />
                    </button>
                  </div>
                  <div class="deal__account">{{ deal.account?.name }}</div>
                  <div class="deal__amounts">
                    <span>{{ deal.amount | money: deal.currency }}</span>
                    <span class="deal__weighted" data-testid="deal-weighted">{{
                      deal.weighted_amount | money: deal.currency
                    }}</span>
                  </div>
                  <div class="deal__meta">
                    <nz-tag>{{ deal.probability }}%</nz-tag>
                    <nz-tag [nzColor]="categoryColor(deal.forecast_category)">{{
                      categoryLabel(deal.forecast_category)
                    }}</nz-tag>
                    @if (deal.expected_close_date) {
                      <span class="deal__close"
                        ><nz-icon nzType="calendar" /> {{ deal.expected_close_date }}</span
                      >
                    }
                  </div>
                  <div class="deal__owner">
                    {{ deal.owner?.name ?? ('SALESPIPE.UNASSIGNED' | translate) }}
                  </div>
                  @if (deal.notes) {
                    <p class="deal__note">{{ deal.notes }}</p>
                  }
                </article>
              } @empty {
                <p class="column__empty">{{ 'SALESPIPE.EMPTY_COLUMN' | translate }}</p>
              }
            </div>
          </section>
        }
      </div>
    }

    <app-sales-loss-modal
      [visible]="pendingLoss() !== null"
      [dealName]="pendingLoss()?.deal?.name ?? ''"
      [reasons]="store.activeLossReasons()"
      [serverErrors]="lossErrors()"
      (confirmed)="confirmLoss($event)"
      (cancelled)="pendingLoss.set(null)"
    />
    <app-sales-quick-note
      [visible]="noteDeal() !== null"
      [deal]="noteDeal()"
      [saving]="noteSaving()"
      (saved)="saveNote($event)"
      (closed)="noteDeal.set(null)"
    />
  `,
  styles: `
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
      align-items: center;
    }
    .filter {
      min-width: 160px;
    }
    .filter--range {
      min-width: 240px;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 12px;
    }
    .state {
      display: block;
      margin: 32px auto;
    }
    .board {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 12px;
      scroll-snap-type: x proximity;
      align-items: flex-start;
    }
    .column {
      flex: 0 0 290px;
      background: var(--ant-color-fill-quaternary, #fafafa);
      border-radius: 8px;
      padding: 8px;
      scroll-snap-align: start;
    }
    .column--won {
      border-top: 3px solid #52c41a;
    }
    .column--lost {
      border-top: 3px solid #ff4d4f;
    }
    .column__header {
      margin-bottom: 8px;
    }
    .column__title {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .column__probability {
      margin-left: auto;
      opacity: 0.6;
    }
    .column__totals {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .column__weighted {
      opacity: 0.7;
    }
    .column__cards {
      min-height: 80px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .column__empty {
      text-align: center;
      opacity: 0.5;
      margin: 16px 0;
    }
    .deal {
      background: var(--ant-color-bg-container, #fff);
      border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
      border-radius: 6px;
      padding: 8px;
      cursor: grab;
      touch-action: pan-x;
    }
    .deal--moving {
      opacity: 0.6;
    }
    .deal__top {
      display: flex;
      justify-content: space-between;
      gap: 4px;
    }
    .deal__name {
      overflow-wrap: anywhere;
    }
    .deal__account,
    .deal__owner {
      font-size: 12px;
      opacity: 0.7;
    }
    .deal__amounts {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
    }
    .deal__weighted {
      opacity: 0.7;
    }
    .deal__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }
    .deal__close {
      font-size: 12px;
      opacity: 0.7;
    }
    .deal__note {
      margin: 6px 0 0;
      font-size: 12px;
      white-space: pre-wrap;
      max-height: 3.6em;
      overflow: hidden;
    }
    .cdk-drag-preview {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      border-radius: 6px;
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
    }
    @media (max-width: 575px) {
      .filter,
      .filter--range {
        min-width: 100%;
      }
      .column {
        flex-basis: 85vw;
      }
      .deal__note-button {
        min-width: 40px;
        min-height: 40px;
      }
    }
  `,
})
export class SalesBoardComponent implements OnInit {
  protected readonly store = inject(SalesPipelineBoardStore);
  protected readonly realtime = inject(SalesPipelineRealtimeService);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput = new Subject<string>();
  private readonly knownOwners = signal<Map<string, string>>(new Map());

  protected readonly categories: readonly SalesForecastCategory[] = SALES_FORECAST_CATEGORIES;
  readonly search = signal('');
  readonly range = signal<Date[]>([]);
  readonly pendingLoss = signal<PendingLoss | null>(null);
  readonly lossErrors = signal<Record<string, string[]>>({});
  readonly noteDeal = signal<SalesDeal | null>(null);
  readonly noteSaving = signal(false);

  readonly currency = computed(
    () => this.store.currentPipeline()?.currency ?? this.auth.activeCurrency(),
  );
  readonly owners = computed(() =>
    [...this.knownOwners().entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  constructor() {
    // Remember every rep seen on the board so the owner filter keeps its options once it narrows the board.
    effect(() => {
      const owners = new Map(untracked(() => this.knownOwners()));
      for (const column of this.store.columns()) {
        for (const deal of column.opportunities) {
          if (deal.owner) {
            owners.set(deal.owner.id, deal.owner.name);
          }
        }
      }
      untracked(() => this.knownOwners.set(owners));
    });

    // A change made by another user or device refreshes the board without a loading flash.
    effect(() => {
      if (this.realtime.changes() !== null) {
        untracked(() => void this.store.refreshSilently());
      }
    });

    this.searchInput.pipe(debounceTime(300), takeUntilDestroyed()).subscribe((term) => {
      void this.store.setFilters({ search: term.trim() === '' ? null : term.trim() });
    });
  }

  ngOnInit(): void {
    void this.store.init();
    void this.realtime.start(this.auth.activeTenantId());

    // Polling fallback while the socket is not connected.
    const timer = setInterval(() => {
      if (!this.realtime.connected() && !document.hidden) {
        void this.store.refreshSilently();
      }
    }, BOARD_POLL_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  categoryLabel(category: string): string {
    return this.i18n.translate(`SALESPIPE.CAT_${category.toUpperCase()}`);
  }

  categoryColor(category: string): string {
    return (
      (
        { commit: 'green', best_case: 'blue', closed: 'default', omitted: 'default' } as Record<
          string,
          string
        >
      )[category] ?? 'default'
    );
  }

  onSearch(term: string): void {
    this.search.set(term);
    this.searchInput.next(term);
  }

  onRange(dates: Date[] | null): void {
    this.range.set(dates ?? []);
    const [from, to] = dates && dates.length === 2 ? dates : [null, null];
    void this.store.setFilters({
      from: from ? toIsoDate(from) : null,
      to: to ? toIsoDate(to) : null,
    });
  }

  async onDrop(event: CdkDragDrop<SalesBoardColumn, SalesBoardColumn, SalesDeal>): Promise<void> {
    const deal = event.item.data;
    const target = event.container.data;
    const sameColumn = event.previousContainer === event.container;

    if (sameColumn && event.previousIndex === event.currentIndex) {
      return;
    }

    // A lost stage needs the questionnaire first: nothing changes until it is answered.
    if (!sameColumn && this.store.requiresLossAnswer(target.stage.id)) {
      this.lossErrors.set({});
      this.pendingLoss.set({ deal, stageId: target.stage.id, position: event.currentIndex });
      return;
    }

    const outcome = await this.store.moveDeal(deal.id, target.stage.id, event.currentIndex);
    if (!outcome.ok) {
      this.message.error(this.i18n.translate('SALESPIPE.MOVE_FAILED'));
    }
  }

  async confirmLoss(answer: SalesLossAnswer): Promise<void> {
    const pending = this.pendingLoss();
    if (pending === null) {
      return;
    }

    const outcome = await this.store.moveDeal(
      pending.deal.id,
      pending.stageId,
      pending.position,
      answer,
    );
    if (outcome.ok) {
      this.pendingLoss.set(null);
      this.message.success(this.i18n.translate('SALESPIPE.MOVED'));
    } else if (outcome.reason === 'validation') {
      this.lossErrors.set(outcome.errors);
    } else {
      this.pendingLoss.set(null);
      this.message.error(this.i18n.translate('SALESPIPE.MOVE_FAILED'));
    }
  }

  openNote(deal: SalesDeal): void {
    this.noteDeal.set(deal);
  }

  async saveNote(event: { notes: string; append: boolean }): Promise<void> {
    const deal = this.noteDeal();
    if (deal === null) {
      return;
    }

    this.noteSaving.set(true);
    const ok = await this.store.saveNote(deal.id, event.notes, event.append);
    this.noteSaving.set(false);

    if (ok) {
      this.noteDeal.set(null);
      this.message.success(this.i18n.translate('SALESPIPE.NOTE_SAVED'));
    } else {
      this.message.error(this.i18n.translate('SALESPIPE.LOAD_ERROR'));
    }
  }
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
