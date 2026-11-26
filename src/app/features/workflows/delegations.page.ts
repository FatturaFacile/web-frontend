import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminApiService,
  AuthStore,
  I18nService,
  PlatformUserRecord,
  WorkflowApiService,
  WorkflowDelegationModel,
  WorkflowSubjectType,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DELEGATION_SCOPES,
  DelegationDraft,
  delegationPayload,
  delegationProblem,
  EMPTY_DELEGATION,
} from './delegations.util';

/**
 * Approval delegations of the signed-in user (profile, Mod 006): hand the approvals over to a colleague for a period,
 * optionally limited to some document types and to an amount. The delegate must be someone else; the API refuses cycles.
 */
@Component({
  selector: 'app-delegations-page',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'workflows.delegations.title' | translate"></app-page-header>

    <nz-card [nzTitle]="'workflows.delegations.new' | translate">
      <div class="grid">
        <label class="inline" for="wf-del-user">
          {{ 'workflows.delegations.delegate' | translate }}
          <nz-select
            nzId="wf-del-user"
            id="wf-del-user"
            nzShowSearch
            nzServerSearch
            [ngModel]="draft().delegateUserId"
            (ngModelChange)="patch('delegateUserId', $event)"
            (nzOnSearch)="searchUsers($event)"
            [nzPlaceHolder]="'workflows.delegations.delegatePlaceholder' | translate"
            data-testid="delegate"
          >
            @for (user of users(); track user.id) {
              <nz-option [nzValue]="user.id" [nzLabel]="user.name"></nz-option>
            }
          </nz-select>
        </label>
        <label class="inline" for="wf-del-period">
          {{ 'workflows.delegations.period' | translate }}
          <nz-range-picker
            nzId="wf-del-period"
            id="wf-del-period"
            [ngModel]="draft().range"
            (ngModelChange)="patch('range', $event?.length === 2 ? $event : null)"
            [nzDisabledDate]="beforeToday"
            data-testid="period"
          ></nz-range-picker>
        </label>
        <label class="inline" for="wf-del-scope">
          {{ 'workflows.delegations.scope' | translate }}
          <nz-select nzId="wf-del-scope" id="wf-del-scope" [ngModel]="draft().scope" (ngModelChange)="patch('scope', $event)">
            @for (scope of scopes; track scope) {
              <nz-option [nzValue]="scope" [nzLabel]="'workflows.delegations.scope.' + scope | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="inline" for="wf-del-doctypes">
          {{ 'workflows.delegations.documentTypes' | translate }}
          <nz-select nzId="wf-del-doctypes" id="wf-del-doctypes" nzMode="multiple" [ngModel]="draft().documentTypes" (ngModelChange)="patch('documentTypes', $event)" [nzPlaceHolder]="'workflows.delegations.allDocumentTypes' | translate">
            @for (type of subjectTypes(); track type.code) {
              <nz-option [nzValue]="type.code" [nzLabel]="'workflows.subject_types.' + type.code | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="inline" for="wf-del-cap">
          {{ 'workflows.delegations.amountCap' | translate }}
          <nz-input-number nzId="wf-del-cap" id="wf-del-cap" [ngModel]="draft().amountCap" (ngModelChange)="patch('amountCap', $event ?? null)" [nzMin]="0"></nz-input-number>
        </label>
        <label class="inline wide" for="wf-del-reason">
          {{ 'workflows.delegations.reason' | translate }}
          <input id="wf-del-reason" nz-input maxlength="1000" [ngModel]="draft().reason" (ngModelChange)="patch('reason', $event)" />
        </label>
      </div>
      @if (problem(); as key) {
        <nz-alert class="gap" nzType="warning" nzShowIcon [nzMessage]="key | translate" data-testid="problem"></nz-alert>
      }
      <button nz-button nzType="primary" class="gap" [nzLoading]="saving()" (click)="create()" data-testid="create">
        {{ 'workflows.delegations.create' | translate }}
      </button>
    </nz-card>

    <nz-card [nzTitle]="'workflows.delegations.list' | translate" class="section">
      <nz-table #table [nzData]="delegations()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'workflows.delegations.delegate' | translate }}</th>
            <th>{{ 'workflows.delegations.period' | translate }}</th>
            <th>{{ 'workflows.delegations.scope' | translate }}</th>
            <th>{{ 'workflows.delegations.amountCap' | translate }}</th>
            <th>{{ 'workflows.delegations.status' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (item of table.data; track item.id) {
            <tr>
              <td>{{ item.delegate_user_name ?? item.delegate_user_id }}</td>
              <td>{{ item.starts_at | date: 'mediumDate' }} - {{ item.ends_at | date: 'mediumDate' }}</td>
              <td>
                {{ 'workflows.delegations.scope.' + (item.scope ?? 'all') | translate }}
                @for (code of item.document_types ?? []; track code) {
                  <nz-tag>{{ 'workflows.subject_types.' + code | translate }}</nz-tag>
                }
              </td>
              <td>{{ item.amount_cap ?? '-' }}</td>
              <td>
                <nz-tag [nzColor]="item.is_active ? 'green' : 'default'">
                  {{ (item.is_active ? 'workflows.delegations.active' : 'workflows.delegations.inactive') | translate }}
                </nz-tag>
              </td>
              <td>
                <button nz-button nzSize="small" nzDanger (click)="remove(item)">{{ 'workflows.delegations.remove' | translate }}</button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }
    .inline {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .gap {
      margin-top: 16px;
    }
    .section {
      margin-top: 16px;
      display: block;
    }
  `,
})
export class DelegationsPageComponent implements OnInit {
  private readonly api = inject(WorkflowApiService);
  private readonly adminApi = inject(AdminApiService);
  private readonly auth = inject(AuthStore);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  protected readonly scopes = DELEGATION_SCOPES;

  readonly draft = signal<DelegationDraft>({ ...EMPTY_DELEGATION });
  readonly delegations = signal<WorkflowDelegationModel[]>([]);
  readonly users = signal<PlatformUserRecord[]>([]);
  readonly subjectTypes = signal<WorkflowSubjectType[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  /** The problem found when the user tried to create (translation key or the message of the API). */
  readonly problem = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getSubjectTypes().subscribe({ next: (res) => this.subjectTypes.set(res.data), error: () => undefined });
    this.searchUsers('');
    this.load();
  }

  /** A delegation cannot start in the past: days before today are disabled in the picker. */
  protected readonly beforeToday = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date.getTime() < today.getTime();
  };

  patch<K extends keyof DelegationDraft>(key: K, value: DelegationDraft[K]): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
    if (this.problem() !== null) {
      this.problem.set(delegationProblem(this.draft(), this.auth.user()?.id));
    }
  }

  searchUsers(term: string): void {
    const own = this.auth.user()?.id;
    this.adminApi.listUsers(term ? { search: term, per_page: 20 } : { per_page: 20 }).subscribe({
      next: (res) => this.users.set(res.data.filter((user) => user.id !== own)),
      error: () => this.users.set([]),
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.getDelegations({ per_page: 50 }).subscribe({
      next: (res) => {
        this.delegations.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.i18n.translate('workflows.delegations.loadError'));
      },
    });
  }

  create(): void {
    const problem = delegationProblem(this.draft(), this.auth.user()?.id);
    this.problem.set(problem);
    if (problem) {
      return;
    }
    this.saving.set(true);
    this.api.createDelegation(delegationPayload(this.draft())).subscribe({
      next: () => {
        this.saving.set(false);
        this.draft.set({ ...EMPTY_DELEGATION });
        this.message.success(this.i18n.translate('workflows.delegations.created'));
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        // 422 explains why (for example a delegation cycle A -> B -> C -> A) in the user's language.
        const detail = error instanceof HttpErrorResponse && error.status === 422 ? error.error?.message : null;
        this.problem.set(typeof detail === 'string' && detail !== '' ? detail : 'workflows.delegations.error.generic');
      },
    });
  }

  remove(item: WorkflowDelegationModel): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('workflows.delegations.removeConfirm'),
      nzOkText: this.i18n.translate('workflows.delegations.remove'),
      nzOkDanger: true,
      nzCancelText: this.i18n.translate('workflows.decision.cancel'),
      nzOnOk: () =>
        new Promise<void>((resolve) => {
          this.api.deleteDelegation(item.id).subscribe({
            next: () => {
              this.load();
              resolve();
            },
            error: () => {
              this.message.error(this.i18n.translate('workflows.delegations.error.generic'));
              resolve();
            },
          });
        }),
    });
  }
}
