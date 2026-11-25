import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CS_RECOVERY_PRIORITIES,
  CS_RECOVERY_STATUSES,
  CsRecoveryCase,
  CsRecoveryPriority,
  CsRecoveryStatus,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  bandColor,
  churnColor,
  CsOutcome,
  CUSTOMER_SATISFACTION_MODULE,
  priorityColor,
  recoveryStatusColor,
  sentimentColor,
  slaCountdown,
} from './customer-satisfaction.util';
import { RecoveryStore } from './recovery.store';

/**
 * The closed-loop detractor recovery queue (NPS <= 6, CSAT <= 2, CES >= 5): the 24 hour SLA countdown, the churn risk badge,
 * the account manager and support lead, the CRM follow-up task and the workflow to resolution with the root cause.
 */
@Component({
  selector: 'app-cs-recovery',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [RecoveryStore],
  styleUrl: './customer-satisfaction.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.CUSTOMER_SATISFACTION_RECOVERY' | translate"
      [subtitle]="'customerSatisfaction.recovery.subtitle' | translate"
    ></app-page-header>

    <div class="toolbar">
      <label class="field" for="cs-r-status">
        <span>{{ 'customerSatisfaction.field.status' | translate }}</span>
        <nz-select
          nzId="cs-r-status"
          nzAllowClear
          [(ngModel)]="statusFilter"
          (ngModelChange)="reload()"
        >
          @for (status of statuses; track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'customerSatisfaction.recoveryStatus.' + status | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="cs-r-priority">
        <span>{{ 'customerSatisfaction.field.priority' | translate }}</span>
        <nz-select
          nzId="cs-r-priority"
          nzAllowClear
          [(ngModel)]="priorityFilter"
          (ngModelChange)="reload()"
        >
          @for (priority of priorities; track priority) {
            <nz-option
              [nzValue]="priority"
              [nzLabel]="'customerSatisfaction.priority.' + priority | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label
        nz-checkbox
        for="cs-r-open"
        nzId="cs-r-open"
        [(ngModel)]="openOnly"
        (ngModelChange)="reload()"
        >{{ 'customerSatisfaction.field.openOnly' | translate }}</label
      >
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="
          failure.errorKey ?? 'customerSatisfaction.error.generic' | translate: failure.params
        "
        [nzDescription]="failure.detail ?? undefined"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.cases()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '1100px' }"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'customerSatisfaction.field.customer' | translate }}</th>
            <th scope="col" class="num">{{ 'customerSatisfaction.field.score' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.priority' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.status' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.sla' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.churnRisk' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.owners' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (item of table.data; track item.id) {
            <tr [attr.data-test]="'case-' + item.id">
              <th scope="row">{{ item.customer_name ?? item.customer_id }}</th>
              <td class="num">
                @if (item.response; as response) {
                  <nz-tag [nzColor]="bandColor(response.normalized_band)">
                    {{ response.score }} ·
                    {{ 'customerSatisfaction.surveyType.' + response.survey_type | translate }}
                  </nz-tag>
                }
              </td>
              <td>
                <nz-tag [nzColor]="priorityColor(item.priority)">{{
                  'customerSatisfaction.priority.' + item.priority | translate
                }}</nz-tag>
              </td>
              <td>
                <nz-tag [nzColor]="recoveryStatusColor(item.status)">{{
                  'customerSatisfaction.recoveryStatus.' + item.status | translate
                }}</nz-tag>
              </td>
              <td>
                @if (countdown(item); as sla) {
                  <span class="sla" [class]="'sla ' + sla.level" data-test="sla">
                    @if (sla.level === 'breached') {
                      {{
                        'customerSatisfaction.sla.late'
                          | translate: { hours: sla.hours, minutes: sla.minutes }
                      }}
                    } @else {
                      {{
                        'customerSatisfaction.sla.left'
                          | translate: { hours: sla.hours, minutes: sla.minutes }
                      }}
                    }
                  </span>
                } @else {
                  <small class="muted">{{ item.sla_due_at | date: 'short' }}</small>
                }
              </td>
              <td>
                @if (item.new_churn_risk) {
                  <nz-tag [nzColor]="churnColor(item.new_churn_risk)">{{
                    'customerSatisfaction.churn.' + item.new_churn_risk | translate
                  }}</nz-tag>
                }
              </td>
              <td>
                {{ item.account_manager_name ?? '—' }}
                <small class="muted">{{ item.support_lead_name ?? '—' }}</small>
              </td>
              <td class="row-actions">
                <button nz-button nzSize="small" type="button" (click)="open(item)">
                  {{ 'customerSatisfaction.action.open' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.cases().length === 0) {
        <nz-empty [nzNotFoundContent]="'customerSatisfaction.empty.cases' | translate"></nz-empty>
      }
    </nz-spin>

    <nz-drawer
      [nzVisible]="selected() !== null"
      [nzWidth]="520"
      [nzTitle]="'customerSatisfaction.recovery.drawerTitle' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (selected(); as current) {
          <p>
            <strong>{{ current.customer_name ?? current.customer_id }}</strong>
            @if (current.response; as response) {
              <nz-tag [nzColor]="bandColor(response.normalized_band)">
                {{ response.score }} ·
                {{ 'customerSatisfaction.band.' + response.normalized_band | translate }}
              </nz-tag>
            }
          </p>
          @if (current.response?.comment_text; as comment) {
            <p class="comment" data-test="comment">{{ comment }}</p>
          }
          @if (current.response?.sentiment_label; as label) {
            <p>
              <nz-tag [nzColor]="sentimentColor(current.response?.sentiment_label ?? null)">{{
                'customerSatisfaction.sentiment.' + label | translate
              }}</nz-tag>
            </p>
          }
          <p>
            {{ 'customerSatisfaction.field.churnRisk' | translate }}:
            @if (current.churn_risk_updated) {
              <nz-tag [nzColor]="churnColor(current.previous_churn_risk)">{{
                'customerSatisfaction.churn.' + (current.previous_churn_risk ?? 'low') | translate
              }}</nz-tag>
              →
            }
            @if (current.new_churn_risk) {
              <nz-tag [nzColor]="churnColor(current.new_churn_risk)">{{
                'customerSatisfaction.churn.' + current.new_churn_risk | translate
              }}</nz-tag>
            } @else {
              —
            }
          </p>
          <p>
            {{ 'customerSatisfaction.field.crmTask' | translate }}:
            {{
              current.crm_task_id ? ('customerSatisfaction.field.crmTaskCreated' | translate) : '—'
            }}
          </p>

          @if (canWrite) {
            <h4 class="section-title">{{ 'customerSatisfaction.section.owners' | translate }}</h4>
            <div class="form-grid">
              <label class="field" for="cs-r-am">
                <span>{{ 'customerSatisfaction.field.accountManager' | translate }}</span>
                <nz-select nzId="cs-r-am" nzAllowClear [(ngModel)]="accountManagerId">
                  @for (member of store.lookups()?.members ?? []; track member.id) {
                    <nz-option [nzValue]="member.id" [nzLabel]="member.name"></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="cs-r-lead">
                <span>{{ 'customerSatisfaction.field.supportLead' | translate }}</span>
                <nz-select nzId="cs-r-lead" nzAllowClear [(ngModel)]="supportLeadId">
                  @for (member of store.lookups()?.members ?? []; track member.id) {
                    <nz-option [nzValue]="member.id" [nzLabel]="member.name"></nz-option>
                  }
                </nz-select>
              </label>
            </div>
            <p>
              <button
                nz-button
                type="button"
                data-test="assign"
                [nzLoading]="store.saving()"
                (click)="assign(current)"
              >
                {{ 'customerSatisfaction.action.assign' | translate }}
              </button>
            </p>

            @if (current.next_statuses.length > 0) {
              <h4 class="section-title">
                {{ 'customerSatisfaction.section.workflow' | translate }}
              </h4>
              <label class="field" for="cs-r-next">
                <span>{{ 'customerSatisfaction.field.nextStatus' | translate }}</span>
                <nz-select nzId="cs-r-next" [(ngModel)]="nextStatus" data-test="next-status">
                  @for (status of current.next_statuses; track status) {
                    <nz-option
                      [nzValue]="status"
                      [nzLabel]="'customerSatisfaction.recoveryStatus.' + status | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="cs-r-cause">
                <span>{{ 'customerSatisfaction.field.rootCause' | translate }}</span>
                <nz-select nzId="cs-r-cause" nzAllowClear [(ngModel)]="rootCause">
                  @for (cause of store.lookups()?.root_causes ?? []; track cause) {
                    <nz-option
                      [nzValue]="cause"
                      [nzLabel]="'customerSatisfaction.rootCause.' + cause | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="cs-r-summary">
                <span>{{ 'customerSatisfaction.field.resolutionSummary' | translate }}</span>
                <textarea
                  nz-input
                  id="cs-r-summary"
                  rows="4"
                  maxlength="4000"
                  [(ngModel)]="summary"
                ></textarea>
              </label>
              <p>
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  data-test="transition"
                  [nzLoading]="store.saving()"
                  (click)="transition(current)"
                >
                  {{ 'customerSatisfaction.action.updateCase' | translate }}
                </button>
              </p>
            }
          }
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class RecoveryComponent implements OnInit {
  protected readonly store = inject(RecoveryStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(CUSTOMER_SATISFACTION_MODULE);
  protected readonly statuses = CS_RECOVERY_STATUSES;
  protected readonly priorities = CS_RECOVERY_PRIORITIES;
  protected readonly bandColor = bandColor;
  protected readonly churnColor = churnColor;
  protected readonly priorityColor = priorityColor;
  protected readonly recoveryStatusColor = recoveryStatusColor;
  protected readonly sentimentColor = sentimentColor;

  protected statusFilter: CsRecoveryStatus | null = null;
  protected priorityFilter: CsRecoveryPriority | null = null;
  protected openOnly = true;

  protected readonly selected = signal<CsRecoveryCase | null>(null);
  protected readonly feedback = signal<CsOutcome | null>(null);
  /** Re-evaluates the SLA countdowns every minute. */
  private readonly now = signal(new Date());

  protected accountManagerId: string | null = null;
  protected supportLeadId: string | null = null;
  protected nextStatus: CsRecoveryStatus | null = null;
  protected rootCause: string | null = null;
  protected summary = '';

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit(): void {
    void this.store.loadLookups();
    void this.store.load();
  }

  protected countdown(item: CsRecoveryCase) {
    return slaCountdown(item.sla_due_at, this.now(), item.status, item.first_contacted_at);
  }

  protected reload(): void {
    void this.store.load({
      ...(this.statusFilter ? { status: this.statusFilter } : {}),
      ...(this.priorityFilter ? { priority: this.priorityFilter } : {}),
      ...(this.openOnly ? { open_only: true } : {}),
    });
  }

  protected open(item: CsRecoveryCase): void {
    this.selected.set(item);
    this.feedback.set(null);
    this.accountManagerId = item.assigned_account_manager_id;
    this.supportLeadId = item.assigned_support_lead_id;
    this.nextStatus = item.next_statuses[0] ?? null;
    this.rootCause = item.root_cause_code;
    this.summary = item.resolution_summary ?? '';
  }

  protected close(): void {
    this.selected.set(null);
  }

  /** The drawer shows the case as the queue holds it, so it follows the reload after every change. */
  private refreshSelected(id: string): void {
    this.selected.set(this.store.cases().find((item) => item.id === id) ?? null);
    const current = this.selected();
    if (current !== null) {
      this.nextStatus = current.next_statuses[0] ?? null;
    }
  }

  protected async assign(item: CsRecoveryCase): Promise<void> {
    const outcome = await this.store.assign(item.id, {
      assigned_account_manager_id: this.accountManagerId,
      assigned_support_lead_id: this.supportLeadId,
    });
    this.done(outcome, item.id);
  }

  protected async transition(item: CsRecoveryCase): Promise<void> {
    if (this.nextStatus === null) {
      return;
    }
    const outcome = await this.store.transition(item.id, {
      status: this.nextStatus,
      root_cause_code: this.rootCause,
      resolution_summary: this.summary.trim() || null,
    });
    this.done(outcome, item.id);
  }

  private done(outcome: CsOutcome, id: string): void {
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant('customerSatisfaction.message.saved'));
      this.refreshSelected(id);
    } else {
      this.feedback.set(outcome);
    }
  }
}
