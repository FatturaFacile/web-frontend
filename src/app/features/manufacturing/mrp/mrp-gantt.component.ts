import { Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
  addDays,
  alternativeWorkCenters,
  BlockRect,
  blockRect,
  bucketClass,
  bucketHeight,
  bucketPercentage,
  bucketsByDate,
  DAY_WIDTH,
  dayNumber,
  daySpan,
  droppedRange,
  formatIsoDate,
  GanttZoom,
  isOverloaded,
  layoutRows,
  maxLoad,
  windowDays,
} from './mrp-gantt.utils';
import {
  MrpGanttBlock,
  MrpGanttBucket,
  MrpGanttWorkCenter,
  MrpReschedulePayload,
} from './mrp.models';
import { MrpStore } from './mrp.store';
import {
  EXCEPTION_COLORS,
  EXCEPTION_KEYS,
  PROPOSAL_STATUS_COLORS,
  PROPOSAL_STATUS_KEYS,
} from './mrp.utils';

const LANE_ROW_HEIGHT = 30;
/** The longest window the API serves. */
const MAX_WINDOW_DAYS = 366;

interface BlockView {
  block: MrpGanttBlock;
  rect: BlockRect;
  top: number;
  /** Total minutes the block takes. */
  minutes: number;
}

interface BucketView {
  bucket: MrpGanttBucket;
  cssClass: string;
  height: number;
  overloaded: boolean;
  percentage: number;
}

interface DayView {
  date: string;
  left: number;
  weekend: boolean;
  label: string;
  buckets: BucketView[];
}

interface LaneView {
  workCenter: MrpGanttWorkCenter;
  width: number;
  height: number;
  blocks: BlockView[];
  days: DayView[];
  overloaded: number;
  maxLoad: number;
  loadedMinutes: number;
  availableMinutes: number;
}

interface DragState {
  block: MrpGanttBlock;
  workCenterId: string;
  grabOffsetPx: number;
}

/**
 * Finite-capacity Gantt and load histogram, in plain HTML and CSS: one section per work centre with its scheduled blocks on a
 * day timeline and, under them, the capacity buckets as a histogram. Buckets above 100 % are red with a warning icon and a
 * tooltip. A block is dragged along the timeline to reschedule it, or onto the lane of an alternative work centre to move it; the
 * block drawer offers the same with a select restricted to the alternatives. "Auto-level" resolves the overloads in one go.
 */
@Component({
  selector: 'app-mrp-gantt',
  imports: [
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzEmptyModule,
    NzIconModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
    NzTooltipModule,
  ],
  styles: `
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 4px;
      border-radius: 2px;
    }
    .timeline {
      overflow-x: auto;
      border: 1px solid var(--ant-border-color-split, #f0f0f0);
      border-radius: 6px;
    }
    .header {
      display: flex;
      position: relative;
      height: 28px;
      border-bottom: 1px solid var(--ant-border-color-split, #f0f0f0);
    }
    .head-day {
      flex: none;
      box-sizing: border-box;
      text-align: center;
      font-size: 11px;
      line-height: 28px;
      white-space: nowrap;
      border-left: 1px solid var(--ant-border-color-split, #f0f0f0);
    }
    .weekend {
      background: rgba(0, 0, 0, 0.03);
    }
    .wc {
      border-bottom: 1px solid var(--ant-border-color-split, #f0f0f0);
    }
    .wc-title {
      position: sticky;
      left: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 6px 8px;
      width: max-content;
      max-width: 100%;
      background: var(--ant-component-background, #fff);
      z-index: 3;
    }
    .wc-title .muted {
      color: var(--ant-text-color-secondary, rgba(0, 0, 0, 0.45));
      font-size: 12px;
    }
    .lane {
      position: relative;
      background-image: linear-gradient(
        to right,
        var(--ant-border-color-split, #f0f0f0) 1px,
        transparent 1px
      );
    }
    .lane.drop-target {
      outline: 2px dashed #1677ff;
      outline-offset: -2px;
    }
    .block {
      position: absolute;
      box-sizing: border-box;
      height: 26px;
      padding: 0 6px;
      overflow: hidden;
      border-radius: 4px;
      border: 1px solid #91caff;
      background: #e6f4ff;
      cursor: grab;
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      white-space: nowrap;
    }
    .block.status-firm {
      background: #d9f7be;
      border-color: #95de64;
    }
    .block.status-released {
      background: #f6ffed;
      border-color: #b7eb8f;
    }
    .block.has-overload {
      border-color: #cf1322;
    }
    .block.manual {
      border-style: dashed;
    }
    .histogram {
      position: relative;
      height: 56px;
      border-top: 1px solid var(--ant-border-color-split, #f0f0f0);
    }
    .histogram::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 66.67%;
      border-top: 1px dashed rgba(207, 19, 34, 0.45);
      pointer-events: none;
    }
    .day-col {
      position: absolute;
      top: 0;
      bottom: 0;
      display: flex;
      align-items: flex-end;
      box-sizing: border-box;
      padding: 0 1px;
      border-left: 1px solid var(--ant-border-color-split, #f0f0f0);
    }
    .bucket {
      position: relative;
      flex: 1 1 0;
      height: 100%;
      display: flex;
      align-items: flex-end;
      min-width: 3px;
    }
    .bar {
      width: 100%;
      min-height: 2px;
      border-radius: 2px 2px 0 0;
      background: #52c41a;
    }
    .bucket--high .bar {
      background: #faad14;
    }
    .bucket--idle .bar {
      background: #d9d9d9;
    }
    .bucket--overload .bar {
      background: #cf1322;
    }
    .bucket--overload {
      background: rgba(207, 19, 34, 0.08);
    }
    .warn {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      color: #cf1322;
      font-size: 12px;
    }
    .over {
      color: #cf1322;
    }
    .drawer-dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 16px;
      margin: 0 0 16px;
    }
    .drawer-dl dt {
      color: var(--ant-text-color-secondary, rgba(0, 0, 0, 0.45));
    }
    .drawer-dl dd {
      margin: 0;
    }
    .field {
      display: block;
      margin-bottom: 12px;
    }
    .field-label {
      display: block;
      margin-bottom: 4px;
    }
  `,
  template: `
    <div class="toolbar" data-testid="gantt-toolbar">
      <nz-range-picker
        data-testid="gantt-window"
        [attr.aria-label]="'MRP.GANTT_WINDOW' | translate"
        [ngModel]="windowDates()"
        (ngModelChange)="windowChanged($event)"
      ></nz-range-picker>
      <nz-radio-group
        data-testid="gantt-zoom"
        [ngModel]="zoom()"
        (ngModelChange)="zoom.set($event)"
      >
        <label nz-radio-button nzValue="day">{{ 'MRP.GANTT_ZOOM_DAY' | translate }}</label>
        <label nz-radio-button nzValue="week">{{ 'MRP.GANTT_ZOOM_WEEK' | translate }}</label>
      </nz-radio-group>
      <button
        nz-button
        type="button"
        data-testid="gantt-reload"
        [disabled]="store.ganttLoading()"
        (click)="reload()"
      >
        {{ 'MRP.GANTT_RELOAD' | translate }}
      </button>
      <button
        nz-button
        nzType="primary"
        type="button"
        data-testid="auto-level"
        [nzLoading]="store.leveling()"
        [disabled]="store.selectedRun() === null"
        (click)="autoLevel()"
      >
        {{ 'MRP.GANTT_AUTO_LEVEL' | translate }}
      </button>
      @if (store.overloadedTotal() > 0) {
        <nz-tag nzColor="error" data-testid="overload-total">
          <span nz-icon nzType="warning"></span>
          {{ 'MRP.GANTT_OVERLOAD_TOTAL' | translate: { count: store.overloadedTotal() } }}
        </nz-tag>
      }
    </div>

    @if (store.lastLevel(); as level) {
      <nz-alert
        nzShowIcon
        nzCloseable
        data-testid="level-result"
        [nzType]="level.overloaded_buckets_after === 0 ? 'success' : 'warning'"
        [nzMessage]="'MRP.LEVEL_DONE_TITLE' | translate"
        [nzDescription]="
          'MRP.LEVEL_DONE_TEXT'
            | translate
              : {
                  before: level.overloaded_buckets_before,
                  after: level.overloaded_buckets_after,
                  proposals: level.leveled_proposals,
                }
        "
        (nzOnClose)="store.lastLevel.set(null)"
      ></nz-alert>
    }

    <div class="legend" aria-hidden="true">
      <span
        ><span class="swatch" style="background: #52c41a"></span
        >{{ 'MRP.GANTT_LEGEND_OK' | translate }}</span
      >
      <span
        ><span class="swatch" style="background: #faad14"></span
        >{{ 'MRP.GANTT_LEGEND_HIGH' | translate }}</span
      >
      <span
        ><span class="swatch" style="background: #cf1322"></span
        >{{ 'MRP.GANTT_LEGEND_OVERLOAD' | translate }}</span
      >
      <span><span nz-icon nzType="lock"></span> {{ 'MRP.GANTT_LEGEND_MANUAL' | translate }}</span>
      <span><span nz-icon nzType="swap"></span> {{ 'MRP.GANTT_LEGEND_MOVED' | translate }}</span>
    </div>

    <nz-spin [nzSpinning]="store.ganttLoading() || store.rescheduling()">
      @if (lanes().length === 0) {
        <nz-empty
          data-testid="gantt-empty"
          [nzNotFoundContent]="'MRP.GANTT_EMPTY' | translate"
        ></nz-empty>
      } @else {
        <div class="timeline" data-testid="gantt-timeline">
          <div class="header" [style.width.px]="timelineWidth()">
            @for (day of headerDays(); track day.date) {
              <div
                class="head-day"
                [class.weekend]="day.weekend"
                [style.width.px]="dayWidth()"
                [attr.title]="day.date"
              >
                {{ day.label }}
              </div>
            }
          </div>

          @for (lane of lanes(); track lane.workCenter.id) {
            <section
              class="wc"
              [attr.data-testid]="'wc-' + lane.workCenter.id"
              [style.width.px]="lane.width"
            >
              <div class="wc-title">
                <strong>{{ lane.workCenter.code }}</strong>
                <span>{{ lane.workCenter.name }}</span>
                <span class="muted" [attr.data-testid]="'wc-summary-' + lane.workCenter.id">
                  {{
                    'MRP.GANTT_WC_SUMMARY'
                      | translate
                        : {
                            loaded: lane.loadedMinutes,
                            available: lane.availableMinutes,
                            max: lane.maxLoad,
                          }
                  }}
                </span>
                @if (lane.overloaded > 0) {
                  <nz-tag
                    nzColor="error"
                    nz-tooltip
                    [attr.data-testid]="'wc-overload-' + lane.workCenter.id"
                    [nzTooltipTitle]="
                      'MRP.GANTT_WC_OVERLOADED_TIP'
                        | translate: { count: lane.overloaded, max: lane.maxLoad }
                    "
                  >
                    <span nz-icon nzType="warning"></span> {{ lane.overloaded }}
                  </nz-tag>
                }
              </div>

              <div
                class="lane"
                data-testid="lane"
                [attr.data-work-center-id]="lane.workCenter.id"
                [class.drop-target]="dropTarget() === lane.workCenter.id"
                [style.width.px]="lane.width"
                [style.height.px]="lane.height"
                [style.background-size.px]="dayWidth()"
                (dragover)="dragOver($event, lane.workCenter.id)"
                (dragleave)="dropTarget.set(null)"
                (drop)="drop($event, lane)"
              >
                @for (view of lane.blocks; track view.block.id) {
                  <div
                    class="block"
                    draggable="true"
                    role="button"
                    tabindex="0"
                    nz-tooltip
                    [attr.data-testid]="'block-' + view.block.id"
                    [class.status-firm]="view.block.proposal_status === 'Firm'"
                    [class.status-released]="view.block.proposal_status === 'Released'"
                    [class.has-overload]="hasOverloadException(view.block)"
                    [class.manual]="view.block.is_manual"
                    [style.left.px]="view.rect.left"
                    [style.width.px]="view.rect.width"
                    [style.top.px]="view.top"
                    [nzTooltipTitle]="blockTip(view.block)"
                    (dragstart)="dragStart($event, view.block, lane.workCenter.id)"
                    (dragend)="dragEnd()"
                    (click)="openBlock(view.block, lane.workCenter.id)"
                    (keydown.enter)="openBlock(view.block, lane.workCenter.id)"
                  >
                    @if (view.block.is_manual) {
                      <span
                        nz-icon
                        nzType="lock"
                        data-testid="manual-marker"
                        [attr.aria-label]="'MRP.GANTT_LEGEND_MANUAL' | translate"
                      ></span>
                    }
                    @if (view.block.original_work_center_id) {
                      <span
                        nz-icon
                        nzType="swap"
                        data-testid="moved-marker"
                        [attr.aria-label]="'MRP.GANTT_LEGEND_MOVED' | translate"
                      ></span>
                    }
                    <strong>{{ view.block.item_code }}</strong>
                    @for (code of view.block.exception_messages; track code) {
                      <nz-tag [nzColor]="exceptionColors[code]" data-testid="block-exception">{{
                        exceptionKeys[code] | translate
                      }}</nz-tag>
                    }
                  </div>
                }
              </div>

              <div
                class="histogram"
                [style.width.px]="lane.width"
                [attr.data-testid]="'histogram-' + lane.workCenter.id"
              >
                @for (day of lane.days; track day.date) {
                  <div
                    class="day-col"
                    [class.weekend]="day.weekend"
                    [style.left.px]="day.left"
                    [style.width.px]="dayWidth()"
                  >
                    @for (view of day.buckets; track $index) {
                      <div
                        nz-tooltip
                        [attr.data-testid]="
                          'bucket-' +
                          lane.workCenter.id +
                          '-' +
                          day.date +
                          '-' +
                          (view.bucket.shift_code ?? 'all')
                        "
                        [class]="'bucket ' + view.cssClass"
                        [nzTooltipTitle]="bucketTip(view.bucket)"
                        [attr.aria-label]="bucketTip(view.bucket)"
                      >
                        @if (view.overloaded) {
                          <span
                            nz-icon
                            nzType="warning"
                            class="warn"
                            [attr.data-testid]="
                              'warn-' +
                              lane.workCenter.id +
                              '-' +
                              day.date +
                              '-' +
                              (view.bucket.shift_code ?? 'all')
                            "
                          ></span>
                        }
                        <div class="bar" [style.height.%]="view.height * 100"></div>
                      </div>
                    }
                  </div>
                }
              </div>
            </section>
          }
        </div>
      }
    </nz-spin>

    <nz-drawer
      nzPlacement="right"
      [nzWidth]="440"
      [nzVisible]="selected() !== null"
      [nzTitle]="'MRP.BLOCK_TITLE' | translate"
      (nzOnClose)="closeBlock()"
    >
      <ng-container *nzDrawerContent>
        @if (selected(); as current) {
          <dl class="drawer-dl" data-testid="block-detail">
            <dt>{{ 'MRP.COL_ITEM' | translate }}</dt>
            <dd>{{ current.block.item_code }} · {{ current.block.item_name }}</dd>
            <dt>{{ 'MRP.COL_STATUS' | translate }}</dt>
            <dd>
              <nz-tag [nzColor]="statusColors[current.block.proposal_status]">{{
                statusKeys[current.block.proposal_status] | translate
              }}</nz-tag>
            </dd>
            <dt>{{ 'MRP.BLOCK_DATES' | translate }}</dt>
            <dd>{{ current.block.start_date }} → {{ current.block.end_date }}</dd>
            <dt>{{ 'MRP.BLOCK_MINUTES' | translate }}</dt>
            <dd>{{ current.block.minutes }}</dd>
            @if (current.block.exception_messages.length > 0) {
              <dt>{{ 'MRP.COL_EXCEPTIONS' | translate }}</dt>
              <dd>
                @for (code of current.block.exception_messages; track code) {
                  <nz-tag [nzColor]="exceptionColors[code]">{{
                    exceptionKeys[code] | translate
                  }}</nz-tag>
                }
              </dd>
            }
            @if (current.block.is_manual) {
              <dt></dt>
              <dd>
                <span nz-icon nzType="lock"></span> {{ 'MRP.GANTT_LEGEND_MANUAL' | translate }}
              </dd>
            }
            @if (current.block.original_work_center_id) {
              <dt></dt>
              <dd>
                <span nz-icon nzType="swap"></span>
                {{
                  'MRP.BLOCK_ORIGINAL_CENTER'
                    | translate: { center: centerName(current.block.original_work_center_id) }
                }}
              </dd>
            }
          </dl>

          <label class="field">
            <span class="field-label">{{ 'MRP.BLOCK_MOVE_TO_CENTER' | translate }}</span>
            <nz-select
              nzAllowClear
              style="width: 100%"
              data-testid="alt-select"
              [ngModel]="targetCenterId()"
              [nzPlaceHolder]="'MRP.BLOCK_NO_ALTERNATIVE' | translate"
              [nzDisabled]="alternativeOptions().length === 0"
              (ngModelChange)="targetCenterId.set($event)"
            >
              @for (center of alternativeOptions(); track center.id) {
                <nz-option
                  [nzValue]="center.id"
                  [nzLabel]="center.code + ' · ' + center.name"
                ></nz-option>
              }
            </nz-select>
          </label>

          <label class="field">
            <span class="field-label">{{ 'MRP.BLOCK_START_DATE' | translate }}</span>
            <nz-date-picker
              style="width: 100%"
              data-testid="block-start"
              [ngModel]="targetStart()"
              (ngModelChange)="targetStart.set($event)"
            ></nz-date-picker>
          </label>

          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="block-apply"
            [nzLoading]="store.rescheduling()"
            [disabled]="payload() === null"
            (click)="applyDrawer()"
          >
            {{ 'MRP.BLOCK_APPLY' | translate }}
          </button>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class MrpGanttComponent {
  protected readonly store = inject(MrpStore);
  private readonly notification = inject(NzNotificationService);
  private readonly i18n = inject(TranslateService);

  /** A reschedule or an auto-level changed the capacity: the host reloads the run KPIs. */
  readonly changed = output<void>();

  protected readonly zoom = signal<GanttZoom>('day');
  protected readonly dayWidth = computed(() => DAY_WIDTH[this.zoom()]);
  protected readonly dropTarget = signal<string | null>(null);
  protected readonly selected = signal<{ block: MrpGanttBlock; workCenterId: string } | null>(null);
  protected readonly targetCenterId = signal<string | null>(null);
  protected readonly targetStart = signal<Date | null>(null);
  protected readonly exceptionKeys = EXCEPTION_KEYS;
  protected readonly exceptionColors = EXCEPTION_COLORS;
  protected readonly statusKeys = PROPOSAL_STATUS_KEYS;
  protected readonly statusColors = PROPOSAL_STATUS_COLORS;
  private drag: DragState | null = null;

  protected readonly window = computed(() => {
    const gantt = this.store.gantt();

    return gantt === null ? this.store.ganttWindow() : { from: gantt.from, to: gantt.to };
  });
  protected readonly windowDates = computed(() => {
    const { from, to } = this.store.ganttWindow();

    return [new Date(`${from}T00:00:00`), new Date(`${to}T00:00:00`)];
  });
  protected readonly timelineWidth = computed(
    () => daySpan(this.window().from, this.window().to) * this.dayWidth(),
  );
  protected readonly headerDays = computed(() =>
    windowDays(this.window().from, this.window().to).map((date) => ({
      date,
      weekend: isWeekend(date),
      label: this.headerLabel(date),
    })),
  );

  protected readonly lanes = computed<LaneView[]>(() => {
    const gantt = this.store.gantt();

    if (gantt === null) {
      return [];
    }
    const { from, to } = this.window();
    const dayWidth = this.dayWidth();
    const width = daySpan(from, to) * dayWidth;

    return gantt.work_centers.map((workCenter) => {
      const { rows, rowCount } = layoutRows(workCenter.blocks);
      const byDate = bucketsByDate(workCenter);

      return {
        workCenter,
        width,
        height: rowCount * LANE_ROW_HEIGHT + 8,
        blocks: workCenter.blocks.map((block) => ({
          block,
          rect: blockRect(block, from, to, dayWidth),
          top: 4 + (rows[block.id] ?? 0) * LANE_ROW_HEIGHT,
          minutes: block.minutes,
        })),
        days: windowDays(from, to).map((date, index) => ({
          date,
          left: index * dayWidth,
          weekend: isWeekend(date),
          label: date,
          buckets: (byDate[date] ?? []).map((bucket) => ({
            bucket,
            cssClass: bucketClass(bucket),
            height: bucketHeight(bucket),
            overloaded: isOverloaded(bucket),
            percentage: bucketPercentage(bucket),
          })),
        })),
        overloaded: workCenter.buckets.filter(isOverloaded).length,
        maxLoad: maxLoad(workCenter),
        loadedMinutes: workCenter.buckets.reduce((sum, bucket) => sum + bucket.loaded_minutes, 0),
        availableMinutes: workCenter.buckets.reduce(
          (sum, bucket) => sum + bucket.available_minutes,
          0,
        ),
      };
    });
  });

  /** The work centres the open block can move to: only the alternatives of the centre it sits on. */
  protected readonly alternativeOptions = computed(() => {
    const current = this.selected();

    return current === null
      ? []
      : alternativeWorkCenters(this.store.gantt()?.work_centers ?? [], current.workCenterId);
  });

  /** What the block drawer would send, `null` while nothing was changed. */
  protected readonly payload = computed<MrpReschedulePayload | null>(() => {
    const current = this.selected();

    if (current === null) {
      return null;
    }
    const payload: MrpReschedulePayload = {};
    const start = this.targetStart();

    if (start !== null) {
      const startDate = formatIsoDate(start);
      const span = dayNumber(current.block.end_date) - dayNumber(current.block.start_date);

      if (startDate !== current.block.start_date) {
        payload.start_date = startDate;
        payload.end_date = addDays(startDate, span);
      }
    }
    const center = this.targetCenterId();

    if (center !== null && center !== current.workCenterId) {
      payload.work_center_id = center;
    }

    return Object.keys(payload).length === 0 ? null : payload;
  });

  constructor() {
    // Loads the Gantt when the component is shown and whenever the selected run changes.
    effect(() => {
      const runId = this.store.selectedRunId();

      untracked(() => {
        if (runId !== null) {
          this.reload();
        }
      });
    });
  }

  reload(): void {
    this.store.loadGantt().subscribe();
  }

  protected windowChanged(range: Date[] | null): void {
    const [start, end] = range ?? [];

    if (!start || !end) {
      return;
    }
    const from = formatIsoDate(start);
    let to = formatIsoDate(end);

    if (daySpan(from, to) > MAX_WINDOW_DAYS) {
      to = addDays(from, MAX_WINDOW_DAYS - 1);
    }
    this.store.setGanttWindow(from, to);
    this.reload();
  }

  protected autoLevel(): void {
    this.store.autoLevel().subscribe((result) => {
      if (result !== null) {
        this.reload();
        this.changed.emit();
      }
    });
  }

  protected hasOverloadException(block: MrpGanttBlock): boolean {
    return block.exception_messages.includes('CapacityOverload');
  }

  protected blockTip(block: MrpGanttBlock): string {
    return this.i18n.instant('MRP.GANTT_BLOCK_TIP', {
      item: `${block.item_code} · ${block.item_name}`,
      start: block.start_date,
      end: block.end_date,
      minutes: block.minutes,
    });
  }

  protected bucketTip(bucket: MrpGanttBucket): string {
    return this.i18n.instant(
      isOverloaded(bucket) ? 'MRP.GANTT_BUCKET_OVERLOAD_TIP' : 'MRP.GANTT_BUCKET_TIP',
      {
        date: bucket.bucket_date,
        shift: bucket.shift_code ?? '-',
        loaded: bucket.loaded_minutes,
        available: bucket.available_minutes,
        percentage: bucketPercentage(bucket),
      },
    );
  }

  protected centerName(id: string): string {
    const center = this.store.gantt()?.work_centers.find((workCenter) => workCenter.id === id);

    return center ? `${center.code} · ${center.name}` : id;
  }

  protected dragStart(event: DragEvent, block: MrpGanttBlock, workCenterId: string): void {
    const element = event.currentTarget as HTMLElement | null;
    const left = element?.getBoundingClientRect().left ?? 0;

    this.drag = { block, workCenterId, grabOffsetPx: Math.max(0, (event.clientX ?? 0) - left) };
    event.dataTransfer?.setData('text/plain', block.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  protected dragEnd(): void {
    this.drag = null;
    this.dropTarget.set(null);
  }

  protected dragOver(event: DragEvent, workCenterId: string): void {
    if (this.drag === null) {
      return;
    }
    event.preventDefault();
    this.dropTarget.set(workCenterId);
  }

  /** Drops the block: the dates follow the pointer; a different lane is only accepted for an alternative work centre. */
  protected drop(event: DragEvent, lane: LaneView): void {
    event.preventDefault();
    const drag = this.drag;

    this.dragEnd();
    if (drag === null) {
      return;
    }
    const laneLeft = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect().left ?? 0;
    const range = droppedRange(
      drag.block,
      (event.clientX ?? 0) - laneLeft,
      drag.grabOffsetPx,
      this.window().from,
      this.dayWidth(),
    );
    const payload: MrpReschedulePayload = {};

    if (range.start_date !== drag.block.start_date) {
      payload.start_date = range.start_date;
      payload.end_date = range.end_date;
    }
    if (lane.workCenter.id !== drag.workCenterId) {
      const allowed = alternativeWorkCenters(
        this.store.gantt()?.work_centers ?? [],
        drag.workCenterId,
      );

      if (!allowed.some((center) => center.id === lane.workCenter.id)) {
        this.notification.warning(
          this.i18n.instant('MRP.ERR_NOT_ALTERNATIVE_TITLE'),
          this.i18n.instant('MRP.ERR_NOT_ALTERNATIVE_TEXT', { center: lane.workCenter.code }),
        );

        return;
      }
      payload.work_center_id = lane.workCenter.id;
    }
    this.send(drag.block.id, payload);
  }

  protected openBlock(block: MrpGanttBlock, workCenterId: string): void {
    this.targetCenterId.set(null);
    this.targetStart.set(null);
    this.selected.set({ block, workCenterId });
  }

  protected closeBlock(): void {
    this.selected.set(null);
  }

  protected applyDrawer(): void {
    const current = this.selected();
    const payload = this.payload();

    if (current !== null && payload !== null) {
      this.send(current.block.id, payload, () => this.closeBlock());
    }
  }

  private send(blockId: string, payload: MrpReschedulePayload, done?: () => void): void {
    if (Object.keys(payload).length === 0) {
      return;
    }

    this.store.reschedule(blockId, payload).subscribe((result) => {
      if (result !== null) {
        done?.();
        this.reload();
        this.changed.emit();
      }
    });
  }

  private headerLabel(date: string): string {
    if (this.zoom() === 'week') {
      return isMonday(date) ? date.slice(5) : '';
    }

    return date.slice(8) === '01' ? date.slice(5) : date.slice(8);
  }
}

/** 1970-01-01 was a Thursday. */
function weekday(date: string): number {
  return (((dayNumber(date) + 4) % 7) + 7) % 7;
}

const isWeekend = (date: string): boolean => weekday(date) === 0 || weekday(date) === 6;
const isMonday = (date: string): boolean => weekday(date) === 1;
