import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MfgPlannedOrderResource, MfgProductionOrderResource, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  addDays,
  barGeometry,
  dayIndex,
  dragDeltaDays,
  GanttWindow,
  isoOfDay,
  RescheduleCheck,
  shiftWindow,
} from './command-center.utils';
import { ManufacturingFacadeService } from './manufacturing.facade';

const DAY_WIDTH = 28;
const LABEL_WIDTH = 190;

interface GanttRow {
  id: string;
  label: string;
  kind: 'order' | 'planned';
  status: string;
  window: GanttWindow;
  draggable: boolean;
  /** Planned order that created this production order (pegging). */
  pegged: string | null;
}

/**
 * MRP planned orders, pegging and a finite-capacity Gantt. Production orders (planned or released) are dragged with the
 * pointer or moved with the arrow keys; the move is checked against the capacity of their work centres before the API is
 * called, and an overload refuses it. Planned MRP orders are shown as read-only bars: the API has no endpoint to
 * reschedule them (they are dated by the MRP run and converted with their dates).
 */
@Component({
  selector: 'app-mrp-gantt',
  providers: [ManufacturingFacadeService],
  imports: [DecimalPipe, PageHeaderComponent, TranslatePipe, NzAlertModule, NzButtonModule, NzCardModule, NzEmptyModule, NzTagModule],
  styles: `
    .scroll { overflow-x: auto; border: 1px solid var(--ant-color-border, #d9d9d9); border-radius: 8px }
    .row { display: flex; align-items: center; height: 36px; border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0) }
    .label { flex: 0 0 190px; padding: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; position: sticky; left: 0; background: var(--ant-color-bg-container, #fff); z-index: 2 }
    .lane { position: relative; height: 100% }
    .head .lane { background-image: none }
    .tick { position: absolute; top: 0; bottom: 0; border-left: 1px solid var(--ant-color-border-secondary, #f0f0f0); font-size: 10px; padding-left: 2px }
    .today { position: absolute; top: 0; bottom: 0; width: 2px; background: #a8071a }
    .bar { position: absolute; top: 6px; height: 24px; border-radius: 4px; color: #fff; font-size: 12px; line-height: 24px; padding: 0 6px; overflow: hidden; white-space: nowrap; box-sizing: border-box; touch-action: none }
    .bar.order { background: #0958d9; cursor: grab }
    .bar.order.released { background: #237804 }
    .bar.planned { background: repeating-linear-gradient(45deg, #595959, #595959 6px, #434343 6px, #434343 12px); cursor: not-allowed }
    .bar:focus-visible { outline: 3px solid #fa8c16; outline-offset: 1px }
    .bar.dragging { cursor: grabbing; opacity: .85; box-shadow: 0 2px 8px rgba(0,0,0,.4) }
    .bar.refused { background: #a8071a }
    table { width: 100%; border-collapse: collapse; margin-top: 8px }
    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0) }
    td.num { text-align: right; font-variant-numeric: tabular-nums }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap }
    .legend { display: flex; gap: 16px; flex-wrap: wrap; margin: 8px 0; font-size: 12px }
  `,
  template: `
    <app-page-header
      [title]="'MFG_CC.GANTT_TITLE' | translate"
      [subtitle]="'MFG_CC.GANTT_SUBTITLE' | translate"
    ></app-page-header>

    <p class="sr-only" id="gantt-help">{{ 'MFG_CC.GANTT_KEYBOARD_HELP' | translate }}</p>

    @if (facade.planningError(); as error) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="'MFG_CC.LOAD_ERROR' | translate" [nzDescription]="error"></nz-alert>
    }

    <div class="legend">
      <span>■ <span style="color:#0958d9">{{ 'MFG_CC.LEGEND_PLANNED_ORDER' | translate }}</span></span>
      <span>■ <span style="color:#237804">{{ 'MFG_CC.LEGEND_RELEASED_ORDER' | translate }}</span></span>
      <span>▨ {{ 'MFG_CC.LEGEND_MRP' | translate }}</span>
      <span>| <span style="color:#a8071a">{{ 'MFG_CC.TODAY' | translate }}</span></span>
    </div>

    @if (rows().length === 0) {
      <nz-empty [nzNotFoundContent]="'MFG_CC.NO_ORDERS' | translate"></nz-empty>
    } @else {
      <div class="scroll" role="group" [attr.aria-label]="'MFG_CC.GANTT_TITLE' | translate">
        <div [style.width.px]="labelWidth + timelineDays() * dayWidth">
          <div class="row head">
            <div class="label">{{ 'MFG_CC.ORDER' | translate }}</div>
            <div class="lane" [style.width.px]="timelineDays() * dayWidth" aria-hidden="true">
              @for (tick of ticks(); track tick.iso) {
                <div class="tick" [style.left.px]="tick.left">{{ tick.label }}</div>
              }
            </div>
          </div>
          @for (row of rows(); track row.id) {
            <div class="row">
              <div class="label" [title]="row.label">{{ row.label }}</div>
              <div class="lane" [style.width.px]="timelineDays() * dayWidth">
                @if (todayLeft(); as left) {
                  <div class="today" [style.left.px]="left" aria-hidden="true"></div>
                }
                <div
                  class="bar"
                  [class.order]="row.kind === 'order'"
                  [class.released]="row.status === 'released'"
                  [class.planned]="row.kind === 'planned'"
                  [class.dragging]="drag()?.id === row.id"
                  [class.refused]="refusedId() === row.id"
                  [attr.tabindex]="row.draggable ? 0 : null"
                  [attr.role]="row.draggable ? 'slider' : 'img'"
                  [attr.aria-label]="barLabel(row)"
                  [attr.aria-describedby]="row.draggable ? 'gantt-help' : null"
                  [attr.aria-valuetext]="row.draggable ? barWindowText(row) : null"
                  [attr.aria-valuenow]="row.draggable ? 0 : null"
                  [style.left.px]="geometry(row).left"
                  [style.width.px]="geometry(row).width"
                  (pointerdown)="row.draggable && onPointerDown($event, row)"
                  (pointermove)="onPointerMove($event)"
                  (pointerup)="onPointerUp($event)"
                  (pointercancel)="cancelDrag()"
                  (keydown)="onKey($event, row)"
                >
                  {{ row.label }}
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    }

    @if (verdict(); as v) {
      <nz-alert
        style="margin-top: 12px"
        [nzType]="v.ok ? 'success' : 'error'"
        nzShowIcon
        [nzMessage]="v.ok ? ('MFG_CC.RESCHEDULED' | translate) : ('MFG_CC.RESCHEDULE_REFUSED' | translate)"
        [nzDescription]="issueText(v)"
      ></nz-alert>
    }

    <nz-card style="margin-top: 16px" [nzTitle]="'MFG_CC.PLANNED_ORDERS' | translate">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
        <button nz-button type="button" data-testid="reload" [nzLoading]="facade.planningLoading()" (click)="facade.loadPlanning()">
          {{ 'MFG_CC.REFRESH' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="batch-release"
          [disabled]="facade.selectedPlanned().size === 0 || facade.batchRunning()"
          [nzLoading]="facade.batchRunning()"
          (click)="batchRelease()"
        >
          {{ 'MFG_CC.BATCH_RELEASE' | translate: { count: facade.selectedPlanned().size } }}
        </button>
      </div>

      @if (facade.openPlanned().length === 0) {
        <nz-empty [nzNotFoundContent]="'MFG_CC.NO_PLANNED' | translate"></nz-empty>
      } @else {
        <table>
          <caption class="sr-only">{{ 'MFG_CC.PLANNED_ORDERS' | translate }}</caption>
          <thead>
            <tr>
              <th scope="col">
                <input
                  type="checkbox"
                  [attr.aria-label]="'MFG_CC.SELECT_ALL' | translate"
                  [checked]="allSelected()"
                  (change)="facade.selectAllReleasable(asChecked($event))"
                />
              </th>
              <th scope="col">{{ 'MFG_CC.PLANNED_ORDER' | translate }}</th>
              <th scope="col">{{ 'MFG_CC.ITEM' | translate }}</th>
              <th scope="col">{{ 'MFG_CC.TYPE' | translate }}</th>
              <th scope="col" class="num">{{ 'MFG_CC.QUANTITY' | translate }}</th>
              <th scope="col">{{ 'MFG_CC.START' | translate }}</th>
              <th scope="col">{{ 'MFG_CC.DUE' | translate }}</th>
              <th scope="col">{{ 'MFG_CC.PEGGING' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (p of facade.openPlanned(); track p.id) {
              <tr>
                <td>
                  <input
                    type="checkbox"
                    [disabled]="p.order_type !== 'make'"
                    [attr.aria-label]="('MFG_CC.SELECT' | translate) + ' ' + p.planned_order_number"
                    [checked]="facade.selectedPlanned().has(p.id)"
                    (change)="facade.toggleSelected(p.id, asChecked($event))"
                  />
                </td>
                <td>{{ p.planned_order_number }}</td>
                <td>{{ p.item_code }} {{ p.item_name }}</td>
                <td>
                  <nz-tag>{{ p.order_type === 'make' ? ('MFG_CC.MAKE' | translate) : ('MFG_CC.BUY' | translate) }}</nz-tag>
                </td>
                <td class="num">{{ p.quantity | number: '1.0-4' }} {{ p.uom }}</td>
                <td>{{ p.start_date }}</td>
                <td>{{ p.due_date }}</td>
                <td>{{ peggingOf(p) }}</td>
              </tr>
            }
          </tbody>
        </table>
      }

      @if (facade.batchResults().length > 0) {
        <h4 style="margin-top: 16px">{{ 'MFG_CC.BATCH_RESULT' | translate }}</h4>
        <ul>
          @for (r of facade.batchResults(); track r.plannedOrderId) {
            <li>
              {{ r.plannedOrderNumber }} —
              @if (r.released) {
                {{ 'MFG_CC.BATCH_OK' | translate }}
              } @else if (r.productionOrderId) {
                {{ 'MFG_CC.BATCH_CONVERTED_ONLY' | translate }}: {{ r.error }}
              } @else {
                {{ 'MFG_CC.BATCH_FAILED' | translate }}: {{ r.error }}
              }
            </li>
          }
        </ul>
      }
    </nz-card>

    @if (facade.shortages().length > 0) {
      <nz-card style="margin-top: 16px" [nzTitle]="'MFG_CC.SHORTAGES' | translate">
        <table>
          <caption class="sr-only">{{ 'MFG_CC.SHORTAGES' | translate }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ 'MFG_CC.ITEM' | translate }}</th>
              <th scope="col">{{ 'MFG_CC.REQUIRED_DATE' | translate }}</th>
              <th scope="col" class="num">{{ 'MFG_CC.NET_SHORTAGE' | translate }}</th>
              <th scope="col">{{ 'MFG_CC.ACTION' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (s of facade.shortages(); track s.id) {
              <tr>
                <td>{{ s.item_code }} {{ s.item_name }}</td>
                <td>{{ s.required_date }}</td>
                <td class="num">{{ s.net_shortage }}</td>
                <td>{{ s.recommended_action }}</td>
              </tr>
            }
          </tbody>
        </table>
      </nz-card>
    }
  `,
})
export class MrpGanttComponent implements OnInit {
  protected readonly facade = inject(ManufacturingFacadeService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly dayWidth = DAY_WIDTH;
  protected readonly labelWidth = LABEL_WIDTH;
  protected readonly drag = signal<{ id: string; startX: number; deltaDays: number } | null>(null);
  protected readonly verdict = signal<RescheduleCheck | null>(null);
  protected readonly refusedId = signal<string | null>(null);
  private readonly keyDelta = signal<{ id: string; deltaDays: number } | null>(null);

  protected readonly rows = computed<GanttRow[]>(() => {
    const pegged = new Map(this.facade.plannedOrders().map((p) => [p.id, p.planned_order_number]));
    const orders = this.facade.orders().map<GanttRow>((o) => ({
      id: o.id,
      label: `${o.order_number} ${o.item_code ?? ''}`.trim(),
      kind: 'order',
      status: o.status,
      window: { start: o.planned_start_date.slice(0, 10), end: o.planned_end_date.slice(0, 10) },
      draggable: o.status === 'planned' || o.status === 'released',
      pegged: o.planned_order_id ? (pegged.get(o.planned_order_id) ?? null) : null,
    }));
    const planned = this.facade.openPlanned().map<GanttRow>((p) => ({
      id: `p:${p.id}`,
      label: `${p.planned_order_number} ${p.item_code ?? ''}`.trim(),
      kind: 'planned',
      status: p.status,
      window: { start: p.start_date.slice(0, 10), end: p.due_date.slice(0, 10) },
      draggable: false,
      pegged: null,
    }));
    return [...orders, ...planned];
  });

  protected readonly timelineStart = computed(() => {
    const starts = this.rows().map((r) => dayIndex(r.window.start));
    return isoOfDay((starts.length === 0 ? dayIndex(new Date().toISOString()) : Math.min(...starts)) - 3);
  });

  protected readonly timelineDays = computed(() => {
    const ends = this.rows().map((r) => dayIndex(r.window.end));
    const last = ends.length === 0 ? dayIndex(this.timelineStart()) + 30 : Math.max(...ends) + 10;
    return Math.max(30, last - dayIndex(this.timelineStart()));
  });

  protected readonly ticks = computed(() =>
    Array.from({ length: Math.ceil(this.timelineDays() / 7) }, (_, week) => {
      const iso = addDays(this.timelineStart(), week * 7);
      return { iso, left: week * 7 * DAY_WIDTH, label: iso.slice(5) };
    }),
  );

  protected readonly todayLeft = computed(() => {
    const offset = dayIndex(new Date().toISOString()) - dayIndex(this.timelineStart());
    return offset >= 0 && offset <= this.timelineDays() ? offset * DAY_WIDTH : null;
  });

  protected readonly allSelected = computed(
    () => this.facade.releasablePlanned().length > 0 && this.facade.selectedPlanned().size === this.facade.releasablePlanned().length,
  );

  ngOnInit(): void {
    this.facade.loadPlanning();
  }

  protected geometry(row: GanttRow): { left: number; width: number } {
    return barGeometry(this.windowOf(row), this.timelineStart(), DAY_WIDTH);
  }

  protected barLabel(row: GanttRow): string {
    return `${row.label}: ${row.window.start} → ${row.window.end}`;
  }

  protected barWindowText(row: GanttRow): string {
    const window = this.windowOf(row);
    return `${window.start} → ${window.end}`;
  }

  protected peggingOf(planned: MfgPlannedOrderResource): string {
    const order: MfgProductionOrderResource | undefined = this.facade.orders().find((o) => o.planned_order_id === planned.id);
    const shortage = this.facade.shortages().find((s) => s.mfg_item_id === planned.mfg_item_id);
    return [order ? order.order_number : null, shortage ? `${this.i18n.instant('MFG_CC.SHORTAGE_OF')} ${shortage.required_date}` : null]
      .filter((part): part is string => part !== null)
      .join(' · ') || '–';
  }

  protected asChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  // --- Pointer drag ---

  protected onPointerDown(event: PointerEvent, row: GanttRow): void {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.verdict.set(null);
    this.refusedId.set(null);
    this.drag.set({ id: row.id, startX: event.clientX, deltaDays: 0 });
  }

  protected onPointerMove(event: PointerEvent): void {
    const current = this.drag();
    if (current !== null) {
      this.drag.set({ ...current, deltaDays: dragDeltaDays(event.clientX - current.startX, DAY_WIDTH) });
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    const current = this.drag();
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.drag.set(null);
    if (current !== null && current.deltaDays !== 0) {
      this.commit(current.id, current.deltaDays);
    }
  }

  protected cancelDrag(): void {
    this.drag.set(null);
  }

  // --- Keyboard: arrows move the preview by a day, Enter books it, Escape cancels ---

  protected onKey(event: KeyboardEvent, row: GanttRow): void {
    if (!row.draggable) {
      return;
    }
    const current = this.keyDelta()?.id === row.id ? (this.keyDelta()?.deltaDays ?? 0) : 0;
    switch (event.key) {
      case 'ArrowRight':
        this.keyDelta.set({ id: row.id, deltaDays: current + 1 });
        break;
      case 'ArrowLeft':
        this.keyDelta.set({ id: row.id, deltaDays: current - 1 });
        break;
      case 'Enter':
        if (current !== 0) {
          this.keyDelta.set(null);
          this.commit(row.id, current);
        }
        break;
      case 'Escape':
        this.keyDelta.set(null);
        return;
      default:
        return;
    }
    event.preventDefault();
  }

  protected issueText(check: RescheduleCheck): string {
    return check.issues
      .map((issue) => {
        const center = issue.workCenterId ? (this.facade.workCenterName().get(issue.workCenterId) ?? issue.workCenterId) : '';
        return this.i18n.instant(`MFG_CC.ISSUE_${issue.code.toUpperCase()}`, {
          center,
          required: Math.round((issue.requiredHours ?? 0) * 10) / 10,
          free: Math.round((issue.freeHours ?? 0) * 10) / 10,
        });
      })
      .join(' ');
  }

  protected batchRelease(): void {
    this.facade.batchRelease().subscribe({
      next: (results) => {
        const ok = results.filter((r) => r.released).length;
        this.message.info(this.i18n.instant('MFG_CC.BATCH_SUMMARY', { ok, total: results.length }));
      },
    });
  }

  private windowOf(row: GanttRow): GanttWindow {
    const delta = this.drag()?.id === row.id ? this.drag()!.deltaDays : this.keyDelta()?.id === row.id ? this.keyDelta()!.deltaDays : 0;
    return delta === 0 ? row.window : shiftWindow(row.window, delta);
  }

  private commit(orderId: string, deltaDays: number): void {
    const row = this.rows().find((r) => r.id === orderId);
    if (row === undefined) {
      return;
    }
    this.facade.reschedule(orderId, shiftWindow(row.window, deltaDays)).subscribe({
      next: ({ check }) => {
        this.verdict.set(check);
        this.refusedId.set(check.ok ? null : orderId);
      },
      error: () => {
        this.verdict.set({ ok: false, issues: [] });
        this.refusedId.set(orderId);
        this.message.error(this.i18n.instant('MFG_CC.RESCHEDULE_ERROR'));
      },
    });
  }
}
