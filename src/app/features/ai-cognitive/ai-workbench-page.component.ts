import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AiPayloadEditorComponent } from './ai-payload-editor.component';
import { AiSuggestion, SuggestionKind, SuggestionStatus } from './ai-cognitive.models';
import { AiWorkbenchStore } from './ai-workbench.store';
import {
  actionRoute,
  ALL_KINDS,
  bandColor,
  confidenceBand,
  entityRoute,
  isDraftKind,
  percent,
  priorityColor,
  STATUSES,
} from './ai-cognitive.utils';

/**
 * Cognitive Review Workbench: the queue of proposals on the left and, for the selected one, a split pane: the source text on
 * the left, the proposed ERP action with its confidence badges and the reasoning of the model on the right. The reviewer
 * approves as proposed, corrects a field and approves (Edit and Approve), or rejects with a reason that feeds the audit trail.
 */
@Component({
  selector: 'app-ai-workbench-page',
  styleUrl: './ai-cognitive.scss',
  imports: [
    DatePipe,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzSpinModule,
    NzTagModule,
    AiPayloadEditorComponent,
  ],
  template: `
    <app-page-header
      [title]="'AI_COG.WORKBENCH_TITLE' | translate"
      [subtitle]="'AI_COG.WORKBENCH_SUBTITLE' | translate"
    ></app-page-header>

    <div class="chip-row" data-testid="kind-chips">
      <button
        type="button"
        class="chip"
        data-testid="chip-all"
        [class.selected]="store.kindFilter() === null"
        [attr.aria-pressed]="store.kindFilter() === null"
        (click)="filterKind(null)"
      >
        {{ 'AI_COG.ALL_KINDS' | translate }} ({{ store.openTotal() }})
      </button>
      @for (kind of kinds; track kind) {
        <button
          type="button"
          class="chip"
          [attr.data-testid]="'chip-' + kind"
          [class.selected]="store.kindFilter() === kind"
          [attr.aria-pressed]="store.kindFilter() === kind"
          (click)="filterKind(kind)"
        >
          {{ 'AI_COG.KIND_' + kind.toUpperCase() | translate }} ({{
            store.meta()?.open_by_kind?.[kind] ?? 0
          }})
        </button>
      }
    </div>

    <div class="queue-layout">
      <nz-card [nzTitle]="'AI_COG.QUEUE' | translate" nzSize="small">
        <div class="chip-row">
          <button
            nz-button
            nzSize="small"
            type="button"
            data-testid="refresh"
            [nzLoading]="store.loading()"
            (click)="reload()"
          >
            {{ 'AI_COG.REFRESH' | translate }}
          </button>
          <button
            nz-button
            nzSize="small"
            type="button"
            data-testid="toggle-decided"
            [nzType]="store.statusFilter() === null ? 'default' : 'primary'"
            (click)="toggleDecided()"
          >
            {{ 'AI_COG.SHOW_DECIDED' | translate }}
          </button>
        </div>
        <nz-spin [nzSpinning]="store.loading()">
          @for (item of store.items(); track item.id) {
            <button
              type="button"
              class="queue-item"
              [class.selected]="store.selectedId() === item.id"
              [attr.data-testid]="'item-' + item.id"
              (click)="store.select(item.id)"
            >
              <strong>{{ 'AI_COG.KIND_' + item.kind.toUpperCase() | translate }}</strong>
              <div>
                <nz-tag [nzColor]="priorityColor(item.priority)">{{
                  'AI_COG.PRIORITY_' + item.priority.toUpperCase() | translate
                }}</nz-tag>
                <span class="pill" [attr.data-band]="band(item.confidence)">{{
                  percentOf(item.confidence)
                }}</span>
                @if (item.status !== 'pending') {
                  <nz-tag>{{ statusKey(item.status) | translate }}</nz-tag>
                }
              </div>
              <div class="muted">
                {{ 'AI_COG.SOURCE_' + item.source_type.toUpperCase() | translate }}
                @if (item.created_at) {
                  · {{ item.created_at | date: 'short' }}
                }
              </div>
            </button>
          } @empty {
            <nz-empty [nzNotFoundContent]="'AI_COG.EMPTY_QUEUE' | translate"></nz-empty>
          }
        </nz-spin>
      </nz-card>

      @if (store.selected(); as suggestion) {
        <div class="split-pane" data-testid="workbench">
          <nz-card [nzTitle]="'AI_COG.SOURCE' | translate" nzSize="small">
            @if (suggestion.source_text) {
              <pre class="source-text" data-testid="source-text">{{ suggestion.source_text }}</pre>
            } @else {
              <nz-empty [nzNotFoundContent]="'AI_COG.NO_SOURCE_TEXT' | translate"></nz-empty>
            }
            @if (suggestion.provider_used) {
              <p class="muted" data-testid="provenance">
                {{ 'AI_COG.PRODUCED_BY' | translate }}: {{ suggestion.provider_used }}
                @if (suggestion.model_used) {
                  / {{ suggestion.model_used }}
                }
              </p>
            }
          </nz-card>

          <nz-card [nzTitle]="'AI_COG.PROPOSED_ACTION' | translate" nzSize="small">
            <div>
              <nz-tag nzColor="blue">{{
                'AI_COG.KIND_' + suggestion.kind.toUpperCase() | translate
              }}</nz-tag>
              <span
                class="pill"
                data-testid="overall-confidence"
                [attr.data-band]="band(suggestion.confidence)"
                >{{ percentOf(suggestion.confidence) }}</span
              >
              <nz-tag>{{ statusKey(suggestion.status) | translate }}</nz-tag>
            </div>

            @if (suggestion.reasoning) {
              <p data-testid="reasoning">
                <strong>{{ 'AI_COG.REASONING' | translate }}:</strong> {{ suggestion.reasoning }}
              </p>
            }

            @if (store.draft(); as draft) {
              <app-ai-payload-editor
                [payload]="draft"
                [confidences]="suggestion.field_confidences"
                [readonly]="!store.canDecide() || !draftKind(suggestion)"
                (payloadChange)="store.setDraft($event)"
              ></app-ai-payload-editor>
            }

            @if (store.canDecide()) {
              <div class="decision-bar">
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  data-testid="approve"
                  [nzLoading]="store.busy()"
                  (click)="approve()"
                >
                  {{ approveKey(suggestion) | translate }}
                </button>
                @if (store.edited()) {
                  <button nz-button type="button" data-testid="reset" (click)="store.resetDraft()">
                    {{ 'AI_COG.RESET' | translate }}
                  </button>
                }
                <button
                  nz-button
                  nzDanger
                  type="button"
                  data-testid="reject-open"
                  (click)="rejecting.set(!rejecting())"
                >
                  {{ rejectKey(suggestion) | translate }}
                </button>
              </div>
              @if (rejecting()) {
                <div class="reject-panel" data-testid="reject-panel">
                  <label for="ai-reject-reason">{{ 'AI_COG.REJECT_REASON' | translate }}</label>
                  <textarea
                    nz-input
                    id="ai-reject-reason"
                    rows="2"
                    maxlength="1000"
                    data-testid="reject-reason"
                    [value]="reason()"
                    (input)="reason.set(textOf($event))"
                  ></textarea>
                  <button
                    nz-button
                    nzDanger
                    nzType="primary"
                    type="button"
                    data-testid="reject-confirm"
                    [disabled]="reason().trim().length < 3"
                    [nzLoading]="store.busy()"
                    (click)="reject()"
                  >
                    {{ 'AI_COG.REJECT_CONFIRM' | translate }}
                  </button>
                </div>
              }
            } @else {
              @if (suggestion.decision_feedback) {
                <p class="muted">{{ suggestion.decision_feedback }}</p>
              }
              @if (resultLink(suggestion); as link) {
                <a [routerLink]="link" data-testid="result-link">{{
                  'AI_COG.OPEN_RESULT' | translate
                }}</a>
              }
            }

            @if (actionLink(suggestion); as link) {
              <p>
                <a [routerLink]="link" data-testid="action-link">{{
                  'AI_COG.OPEN_SUBJECT' | translate
                }}</a>
              </p>
            }
          </nz-card>
        </div>
      } @else {
        <nz-empty
          data-testid="no-selection"
          [nzNotFoundContent]="'AI_COG.SELECT_SUGGESTION' | translate"
        ></nz-empty>
      }
    </div>
  `,
})
export class AiWorkbenchPageComponent implements OnInit {
  protected readonly store = inject(AiWorkbenchStore);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly kinds = ALL_KINDS;
  protected readonly rejecting = signal(false);
  protected readonly reason = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('suggestion');

    this.store.loadQueue().subscribe({
      next: () => {
        if (id !== null) {
          this.store.open(id).subscribe({ error: () => undefined });
        }
      },
      error: () => undefined,
    });
  }

  protected reload(): void {
    this.store.loadQueue().subscribe({ error: () => undefined });
  }

  protected filterKind(kind: SuggestionKind | null): void {
    this.store.setKindFilter(kind);
    this.reload();
  }

  /** Switches between the open queue and the decided items (approved, rejected, auto-approved). */
  protected toggleDecided(): void {
    const decided: SuggestionStatus | null = this.store.statusFilter() === null ? 'approved' : null;

    this.store.setStatusFilter(decided);
    this.reload();
  }

  protected approve(): void {
    this.store.approve().subscribe({
      next: () => {
        this.message.success(this.i18n.instant('AI_COG.APPROVED'));
        this.closeReject();
      },
      error: () => undefined,
    });
  }

  protected reject(): void {
    this.store.reject(this.reason().trim()).subscribe({
      next: () => {
        this.message.success(this.i18n.instant('AI_COG.REJECTED'));
        this.closeReject();
      },
      error: () => undefined,
    });
  }

  private closeReject(): void {
    this.rejecting.set(false);
    this.reason.set('');
  }

  protected textOf(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected draftKind(suggestion: AiSuggestion): boolean {
    return isDraftKind(suggestion.kind);
  }

  protected approveKey(suggestion: AiSuggestion): string {
    if (!isDraftKind(suggestion.kind)) {
      return 'AI_COG.ACKNOWLEDGE';
    }

    return this.store.edited() ? 'AI_COG.EDIT_AND_APPROVE' : 'AI_COG.APPROVE';
  }

  protected rejectKey(suggestion: AiSuggestion): string {
    return isDraftKind(suggestion.kind) ? 'AI_COG.REJECT' : 'AI_COG.DISMISS';
  }

  protected statusKey(status: SuggestionStatus): string {
    return `AI_COG.STATUS_${status.toUpperCase()}`;
  }

  protected band(score: number): string {
    return confidenceBand(score);
  }

  protected percentOf(score: number): string {
    return percent(score);
  }

  protected priorityColor = priorityColor;
  protected bandColor = bandColor;

  protected actionLink(suggestion: AiSuggestion): string | null {
    return actionRoute(suggestion);
  }

  protected resultLink(suggestion: AiSuggestion): string | null {
    return entityRoute(suggestion.resulting_entity_type, suggestion.resulting_entity_id);
  }

  protected readonly statuses = STATUSES;
}
