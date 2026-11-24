import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  JOURNEY_CONDITIONS,
  JOURNEY_STEP_TYPES,
  JourneyConditionType,
  JourneyStep,
  JourneyStepType,
  LocalizedText,
  MarketingBlueprint,
  MarketingLocale,
  MARKETING_LOCALES,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { MarketingNavComponent } from './marketing-nav.component';
import { MarketingAutomationStore } from './marketing-automation.store';
import {
  asMarketingLocale,
  blockingJourneyIssues,
  blueprintText,
  connect,
  edgeKindsOf,
  edgesOf,
  journeyIssues,
  JourneyEdgeKind,
  localized,
  newStep,
  removeStep,
  setEntry,
  stepIcon,
} from './marketing-automation.util';

const CARD_WIDTH = 220;
const CARD_HEIGHT = 84;
const DRAG_TYPE = 'application/x-marketing-journey';

/** A drag carries either a step type from the palette or the key of a step of the canvas. */
type JourneyDrag =
  { kind: 'palette'; type: JourneyStepType } | { kind: 'step'; key: string; dx: number; dy: number };

/**
 * Visual journey builder: the nodes of an automation (send e-mail / WhatsApp / SMS, wait, click-and-order conditions,
 * CRM task for the area sales agent) and the edges between them, for the five triggers of the campaign.
 */
@Component({
  selector: 'app-journey-builder',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    MarketingNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'marketing.journey.title' | translate"
      [subtitle]="'marketing.journey.subtitle' | translate"
    />
    <app-marketing-nav activeTab="journey" />

    @if (store.errorCode(); as code) {
      <p class="mb-4 text-red-600" role="alert">
        {{ code | translate }}
        @for (detail of store.errorDetails(); track detail) {
          <span class="block text-sm">{{ detail }}</span>
        }
      </p>
    }

    <div class="mb-4 flex flex-wrap items-end gap-4">
      <div class="min-w-64">
        <label class="mb-1 block text-xs font-medium" for="jrn-campaign">{{ 'marketing.designer.campaign' | translate }}</label>
        <nz-select nzId="jrn-campaign" class="w-full" [ngModel]="store.selectedCampaign()?.id ?? null" (ngModelChange)="pickCampaign($event)">
          @for (campaign of store.campaigns(); track campaign.id) {
            <nz-option [nzValue]="campaign.id" [nzLabel]="campaign.name" />
          }
        </nz-select>
      </div>
      <div class="min-w-64">
        <label class="mb-1 block text-xs font-medium" for="jrn-blueprint">{{ 'marketing.journey.blueprint' | translate }}</label>
        <nz-select nzId="jrn-blueprint" class="w-full" nzAllowClear [ngModel]="null" (ngModelChange)="applyBlueprint($event)">
          @for (blueprint of store.journeys(); track blueprint.code) {
            <nz-option [nzValue]="blueprint.code" [nzLabel]="blueprintName(blueprint)" />
          }
        </nz-select>
      </div>
      <div role="group" [attr.aria-label]="'marketing.designer.locale' | translate" class="flex gap-1">
        @for (item of locales; track item) {
          <button nz-button [nzType]="locale() === item ? 'primary' : 'default'" [attr.aria-pressed]="locale() === item" (click)="locale.set(item)">{{ item.toUpperCase() }}</button>
        }
      </div>
    </div>

    @if (store.selectedCampaign(); as campaign) {
      <p class="mb-3 text-sm text-gray-600">
        {{ 'marketing.field.trigger' | translate }}: <nz-tag>{{ 'marketing.trigger.' + campaign.trigger_type | translate }}</nz-tag>
        {{ 'marketing.field.channel' | translate }}: <nz-tag>{{ 'marketing.channel.' + campaign.channel | translate }}</nz-tag>
      </p>

      <div class="grid gap-4 xl:grid-cols-[14rem_minmax(0,1fr)_22rem]">
        <aside>
          <nz-card nzSize="small" [nzTitle]="'marketing.journey.palette' | translate">
            <div class="flex flex-col gap-2">
              @for (type of stepTypes; track type) {
                <button nz-button type="button" draggable="true" (dragstart)="dragPalette($event, type)" (click)="addStep(type)">
                  <i [class]="icon(type)" aria-hidden="true"></i>
                  {{ 'marketing.step.' + type | translate }}
                </button>
              }
            </div>
            <p class="mt-2 text-xs text-gray-500">{{ 'marketing.journey.drag_hint' | translate }}</p>
          </nz-card>
        </aside>

        <section>
          <div
            class="relative overflow-auto rounded border bg-gray-50"
            style="min-height: 34rem"
            data-testid="journey-canvas"
            (dragover)="$event.preventDefault()"
            (drop)="dropOnCanvas($event)"
          >
            <svg class="pointer-events-none absolute left-0 top-0" [attr.width]="canvasWidth()" [attr.height]="canvasHeight()" aria-hidden="true">
              <defs>
                <marker id="journey-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#8c8c8c" />
                </marker>
              </defs>
              @for (edge of edges(); track edge.from + edge.kind + edge.to) {
                <path [attr.d]="path(edge.from, edge.to)" fill="none" [attr.stroke]="edgeColor(edge.kind)" stroke-width="2" marker-end="url(#journey-arrow)" />
              }
            </svg>

            <div class="relative" [style.width.px]="canvasWidth()" [style.height.px]="canvasHeight()">
              @for (step of steps(); track step.step_key) {
                <div
                  class="absolute cursor-grab rounded border bg-white p-2 shadow-sm"
                  [style.left.px]="step.pos_x"
                  [style.top.px]="step.pos_y"
                  [style.width.px]="cardWidth"
                  [style.min-height.px]="cardHeight"
                  [class.border-blue-500]="selectedKey() === step.step_key"
                  [class.border-red-400]="issueKeys().has(step.step_key)"
                  draggable="true"
                  tabindex="0"
                  role="button"
                  [attr.aria-pressed]="selectedKey() === step.step_key"
                  (dragstart)="dragStep($event, step)"
                  (click)="selectedKey.set(step.step_key)"
                  (keydown.enter)="selectedKey.set(step.step_key)"
                >
                  <div class="flex items-center justify-between text-xs text-gray-500">
                    <span><i [class]="icon(step.type)" aria-hidden="true"></i> {{ 'marketing.step.' + step.type | translate }}</span>
                    @if (step.is_entry) {
                      <nz-tag nzColor="green">{{ 'marketing.journey.entry' | translate }}</nz-tag>
                    }
                  </div>
                  <div class="mt-1 text-sm font-medium">{{ label(step) }}</div>
                  @if (step.type === 'wait') {
                    <div class="text-xs text-gray-500">{{ waitSummary(step) }}</div>
                  }
                  @if (step.type === 'condition') {
                    <div class="text-xs text-gray-500">{{ 'marketing.condition.' + conditionOf(step) | translate }}</div>
                  }
                </div>
              }
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button nz-button nzType="primary" (click)="save()" [disabled]="store.saving() || blocking().length > 0">{{ 'marketing.journey.save' | translate }}</button>
            @if (blocking().length > 0) {
              <span class="self-center text-sm text-red-600" role="alert">{{ 'marketing.journey.cannot_save' | translate }}</span>
            }
          </div>

          @if (issues().length > 0) {
            <ul class="mt-3 list-disc pl-5 text-sm" [attr.aria-label]="'marketing.journey.issues' | translate" data-testid="journey-issues">
              @for (entry of issues(); track entry.issue + (entry.step ?? '')) {
                <li [class.text-red-600]="isBlocking(entry.issue)" [class.text-amber-600]="!isBlocking(entry.issue)">
                  {{ 'marketing.journey_issue.' + entry.issue | translate }}
                  @if (entry.step) {
                    <code>{{ entry.step }}</code>
                  }
                </li>
              }
            </ul>
          }
        </section>

        <aside>
          <nz-card nzSize="small" [nzTitle]="'marketing.journey.step_settings' | translate">
            @if (selected(); as step) {
              <div class="flex flex-col gap-3">
                <div class="flex flex-wrap gap-2">
                  <button nz-button nzSize="small" [disabled]="step.is_entry" (click)="makeEntry(step.step_key)">{{ 'marketing.journey.set_entry' | translate }}</button>
                  <button nz-button nzSize="small" nzDanger (click)="deleteStep(step.step_key)">{{ 'marketing.action.delete' | translate }}</button>
                </div>

                @for (kind of edgeKinds(step); track kind) {
                  <div>
                    <label class="mb-1 block text-xs font-medium" [for]="'jrn-edge-' + kind">{{ 'marketing.journey.edge_' + kind | translate }}</label>
                    <nz-select [nzId]="'jrn-edge-' + kind" class="w-full" nzAllowClear [ngModel]="targetOf(step, kind)" (ngModelChange)="link(step.step_key, kind, $event)">
                      @for (other of otherSteps(step.step_key); track other.step_key) {
                        <nz-option [nzValue]="other.step_key" [nzLabel]="label(other) + ' (' + other.step_key + ')'" />
                      }
                    </nz-select>
                  </div>
                }

                @if (step.type === 'wait') {
                  <div class="flex gap-2">
                    <div>
                      <label class="mb-1 block text-xs font-medium" for="jrn-days">{{ 'marketing.journey.days' | translate }}</label>
                      <nz-input-number nzId="jrn-days" [ngModel]="numberOf(step, 'days')" (ngModelChange)="setConfig(step.step_key, 'days', $event ?? 0)" [nzMin]="0" />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium" for="jrn-hours">{{ 'marketing.journey.hours' | translate }}</label>
                      <nz-input-number nzId="jrn-hours" [ngModel]="numberOf(step, 'hours')" (ngModelChange)="setConfig(step.step_key, 'hours', $event ?? 0)" [nzMin]="0" />
                    </div>
                  </div>
                }

                @if (step.type === 'condition') {
                  <div>
                    <label class="mb-1 block text-xs font-medium" for="jrn-condition">{{ 'marketing.journey.condition' | translate }}</label>
                    <nz-select nzId="jrn-condition" class="w-full" [ngModel]="conditionOf(step)" (ngModelChange)="setConfig(step.step_key, 'type', $event)">
                      @for (condition of conditions; track condition) {
                        <nz-option [nzValue]="condition" [nzLabel]="'marketing.condition.' + condition | translate" />
                      }
                    </nz-select>
                  </div>
                }

                @if (step.type === 'send_whatsapp' || step.type === 'send_sms') {
                  <div>
                    <label class="mb-1 block text-xs font-medium" for="jrn-message">{{ 'marketing.journey.message' | translate }} ({{ locale().toUpperCase() }})</label>
                    <textarea nz-input id="jrn-message" rows="3" [ngModel]="textOf(step, 'message')" (ngModelChange)="setText(step.step_key, 'message', $event)"></textarea>
                  </div>
                }

                @if (step.type === 'crm_task') {
                  <div>
                    <label class="mb-1 block text-xs font-medium" for="jrn-subject">{{ 'marketing.journey.task_subject' | translate }} ({{ locale().toUpperCase() }})</label>
                    <textarea nz-input id="jrn-subject" rows="2" [ngModel]="textOf(step, 'subject')" (ngModelChange)="setText(step.step_key, 'subject', $event)"></textarea>
                  </div>
                  <div class="flex gap-2">
                    <div>
                      <label class="mb-1 block text-xs font-medium" for="jrn-task-type">{{ 'marketing.journey.task_type' | translate }}</label>
                      <nz-select nzId="jrn-task-type" [ngModel]="stringOf(step, 'task_type')" (ngModelChange)="setConfig(step.step_key, 'task_type', $event)">
                        <nz-option nzValue="call" [nzLabel]="'marketing.task.call' | translate" />
                        <nz-option nzValue="task" [nzLabel]="'marketing.task.task' | translate" />
                        <nz-option nzValue="follow_up" [nzLabel]="'marketing.task.follow_up' | translate" />
                      </nz-select>
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium" for="jrn-due">{{ 'marketing.journey.due_in_days' | translate }}</label>
                      <nz-input-number nzId="jrn-due" [ngModel]="numberOf(step, 'due_in_days')" (ngModelChange)="setConfig(step.step_key, 'due_in_days', $event ?? 1)" [nzMin]="0" />
                    </div>
                  </div>
                  <p class="text-xs text-gray-500">{{ 'marketing.journey.task_hint' | translate }}</p>
                }
              </div>
            } @else {
              <p class="text-sm text-gray-500">{{ 'marketing.journey.select_step' | translate }}</p>
            }
          </nz-card>
        </aside>
      </div>
    } @else {
      <p class="text-gray-500">{{ 'marketing.designer.no_campaign' | translate }}</p>
    }
  `,
})
export class JourneyBuilderComponent implements OnInit {
  protected readonly store = inject(MarketingAutomationStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly route = inject(ActivatedRoute);

  protected readonly locales = MARKETING_LOCALES;
  protected readonly stepTypes = JOURNEY_STEP_TYPES;
  protected readonly conditions = JOURNEY_CONDITIONS;
  protected readonly cardWidth = CARD_WIDTH;
  protected readonly cardHeight = CARD_HEIGHT;
  protected readonly locale = signal<MarketingLocale>(asMarketingLocale(this.i18n.currentLanguage()));
  protected readonly steps = signal<JourneyStep[]>([]);
  protected readonly selectedKey = signal<string | null>(null);

  protected readonly selected = computed(
    () => this.steps().find((step) => step.step_key === this.selectedKey()) ?? null,
  );
  protected readonly edges = computed(() => edgesOf(this.steps()));
  protected readonly issues = computed(() => journeyIssues(this.steps()));
  protected readonly blocking = computed(() => blockingJourneyIssues(this.steps()));
  protected readonly issueKeys = computed(
    () => new Set(this.issues().flatMap((entry) => (entry.step ? [entry.step] : []))),
  );
  protected readonly canvasWidth = computed(
    () => Math.max(900, ...this.steps().map((step) => step.pos_x + CARD_WIDTH + 80)),
  );
  protected readonly canvasHeight = computed(
    () => Math.max(520, ...this.steps().map((step) => step.pos_y + CARD_HEIGHT + 80)),
  );

  async ngOnInit(): Promise<void> {
    await Promise.all([this.store.loadCampaigns(), this.store.loadBlueprints()]);
    const id = this.route.snapshot.queryParamMap.get('campaign');
    if (id) {
      await this.pickCampaign(id);
    }
  }

  protected async pickCampaign(id: string | null): Promise<void> {
    await this.store.selectCampaign(id);
    this.steps.set(structuredClone(this.store.selectedCampaign()?.steps ?? []));
    this.selectedKey.set(null);
  }

  protected blueprintName(blueprint: MarketingBlueprint): string {
    return blueprintText(blueprint, 'name', this.locale());
  }

  /** Replaces the canvas with the nodes of a seeded journey; the node copy comes with the blueprint. */
  protected applyBlueprint(code: string | null): void {
    const blueprint = this.store.journeys().find((b) => b.code === code);
    const source = (blueprint?.payload['steps'] ?? null) as
      | (Partial<JourneyStep> & { labels?: LocalizedText })[]
      | null;
    if (!source) {
      return;
    }
    this.steps.set(
      source.map((node, index) => ({
        step_key: node.step_key ?? `step_${index + 1}`,
        type: (node.type ?? 'end') as JourneyStepType,
        config: { ...(node.config ?? {}), label: node.labels ?? {} },
        next_step_key: node.next_step_key ?? null,
        true_step_key: node.true_step_key ?? null,
        false_step_key: node.false_step_key ?? null,
        is_entry: node.is_entry ?? false,
        pos_x: 40 + (index % 2) * 260,
        pos_y: 30 + index * 110,
      })),
    );
    this.selectedKey.set(null);
  }

  protected icon(type: JourneyStepType): string {
    return stepIcon(type);
  }

  protected label(step: JourneyStep): string {
    return localized(step.config['label'] as LocalizedText | undefined, this.locale()) || step.step_key;
  }

  protected edgeKinds(step: JourneyStep): JourneyEdgeKind[] {
    return edgeKindsOf(step.type);
  }

  protected targetOf(step: JourneyStep, kind: JourneyEdgeKind): string | null {
    return kind === 'next' ? step.next_step_key : kind === 'true' ? step.true_step_key : step.false_step_key;
  }

  protected otherSteps(key: string): JourneyStep[] {
    return this.steps().filter((step) => step.step_key !== key);
  }

  protected isBlocking(issue: string): boolean {
    return ['no_steps', 'entry_missing', 'unknown_step', 'condition_branches'].includes(issue);
  }

  protected conditionOf(step: JourneyStep): JourneyConditionType {
    return (step.config['type'] as JourneyConditionType | undefined) ?? 'clicked_not_ordered';
  }

  protected numberOf(step: JourneyStep, prop: string): number {
    const value = step.config[prop];
    return typeof value === 'number' ? value : 0;
  }

  protected stringOf(step: JourneyStep, prop: string): string {
    const value = step.config[prop];
    return typeof value === 'string' ? value : '';
  }

  protected textOf(step: JourneyStep, prop: string): string {
    return ((step.config[prop] as LocalizedText | undefined) ?? {})[this.locale()] ?? '';
  }

  protected waitSummary(step: JourneyStep): string {
    const days = this.numberOf(step, 'days');
    const hours = this.numberOf(step, 'hours');
    return [days > 0 ? `${days} d` : '', hours > 0 ? `${hours} h` : ''].filter(Boolean).join(' ') || '0';
  }

  protected edgeColor(kind: JourneyEdgeKind): string {
    return kind === 'true' ? '#52c41a' : kind === 'false' ? '#f5222d' : '#8c8c8c';
  }

  /** A cubic curve from the bottom of a card to the top of the next one. */
  protected path(from: string, to: string): string {
    const a = this.steps().find((step) => step.step_key === from);
    const b = this.steps().find((step) => step.step_key === to);
    if (!a || !b) {
      return '';
    }
    const x1 = a.pos_x + CARD_WIDTH / 2;
    const y1 = a.pos_y + CARD_HEIGHT;
    const x2 = b.pos_x + CARD_WIDTH / 2;
    const y2 = b.pos_y;
    const dy = Math.max(30, Math.abs(y2 - y1) / 2);
    return `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
  }

  // --- Editing ---

  protected addStep(type: JourneyStepType, position?: { x: number; y: number }): void {
    const step = newStep(type, this.steps(), position);
    this.steps.update((steps) => [...steps, step]);
    this.selectedKey.set(step.step_key);
  }

  protected deleteStep(key: string): void {
    this.steps.update((steps) => removeStep(steps, key));
    this.selectedKey.set(null);
  }

  protected makeEntry(key: string): void {
    this.steps.update((steps) => setEntry(steps, key));
  }

  protected link(from: string, kind: JourneyEdgeKind, to: string | null): void {
    this.steps.update((steps) => connect(steps, from, kind, to ?? null));
  }

  protected setConfig(key: string, prop: string, value: unknown): void {
    this.steps.update((steps) =>
      steps.map((step) => (step.step_key === key ? { ...step, config: { ...step.config, [prop]: value } } : step)),
    );
  }

  protected setText(key: string, prop: string, value: string): void {
    const locale = this.locale();
    this.steps.update((steps) =>
      steps.map((step) =>
        step.step_key === key
          ? { ...step, config: { ...step.config, [prop]: { ...((step.config[prop] as LocalizedText | undefined) ?? {}), [locale]: value } } }
          : step,
      ),
    );
  }

  // --- Drag and drop ---

  protected dragPalette(event: DragEvent, type: JourneyStepType): void {
    this.startDrag(event, { kind: 'palette', type });
  }

  protected dragStep(event: DragEvent, step: JourneyStep): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.startDrag(event, { kind: 'step', key: step.step_key, dx: event.clientX - rect.left, dy: event.clientY - rect.top });
  }

  protected dropOnCanvas(event: DragEvent): void {
    event.preventDefault();
    const raw = event.dataTransfer?.getData(DRAG_TYPE);
    if (!raw) {
      return;
    }
    const drag = JSON.parse(raw) as JourneyDrag;
    const canvas = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const scrollLeft = (event.currentTarget as HTMLElement).scrollLeft;
    const scrollTop = (event.currentTarget as HTMLElement).scrollTop;
    const x = Math.max(0, Math.round(event.clientX - canvas.left + scrollLeft - (drag.kind === 'step' ? drag.dx : CARD_WIDTH / 2)));
    const y = Math.max(0, Math.round(event.clientY - canvas.top + scrollTop - (drag.kind === 'step' ? drag.dy : CARD_HEIGHT / 2)));
    if (drag.kind === 'palette') {
      this.addStep(drag.type, { x, y });
    } else {
      this.steps.update((steps) => steps.map((step) => (step.step_key === drag.key ? { ...step, pos_x: x, pos_y: y } : step)));
    }
  }

  protected async save(): Promise<void> {
    const campaign = this.store.selectedCampaign();
    if (!campaign || this.blocking().length > 0) {
      return;
    }
    const saved = await this.store.saveJourney(campaign.id, this.steps());
    if (saved) {
      this.message.success(this.i18n.translate('marketing.journey.saved'));
    }
  }

  private startDrag(event: DragEvent, payload: JourneyDrag): void {
    event.dataTransfer?.setData(DRAG_TYPE, JSON.stringify(payload));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = payload.kind === 'step' ? 'move' : 'copy';
    }
  }
}
