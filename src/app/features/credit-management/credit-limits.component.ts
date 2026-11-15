import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CREDIT_LIMIT_REQUEST_STATUSES,
  CreditExposure,
  CreditLimitProposal,
  CreditLimitRequest,
  CreditManagementApiService,
  CrmApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, CreditCustomerOption, decimalOrNull, loadCustomers, statusColor } from './credit.util';

type LimitDialog = 'request' | 'approve' | 'reject' | null;

/** Credit limit requests with the automatic proposal, the exposure of the customer and the approval. */
@Component({
  selector: 'app-credit-limits',
  styleUrl: './credit-management.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'CREDIT.LIMITS_TITLE' | translate" [subtitle]="'CREDIT.LIMITS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openRequest()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="status()" (ngModelChange)="status.set($event); load()" [nzPlaceHolder]="'CREDIT.STATUS' | translate">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('CREDIT.REQUEST_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="requests()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'CREDIT.CUSTOMER' | translate }}</th>
            <th class="num">{{ 'CREDIT.CURRENT_LIMIT' | translate }}</th>
            <th class="num">{{ 'CREDIT.REQUESTED_LIMIT' | translate }}</th>
            <th class="num">{{ 'CREDIT.PROPOSED_LIMIT' | translate }}</th>
            <th class="num">{{ 'CREDIT.APPROVED_LIMIT' | translate }}</th>
            <th>{{ 'CREDIT.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.customer_name }}</td>
              <td class="num">{{ +row.current_limit | number: '1.2-2' }}</td>
              <td class="num">{{ row.requested_limit === null ? '-' : (+row.requested_limit | number: '1.2-2') }}</td>
              <td class="num">{{ row.proposed_limit === null ? '-' : (+row.proposed_limit | number: '1.2-2') }}</td>
              <td class="num">{{ row.approved_limit === null ? '-' : (+row.approved_limit | number: '1.2-2') }}</td>
              <td><nz-tag [nzColor]="color(row.status)">{{ ('CREDIT.REQUEST_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td>
                @if (row.status === 'pending') {
                  <div class="row-actions">
                    <button nz-button nzSize="small" nzType="primary" (click)="openDecision(row, 'approve')">{{ 'CREDIT.APPROVE' | translate }}</button>
                    <button nz-button nzSize="small" nzDanger (click)="openDecision(row, 'reject')">{{ 'CREDIT.REJECT' | translate }}</button>
                    <button nz-button nzSize="small" nz-popconfirm [nzPopconfirmTitle]="'CREDIT.CANCEL_CONFIRM' | translate" (nzOnConfirm)="cancel(row)">{{ 'CREDIT.CANCEL' | translate }}</button>
                  </div>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && requests().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_LIMIT_REQUESTS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [nzVisible]="dialog() === 'request'" [nzTitle]="'CREDIT.NEW_LIMIT_REQUEST' | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="saveRequest()" okAction="save" [nzOkDisabled]="requestForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="requestForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'CREDIT.CUSTOMER' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="customer_id" nzShowSearch>
                @for (customer of customers(); track customer.id) {
                  <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (proposal(); as p) {
            <p class="muted">{{ 'CREDIT.PROPOSAL_HINT' | translate: { limit: ((+p.proposed_limit | number: '1.2-2') ?? ''), rating: p.rating } }}</p>
          }
          @if (exposure(); as e) {
            <p class="muted">{{ 'CREDIT.EXPOSURE_HINT' | translate: { exposure: ((+e.exposure | number: '1.2-2') ?? ''), limit: ((+e.credit_limit | number: '1.2-2') ?? '') } }}</p>
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="limit-requested">{{ 'CREDIT.REQUESTED_LIMIT' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'CREDIT.REQUESTED_LIMIT_HINT' | translate">
                <input nz-input id="limit-requested" type="number" min="0" step="any" formControlName="requested_limit" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="limit-currency">{{ 'CREDIT.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="limit-currency" formControlName="currency" maxlength="3" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="limit-valid">{{ 'CREDIT.VALID_UNTIL' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="limit-valid" type="date" formControlName="valid_until" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="limit-reason">{{ 'CREDIT.REASON' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="limit-reason" rows="2" maxlength="2000" formControlName="reason"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="dialog() === 'approve' || dialog() === 'reject'" [nzTitle]="(dialog() === 'approve' ? 'CREDIT.APPROVE' : 'CREDIT.REJECT') | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="saveDecision()" okAction="save" [nzOkDisabled]="decisionForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="decisionForm" nzLayout="vertical">
          @if (dialog() === 'approve') {
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzFor="decision-limit">{{ 'CREDIT.APPROVED_LIMIT' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="decision-limit" type="number" min="0" step="any" formControlName="approved_limit" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="decision-valid">{{ 'CREDIT.VALID_UNTIL' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="decision-valid" type="date" formControlName="valid_until" /></nz-form-control>
              </nz-form-item>
            </div>
          }
          <nz-form-item>
            <nz-form-label [nzRequired]="dialog() === 'reject'" nzFor="decision-note">{{ 'CREDIT.DECISION_NOTE' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="decision-note" rows="2" maxlength="2000" formControlName="decision_note"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class CreditLimitsComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = CREDIT_LIMIT_REQUEST_STATUSES;
  readonly requests = signal<CreditLimitRequest[]>([]);
  readonly customers = signal<CreditCustomerOption[]>([]);
  readonly loading = signal(false);
  readonly status = signal<string | null>(null);
  readonly dialog = signal<LimitDialog>(null);
  readonly deciding = signal<CreditLimitRequest | null>(null);
  readonly proposal = signal<CreditLimitProposal | null>(null);
  readonly exposure = signal<CreditExposure | null>(null);

  readonly requestForm = this.fb.group({
    customer_id: ['', [Validators.required]],
    requested_limit: this.fb.control<number | null>(null, [Validators.min(0)]),
    currency: ['EUR', [Validators.minLength(3), Validators.maxLength(3)]],
    valid_until: [''],
    reason: [''],
  });

  readonly decisionForm = this.fb.group({
    approved_limit: this.fb.control<number | null>(null, [Validators.min(0)]),
    valid_until: [''],
    decision_note: [''],
  });

  constructor() {
    this.requestForm.controls.customer_id.valueChanges.pipe(takeUntilDestroyed()).subscribe((customerId) => this.onCustomerChange(customerId));
  }

  ngOnInit(): void {
    this.load();
    loadCustomers(this.crm).subscribe((customers) => this.customers.set(customers));
  }

  color(status: string): string {
    return statusColor(status);
  }

  load(): void {
    this.loading.set(true);
    this.api.getLimitRequests(this.status() ?? undefined).subscribe({
      next: (response) => {
        this.requests.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
  }

  openRequest(): void {
    this.requestForm.reset({ customer_id: '', requested_limit: null, currency: 'EUR', valid_until: '', reason: '' });
    this.proposal.set(null);
    this.exposure.set(null);
    this.dialog.set('request');
  }

  /** The automatic proposal and the current exposure help to ask a realistic amount; both are optional hints. */
  private onCustomerChange(customerId: string): void {
    this.proposal.set(null);
    this.exposure.set(null);
    if (!customerId) {
      return;
    }
    this.api.getLimitProposal(customerId).subscribe({ next: (response) => this.proposal.set(response.data), error: () => undefined });
    this.api.getExposure(customerId).subscribe({ next: (response) => this.exposure.set(response.data), error: () => undefined });
  }

  saveRequest(): void {
    const value = this.requestForm.getRawValue();
    this.api
      .createLimitRequest({
        customer_id: value.customer_id,
        requested_limit: decimalOrNull(value.requested_limit),
        currency: blankToNull(value.currency)?.toUpperCase() ?? null,
        reason: blankToNull(value.reason),
        valid_until: blankToNull(value.valid_until),
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CREDIT.LIMIT_REQUEST_SAVED'));
          this.dialog.set(null);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR')),
      });
  }

  openDecision(request: CreditLimitRequest, kind: 'approve' | 'reject'): void {
    this.deciding.set(request);
    const suggested = request.proposed_limit ?? request.requested_limit;
    this.decisionForm.reset({ approved_limit: suggested === null ? null : Number(suggested), valid_until: '', decision_note: '' });
    this.dialog.set(kind);
  }

  saveDecision(): void {
    const request = this.deciding();
    if (!request) {
      return;
    }
    const value = this.decisionForm.getRawValue();
    const note = blankToNull(value.decision_note);
    if (this.dialog() === 'reject' && note === null) {
      this.message.error(this.translate.instant('CREDIT.DECISION_NOTE_REQUIRED'));
      return;
    }
    const call =
      this.dialog() === 'approve'
        ? this.api.approveLimitRequest(request.id, { approved_limit: decimalOrNull(value.approved_limit), decision_note: note, valid_until: blankToNull(value.valid_until) })
        : this.api.rejectLimitRequest(request.id, { decision_note: note ?? '' });

    call.subscribe({
      next: () => {
        this.message.success(this.translate.instant('CREDIT.DECISION_SAVED'));
        this.dialog.set(null);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR')),
    });
  }

  cancel(request: CreditLimitRequest): void {
    this.api.cancelLimitRequest(request.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CREDIT.DECISION_SAVED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR')),
    });
  }
}
