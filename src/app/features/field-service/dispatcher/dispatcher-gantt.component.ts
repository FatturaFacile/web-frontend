import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import type { FsmBoardBlock, FsmBoardLane, FsmBoardUnassigned } from '@core';
import { TranslatePipe } from '@shared';
import {
  assignmentWarnings,
  AssignmentWarnings,
  BOARD_STATUS_COLORS,
  BOARD_STATUS_KEYS,
  boardStatusKey,
  ganttDayTicks,
  ganttGeometry,
  GanttWindow,
  instantAtFraction,
} from './dispatcher.utils';

export interface GanttSlotEvent {
  lane: FsmBoardLane;
  /** ISO instant under the click. */
  at: string;
}

interface LaneView {
  lane: FsmBoardLane;
  warnings: AssignmentWarnings | null;
  bars: { block: FsmBoardBlock; left: number; width: number; color: string; statusKey: string }[];
}

/** Multi-technician timeline of the board window; blocks are coloured by status, lanes flag skill and van problems. */
@Component({
  selector: 'app-dispatcher-gantt',
  imports: [DatePipe, NzButtonModule, NzTagModule, TranslatePipe],
  styleUrl: './dispatcher-gantt.component.scss',
  template: `
    <ul class="gantt-legend" [attr.aria-label]="'FSM.DISPATCH.LEGEND' | translate">
      @for (key of statusKeys; track key) {
        <li>
          <span class="swatch" [style.background-color]="colors[key]" aria-hidden="true"></span>
          {{ 'FSM.STATUS.' + key.toUpperCase() | translate }}
        </li>
      }
    </ul>

    <div class="gantt" role="table" [attr.aria-label]="'FSM.DISPATCH.TIMELINE' | translate">
      <div class="gantt-row gantt-head" role="row">
        <div class="gantt-label" role="columnheader">{{ 'FSM.DISPATCH.TECHNICIAN' | translate }}</div>
        <div class="gantt-track" role="columnheader">
          @for (tick of ticks(); track tick.at) {
            <span class="gantt-tick" [style.left.%]="tick.left">{{ tick.at | date: 'EEE d/M' }}</span>
          }
        </div>
      </div>

      @for (view of views(); track view.lane.technician_id) {
        <div class="gantt-row" role="row" [attr.data-testid]="'lane-' + view.lane.technician_id">
          <div class="gantt-label" role="rowheader">
            <strong>{{ view.lane.name }}</strong>
            <div class="gantt-badges">
              @if (!view.lane.is_available) {
                <nz-tag nzColor="red">{{ 'FSM.DISPATCH.UNAVAILABLE' | translate }}</nz-tag>
              }
              @if (!view.lane.van.ready) {
                <nz-tag nzColor="orange">{{ 'FSM.DISPATCH.NO_VAN' | translate }}</nz-tag>
              }
              @if (view.warnings && view.warnings.missingSkills.length > 0) {
                <nz-tag nzColor="gold" data-testid="skill-warning">
                  {{ 'FSM.DISPATCH.SKILLS_MISSING' | translate }}: {{ view.warnings.missingSkills.join(', ') }}
                </nz-tag>
              }
              @if (view.warnings && view.warnings.vanNotReady) {
                <nz-tag nzColor="gold" data-testid="stock-warning">{{ 'FSM.DISPATCH.VAN_NOT_READY' | translate }}</nz-tag>
              }
            </div>
            @if (selected()) {
              <button nz-button nzSize="small" type="button" (click)="laneAction.emit(view.lane)">
                {{ 'FSM.DISPATCH.ASSIGN_HERE' | translate }}
              </button>
            }
          </div>
          <div
            class="gantt-track"
            role="cell"
            tabindex="0"
            (click)="trackClicked($event, view.lane)"
            (keydown.enter)="trackActivated($event, view.lane)"
            (keydown.space)="trackActivated($event, view.lane)"
            [attr.aria-label]="'FSM.DISPATCH.LANE_BLOCKS' | translate: { name: view.lane.name, count: view.bars.length }"
          >
            @for (tick of ticks(); track tick.at) {
              <span class="gantt-gridline" [style.left.%]="tick.left" aria-hidden="true"></span>
            }
            @for (bar of view.bars; track bar.block.work_order_id) {
              <button
                type="button"
                class="gantt-bar"
                [style.left.%]="bar.left"
                [style.width.%]="bar.width"
                [style.background-color]="bar.color"
                [attr.data-status]="bar.statusKey"
                [attr.aria-label]="
                  bar.block.work_order_number +
                  ' - ' +
                  bar.block.title +
                  ' - ' +
                  ('FSM.STATUS.' + bar.statusKey.toUpperCase() | translate)
                "
                [attr.title]="bar.block.title"
                (click)="barClicked($event, bar.block, view.lane)"
              >
                {{ bar.block.work_order_number }}
              </button>
            }
          </div>
        </div>
      } @empty {
        <div class="gantt-empty">{{ 'FSM.DISPATCH.NO_TECHNICIANS' | translate }}</div>
      }
    </div>
  `,
})
export class DispatcherGanttComponent {
  readonly lanes = input.required<readonly FsmBoardLane[]>();
  readonly window = input.required<GanttWindow>();
  /** Queue item being assigned: lanes then show the skill and van warnings of that assignment. */
  readonly selected = input<FsmBoardUnassigned | null>(null);

  readonly slotSelected = output<GanttSlotEvent>();
  readonly laneAction = output<FsmBoardLane>();
  readonly blockSelected = output<{ block: FsmBoardBlock; lane: FsmBoardLane }>();

  protected readonly statusKeys = BOARD_STATUS_KEYS;
  protected readonly colors = BOARD_STATUS_COLORS;
  protected readonly ticks = computed(() => ganttDayTicks(this.window()));

  protected readonly views = computed<LaneView[]>(() => {
    const window = this.window();
    const selected = this.selected();
    return this.lanes().map((lane) => ({
      lane,
      warnings: selected ? assignmentWarnings(selected, lane) : null,
      bars: lane.blocks.flatMap((block) => {
        const geometry = ganttGeometry(block, window);
        if (!geometry) {
          return [];
        }
        const statusKey = boardStatusKey(block.status);
        return [{ block, ...geometry, color: BOARD_STATUS_COLORS[statusKey], statusKey }];
      }),
    }));
  });

  protected trackClicked(event: MouseEvent, lane: FsmBoardLane): void {
    if (!this.selected()) {
      return;
    }
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    this.slotSelected.emit({ lane, at: instantAtFraction(this.window(), (event.clientX - rect.left) / rect.width) });
  }

  protected trackActivated(event: Event, lane: FsmBoardLane): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    if (this.selected()) {
      this.laneAction.emit(lane);
    }
  }

  protected barClicked(event: MouseEvent, block: FsmBoardBlock, lane: FsmBoardLane): void {
    event.stopPropagation();
    this.blockSelected.emit({ block, lane });
  }
}
