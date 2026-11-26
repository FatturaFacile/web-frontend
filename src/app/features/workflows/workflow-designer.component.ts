import { CdkDrag, CdkDragEnd } from '@angular/cdk/drag-drop';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  I18nService,
  WorkflowApiService,
  WorkflowDefinitionResource,
  WorkflowNodeResource,
  WorkflowNodeType,
  WorkflowSubjectType,
  WorkflowTransitionResource,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import {
  buildWizardPlan,
  edgeBetween,
  movedPosition,
  NODE_HEIGHT,
  NODE_WIDTH,
  nextNodeKey,
  PALETTE_NODE_TYPES,
  positionOf,
  publishProblems,
  slotPosition,
} from './workflow-designer.util';

type DesignerMode = 'canvas' | 'wizard';

/**
 * Workflow designer (Mod 006): a drag-and-drop canvas of the nodes of a definition (Angular CDK) with a property
 * inspector, and a guided step-by-step wizard that builds the same graph without dragging anything. Both write through
 * the definition endpoints, so the result is identical.
 */
@Component({
  selector: 'app-workflow-designer',
  imports: [
    CdkDrag,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzStepsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'workflows.designer.title' | translate"></app-page-header>

    <div class="toolbar">
      <button nz-button [nzType]="mode() === 'canvas' ? 'primary' : 'default'" (click)="mode.set('canvas')" data-testid="mode-canvas">
        {{ 'workflows.designer.mode.canvas' | translate }}
      </button>
      <button nz-button [nzType]="mode() === 'wizard' ? 'primary' : 'default'" (click)="startWizard()" data-testid="mode-wizard">
        {{ 'workflows.designer.mode.wizard' | translate }}
      </button>
    </div>

    @if (mode() === 'canvas') {
      <nz-card>
        <div class="toolbar">
          <nz-select
            class="select"
            [ngModel]="definition()?.id ?? null"
            (ngModelChange)="openDefinition($event)"
            [nzPlaceHolder]="'workflows.designer.selectDefinition' | translate"
            [attr.aria-label]="'workflows.designer.selectDefinition' | translate"
          >
            @for (item of definitions(); track item.id) {
              <nz-option [nzValue]="item.id" [nzLabel]="item.code + ' - ' + item.name"></nz-option>
            }
          </nz-select>
          @if (definition(); as current) {
            <nz-tag [nzColor]="current.status === 'published' ? 'green' : 'orange'">
              {{ 'workflows.status.' + current.status | translate }}
            </nz-tag>
            <button nz-button nzType="primary" [disabled]="busy()" (click)="publish()" data-testid="publish">
              {{ 'workflows.designer.publish' | translate }}
            </button>
          }
        </div>

        @if (problems().length > 0 && definition()) {
          <nz-alert nzType="warning" nzShowIcon [nzMessage]="'workflows.designer.problems' | translate" [nzDescription]="problemList"></nz-alert>
          <ng-template #problemList>
            <ul>
              @for (problem of problems(); track problem) {
                <li>{{ problem | translate }}</li>
              }
            </ul>
          </ng-template>
        }
      </nz-card>

      @if (definition()) {
        <div class="layout">
          <div class="palette" role="group" [attr.aria-label]="'workflows.designer.palette' | translate">
            <h4>{{ 'workflows.designer.palette' | translate }}</h4>
            @for (type of paletteTypes; track type) {
              <button nz-button nzBlock [disabled]="busy()" (click)="addNode(type)" [attr.data-testid]="'add-' + type">
                {{ 'workflows.designer.nodeType.' + type | translate }}
              </button>
            }
            <h4>{{ 'workflows.designer.connect' | translate }}</h4>
            <nz-select class="full" nzAllowClear [ngModel]="connectFrom()" (ngModelChange)="connectFrom.set($event)" [nzPlaceHolder]="'workflows.designer.from' | translate" [attr.aria-label]="'workflows.designer.from' | translate">
              @for (node of nodes(); track node.id) {
                <nz-option [nzValue]="node.id" [nzLabel]="node.name"></nz-option>
              }
            </nz-select>
            <nz-select class="full" nzAllowClear [ngModel]="connectTo()" (ngModelChange)="connectTo.set($event)" [nzPlaceHolder]="'workflows.designer.to' | translate" [attr.aria-label]="'workflows.designer.to' | translate">
              @for (node of nodes(); track node.id) {
                <nz-option [nzValue]="node.id" [nzLabel]="node.name"></nz-option>
              }
            </nz-select>
            <button nz-button nzBlock [disabled]="!canConnect() || busy()" (click)="connect()" data-testid="connect">
              {{ 'workflows.designer.addTransition' | translate }}
            </button>
          </div>

          <div class="canvas" #canvas role="application" [attr.aria-label]="'workflows.designer.canvas' | translate">
            <svg class="edges" aria-hidden="true">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#8c8c8c" />
                </marker>
              </defs>
              @for (edge of edges(); track edge.id) {
                <line [attr.x1]="edge.from.x" [attr.y1]="edge.from.y" [attr.x2]="edge.to.x" [attr.y2]="edge.to.y" stroke="#8c8c8c" stroke-width="2" marker-end="url(#arrow)" />
              }
            </svg>
            @for (node of nodes(); track node.id) {
              <div
                class="node"
                cdkDrag
                cdkDragBoundary=".canvas"
                [class.selected]="selectedId() === node.id"
                [attr.data-type]="node.node_type"
                [style.left.px]="position(node).x"
                [style.top.px]="position(node).y"
                [style.width.px]="nodeWidth"
                [style.height.px]="nodeHeight"
                tabindex="0"
                (click)="select(node.id)"
                (keydown.enter)="select(node.id)"
                (cdkDragEnded)="onDragEnded(node, $event)"
              >
                <strong>{{ node.name }}</strong>
                <small>{{ 'workflows.designer.nodeType.' + node.node_type | translate }}</small>
              </div>
            }
          </div>

          <div class="inspector">
            <h4>{{ 'workflows.designer.inspector' | translate }}</h4>
            @if (selected(); as node) {
              <label for="node-name">{{ 'workflows.designer.nodeName' | translate }}</label>
              <input id="node-name" nz-input maxlength="150" [ngModel]="draftName()" (ngModelChange)="draftName.set($event)" />
              <label for="node-x">{{ 'workflows.designer.positionX' | translate }}</label>
              <nz-input-number id="node-x" [nzMin]="0" [ngModel]="draftX()" (ngModelChange)="draftX.set($event ?? 0)"></nz-input-number>
              <label for="node-y">{{ 'workflows.designer.positionY' | translate }}</label>
              <nz-input-number id="node-y" [nzMin]="0" [ngModel]="draftY()" (ngModelChange)="draftY.set($event ?? 0)"></nz-input-number>
              @if (node.node_type === 'approval') {
                <label for="node-config">{{ 'workflows.designer.config' | translate }}</label>
                <textarea id="node-config" nz-input rows="5" [ngModel]="draftConfig()" (ngModelChange)="draftConfig.set($event)"></textarea>
                @if (configInvalid()) {
                  <p class="error" role="alert">{{ 'workflows.designer.configInvalid' | translate }}</p>
                }
              }
              <div class="toolbar">
                <button nz-button nzType="primary" [disabled]="busy() || configInvalid()" (click)="saveNode()" data-testid="save-node">
                  {{ 'workflows.designer.saveNode' | translate }}
                </button>
                <button nz-button nzDanger [disabled]="busy()" (click)="removeNode(node)">
                  {{ 'workflows.designer.deleteNode' | translate }}
                </button>
              </div>
            } @else {
              <p class="hint">{{ 'workflows.designer.selectNode' | translate }}</p>
            }
            <h4>{{ 'workflows.designer.transitions' | translate }}</h4>
            <ul class="transitions">
              @for (transition of transitions(); track transition.id) {
                <li>
                  {{ nodeName(transition.from_node_id) }} &rarr; {{ nodeName(transition.to_node_id) }}
                  <button nz-button nzSize="small" nzType="link" nzDanger (click)="removeTransition(transition)">
                    {{ 'workflows.designer.deleteTransition' | translate }}
                  </button>
                </li>
              }
            </ul>
          </div>
        </div>
      }
    } @else {
      <nz-card>
        <nz-steps [nzCurrent]="wizardStep()" nzSize="small">
          <nz-step [nzTitle]="'workflows.designer.wizard.basics' | translate"></nz-step>
          <nz-step [nzTitle]="'workflows.designer.wizard.steps' | translate"></nz-step>
          <nz-step [nzTitle]="'workflows.designer.wizard.review' | translate"></nz-step>
        </nz-steps>

        <div class="wizard-body">
          @switch (wizardStep()) {
            @case (0) {
              <label for="wiz-code">{{ 'workflows.designer.wizard.code' | translate }}</label>
              <input id="wiz-code" nz-input maxlength="60" [ngModel]="wizard().code" (ngModelChange)="patchWizard('code', $event.toUpperCase())" />
              <label for="wiz-name">{{ 'workflows.designer.wizard.name' | translate }}</label>
              <input id="wiz-name" nz-input maxlength="150" [ngModel]="wizard().name" (ngModelChange)="patchWizard('name', $event)" />
              <label for="wiz-type">{{ 'workflows.designer.wizard.subjectType' | translate }}</label>
              <nz-select id="wiz-type" class="full" [ngModel]="wizard().subjectType" (ngModelChange)="patchWizard('subjectType', $event)">
                @for (type of subjectTypes(); track type.code) {
                  <nz-option [nzValue]="type.code" [nzLabel]="'workflows.subject_types.' + type.code | translate"></nz-option>
                }
              </nz-select>
            }
            @case (1) {
              <p class="hint">{{ 'workflows.designer.wizard.stepsHint' | translate }}</p>
              @for (step of wizard().steps; track $index; let i = $index) {
                <div class="toolbar">
                  <span class="index">{{ i + 1 }}</span>
                  <input nz-input [ngModel]="step" (ngModelChange)="setWizardStep(i, $event)" [attr.aria-label]="'workflows.designer.wizard.stepName' | translate" />
                  <button nz-button nzSize="small" [disabled]="i === 0" (click)="moveWizardStep(i, -1)">{{ 'workflows.designer.wizard.up' | translate }}</button>
                  <button nz-button nzSize="small" [disabled]="i === wizard().steps.length - 1" (click)="moveWizardStep(i, 1)">{{ 'workflows.designer.wizard.down' | translate }}</button>
                  <button nz-button nzSize="small" nzDanger (click)="removeWizardStep(i)">{{ 'workflows.designer.deleteNode' | translate }}</button>
                </div>
              }
              <button nz-button nzType="dashed" (click)="addWizardStep()" data-testid="wizard-add-step">{{ 'workflows.designer.wizard.addStep' | translate }}</button>
            }
            @default {
              <p>{{ 'workflows.designer.wizard.reviewHint' | translate }}</p>
              <ol>
                @for (name of wizardApprovalNames(); track $index) {
                  <li>{{ name }}</li>
                }
              </ol>
            }
          }
        </div>

        <div class="toolbar">
          <button nz-button [disabled]="wizardStep() === 0" (click)="wizardStep.set(wizardStep() - 1)">{{ 'workflows.designer.wizard.back' | translate }}</button>
          @if (wizardStep() < 2) {
            <button nz-button nzType="primary" [disabled]="!wizardStepValid()" (click)="wizardStep.set(wizardStep() + 1)" data-testid="wizard-next">
              {{ 'workflows.designer.wizard.next' | translate }}
            </button>
          } @else {
            <button nz-button nzType="primary" [disabled]="busy() || !wizardStepValid()" (click)="finishWizard()" data-testid="wizard-finish">
              {{ 'workflows.designer.wizard.finish' | translate }}
            </button>
          }
        </div>
      </nz-card>
    }
  `,
  styles: `
    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .select {
      min-width: 280px;
    }
    .full {
      width: 100%;
      margin-bottom: 8px;
    }
    .layout {
      display: grid;
      grid-template-columns: 200px minmax(520px, 1fr) 280px;
      gap: 16px;
      margin-top: 16px;
    }
    .palette,
    .inspector {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .canvas {
      position: relative;
      min-height: 480px;
      overflow: auto;
      background: repeating-linear-gradient(0deg, transparent 0 19px, rgb(0 0 0 / 5%) 19px 20px),
        repeating-linear-gradient(90deg, transparent 0 19px, rgb(0 0 0 / 5%) 19px 20px);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
    }
    .edges {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .node {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 6px 10px;
      background: var(--bg-card, #fff);
      border: 2px solid var(--border-color);
      border-radius: 8px;
      cursor: grab;
      user-select: none;
    }
    .node.selected {
      border-color: var(--primary-color);
    }
    .node[data-type='start'] {
      border-color: #52c41a;
    }
    .node[data-type='end'] {
      border-color: #8c8c8c;
    }
    .node small {
      color: var(--text-secondary);
    }
    .transitions {
      margin: 0;
      padding-left: 16px;
    }
    .wizard-body {
      max-width: 560px;
      margin: 24px 0;
    }
    .index {
      font-weight: 600;
      min-width: 20px;
    }
    .hint {
      color: var(--text-secondary);
    }
    .error {
      color: var(--error-color, #cf1322);
    }
    label {
      display: block;
      margin: 8px 0 4px;
      font-weight: 500;
    }
    @media (max-width: 1100px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class WorkflowDesignerComponent implements OnInit {
  private readonly api = inject(WorkflowApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly paletteTypes = PALETTE_NODE_TYPES;
  protected readonly nodeWidth = NODE_WIDTH;
  protected readonly nodeHeight = NODE_HEIGHT;

  readonly mode = signal<DesignerMode>('canvas');
  readonly definitions = signal<WorkflowDefinitionResource[]>([]);
  readonly definition = signal<WorkflowDefinitionResource | null>(null);
  readonly nodes = signal<WorkflowNodeResource[]>([]);
  readonly transitions = signal<WorkflowTransitionResource[]>([]);
  readonly subjectTypes = signal<WorkflowSubjectType[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly connectFrom = signal<string | null>(null);
  readonly connectTo = signal<string | null>(null);

  // Inspector drafts
  readonly draftName = signal('');
  readonly draftX = signal(0);
  readonly draftY = signal(0);
  readonly draftConfig = signal('');

  // Wizard
  readonly wizardStep = signal(0);
  readonly wizard = signal<{ code: string; name: string; subjectType: string; steps: string[] }>({
    code: '',
    name: '',
    subjectType: '',
    steps: [''],
  });

  readonly selected = computed(() => this.nodes().find((node) => node.id === this.selectedId()) ?? null);
  readonly problems = computed(() => publishProblems(this.nodes(), this.transitions()));
  readonly edges = computed(() =>
    this.transitions().flatMap((transition) => {
      const edge = edgeBetween(transition, this.nodes());
      return edge ? [{ id: transition.id, ...edge }] : [];
    }),
  );
  readonly canConnect = computed(
    () => !!this.connectFrom() && !!this.connectTo() && this.connectFrom() !== this.connectTo(),
  );
  readonly configInvalid = computed(() => this.parseConfig(this.draftConfig()) === undefined);
  readonly wizardApprovalNames = computed(() => this.wizard().steps.map((step) => step.trim()).filter((step) => step !== ''));
  readonly wizardStepValid = computed(() => {
    const wizard = this.wizard();
    switch (this.wizardStep()) {
      case 0:
        return wizard.code.trim() !== '' && wizard.name.trim() !== '' && wizard.subjectType !== '';
      case 1:
      case 2:
        return this.wizardApprovalNames().length > 0;
      default:
        return false;
    }
  });

  ngOnInit(): void {
    this.api.getSubjectTypes().subscribe({ next: (res) => this.subjectTypes.set(res.data), error: () => undefined });
    this.loadDefinitions();
  }

  protected position(node: WorkflowNodeResource): { x: number; y: number } {
    return positionOf(node);
  }

  protected nodeName(id: string): string {
    return this.nodes().find((node) => node.id === id)?.name ?? id;
  }

  loadDefinitions(): void {
    this.api.getDefinitions({ per_page: 100 }).subscribe({
      next: (res) => this.definitions.set(res.data),
      error: () => this.notify('error', 'workflows.designer.loadError'),
    });
  }

  openDefinition(id: string | null): void {
    if (!id) {
      return;
    }
    this.api.getDefinition(id).subscribe({
      next: (res) => this.applyDefinition(res.data),
      error: () => this.notify('error', 'workflows.designer.loadError'),
    });
  }

  private applyDefinition(definition: WorkflowDefinitionResource): void {
    this.definition.set(definition);
    this.nodes.set(definition.nodes ?? []);
    this.transitions.set(definition.transitions ?? []);
    this.selectedId.set(null);
    this.connectFrom.set(null);
    this.connectTo.set(null);
  }

  select(id: string): void {
    this.selectedId.set(id);
    const node = this.nodes().find((candidate) => candidate.id === id);
    if (node) {
      const position = positionOf(node);
      this.draftName.set(node.name);
      this.draftX.set(position.x);
      this.draftY.set(position.y);
      this.draftConfig.set(node.config && Object.keys(node.config).length > 0 ? JSON.stringify(node.config, null, 2) : '');
    }
  }

  /** `undefined` when the text is not a JSON object; an empty text is an empty config. */
  private parseConfig(text: string): Record<string, unknown> | undefined {
    if (text.trim() === '') {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(text);
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  }

  async addNode(type: WorkflowNodeType): Promise<void> {
    const definition = this.definition();
    if (!definition) {
      return;
    }
    this.busy.set(true);
    try {
      const position = slotPosition(this.nodes().length);
      const res = await firstValueFrom(
        this.api.addNode(definition.id, {
          node_key: nextNodeKey(type, this.nodes()),
          name: this.i18n.translate(`workflows.designer.nodeType.${type}`),
          node_type: type,
          position_x: position.x,
          position_y: position.y,
        }),
      );
      this.nodes.update((current) => [...current, res.data]);
      this.select(res.data.id);
    } catch {
      this.notify('error', 'workflows.designer.saveError');
    } finally {
      this.busy.set(false);
    }
  }

  async onDragEnded(node: WorkflowNodeResource, event: CdkDragEnd): Promise<void> {
    const definition = this.definition();
    const target = movedPosition(positionOf(node), event.distance);
    // The element returns to its CSS position; the new one comes from the node signal.
    event.source.reset();
    if (!definition || (target.x === positionOf(node).x && target.y === positionOf(node).y)) {
      return;
    }
    this.nodes.update((current) => current.map((item) => (item.id === node.id ? { ...item, position_x: target.x, position_y: target.y } : item)));
    try {
      await firstValueFrom(this.api.updateNode(definition.id, node.id, { position_x: target.x, position_y: target.y }));
    } catch {
      this.nodes.update((current) => current.map((item) => (item.id === node.id ? node : item)));
      this.notify('error', 'workflows.designer.saveError');
    }
  }

  async saveNode(): Promise<void> {
    const definition = this.definition();
    const node = this.selected();
    const config = this.parseConfig(this.draftConfig());
    if (!definition || !node || config === undefined) {
      return;
    }
    this.busy.set(true);
    try {
      const res = await firstValueFrom(
        this.api.updateNode(definition.id, node.id, {
          name: this.draftName().trim(),
          position_x: this.draftX(),
          position_y: this.draftY(),
          ...(node.node_type === 'approval' ? { config } : {}),
        }),
      );
      this.nodes.update((current) => current.map((item) => (item.id === node.id ? res.data : item)));
      this.notify('success', 'workflows.designer.saved');
    } catch {
      this.notify('error', 'workflows.designer.saveError');
    } finally {
      this.busy.set(false);
    }
  }

  async removeNode(node: WorkflowNodeResource): Promise<void> {
    const definition = this.definition();
    if (!definition) {
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteNode(definition.id, node.id));
      this.nodes.update((current) => current.filter((item) => item.id !== node.id));
      this.transitions.update((current) => current.filter((item) => item.from_node_id !== node.id && item.to_node_id !== node.id));
      this.selectedId.set(null);
    } catch {
      this.notify('error', 'workflows.designer.saveError');
    } finally {
      this.busy.set(false);
    }
  }

  async connect(): Promise<void> {
    const definition = this.definition();
    const from = this.connectFrom();
    const to = this.connectTo();
    if (!definition || !from || !to || from === to) {
      return;
    }
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.api.addTransition(definition.id, { from_node_id: from, to_node_id: to }));
      this.transitions.update((current) => [...current, res.data]);
      this.connectFrom.set(null);
      this.connectTo.set(null);
    } catch {
      this.notify('error', 'workflows.designer.saveError');
    } finally {
      this.busy.set(false);
    }
  }

  async removeTransition(transition: WorkflowTransitionResource): Promise<void> {
    const definition = this.definition();
    if (!definition) {
      return;
    }
    try {
      await firstValueFrom(this.api.deleteTransition(definition.id, transition.id));
      this.transitions.update((current) => current.filter((item) => item.id !== transition.id));
    } catch {
      this.notify('error', 'workflows.designer.saveError');
    }
  }

  async publish(): Promise<void> {
    const definition = this.definition();
    if (!definition || this.problems().length > 0) {
      this.notify('warning', 'workflows.designer.problems');
      return;
    }
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.api.publishDefinition(definition.id));
      this.definition.set({ ...definition, ...res.data, nodes: this.nodes(), transitions: this.transitions() });
      this.notify('success', 'workflows.designer.published');
      this.loadDefinitions();
    } catch {
      this.notify('error', 'workflows.designer.publishError');
    } finally {
      this.busy.set(false);
    }
  }

  // --- wizard ---
  startWizard(): void {
    this.wizardStep.set(0);
    this.mode.set('wizard');
  }

  patchWizard(key: 'code' | 'name' | 'subjectType', value: string): void {
    this.wizard.update((current) => ({ ...current, [key]: value }));
  }

  setWizardStep(index: number, value: string): void {
    this.wizard.update((current) => ({ ...current, steps: current.steps.map((step, i) => (i === index ? value : step)) }));
  }

  addWizardStep(): void {
    this.wizard.update((current) => ({ ...current, steps: [...current.steps, ''] }));
  }

  removeWizardStep(index: number): void {
    this.wizard.update((current) => ({ ...current, steps: current.steps.filter((_, i) => i !== index) }));
  }

  moveWizardStep(index: number, delta: -1 | 1): void {
    this.wizard.update((current) => {
      const steps = [...current.steps];
      const target = index + delta;
      if (target < 0 || target >= steps.length) {
        return current;
      }
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps };
    });
  }

  /** Creates the definition, its start, approval and end nodes and the transitions between them, then opens it on the canvas. */
  async finishWizard(): Promise<void> {
    const wizard = this.wizard();
    const plan = buildWizardPlan(wizard.steps, {
      start: this.i18n.translate('workflows.designer.nodeType.start'),
      end: this.i18n.translate('workflows.designer.nodeType.end'),
    });
    this.busy.set(true);
    try {
      const created = (
        await firstValueFrom(
          this.api.createDefinition({
            code: wizard.code.trim(),
            name: wizard.name.trim(),
            target_entity_type: wizard.subjectType,
          }),
        )
      ).data;
      const nodeIds: string[] = [];
      for (const node of plan.nodes) {
        nodeIds.push((await firstValueFrom(this.api.addNode(created.id, node))).data.id);
      }
      for (const link of plan.transitions) {
        await firstValueFrom(this.api.addTransition(created.id, { from_node_id: nodeIds[link.from], to_node_id: nodeIds[link.to] }));
      }
      this.notify('success', 'workflows.designer.wizard.created');
      this.loadDefinitions();
      this.mode.set('canvas');
      this.openDefinition(created.id);
    } catch {
      this.notify('error', 'workflows.designer.wizard.error');
    } finally {
      this.busy.set(false);
    }
  }

  private notify(level: 'success' | 'warning' | 'error', key: string): void {
    this.message[level](this.i18n.translate(key));
  }
}
