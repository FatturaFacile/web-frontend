import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  BudgetAuditEvent,
  BudgetingApiService,
  BudgetOverride,
  OVERRIDE_SCOPES,
  OVERRIDE_STATUSES,
  OverrideScope,
  OverrideStatus,
  PermissionsService,
  SPEND_DOCUMENT_TYPES,
  SpendDocumentType,
  TranslateService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { BudgetingDimensionsComponent } from './budgeting-dimensions.component';
import { apiErrorText, blankToNull, OPTIONAL_UUID_PATTERN, OVERRIDE_STATUS_COLORS } from './budgeting.util';

export type OverrideDecision = 'approve' | 'reject' | 'cancel';

/** Override (deroga) requests against the spend lock: request, CFO decision with comment, cancellation and the history. */
@Component({
  selector: 'app-budgeting-overrides',
  styleUrl: './budgeting.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    BudgetingDimensionsComponent,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'PAGE_TITLE.BUDGETING_OVERRIDES' | translate" [subtitle]="'BUDGETING_CONTROL.OVERRIDES_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openRequest()">{{ 'BUDGETING_CONTROL.REQUEST_OVERRIDE' | translate }}</button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 220px" nzAllowClear [nzPlaceHolder]="'BUDGETING.STATUS' | translate" [ngModel]="status()" (ngModelChange)="status.set($event); load()">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('BUDGETING_CONTROL.OVERRIDE_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="overrides()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'BUDGETING_CONTROL.OVERRIDE_SCOPE' | translate }}</th>
            <th>{{ 'BUDGETING_CONTROL.NUMBER' | translate }}</th>
            <th class="num">{{ 'BUDGETING_CONTROL.REQUESTED' | translate }}</th>
            <th class="num">{{ 'BUDGETING_CONTROL.SHORTFALL' | translate }}</th>
            <th class="num">{{ 'BUDGETING_CONTROL.APPROVED_AMOUNT' | translate }}</th>
            <th>{{ 'BUDGETING_CONTROL.VALID_UNTIL' | translate }}</th>
            <th>{{ 'BUDGETING.STATUS' | translate }}</th>
            <th>{{ 'BUDGETING_CONTROL.REASON' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ ('BUDGETING_CONTROL.SCOPE_' + row.scope.toUpperCase()) | translate }}</td>
              <td>{{ row.source_number }}</td>
              <td class="num">{{ row.requested_amount | number: '1.2-2' }}</td>
              <td class="num">{{ row.shortfall_amount | number: '1.2-2' }}</td>
              <td class="num">{{ row.approved_amount !== null ? (row.approved_amount | number: '1.2-2') : '' }}</td>
              <td>{{ row.valid_until }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{ ('BUDGETING_CONTROL.OVERRIDE_' + row.status.toUpperCase()) | translate }}</nz-tag>
                @if (row.is_expired) {
                  <nz-tag>{{ 'BUDGETING_CONTROL.EXPIRED' | translate }}</nz-tag>
                }
              </td>
              <td>{{ row.reason }}</td>
              <td>
                <div class="row-actions">
                  @if (row.status === 'pending' && canDecide) {
                    <button nz-button nzType="text" (click)="openDecision(row, 'approve')">{{ 'BUDGETING_CONTROL.APPROVE' | translate }}</button>
                    <button nz-button nzType="text" nzDanger (click)="openDecision(row, 'reject')">{{ 'BUDGETING_CONTROL.REJECT' | translate }}</button>
                  }
                  @if (row.status === 'pending' || row.status === 'approved') {
                    <button nz-button nzType="text" (click)="openDecision(row, 'cancel')">{{ 'BUDGETING_CONTROL.CANCEL_OVERRIDE' | translate }}</button>
                  }
                  <button nz-button nzType="text" (click)="openHistory(row)">{{ 'BUDGETING_CONTROL.HISTORY' | translate }}</button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && overrides().length === 0) {
        <nz-empty [nzNotFoundContent]="'BUDGETING_CONTROL.NO_OVERRIDES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="requestVisible" [nzTitle]="'BUDGETING_CONTROL.REQUEST_OVERRIDE' | translate" (nzOnCancel)="requestVisible.set(false)" (nzOnOk)="saveRequest()" okAction="save" [nzOkDisabled]="requestForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="requestForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'BUDGETING_CONTROL.OVERRIDE_SCOPE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="scope">
                @for (scope of scopes; track scope) {
                  <nz-option [nzValue]="scope" [nzLabel]="('BUDGETING_CONTROL.SCOPE_' + scope.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (requestForm.controls.scope.value === 'document') {
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'BUDGETING_CONTROL.DOCUMENT_TYPE' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="source_type">
                    @for (type of documentTypes; track type) {
                      <nz-option [nzValue]="type" [nzLabel]="('BUDGETING_CONTROL.DOCUMENT_' + type.toUpperCase()) | translate"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="ovr-source">{{ 'BUDGETING_CONTROL.DOCUMENT_ID' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'BUDGETING_CONTROL.UUID_INVALID' | translate"><input nz-input id="ovr-source" formControlName="source_id" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="ovr-number">{{ 'BUDGETING_CONTROL.NUMBER' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="ovr-number" formControlName="source_number" maxlength="60" /></nz-form-control>
              </nz-form-item>
            </div>
          }
          <app-budgeting-dimensions [group]="requestForm" />
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ovr-amount">{{ 'BUDGETING_CONTROL.REQUESTED' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ovr-amount" type="number" min="0.01" step="any" formControlName="requested_amount" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ovr-until">{{ 'BUDGETING_CONTROL.VALID_UNTIL' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ovr-until" type="date" formControlName="valid_until" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ovr-reason">{{ 'BUDGETING_CONTROL.REASON' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="ovr-reason" rows="3" formControlName="reason" maxlength="2000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="decisionVisible" [nzTitle]="('BUDGETING_CONTROL.DECISION_' + decision().toUpperCase()) | translate" (nzOnCancel)="decisionVisible.set(false)" (nzOnOk)="saveDecision()" okAction="save" [nzOkDisabled]="decision() === 'reject' && !decisionForm.controls.comment.value.trim()">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="decisionForm" nzLayout="vertical">
          @if (decision() === 'approve') {
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzFor="dec-amount">{{ 'BUDGETING_CONTROL.APPROVED_AMOUNT' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="dec-amount" type="number" min="0.01" step="any" formControlName="approved_amount" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="dec-until">{{ 'BUDGETING_CONTROL.VALID_UNTIL' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="dec-until" type="date" formControlName="valid_until" /></nz-form-control>
              </nz-form-item>
            </div>
          }
          <nz-form-item>
            <nz-form-label [nzRequired]="decision() === 'reject'" nzFor="dec-comment">{{ 'BUDGETING.COMMENT' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="dec-comment" rows="3" formControlName="comment" maxlength="1000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="historyVisible" [nzTitle]="'BUDGETING_CONTROL.HISTORY' | translate" [nzFooter]="null" (nzOnCancel)="historyVisible.set(false)">
      <ng-container *nzModalContent>
        <nz-table #trail [nzData]="history()" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'BUDGETING.DATE' | translate }}</th>
              <th>{{ 'BUDGETING.ACTION' | translate }}</th>
              <th>{{ 'BUDGETING.COMMENT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (event of trail.data; track event.id) {
              <tr>
                <td>{{ event.created_at }}</td>
                <td>{{ ('BUDGETING_CONTROL.AUDIT_' + event.action.toUpperCase()) | translate }}</td>
                <td>{{ event.comment }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </ng-container>
    </nz-modal>
  `,
})
export class BudgetingOverridesComponent implements OnInit {
  private readonly api = inject(BudgetingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Owners, administrators and members granted budgeting.override.approve decide; everyone else only requests. */
  readonly canDecide = inject(PermissionsService).canWrite('budgeting_override');
  readonly statuses = OVERRIDE_STATUSES;
  readonly scopes = OVERRIDE_SCOPES;
  readonly documentTypes = SPEND_DOCUMENT_TYPES;

  readonly overrides = signal<BudgetOverride[]>([]);
  readonly loading = signal(false);
  readonly status = signal<OverrideStatus | null>(null);
  readonly requestVisible = signal(false);
  readonly decisionVisible = signal(false);
  readonly historyVisible = signal(false);
  readonly decision = signal<OverrideDecision>('approve');
  readonly selected = signal<BudgetOverride | null>(null);
  readonly history = signal<BudgetAuditEvent[]>([]);

  readonly requestForm = this.fb.group({
    scope: ['document' as OverrideScope, [Validators.required]],
    source_type: ['purchase_order' as SpendDocumentType],
    source_id: ['', [Validators.pattern(OPTIONAL_UUID_PATTERN)]],
    source_number: [''],
    account_id: this.fb.control<string | null>(null),
    cost_center_id: this.fb.control<string | null>(null),
    project_id: ['', [Validators.pattern(OPTIONAL_UUID_PATTERN)]],
    requested_amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    valid_until: [''],
    reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(2000)]],
  });

  readonly decisionForm = this.fb.group({
    comment: [''],
    approved_amount: this.fb.control<number | null>(null, [Validators.min(0.01)]),
    valid_until: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: OverrideStatus): string {
    return OVERRIDE_STATUS_COLORS[status] ?? 'default';
  }

  load(): void {
    this.loading.set(true);
    this.api.getOverrides({ status: this.status() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.overrides.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR'));
      },
    });
  }

  openRequest(): void {
    this.requestForm.reset({ scope: 'document', source_type: 'purchase_order', source_id: '', source_number: '', account_id: null, cost_center_id: null, project_id: '', requested_amount: null, valid_until: '', reason: '' });
    this.requestVisible.set(true);
  }

  saveRequest(): void {
    const value = this.requestForm.getRawValue();
    const document = value.scope === 'document';
    this.api
      .requestOverride({
        scope: value.scope,
        source_type: document ? value.source_type : null,
        source_id: document ? blankToNull(value.source_id) : null,
        source_number: document ? blankToNull(value.source_number) : null,
        account_id: value.account_id,
        cost_center_id: value.cost_center_id,
        project_id: blankToNull(value.project_id),
        requested_amount: String(value.requested_amount),
        reason: value.reason,
        valid_until: blankToNull(value.valid_until),
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('BUDGETING_CONTROL.OVERRIDE_REQUESTED'));
          this.requestVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
      });
  }

  openDecision(override: BudgetOverride, decision: OverrideDecision): void {
    this.selected.set(override);
    this.decision.set(decision);
    this.decisionForm.reset({ comment: '', approved_amount: null, valid_until: '' });
    this.decisionVisible.set(true);
  }

  saveDecision(): void {
    const override = this.selected();
    if (!override) {
      return;
    }

    const value = this.decisionForm.getRawValue();
    const comment = blankToNull(value.comment);
    const request = {
      approve: () => this.api.approveOverride(override.id, { comment, approved_amount: value.approved_amount === null ? null : String(value.approved_amount), valid_until: blankToNull(value.valid_until) }),
      reject: () => this.api.rejectOverride(override.id, { comment }),
      cancel: () => this.api.cancelOverride(override.id, { comment }),
    }[this.decision()]();

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING_CONTROL.OVERRIDE_DECIDED'));
        this.decisionVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  openHistory(override: BudgetOverride): void {
    this.history.set([]);
    this.historyVisible.set(true);
    this.api.getOverrideHistory(override.id).subscribe({
      next: (response) => this.history.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
