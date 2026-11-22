import { Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@shared';
import { BaselineNodeDates, TaskDependency, WbsNode } from './portfolio.models';
import {
  barGeometry,
  BarGeometry,
  baselineSlip,
  DragMode,
  ganttScale,
  ganttWidth,
  GanttScale,
  monthTicks,
  TreeRow,
  xToDay,
} from './portfolio.utils';

export interface GanttDragEvent {
  nodeId: string;
  mode: DragMode;
  deltaDays: number;
}

interface Bar extends BarGeometry {
  id: string;
  y: number;
  title: string;
  milestone: boolean;
  /** A parent bar is a roll-up of its children: it is drawn but not draggable. */
  parent: boolean;
  critical: boolean;
  progress: number;
  baseline: BarGeometry | null;
  slip: number | null;
  label: string;
}

interface Link {
  id: string;
  path: string;
  critical: boolean;
}

interface Drag {
  nodeId: string;
  mode: DragMode;
  originX: number;
  lastDelta: number;
}

const BAR_HEIGHT = 18;
const ARROW = 5;

/**
 * SVG Gantt timeline (Mod 078). Draws one bar per visible WBS row (milestones as diamonds, parents as summary bars),
 * the dependency arrows, the critical path in red and, when a baseline is selected, the frozen dates under each bar.
 * A bar is moved by dragging its body and resized by dragging its right edge; the arrow keys do the same one day at a
 * time. The component only reports gestures: the workspace store previews the CPM cascade and commits on release.
 */
@Component({
  selector: 'app-wbs-gantt',
  imports: [TranslatePipe],
  styleUrl: './wbs-gantt.component.scss',
  template: `
    <svg
      class="gantt"
      role="group"
      [attr.aria-label]="'PORTFOLIO.GANTT' | translate"
      [attr.width]="width()"
      [attr.height]="height()"
      data-testid="gantt-svg"
    >
      <defs>
        <marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" class="arrow-head" />
        </marker>
        <marker id="gantt-arrow-critical" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" class="arrow-head critical" />
        </marker>
      </defs>

      <rect class="header" x="0" y="0" [attr.width]="width()" [attr.height]="headerHeight()" />
      @for (tick of ticks(); track tick.x) {
        <line class="tick" [attr.x1]="tick.x" [attr.x2]="tick.x" y1="0" [attr.y2]="height()" />
        <text class="tick-label" [attr.x]="tick.x + 4" y="18">{{ tick.label }}</text>
      }

      @for (bar of bars(); track bar.id) {
        <rect class="stripe" x="0" [attr.y]="bar.y - 9" [attr.width]="width()" [attr.height]="rowHeight()" />
      }

      @if (todayX() !== null) {
        <line class="today" [attr.x1]="todayX()" [attr.x2]="todayX()" [attr.y1]="headerHeight()" [attr.y2]="height()" />
      }

      @for (link of links(); track link.id) {
        <path class="link" [class.critical]="link.critical" [attr.d]="link.path" [attr.marker-end]="link.critical ? 'url(#gantt-arrow-critical)' : 'url(#gantt-arrow)'" />
      }

      @for (bar of bars(); track bar.id) {
        @if (bar.baseline; as base) {
          <rect class="baseline" [attr.x]="base.x" [attr.y]="bar.y + 11" [attr.width]="base.width" height="5" rx="2" [attr.data-testid]="'gantt-baseline-' + bar.id" />
        }

        <g
          class="bar"
          [class.critical]="bar.critical"
          [class.milestone]="bar.milestone"
          [class.late]="bar.slip !== null && bar.slip > 0"
          [attr.data-testid]="'gantt-bar-' + bar.id"
          [attr.tabindex]="editable() && !bar.parent ? 0 : null"
          role="img"
          [attr.aria-label]="bar.label"
          (pointerdown)="down($event, bar, 'move')"
          (pointermove)="move($event)"
          (pointerup)="up($event)"
          (pointercancel)="cancel()"
          (keydown)="key($event, bar)"
        >
          @if (bar.milestone) {
            <polygon [attr.points]="diamond(bar)" class="shape" />
          } @else {
            <rect class="shape" [attr.x]="bar.x" [attr.y]="bar.y - 9 + 4" [attr.width]="bar.width" [attr.height]="barHeight" rx="3" />
            <rect class="progress" [attr.x]="bar.x" [attr.y]="bar.y - 9 + 4" [attr.width]="(bar.width * bar.progress) / 100" [attr.height]="barHeight" rx="3" />
            @if (editable() && !bar.parent) {
              <rect
                class="handle"
                [attr.x]="bar.x + bar.width - 6"
                [attr.y]="bar.y - 9 + 4"
                width="6"
                [attr.height]="barHeight"
                [attr.data-testid]="'gantt-handle-' + bar.id"
                (pointerdown)="down($event, bar, 'resize')"
              />
            }
          }
          <title>{{ bar.label }}</title>
        </g>
      }
    </svg>
  `,
})
export class WbsGanttComponent {
  readonly rows = input.required<TreeRow[]>();
  /** Every node of the project: the timeline range covers all of them, whether their row is visible or not. */
  readonly nodes = input<WbsNode[]>([]);
  readonly dependencies = input<TaskDependency[]>([]);
  readonly baseline = input<Map<string, BaselineNodeDates>>(new Map());
  readonly dayWidth = input(24);
  readonly rowHeight = input(36);
  readonly headerHeight = input(28);
  readonly editable = input(true);

  readonly dragPreview = output<GanttDragEvent>();
  readonly dragCommit = output<string>();
  readonly dragCancel = output<void>();
  readonly nudge = output<GanttDragEvent>();

  protected readonly barHeight = BAR_HEIGHT;

  /** The range is frozen while a bar is dragged, so the bars do not slide under the pointer when the range grows. */
  private readonly frozenScale = signal<GanttScale | null>(null);

  private readonly liveScale = computed<GanttScale>(() =>
    ganttScale(
      this.nodes().length > 0 ? this.nodes() : this.rows().map((row) => row.node),
      [...this.baseline().values()],
      this.dayWidth(),
      14,
    ),
  );

  readonly scale = computed<GanttScale>(() => this.frozenScale() ?? this.liveScale());

  protected readonly width = computed(() => ganttWidth(this.scale()));
  protected readonly height = computed(() => this.headerHeight() + this.rows().length * this.rowHeight());
  protected readonly ticks = computed(() => monthTicks(this.scale()));

  protected readonly todayX = computed(() => {
    const scale = this.scale();
    const today = Math.round(Date.now() / 86_400_000);

    return today < scale.startDay || today > scale.endDay ? null : (today - scale.startDay) * scale.dayWidth + scale.dayWidth / 2;
  });

  protected readonly bars = computed<Bar[]>(() => {
    const scale = this.scale();
    const baseline = this.baseline();

    return this.rows().map((row, index) => {
      const node = row.node;
      const base = baseline.get(node.id);

      return {
        ...barGeometry(scale, node.startDate, node.endDate),
        id: node.id,
        y: this.headerHeight() + index * this.rowHeight() + this.rowHeight() / 2 - 4,
        title: node.title,
        milestone: node.nodeType === 'Milestone',
        parent: row.hasChildren,
        critical: node.isCritical,
        progress: Math.min(100, Math.max(0, node.percentComplete)),
        baseline: base === undefined ? null : barGeometry(scale, base.startDate, base.endDate),
        slip: baselineSlip(node, base),
        label: `${node.wbsCode} ${node.title}: ${node.startDate} → ${node.endDate}`,
      };
    });
  });

  /** Elbow arrows from the anchor of the predecessor (start or finish by the type) to the anchor of the successor. */
  protected readonly links = computed<Link[]>(() => {
    const byId = new Map(this.bars().map((bar) => [bar.id, bar]));
    const half = BAR_HEIGHT / 2;

    return this.dependencies().flatMap((dependency) => {
      const from = byId.get(dependency.predecessorNodeId);
      const to = byId.get(dependency.successorNodeId);

      // A link to a node hidden inside a collapsed parent is not drawn.
      if (from === undefined || to === undefined) {
        return [];
      }

      const fromStart = dependency.dependencyType === 'SS' || dependency.dependencyType === 'SF';
      const toFinish = dependency.dependencyType === 'FF' || dependency.dependencyType === 'SF';
      const x1 = fromStart ? from.x : from.x + from.width;
      const x2 = toFinish ? to.x + to.width : to.x;
      const y1 = from.y + half - 5;
      const y2 = to.y + half - 5;
      const out = fromStart ? x1 - 8 : x1 + 8;
      const into = toFinish ? x2 + 8 : x2 - 8;
      const bend = y1 === y2 ? y1 : (y1 + y2) / 2;
      const path = `M${x1},${y1} H${out} V${bend} H${into} V${y2} H${x2 + (toFinish ? ARROW : -ARROW)}`;
      const critical = this.isCriticalLink(dependency);

      return [{ id: dependency.id, path, critical }];
    });
  });

  private drag: Drag | null = null;

  protected diamond(bar: Bar): string {
    const cx = bar.x + bar.width / 2;
    const cy = bar.y - 9 + 4 + BAR_HEIGHT / 2;
    const r = BAR_HEIGHT / 2 + 2;

    return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
  }

  protected down(event: PointerEvent, bar: Bar, mode: DragMode): void {
    if (!this.editable() || bar.parent) {
      return;
    }

    event.stopPropagation();
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    this.frozenScale.set(this.liveScale());
    this.drag = { nodeId: bar.id, mode, originX: event.clientX, lastDelta: 0 };
  }

  protected move(event: PointerEvent): void {
    const drag = this.drag;

    if (drag === null) {
      return;
    }

    const scale = this.scale();
    const delta = xToDay(scale, event.clientX - drag.originX) - scale.startDay;

    if (delta !== drag.lastDelta) {
      drag.lastDelta = delta;
      this.dragPreview.emit({ nodeId: drag.nodeId, mode: drag.mode, deltaDays: delta });
    }
  }

  protected up(event: PointerEvent): void {
    const drag = this.drag;

    if (drag === null) {
      return;
    }

    (event.currentTarget as Element | null)?.releasePointerCapture?.(event.pointerId);
    this.drag = null;
    this.frozenScale.set(null);

    if (drag.lastDelta === 0) {
      this.dragCancel.emit();
    } else {
      this.dragCommit.emit(drag.nodeId);
    }
  }

  protected cancel(): void {
    if (this.drag !== null) {
      this.drag = null;
      this.frozenScale.set(null);
      this.dragCancel.emit();
    }
  }

  /** Keyboard: ←/→ move the bar one day, Shift+←/→ move its end. The change is previewed and committed at once. */
  protected key(event: KeyboardEvent, bar: Bar): void {
    if (!this.editable() || bar.parent || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
      return;
    }

    event.preventDefault();
    const deltaDays = event.key === 'ArrowLeft' ? -1 : 1;
    this.nudge.emit({ nodeId: bar.id, mode: event.shiftKey ? 'resize' : 'move', deltaDays });
  }

  private isCriticalLink(dependency: TaskDependency): boolean {
    const bars = this.bars();
    const from = bars.find((bar) => bar.id === dependency.predecessorNodeId);
    const to = bars.find((bar) => bar.id === dependency.successorNodeId);

    return from?.critical === true && to?.critical === true;
  }
}
