import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import {
  FVR_CLAIM_STEPS,
  FvrClaim,
  FvrDecidePayload,
  FvrExportType,
  FvrReconcilePayload,
  FvrSubmitPayload,
  TreasuryApiService,
} from '@core';
import { TranslatePipe } from '@shared';
import { claimStatusColor, exportTypesOf, isoDay, stepIndex, toNumber } from './foreign-vat-refund.util';

interface BankOption {
  id: string;
  label: string;
}

type Dialog = 'submit' | 'information' | 'decide' | 'reconcile' | null;

/**
 * Detail of a refund claim: the status timeline, the totals, the lines, the one-click downloads of the official files (EU portal XML, ESTV 1222/1223
 * package, Modello IVA 79 package), the transitions (submitted, integration request, decision) and the reconciliation of the refund received.
 */
@Component({
  selector: 'app-foreign-vat-claim-detail',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    NzTimelineModule,
    TranslatePipe,
  ],
  styleUrl: './foreign-vat-refund.scss',
  template: `
    <div class="detail-head">
      <nz-tag [nzColor]="color(claim().status)" data-test="claim-status">{{ 'foreignVat.claimStatus.' + claim().status | translate }}</nz-tag>
      <span class="hint">{{ 'foreignVat.regime.' + claim().regime_type | translate }}</span>
    </div>

    <nz-steps class="claim-steps" nzSize="small" [nzCurrent]="step()" data-test="claim-steps">
      @for (item of steps; track item) {
        <nz-step [nzTitle]="'foreignVat.step.' + item | translate"></nz-step>
      }
    </nz-steps>

    @if (error(); as key) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="key | translate: errorParams()" data-test="detail-error"></nz-alert>
    }

    <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
      <nz-descriptions-item [nzTitle]="'foreignVat.field.targetCountry' | translate">{{ 'foreignVat.country.' + claim().target_country_code | translate }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'foreignVat.field.periodType' | translate">{{ 'foreignVat.periodType.' + claim().period_type | translate }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'foreignVat.field.period' | translate">{{ claim().period_start_date | date: 'mediumDate' }} – {{ claim().period_end_date | date: 'mediumDate' }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'foreignVat.field.deadline' | translate">{{ claim().statutory_deadline_date | date: 'mediumDate' }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'foreignVat.field.requested' | translate">{{ num(claim().total_requested_amount) | currency: claim().currency_code }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'foreignVat.field.approved' | translate">{{ num(claim().total_approved_amount) | currency: claim().currency_code }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'foreignVat.field.rejected' | translate">{{ num(claim().total_rejected_amount) | currency: claim().currency_code }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'foreignVat.field.refunded' | translate">{{ num(claim().total_refunded_amount) | currency: claim().currency_code }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'foreignVat.field.protocol' | translate">{{ claim().protocol_number }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'foreignVat.field.submittedOn' | translate">{{ claim().submission_date | date: 'medium' }}</nz-descriptions-item>
    </nz-descriptions>

    <div class="detail-actions">
      @for (type of exports(); track type) {
        <button nz-button type="button" [attr.data-test]="'export-' + type" (click)="download.emit(type)">
          {{ 'foreignVat.exportType.' + type | translate }}
        </button>
      }
      @if (canWrite()) {
        @if (can('READY_TO_SUBMIT')) {
          <button nz-button nzType="primary" type="button" data-test="ready" (click)="ready.emit()">{{ 'foreignVat.action.markReady' | translate }}</button>
        }
        @if (can('DRAFT')) {
          <button nz-button type="button" data-test="draft" (click)="draft.emit()">{{ 'foreignVat.action.backToDraft' | translate }}</button>
        }
        @if (can('SUBMITTED')) {
          <button nz-button nzType="primary" type="button" data-test="submit" (click)="openDialog('submit')">{{ 'foreignVat.action.markSubmitted' | translate }}</button>
        }
        @if (can('ADDITIONAL_INFO_REQUESTED')) {
          <button nz-button type="button" data-test="information" (click)="openDialog('information')">{{ 'foreignVat.action.logInformationRequest' | translate }}</button>
        }
        @if (canDecide()) {
          <button nz-button type="button" data-test="decide" (click)="openDialog('decide')">{{ 'foreignVat.action.recordDecision' | translate }}</button>
        }
        @if (can('REFUNDED')) {
          <button nz-button nzType="primary" type="button" data-test="reconcile" (click)="openDialog('reconcile')">{{ 'foreignVat.action.reconcile' | translate }}</button>
        }
        @if (!claim().locked) {
          <button
            nz-button
            nzDanger
            type="button"
            data-test="delete"
            nz-popconfirm
            [nzPopconfirmTitle]="'foreignVat.confirm.deleteClaim' | translate"
            (nzOnConfirm)="remove.emit()"
          >
            {{ 'foreignVat.action.delete' | translate }}
          </button>
        }
      }
    </div>

    <h4 class="section-title">{{ 'foreignVat.section.claimItems' | translate }}</h4>
    <nz-table #items nzSize="small" [nzData]="claim().items ?? []" [nzShowPagination]="false" [nzScroll]="{ x: '700px' }">
      <thead>
        <tr>
          <th scope="col">{{ 'foreignVat.column.document' | translate }}</th>
          <th scope="col">{{ 'foreignVat.column.date' | translate }}</th>
          <th scope="col">{{ 'foreignVat.column.supplier' | translate }}</th>
          <th scope="col">{{ 'foreignVat.column.category' | translate }}</th>
          <th scope="col">{{ 'foreignVat.column.recoverable' | translate }}</th>
          <th scope="col">{{ 'foreignVat.column.scan' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (item of items.data; track item.id) {
          <tr>
            <td>{{ item.document_number }}</td>
            <td>{{ item.document_date | date: 'mediumDate' }}</td>
            <td>{{ item.supplier_name }}</td>
            <td>{{ item.expense_category_code }} · {{ 'foreignVat.category.' + item.expense_category_code | translate }}</td>
            <td>{{ num(item.recoverable_vat_amount) | currency: item.currency_code }}</td>
            <td>{{ (item.has_attachment ? 'foreignVat.scan.yes' : 'foreignVat.scan.no') | translate }}</td>
          </tr>
        }
      </tbody>
    </nz-table>

    <h4 class="section-title">{{ 'foreignVat.section.claimEvents' | translate }}</h4>
    <nz-timeline>
      @for (event of claim().events ?? []; track event.id) {
        <nz-timeline-item>
          <strong>{{ 'foreignVat.event.' + event.event | translate }}</strong>
          @if (event.to_status) {
            · {{ 'foreignVat.claimStatus.' + event.to_status | translate }}
          }
          <div class="hint">{{ event.created_at | date: 'medium' }}</div>
          @if (event.note) {
            <div>{{ event.note }}</div>
          }
        </nz-timeline-item>
      }
    </nz-timeline>

    <nz-modal
      [nzVisible]="dialog() === 'submit'"
      [nzTitle]="'foreignVat.modal.submitTitle' | translate"
      [nzOkText]="'foreignVat.action.confirm' | translate"
      [nzCancelText]="'foreignVat.action.cancel' | translate"
      (nzOnOk)="confirmSubmit()"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        <p>{{ 'foreignVat.modal.submitBody' | translate }}</p>
        <label class="field" for="fv-c-protocol">
          <span>{{ 'foreignVat.field.protocol' | translate }}</span>
          <input nz-input id="fv-c-protocol" name="protocol_number" [(ngModel)]="protocol" />
        </label>
        <label class="field" for="fv-c-submitted-on">
          <span>{{ 'foreignVat.field.submittedOn' | translate }}</span>
          <nz-date-picker nzId="fv-c-submitted-on" name="submitted_on" [(ngModel)]="submittedOn"></nz-date-picker>
        </label>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="dialog() === 'information'"
      [nzTitle]="'foreignVat.modal.informationTitle' | translate"
      [nzOkText]="'foreignVat.action.confirm' | translate"
      [nzCancelText]="'foreignVat.action.cancel' | translate"
      [nzOkDisabled]="note.trim() === ''"
      (nzOnOk)="confirmInformation()"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        <label class="field" for="fv-c-note">
          <span>{{ 'foreignVat.field.note' | translate }}</span>
          <textarea nz-input id="fv-c-note" name="note" rows="4" [(ngModel)]="note"></textarea>
        </label>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="dialog() === 'decide'"
      [nzTitle]="'foreignVat.modal.decideTitle' | translate"
      [nzOkText]="'foreignVat.action.confirm' | translate"
      [nzCancelText]="'foreignVat.action.cancel' | translate"
      (nzOnOk)="confirmDecision()"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        <p>{{ 'foreignVat.modal.decideBody' | translate: { amount: claim().total_requested_amount, currency: claim().currency_code } }}</p>
        <label class="field" for="fv-c-approved">
          <span>{{ 'foreignVat.field.approvedAmount' | translate }}</span>
          <nz-input-number nzId="fv-c-approved" name="approved_amount" [(ngModel)]="approvedAmount" [nzMin]="0" [nzStep]="0.01"></nz-input-number>
        </label>
        <label class="field" for="fv-c-decision-note">
          <span>{{ 'foreignVat.field.note' | translate }}</span>
          <textarea nz-input id="fv-c-decision-note" name="decision_note" rows="3" [(ngModel)]="note"></textarea>
        </label>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="dialog() === 'reconcile'"
      [nzTitle]="'foreignVat.modal.reconcileTitle' | translate"
      [nzOkText]="'foreignVat.action.reconcile' | translate"
      [nzCancelText]="'foreignVat.action.cancel' | translate"
      [nzOkDisabled]="!reconcileValid()"
      (nzOnOk)="confirmReconcile()"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        <p>{{ 'foreignVat.modal.reconcileBody' | translate }}</p>
        <label class="field" for="fv-c-refunded">
          <span>{{ 'foreignVat.field.refundedAmount' | translate }} ({{ claim().currency_code }})</span>
          <nz-input-number nzId="fv-c-refunded" name="refunded_amount" [(ngModel)]="refundedAmount" [nzMin]="0" [nzStep]="0.01"></nz-input-number>
        </label>
        <label class="field" for="fv-c-bank">
          <span>{{ 'foreignVat.field.bankAccount' | translate }}</span>
          <nz-select nzId="fv-c-bank" name="bank_account_id" [(ngModel)]="bankAccountId">
            @for (bank of banks(); track bank.id) {
              <nz-option [nzValue]="bank.id" [nzLabel]="bank.label"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="fv-c-fx">
          <span>{{ 'foreignVat.field.exchangeRate' | translate }}</span>
          <nz-input-number nzId="fv-c-fx" name="exchange_rate" [(ngModel)]="exchangeRate" [nzMin]="0" [nzStep]="0.0001"></nz-input-number>
        </label>
        <label class="field" for="fv-c-received">
          <span>{{ 'foreignVat.field.receivedOn' | translate }}</span>
          <nz-date-picker nzId="fv-c-received" name="received_on" [(ngModel)]="receivedOn"></nz-date-picker>
        </label>
        <div class="hint" data-test="rejected-preview">
          {{ 'foreignVat.field.rejectedAuto' | translate }}:
          {{ rejectedPreview() | currency: claim().currency_code }}
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class ForeignVatClaimDetailComponent implements OnInit {
  readonly claim = input.required<FvrClaim>();
  readonly canWrite = input(false);
  readonly error = input<string | null>(null);
  readonly errorParams = input<Record<string, string>>({});

  readonly ready = output<void>();
  readonly draft = output<void>();
  readonly remove = output<void>();
  readonly submitClaim = output<FvrSubmitPayload>();
  readonly requestInformation = output<string>();
  readonly decide = output<FvrDecidePayload>();
  readonly reconcile = output<FvrReconcilePayload>();
  readonly download = output<FvrExportType>();

  private readonly treasury = inject(TreasuryApiService);

  protected readonly steps = FVR_CLAIM_STEPS;
  protected readonly num = toNumber;
  protected readonly color = claimStatusColor;
  protected readonly dialog = signal<Dialog>(null);
  protected readonly banks = signal<BankOption[]>([]);
  protected readonly step = computed(() => stepIndex(this.claim().status));
  protected readonly exports = computed(() => exportTypesOf(this.claim()));

  protected protocol = '';
  protected submittedOn: Date | null = null;
  protected note = '';
  protected approvedAmount = 0;
  protected refundedAmount = 0;
  protected bankAccountId: string | null = null;
  protected exchangeRate: number | null = null;
  protected receivedOn: Date | null = null;

  ngOnInit(): void {
    this.treasury.getBankAccounts().subscribe({
      next: (page) =>
        this.banks.set(
          page.data
            .filter((bank) => bank.is_active)
            .map((bank) => ({ id: bank.id, label: `${bank.bank_name} · ${bank.iban} (${bank.currency})` })),
        ),
      error: () => this.banks.set([]),
    });
  }

  protected can(target: string): boolean {
    return (this.claim().allowed_transitions as string[]).includes(target);
  }

  protected canDecide(): boolean {
    return this.can('APPROVED') || this.can('PARTIALLY_APPROVED') || this.can('REJECTED');
  }

  protected openDialog(dialog: Exclude<Dialog, null>): void {
    this.note = '';
    this.protocol = this.claim().protocol_number ?? '';
    this.submittedOn = null;
    this.approvedAmount = toNumber(this.claim().total_requested_amount);
    this.refundedAmount = toNumber(this.claim().total_requested_amount) - toNumber(this.claim().total_rejected_amount);
    this.exchangeRate = null;
    this.receivedOn = null;
    this.dialog.set(dialog);
  }

  protected rejectedPreview(): number {
    const requested = toNumber(this.claim().total_requested_amount);
    return Math.max(0, Math.round((requested - (this.refundedAmount ?? 0)) * 100) / 100);
  }

  protected reconcileValid(): boolean {
    return (this.refundedAmount ?? 0) > 0 && this.bankAccountId !== null;
  }

  protected confirmSubmit(): void {
    this.dialog.set(null);
    this.submitClaim.emit({
      protocol_number: this.protocol.trim() === '' ? null : this.protocol.trim(),
      submitted_on: this.submittedOn ? isoDay(this.submittedOn) : null,
    });
  }

  protected confirmInformation(): void {
    this.dialog.set(null);
    this.requestInformation.emit(this.note.trim());
  }

  protected confirmDecision(): void {
    this.dialog.set(null);
    this.decide.emit({ approved_amount: this.approvedAmount ?? 0, note: this.note.trim() === '' ? null : this.note.trim() });
  }

  protected confirmReconcile(): void {
    if (this.bankAccountId === null) {
      return;
    }
    this.dialog.set(null);
    this.reconcile.emit({
      refunded_amount: this.refundedAmount ?? 0,
      bank_account_id: this.bankAccountId,
      exchange_rate: this.exchangeRate,
      received_on: this.receivedOn ? isoDay(this.receivedOn) : null,
    });
  }
}
