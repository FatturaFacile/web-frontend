import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, PermissionsService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { DEPENDENCY_TYPES, DependencyType, WBS_NODE_TYPES, WbsNode, WbsNodeType } from './portfolio.models';
import { DEPENDENCY_KEYS, descendantIds, leafNodes, MoveAction, NODE_TYPE_KEYS } from './portfolio.utils';
import { GanttDragEvent, WbsGanttComponent } from './wbs-gantt.component';
import { ProjectWorkspaceStore } from './project-workspace.store';

const MIN_TREE_WIDTH = 320;
const MAX_TREE_WIDTH = 900;

/**
 * Split-pane project workspace (Mod 078): the multi-level WBS tree on the left and the interactive Gantt on the right,
 * sharing one vertical scroll so rows line up. Dragging a bar previews the cascading CPM, the critical path is
 * highlighted, a baseline can be overlaid, and dependencies (FS, SS, FF, SF with lag or lead) are managed below.
 */
@Component({
  selector: 'app-project-workspace',
  providers: [ProjectWorkspaceStore],
  styleUrl: './project-workspace.component.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    WbsGanttComponent,
  ],
  template: `
    <app-page-header [title]="pageTitle()" [subtitle]="'PORTFOLIO.WORKSPACE_SUBTITLE' | translate" />
    <p class="ws-links">
      <a routerLink="/projects/portfolio">{{ 'PORTFOLIO.BACK_TO_PORTFOLIO' | translate }}</a>
      <a [routerLink]="['/projects', projectId, 'kanban']" data-testid="ws-kanban-link">{{ 'PORTFOLIO.OPEN_KANBAN' | translate }}</a>
    </p>

    @if (store.error()) {
      <nz-alert class="mb-4" nzType="error" nzShowIcon [nzMessage]="'PORTFOLIO.LOAD_ERROR' | translate" />
    }
    @if (store.cyclic()) {
      <nz-alert class="mb-4" nzType="warning" nzShowIcon data-testid="ws-cycle" [nzMessage]="'PORTFOLIO.DEP_CYCLE' | translate" />
    }

    <div class="ws-toolbar">
      <button nz-button type="button" data-testid="ws-toggle-all" (click)="store.toggleAll()">
        {{ (store.allExpanded() ? 'PORTFOLIO.COLLAPSE_ALL' : 'PORTFOLIO.EXPAND_ALL') | translate }}
      </button>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" data-testid="ws-add-root" (click)="openNode(null)">{{ 'PORTFOLIO.ADD_NODE' | translate }}</button>
        <button nz-button type="button" data-testid="ws-recalculate" [nzLoading]="store.saving()" (click)="recalculate()">{{ 'PORTFOLIO.RECALCULATE' | translate }}</button>
      }
      <nz-select
        class="ws-select"
        nzAllowClear
        data-testid="ws-baseline"
        [nzPlaceHolder]="'PORTFOLIO.COMPARE_BASELINE' | translate"
        [ngModel]="store.baselineId()"
        (ngModelChange)="selectBaseline($event)"
      >
        @for (baseline of store.baselines(); track baseline.id) {
          <nz-option [nzValue]="baseline.id" [nzLabel]="'#' + baseline.baselineNumber + ' ' + baseline.name" />
        }
      </nz-select>
      <nz-select class="ws-select-small" data-testid="ws-zoom" [ngModel]="dayWidth()" (ngModelChange)="dayWidth.set($event)">
        <nz-option [nzValue]="10" [nzLabel]="'PORTFOLIO.ZOOM_OUT' | translate" />
        <nz-option [nzValue]="24" [nzLabel]="'PORTFOLIO.ZOOM_NORMAL' | translate" />
        <nz-option [nzValue]="44" [nzLabel]="'PORTFOLIO.ZOOM_IN' | translate" />
      </nz-select>
      <nz-tag nzColor="red" data-testid="ws-critical-count">{{ 'PORTFOLIO.CRITICAL_NODES' | translate: { count: store.criticalCount() } }}</nz-tag>
      @if (store.previewing()) {
        <nz-tag nzColor="blue" data-testid="ws-preview">{{ 'PORTFOLIO.PREVIEW' | translate }}</nz-tag>
      }
      @if (store.variance(); as report) {
        <nz-tag [nzColor]="report.projectEndVarianceDays > 0 ? 'red' : 'green'" data-testid="ws-end-variance">
          {{ 'PORTFOLIO.PROJECT_END_VARIANCE' | translate }}: {{ report.projectEndVarianceDays }} {{ 'PORTFOLIO.DAYS' | translate }}
        </nz-tag>
      }
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.nodes().length === 0 && !store.loading()) {
        <nz-empty data-testid="ws-empty" [nzNotFoundContent]="'PORTFOLIO.NO_NODES' | translate" />
      } @else {
        <div class="ws-split" data-testid="ws-split" [style.--tree-width.px]="treeWidth()">
          <div class="ws-tree" role="treegrid" [attr.aria-label]="'PORTFOLIO.WBS' | translate">
            <div class="ws-tree-head ws-row">
              <span>WBS</span>
              <span>{{ 'PORTFOLIO.COL_NAME' | translate }}</span>
              <span class="ws-num">{{ 'PORTFOLIO.COL_HOURS' | translate }}</span>
              <span class="ws-num">{{ 'PORTFOLIO.COL_COST' | translate }}</span>
              <span class="ws-num">%</span>
              <span></span>
            </div>
            @for (row of store.rows(); track row.node.id) {
              <div
                class="ws-row"
                role="row"
                [class.selected]="store.selectedNodeId() === row.node.id"
                [class.critical]="row.node.isCritical"
                [attr.aria-level]="row.depth + 1"
                [attr.aria-expanded]="row.hasChildren ? store.expanded().has(row.node.id) : null"
                [attr.data-testid]="'ws-row-' + row.node.id"
                (click)="store.select(row.node.id)"
              >
                <span class="ws-code">{{ row.node.wbsCode }}</span>
                <span class="ws-title" [style.padding-left.px]="row.depth * 16">
                  @if (row.hasChildren) {
                    <button
                      type="button"
                      class="ws-toggle"
                      [attr.aria-label]="'PORTFOLIO.TOGGLE' | translate"
                      [attr.data-testid]="'ws-toggle-' + row.node.id"
                      (click)="$event.stopPropagation(); store.toggle(row.node.id)"
                    >{{ store.expanded().has(row.node.id) ? '▾' : '▸' }}</button>
                  } @else {
                    <span class="ws-toggle-spacer"></span>
                  }
                  <span class="ws-title-text" [class.ws-parent]="row.hasChildren" [title]="typeKeys[row.node.nodeType] | translate">{{ row.node.title }}</span>
                  @if (row.node.nodeType === 'Milestone') {
                    <nz-tag nzColor="gold">◆</nz-tag>
                  }
                </span>
                <span class="ws-num">{{ store.totals().get(row.node.id)?.plannedHours ?? 0 }}</span>
                <span class="ws-num">{{ store.totals().get(row.node.id)?.plannedCost ?? 0 | money }}</span>
                <span class="ws-num">{{ store.totals().get(row.node.id)?.percentComplete ?? 0 }}</span>
                <span class="ws-actions">
                  @if (canWrite) {
                    <button type="button" class="ws-icon" [attr.aria-label]="'PORTFOLIO.ADD_CHILD' | translate" [attr.data-testid]="'ws-add-' + row.node.id" (click)="$event.stopPropagation(); openNode(null, row.node.id)">＋</button>
                    <button type="button" class="ws-icon" [attr.aria-label]="'PORTFOLIO.EDIT' | translate" [attr.data-testid]="'ws-edit-' + row.node.id" (click)="$event.stopPropagation(); openNode(row.node)">✎</button>
                    <button type="button" class="ws-icon" [attr.aria-label]="'PORTFOLIO.MOVE_UP' | translate" (click)="$event.stopPropagation(); move(row.node.id, 'up')">↑</button>
                    <button type="button" class="ws-icon" [attr.aria-label]="'PORTFOLIO.MOVE_DOWN' | translate" (click)="$event.stopPropagation(); move(row.node.id, 'down')">↓</button>
                    <button type="button" class="ws-icon" [attr.aria-label]="'PORTFOLIO.INDENT' | translate" (click)="$event.stopPropagation(); move(row.node.id, 'indent')">→</button>
                    <button type="button" class="ws-icon" [attr.aria-label]="'PORTFOLIO.OUTDENT' | translate" (click)="$event.stopPropagation(); move(row.node.id, 'outdent')">←</button>
                    <button
                      type="button"
                      class="ws-icon"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'PORTFOLIO.CONFIRM_DELETE_NODE' | translate"
                      (nzOnConfirm)="deleteNode(row.node.id)"
                      [attr.aria-label]="'PORTFOLIO.DELETE' | translate"
                      [attr.data-testid]="'ws-delete-' + row.node.id"
                      (click)="$event.stopPropagation()"
                    >✕</button>
                  }
                </span>
              </div>
            }
          </div>

          <div
            class="ws-divider"
            role="separator"
            tabindex="0"
            aria-orientation="vertical"
            data-testid="ws-divider"
            [attr.aria-label]="'PORTFOLIO.RESIZE_PANES' | translate"
            [attr.aria-valuenow]="treeWidth()"
            [attr.aria-valuemin]="minTreeWidth"
            [attr.aria-valuemax]="maxTreeWidth"
            (pointerdown)="startResize($event)"
            (pointermove)="resize($event)"
            (pointerup)="endResize($event)"
            (keydown)="resizeKey($event)"
          ></div>

          <div class="ws-gantt">
            <app-wbs-gantt
              [rows]="store.rows()"
              [nodes]="store.nodes()"
              [dependencies]="store.dependencies()"
              [baseline]="store.baselineByNode()"
              [dayWidth]="dayWidth()"
              [editable]="canWrite"
              (dragPreview)="preview($event)"
              (dragCommit)="commit($event)"
              (dragCancel)="store.cancelMove()"
              (nudge)="nudge($event)"
            />
          </div>
        </div>
      }
    </nz-spin>

    <section class="ws-deps" data-testid="ws-deps">
      <h3>{{ 'PORTFOLIO.DEPENDENCIES' | translate }}</h3>
      @if (canWrite) {
        <div class="ws-dep-form">
          <nz-select data-testid="ws-dep-pred" [nzPlaceHolder]="'PORTFOLIO.PREDECESSOR' | translate" [ngModel]="depPredecessor()" (ngModelChange)="depPredecessor.set($event)" nzShowSearch>
            @for (leaf of leaves(); track leaf.id) {
              <nz-option [nzValue]="leaf.id" [nzLabel]="leaf.wbsCode + ' ' + leaf.title" />
            }
          </nz-select>
          <nz-select data-testid="ws-dep-succ" [nzPlaceHolder]="'PORTFOLIO.SUCCESSOR' | translate" [ngModel]="depSuccessor()" (ngModelChange)="depSuccessor.set($event)" nzShowSearch>
            @for (leaf of leaves(); track leaf.id) {
              <nz-option [nzValue]="leaf.id" [nzLabel]="leaf.wbsCode + ' ' + leaf.title" />
            }
          </nz-select>
          <nz-select data-testid="ws-dep-type" [ngModel]="depType()" (ngModelChange)="depType.set($event)">
            @for (type of dependencyTypes; track type) {
              <nz-option [nzValue]="type" [nzLabel]="dependencyKeys[type] | translate" />
            }
          </nz-select>
          <nz-input-number data-testid="ws-dep-lag" [nzStep]="1" [ngModel]="depLag()" (ngModelChange)="depLag.set($event ?? 0)" [nzPlaceHolder]="'PORTFOLIO.LAG_DAYS' | translate" />
          <button nz-button nzType="primary" type="button" data-testid="ws-dep-add" [disabled]="depPredecessor() === null || depSuccessor() === null" (click)="addDependency()">
            {{ 'PORTFOLIO.ADD_DEPENDENCY' | translate }}
          </button>
        </div>
        <p class="ws-hint">{{ 'PORTFOLIO.LAG_HINT' | translate }}</p>
      }
      @if (store.dependencies().length === 0) {
        <nz-empty [nzNotFoundContent]="'PORTFOLIO.NO_DEPENDENCIES' | translate" />
      } @else {
        <nz-table nzSize="small" [nzData]="store.dependencies()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PORTFOLIO.PREDECESSOR' | translate }}</th>
              <th>{{ 'PORTFOLIO.SUCCESSOR' | translate }}</th>
              <th>{{ 'PORTFOLIO.DEP_TYPE' | translate }}</th>
              <th>{{ 'PORTFOLIO.LAG_DAYS' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (dependency of store.dependencies(); track dependency.id) {
              <tr [attr.data-testid]="'ws-dep-' + dependency.id">
                <td>{{ label(dependency.predecessorNodeId) }}</td>
                <td>{{ label(dependency.successorNodeId) }}</td>
                <td>
                  @if (canWrite) {
                    <nz-select nzSize="small" [ngModel]="dependency.dependencyType" (ngModelChange)="updateDependency(dependency.id, $event, dependency.lagDays)">
                      @for (type of dependencyTypes; track type) {
                        <nz-option [nzValue]="type" [nzLabel]="type" />
                      }
                    </nz-select>
                  } @else {
                    {{ dependency.dependencyType }}
                  }
                </td>
                <td>
                  @if (canWrite) {
                    <nz-input-number nzSize="small" [nzStep]="1" [ngModel]="dependency.lagDays" (ngModelChange)="updateDependency(dependency.id, dependency.dependencyType, $event ?? 0)" />
                  } @else {
                    {{ dependency.lagDays }}
                  }
                </td>
                <td>
                  @if (canWrite) {
                    <button nz-button nzSize="small" nzDanger type="button" [attr.data-testid]="'ws-dep-delete-' + dependency.id" (click)="deleteDependency(dependency.id)">{{ 'PORTFOLIO.DELETE' | translate }}</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </section>

    <nz-modal
      [nzVisible]="nodeModalOpen()"
      [nzTitle]="(editingNode() ? 'PORTFOLIO.EDIT_NODE' : 'PORTFOLIO.ADD_NODE') | translate"
      [nzOkText]="'PORTFOLIO.SAVE' | translate"
      [nzCancelText]="'PORTFOLIO.CANCEL' | translate"
      [nzOkDisabled]="nodeForm.invalid"
      [nzOkLoading]="store.saving()"
      nzWidth="680px"
      (nzOnOk)="saveNode()"
      (nzOnCancel)="nodeModalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="nodeForm" data-testid="ws-node-form">
          <div class="ws-form-grid">
            <nz-form-item class="ws-span">
              <nz-form-label nzRequired>{{ 'PORTFOLIO.F_TITLE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="title" data-testid="ws-f-title" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_NODE_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="nodeType" data-testid="ws-f-type">
                  @for (type of nodeTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="typeKeys[type] | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_PARENT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="parentNodeId" nzAllowClear [nzPlaceHolder]="'PORTFOLIO.NO_PARENT' | translate" data-testid="ws-f-parent">
                  @for (candidate of parentCandidates(); track candidate.id) {
                    <nz-option [nzValue]="candidate.id" [nzLabel]="candidate.wbsCode + ' ' + candidate.title" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PORTFOLIO.F_START' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="date" formControlName="startDate" data-testid="ws-f-start" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PORTFOLIO.F_END' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="'PORTFOLIO.ERR_END_BEFORE_START' | translate"><input nz-input type="date" formControlName="endDate" data-testid="ws-f-end" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_PLANNED_HOURS' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number formControlName="plannedHours" [nzMin]="0" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_PLANNED_COST' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number formControlName="plannedCost" [nzMin]="0" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_PLANNED_REVENUE' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number formControlName="plannedRevenue" [nzMin]="0" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_PERCENT' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number formControlName="percentComplete" [nzMin]="0" [nzMax]="100" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class ProjectWorkspaceComponent implements OnInit {
  protected readonly store = inject(ProjectWorkspaceStore);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canWrite = inject(PermissionsService).canWrite('projects');
  protected readonly projectId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly nodeTypes = WBS_NODE_TYPES;
  protected readonly dependencyTypes = DEPENDENCY_TYPES;
  protected readonly typeKeys = NODE_TYPE_KEYS;
  protected readonly dependencyKeys = DEPENDENCY_KEYS;
  protected readonly minTreeWidth = MIN_TREE_WIDTH;
  protected readonly maxTreeWidth = MAX_TREE_WIDTH;

  protected readonly dayWidth = signal(24);
  protected readonly treeWidth = signal(560);

  protected readonly nodeModalOpen = signal(false);
  protected readonly editingNode = signal<WbsNode | null>(null);

  protected readonly depPredecessor = signal<string | null>(null);
  protected readonly depSuccessor = signal<string | null>(null);
  protected readonly depType = signal<DependencyType>('FS');
  protected readonly depLag = signal(0);

  protected readonly pageTitle = computed(() => this.store.project()?.name ?? this.i18n.translate('PORTFOLIO.WORKSPACE'));
  protected readonly leaves = computed(() => leafNodes(this.store.nodes()));
  protected readonly parentCandidates = computed(() => {
    const editing = this.editingNode();
    const excluded = editing === null ? new Set<string>() : new Set([editing.id, ...descendantIds(this.store.nodes(), editing.id)]);

    return this.store.nodes().filter((node) => !excluded.has(node.id) && node.nodeType !== 'Milestone');
  });

  protected readonly nodeForm = this.fb.group({
    title: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    nodeType: this.fb.control<WbsNodeType>('WorkPackage', [Validators.required]),
    parentNodeId: this.fb.control<string | null>(null),
    startDate: this.fb.control('', [Validators.required]),
    endDate: this.fb.control('', [Validators.required, endsNotBefore('startDate')]),
    plannedHours: this.fb.control(0),
    plannedCost: this.fb.control(0),
    plannedRevenue: this.fb.control(0),
    percentComplete: this.fb.control(0),
  });

  private resizing: { originX: number; originWidth: number } | null = null;

  constructor() {
    revalidateOnStartChange(this.nodeForm, 'startDate', 'endDate', this.destroyRef);
  }

  ngOnInit(): void {
    void this.store.load(this.projectId);
  }

  protected label(nodeId: string): string {
    const node = this.store.nodes().find((candidate) => candidate.id === nodeId);

    return node === undefined ? nodeId : `${node.wbsCode} ${node.title}`;
  }

  // -- Gantt gestures -------------------------------------------------------------------------------------------------

  protected preview(event: GanttDragEvent): void {
    this.store.previewMove(event.nodeId, event.mode, event.deltaDays);
  }

  protected async commit(nodeId: string): Promise<void> {
    this.report(await this.store.commitMove(nodeId));
  }

  protected async nudge(event: GanttDragEvent): Promise<void> {
    this.store.previewMove(event.nodeId, event.mode, event.deltaDays);
    await this.commit(event.nodeId);
  }

  // -- Toolbar --------------------------------------------------------------------------------------------------------

  protected async recalculate(): Promise<void> {
    this.report(await this.store.recalculate(), 'PORTFOLIO.RECALCULATED');
  }

  protected async selectBaseline(baselineId: string | null): Promise<void> {
    this.report(await this.store.selectBaseline(baselineId ?? null));
  }

  protected async move(nodeId: string, action: MoveAction): Promise<void> {
    // `false` is also the answer when the move is not possible (first sibling moved up): nothing to report then.
    await this.store.moveNode(nodeId, action);
  }

  protected async deleteNode(nodeId: string): Promise<void> {
    this.report(await this.store.deleteNode(nodeId), 'PORTFOLIO.NODE_DELETED');
  }

  // -- Node form ------------------------------------------------------------------------------------------------------

  protected openNode(node: WbsNode | null, parentNodeId: string | null = null): void {
    this.editingNode.set(node);

    if (node === null) {
      const today = new Date().toISOString().slice(0, 10);
      this.nodeForm.reset({ nodeType: parentNodeId === null ? 'Phase' : 'WorkPackage', parentNodeId, startDate: today, endDate: today });
    } else {
      this.nodeForm.reset({
        title: node.title,
        nodeType: node.nodeType,
        parentNodeId: node.parentNodeId,
        startDate: node.startDate,
        endDate: node.endDate,
        plannedHours: node.plannedHours,
        plannedCost: node.plannedCost,
        plannedRevenue: node.plannedRevenue,
        percentComplete: node.percentComplete,
      });
    }

    this.nodeModalOpen.set(true);
  }

  protected async saveNode(): Promise<void> {
    if (this.nodeForm.invalid) {
      this.nodeForm.markAllAsTouched();

      return;
    }

    const value = this.nodeForm.getRawValue();
    const editing = this.editingNode();
    const ok = await this.store.saveNode(
      {
        title: value.title.trim(),
        nodeType: value.nodeType,
        parentNodeId: value.parentNodeId,
        startDate: value.startDate,
        // A milestone is a point in time.
        endDate: value.nodeType === 'Milestone' ? value.startDate : value.endDate,
        plannedHours: value.plannedHours,
        plannedCost: value.plannedCost,
        plannedRevenue: value.plannedRevenue,
        percentComplete: value.percentComplete,
      },
      editing?.id,
    );

    if (ok) {
      this.nodeModalOpen.set(false);
    }

    this.report(ok, 'PORTFOLIO.SAVED');
  }

  // -- Dependencies ---------------------------------------------------------------------------------------------------

  protected async addDependency(): Promise<void> {
    const predecessorNodeId = this.depPredecessor();
    const successorNodeId = this.depSuccessor();

    if (predecessorNodeId === null || successorNodeId === null) {
      return;
    }

    const result = await this.store.addDependency({ predecessorNodeId, successorNodeId, dependencyType: this.depType(), lagDays: this.depLag() });

    if (result === 'cycle') {
      this.message.error(this.i18n.translate('PORTFOLIO.DEP_CYCLE'));

      return;
    }

    if (result === 'created') {
      this.depPredecessor.set(null);
      this.depSuccessor.set(null);
      this.depLag.set(0);
    }

    this.report(result === 'created', 'PORTFOLIO.DEPENDENCY_SAVED');
  }

  protected async updateDependency(id: string, dependencyType: DependencyType, lagDays: number): Promise<void> {
    this.report(await this.store.updateDependency(id, { dependencyType, lagDays }), 'PORTFOLIO.DEPENDENCY_SAVED');
  }

  protected async deleteDependency(id: string): Promise<void> {
    this.report(await this.store.deleteDependency(id), 'PORTFOLIO.DEPENDENCY_DELETED');
  }

  // -- Splitter -------------------------------------------------------------------------------------------------------

  protected startResize(event: PointerEvent): void {
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    this.resizing = { originX: event.clientX, originWidth: this.treeWidth() };
  }

  protected resize(event: PointerEvent): void {
    if (this.resizing !== null) {
      this.setTreeWidth(this.resizing.originWidth + event.clientX - this.resizing.originX);
    }
  }

  protected endResize(event: PointerEvent): void {
    (event.currentTarget as Element | null)?.releasePointerCapture?.(event.pointerId);
    this.resizing = null;
  }

  protected resizeKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.setTreeWidth(this.treeWidth() + (event.key === 'ArrowLeft' ? -24 : 24));
    }
  }

  private setTreeWidth(width: number): void {
    this.treeWidth.set(Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, Math.round(width))));
  }

  private report(ok: boolean, successKey?: string): void {
    if (ok) {
      if (successKey !== undefined) {
        this.message.success(this.i18n.translate(successKey));
      }
    } else {
      this.message.error(this.i18n.translate('PORTFOLIO.SAVE_ERROR'));
    }
  }
}
