import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
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
  COLLECTION_ACTION_TYPES,
  COLLECTION_CASE_OUTCOMES,
  COLLECTION_CASE_PRIORITIES,
  COLLECTION_PROMISE_OUTCOMES,
  CollectionActionRequest,
  CollectionCase,
  CollectionCaseOutcome,
  CollectionCasePriority,
  CollectionPromise,
  CollectionPromiseOutcome,
  CREDIT_DISPUTE_REASONS,
  CreditDispute,
  CreditDisputeOutcome,
  CreditDisputeReason,
  CreditManagementApiService,
  SettingsApiService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, CreditCollectorOption, decimalOrNull, loadCollectors, statusColor, todayIso } from './credit.util';

type CaseDialog = 'action' | 'assign' | 'edit' | 'promise' | 'promiseResolve' | 'dispute' | 'disputeResolve' | 'close' | null;

/** One collection case: invoices, dunning actions, promises to pay and disputes. */
@Component({
  selector: 'app-credit-case-detail',
  styleUrl: './credit-management.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
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
    @if (caseData(); as data) {
      <app-page-header [title]="data.case_number" [subtitle]="data.customer_name ?? ''">
        <a nz-button routerLink="/credit-management/cases">{{ 'CREDIT.BACK_TO_CASES' | translate }}</a>
        @if (!isClosed()) {
          <button nz-button nz-popconfirm [nzPopconfirmTitle]="'CREDIT.ADVANCE_CONFIRM' | translate" (nzOnConfirm)="advance()">{{ 'CREDIT.ADVANCE' | translate }}</button>
          <button nz-button (click)="refresh()">{{ 'CREDIT.REFRESH' | translate }}</button>
          <button nz-button (click)="openAssign()">{{ 'CREDIT.ASSIGN_COLLECTOR' | translate }}</button>
          <button nz-button (click)="openEdit()">{{ 'CREDIT.EDIT_CASE' | translate }}</button>
          <button nz-button (click)="openDialog('action')">{{ 'CREDIT.RECORD_ACTION' | translate }}</button>
          <button nz-button (click)="openDialog('promise')">{{ 'CREDIT.ADD_PROMISE' | translate }}</button>
          <button nz-button (click)="openDialog('dispute')">{{ 'CREDIT.OPEN_DISPUTE' | translate }}</button>
          <button nz-button nzType="primary" (click)="openDialog('close')">{{ 'CREDIT.CLOSE_CASE' | translate }}</button>
        }
      </app-page-header>

      <nz-card class="main-card">
        <div class="form-row">
          <div><span class="muted">{{ 'CREDIT.OUTSTANDING' | translate }}</span><br />{{ +data.outstanding_amount | number: '1.2-2' }} {{ data.currency }}</div>
          <div><span class="muted">{{ 'CREDIT.OPENED_ON' | translate }}</span><br />{{ data.opened_on }}</div>
          <div><span class="muted">{{ 'CREDIT.NEXT_ACTION_ON' | translate }}</span><br />{{ data.next_action_on ?? '-' }}</div>
          <div><span class="muted">{{ 'CREDIT.DUNNING_STRATEGY' | translate }}</span><br />{{ data.strategy?.name ?? '-' }}</div>
          <div><span class="muted">{{ 'CREDIT.CURRENT_STEP' | translate }}</span><br />{{ data.current_step_order }}</div>
          <div><span class="muted">{{ 'CREDIT.COLLECTOR' | translate }}</span><br />{{ collectorName(data.collector_id) }}</div>
          <div><span class="muted">{{ 'CREDIT.PRIORITY' | translate }}</span><br /><nz-tag [nzColor]="color(data.priority)">{{ ('CREDIT.PRIORITY_' + data.priority.toUpperCase()) | translate }}</nz-tag></div>
          <div><span class="muted">{{ 'CREDIT.STATUS' | translate }}</span><br /><nz-tag [nzColor]="color(data.status)">{{ ('CREDIT.CASE_STATUS_' + data.status.toUpperCase()) | translate }}</nz-tag></div>
        </div>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'CREDIT.INVOICES' | translate">
        <nz-table [nzData]="data.invoices ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'CREDIT.INVOICE_NUMBER' | translate }}</th>
              <th>{{ 'CREDIT.DUE_ON' | translate }}</th>
              <th class="num">{{ 'CREDIT.OUTSTANDING' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of data.invoices ?? []; track row.id) {
              <tr>
                <td>{{ row.invoice_number }}</td>
                <td>{{ row.due_on }}</td>
                <td class="num">{{ +row.outstanding_amount | number: '1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'CREDIT.ACTIONS' | translate">
        <nz-table [nzData]="data.actions ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'CREDIT.PERFORMED_ON' | translate }}</th>
              <th>{{ 'CREDIT.ACTION_TYPE' | translate }}</th>
              <th>{{ 'CREDIT.CHANNEL' | translate }}</th>
              <th class="num">{{ 'CREDIT.FEE' | translate }}</th>
              <th>{{ 'CREDIT.OUTCOME' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of data.actions ?? []; track row.id) {
              <tr>
                <td>{{ row.performed_on }}</td>
                <td>{{ ('CREDIT.ACTION_' + row.action_type.toUpperCase()) | translate }}</td>
                <td>{{ row.channel }}</td>
                <td class="num">{{ row.fee_amount === null ? '-' : (+row.fee_amount | number: '1.2-2') }}</td>
                <td>{{ row.outcome }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'CREDIT.PROMISES' | translate">
        <nz-table [nzData]="data.promises ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'CREDIT.PROMISED_ON' | translate }}</th>
              <th class="num">{{ 'CREDIT.PROMISED_AMOUNT' | translate }}</th>
              <th class="num">{{ 'CREDIT.PAID_AMOUNT' | translate }}</th>
              <th>{{ 'CREDIT.STATUS' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of data.promises ?? []; track row.id) {
              <tr>
                <td>{{ row.promised_on }}</td>
                <td class="num">{{ +row.promised_amount | number: '1.2-2' }}</td>
                <td class="num">{{ row.paid_amount === null ? '-' : (+row.paid_amount | number: '1.2-2') }}</td>
                <td><nz-tag [nzColor]="color(row.status)">{{ ('CREDIT.PROMISE_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
                <td>
                  @if (row.status === 'pending') {
                    <button nz-button nzSize="small" (click)="openPromiseResolve(row)">{{ 'CREDIT.RESOLVE' | translate }}</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'CREDIT.DISPUTES' | translate">
        <nz-table [nzData]="data.disputes ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'CREDIT.OPENED_ON' | translate }}</th>
              <th>{{ 'CREDIT.REASON' | translate }}</th>
              <th class="num">{{ 'CREDIT.DISPUTED_AMOUNT' | translate }}</th>
              <th>{{ 'CREDIT.STATUS' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of data.disputes ?? []; track row.id) {
              <tr>
                <td>{{ row.opened_on }}</td>
                <td>{{ ('CREDIT.REASON_' + row.reason_code.toUpperCase()) | translate }}</td>
                <td class="num">{{ +row.disputed_amount | number: '1.2-2' }}</td>
                <td><nz-tag [nzColor]="color(row.status)">{{ ('CREDIT.DISPUTE_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
                <td>
                  <div class="row-actions">
                    @if (row.status === 'open') {
                      <button nz-button nzSize="small" (click)="reviewDispute(row)">{{ 'CREDIT.START_REVIEW' | translate }}</button>
                    }
                    @if (row.status === 'open' || row.status === 'under_review') {
                      <button nz-button nzSize="small" nzType="primary" (click)="openDisputeResolve(row)">{{ 'CREDIT.RESOLVE' | translate }}</button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    } @else if (!loading()) {
      <nz-empty [nzNotFoundContent]="'CREDIT.NO_DATA' | translate"></nz-empty>
    }

    <nz-modal [nzVisible]="dialog() === 'assign'" [nzTitle]="'CREDIT.ASSIGN_COLLECTOR' | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="saveAssign()" okAction="save">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="assignForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label>{{ 'CREDIT.COLLECTOR' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="collector_id" nzAllowClear nzShowSearch [nzPlaceHolder]="'CREDIT.UNASSIGNED' | translate">
                @for (collector of collectors(); track collector.id) {
                  <nz-option [nzValue]="collector.id" [nzLabel]="collector.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="dialog() === 'edit'" [nzTitle]="'CREDIT.EDIT_CASE' | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="saveEdit()" okAction="save" [nzOkDisabled]="editForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="editForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'CREDIT.PRIORITY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="priority">
                  @for (value of priorities; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('CREDIT.PRIORITY_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="case-next-action">{{ 'CREDIT.NEXT_ACTION_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="case-next-action" type="date" formControlName="next_action_on" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="case-edit-notes">{{ 'CREDIT.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="case-edit-notes" rows="3" maxlength="2000" formControlName="notes"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="dialog() === 'action'" [nzTitle]="'CREDIT.RECORD_ACTION' | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="saveAction()" okAction="save" [nzOkDisabled]="actionForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="actionForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'CREDIT.ACTION_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="action_type">
                  @for (type of actionTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="('CREDIT.ACTION_' + type.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="action-date">{{ 'CREDIT.PERFORMED_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="action-date" type="date" formControlName="performed_on" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="action-channel">{{ 'CREDIT.CHANNEL' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="action-channel" formControlName="channel" maxlength="30" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="action-outcome">{{ 'CREDIT.OUTCOME' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="action-outcome" rows="2" maxlength="2000" formControlName="outcome"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="dialog() === 'promise'" [nzTitle]="'CREDIT.ADD_PROMISE' | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="savePromise()" okAction="save" [nzOkDisabled]="promiseForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="promiseForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="promise-date">{{ 'CREDIT.PROMISED_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="promise-date" type="date" formControlName="promised_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="promise-amount">{{ 'CREDIT.PROMISED_AMOUNT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="promise-amount" type="number" min="0.01" step="any" formControlName="promised_amount" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="promise-notes">{{ 'CREDIT.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="promise-notes" rows="2" maxlength="2000" formControlName="notes"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="dialog() === 'promiseResolve'" [nzTitle]="'CREDIT.RESOLVE' | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="savePromiseResolve()" okAction="save" [nzOkDisabled]="promiseResolveForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="promiseResolveForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'CREDIT.OUTCOME' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="outcome">
                @for (value of promiseOutcomes; track value) {
                  <nz-option [nzValue]="value" [nzLabel]="('CREDIT.PROMISE_' + value.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="promise-paid">{{ 'CREDIT.PAID_AMOUNT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="promise-paid" type="number" min="0" step="any" formControlName="paid_amount" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="promise-resolved">{{ 'CREDIT.RESOLVED_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="promise-resolved" type="date" formControlName="resolved_on" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="dialog() === 'dispute'" [nzTitle]="'CREDIT.OPEN_DISPUTE' | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="saveDispute()" okAction="save" [nzOkDisabled]="disputeForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="disputeForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'CREDIT.REASON' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="reason_code">
                  @for (value of disputeReasons; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('CREDIT.REASON_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="dispute-amount">{{ 'CREDIT.DISPUTED_AMOUNT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="dispute-amount" type="number" min="0.01" step="any" formControlName="disputed_amount" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="dispute-description">{{ 'CREDIT.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="dispute-description" rows="3" maxlength="2000" formControlName="description"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="dialog() === 'disputeResolve'" [nzTitle]="'CREDIT.RESOLVE' | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="saveDisputeResolve()" okAction="save" [nzOkDisabled]="disputeResolveForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="disputeResolveForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'CREDIT.OUTCOME' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="outcome">
                <nz-option nzValue="upheld" [nzLabel]="'CREDIT.DISPUTE_UPHELD' | translate"></nz-option>
                <nz-option nzValue="rejected" [nzLabel]="'CREDIT.DISPUTE_REJECTED' | translate"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="dispute-credited">{{ 'CREDIT.CREDITED_AMOUNT' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="dispute-credited" type="number" min="0" step="any" formControlName="credited_amount" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="dispute-note">{{ 'CREDIT.RESOLUTION_NOTE' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="dispute-note" rows="3" maxlength="2000" formControlName="resolution_note"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="dialog() === 'close'" [nzTitle]="'CREDIT.CLOSE_CASE' | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="saveClose()" okAction="save" [nzOkDisabled]="closeForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="closeForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'CREDIT.OUTCOME' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="outcome">
                @for (value of closeOutcomes; track value) {
                  <nz-option [nzValue]="value" [nzLabel]="('CREDIT.CASE_STATUS_' + value.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="close-note">{{ 'CREDIT.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="close-note" rows="2" maxlength="2000" formControlName="note"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class CreditCaseDetailComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly settings = inject(SettingsApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly actionTypes = COLLECTION_ACTION_TYPES;
  readonly promiseOutcomes = COLLECTION_PROMISE_OUTCOMES;
  readonly disputeReasons = CREDIT_DISPUTE_REASONS;
  readonly closeOutcomes = COLLECTION_CASE_OUTCOMES;
  readonly priorities = COLLECTION_CASE_PRIORITIES;
  readonly collectors = signal<CreditCollectorOption[]>([]);
  readonly caseData = signal<CollectionCase | null>(null);
  readonly loading = signal(false);
  readonly dialog = signal<CaseDialog>(null);
  readonly resolvingPromise = signal<CollectionPromise | null>(null);
  readonly resolvingDispute = signal<CreditDispute | null>(null);

  readonly actionForm = this.fb.group({
    action_type: ['call' as CollectionActionRequest['action_type'], [Validators.required]],
    channel: [''],
    performed_on: [todayIso()],
    outcome: [''],
  });

  readonly promiseForm = this.fb.group({
    promised_on: [todayIso(), [Validators.required]],
    promised_amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    notes: [''],
  });

  readonly promiseResolveForm = this.fb.group({
    outcome: ['kept' as CollectionPromiseOutcome, [Validators.required]],
    paid_amount: this.fb.control<number | null>(null, [Validators.min(0)]),
    resolved_on: [todayIso()],
  });

  readonly disputeForm = this.fb.group({
    reason_code: ['other' as CreditDisputeReason, [Validators.required]],
    disputed_amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    description: [''],
  });

  readonly disputeResolveForm = this.fb.group({
    outcome: ['upheld' as CreditDisputeOutcome, [Validators.required]],
    credited_amount: this.fb.control<number | null>(null, [Validators.min(0)]),
    resolution_note: [''],
  });

  readonly assignForm = this.fb.group({
    collector_id: this.fb.control<string | null>(null),
  });

  readonly editForm = this.fb.group({
    priority: ['normal' as CollectionCasePriority, [Validators.required]],
    next_action_on: [''],
    notes: ['', [Validators.maxLength(2000)]],
  });

  readonly closeForm = this.fb.group({
    outcome: ['resolved' as CollectionCaseOutcome, [Validators.required]],
    note: [''],
  });

  private get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    this.load();
    loadCollectors(this.settings).subscribe((collectors) => this.collectors.set(collectors));
  }

  collectorName(collectorId: string | null): string {
    return collectorId === null ? this.translate.instant('CREDIT.UNASSIGNED') : (this.collectors().find((collector) => collector.id === collectorId)?.name ?? collectorId);
  }

  color(status: string): string {
    return statusColor(status);
  }

  isClosed(): boolean {
    const status = this.caseData()?.status;
    return status === 'resolved' || status === 'written_off';
  }

  load(): void {
    this.loading.set(true);
    this.api.getCase(this.id).subscribe({
      next: (response) => {
        this.caseData.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
  }

  openDialog(dialog: CaseDialog): void {
    this.dialog.set(dialog);
  }

  advance(): void {
    this.run(this.api.advanceCase(this.id, null), 'CREDIT.STEP_ADVANCED');
  }

  refresh(): void {
    this.run(this.api.refreshCase(this.id), 'CREDIT.CASE_REFRESHED');
  }

  openAssign(): void {
    this.assignForm.reset({ collector_id: this.caseData()?.collector_id ?? null });
    this.dialog.set('assign');
  }

  saveAssign(): void {
    this.run(this.api.assignCase(this.id, this.assignForm.getRawValue().collector_id), 'CREDIT.CASE_SAVED');
  }

  openEdit(): void {
    const data = this.caseData();
    this.editForm.reset({ priority: data?.priority ?? 'normal', next_action_on: data?.next_action_on ?? '', notes: data?.notes ?? '' });
    this.dialog.set('edit');
  }

  saveEdit(): void {
    const value = this.editForm.getRawValue();
    this.run(this.api.updateCase(this.id, { priority: value.priority, next_action_on: blankToNull(value.next_action_on), notes: blankToNull(value.notes) }), 'CREDIT.CASE_SAVED');
  }

  saveAction(): void {
    const value = this.actionForm.getRawValue();
    this.run(
      this.api.recordAction(this.id, { action_type: value.action_type, channel: blankToNull(value.channel), performed_on: blankToNull(value.performed_on), outcome: blankToNull(value.outcome) }),
      'CREDIT.ACTION_SAVED',
    );
  }

  savePromise(): void {
    const value = this.promiseForm.getRawValue();
    this.run(this.api.createPromise({ case_id: this.id, promised_amount: String(value.promised_amount), promised_on: value.promised_on, notes: blankToNull(value.notes) }), 'CREDIT.PROMISE_SAVED');
  }

  openPromiseResolve(promise: CollectionPromise): void {
    this.resolvingPromise.set(promise);
    this.promiseResolveForm.reset({ outcome: 'kept', paid_amount: Number(promise.promised_amount), resolved_on: todayIso() });
    this.dialog.set('promiseResolve');
  }

  savePromiseResolve(): void {
    const promise = this.resolvingPromise();
    if (!promise) {
      return;
    }
    const value = this.promiseResolveForm.getRawValue();
    this.run(this.api.resolvePromise(promise.id, { outcome: value.outcome, paid_amount: decimalOrNull(value.paid_amount), resolved_on: blankToNull(value.resolved_on) }), 'CREDIT.PROMISE_SAVED');
  }

  saveDispute(): void {
    const data = this.caseData();
    if (!data) {
      return;
    }
    const value = this.disputeForm.getRawValue();
    this.run(
      this.api.createDispute({ customer_id: data.customer_id, case_id: data.id, disputed_amount: String(value.disputed_amount), reason_code: value.reason_code, description: blankToNull(value.description) }),
      'CREDIT.DISPUTE_SAVED',
    );
  }

  reviewDispute(dispute: CreditDispute): void {
    this.run(this.api.reviewDispute(dispute.id), 'CREDIT.DISPUTE_SAVED');
  }

  openDisputeResolve(dispute: CreditDispute): void {
    this.resolvingDispute.set(dispute);
    this.disputeResolveForm.reset({ outcome: 'upheld', credited_amount: null, resolution_note: '' });
    this.dialog.set('disputeResolve');
  }

  saveDisputeResolve(): void {
    const dispute = this.resolvingDispute();
    if (!dispute) {
      return;
    }
    const value = this.disputeResolveForm.getRawValue();
    this.run(this.api.resolveDispute(dispute.id, { outcome: value.outcome, credited_amount: decimalOrNull(value.credited_amount), resolution_note: blankToNull(value.resolution_note) }), 'CREDIT.DISPUTE_SAVED');
  }

  saveClose(): void {
    const value = this.closeForm.getRawValue();
    this.run(this.api.closeCase(this.id, { outcome: value.outcome, note: blankToNull(value.note) }), 'CREDIT.CASE_CLOSED');
  }

  private run(request: Observable<unknown>, successKey: string): void {
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant(successKey));
        this.dialog.set(null);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR')),
    });
  }
}
