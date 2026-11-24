import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthStore, CuCertification, F24Payment, I18nService, ItalianVatApiService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { downloadBlob } from '../general-ledger/shared/gl-dates';
import { reportProblem } from './italian-vat-feedback';
import { ItalianVatStore } from './italian-vat.store';
import {
  CU_STATUS_COLORS,
  currentYear,
  F24_STATUS_COLORS,
  f24Outstanding,
  todayIso,
  toCents,
} from './italian-vat.util';

/** Certificazione Unica of professionals and agents, with the F24 payments of the withholdings, PDF and ministerial telematic file. */
@Component({
  selector: 'app-italian-vat-cu',
  styleUrl: '../general-ledger/localization/gl-localization.scss',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'PAGE_TITLE.ITALIAN_VAT_CU' | translate" />
    <nz-card>
      <div class="filters">
        <div class="field">
          <span>{{ 'GL.VAT_YEAR' | translate }}</span>
          <nz-input-number
            data-testid="cu-year"
            [nzMin]="2000"
            [nzMax]="2100"
            [ngModel]="year()"
            (ngModelChange)="year.set($event ?? year())"
          />
        </div>
        <button
          nz-button
          type="button"
          data-testid="cu-load"
          [nzLoading]="store.loading()"
          (click)="load()"
        >
          {{ 'GL.RUN_REPORT' | translate }}
        </button>
        <button
          nz-button
          type="button"
          data-testid="cu-build"
          [nzLoading]="store.saving()"
          (click)="build()"
        >
          {{ 'italianVat.cu.build' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="cu-issue"
          nz-popconfirm
          [nzPopconfirmTitle]="'italianVat.ui.issueConfirm' | translate"
          [disabled]="!store.cuIssuable()"
          (nzOnConfirm)="issue()"
        >
          {{ 'italianVat.cu.issue' | translate }}
        </button>
        <button
          nz-button
          type="button"
          data-testid="cu-file"
          [disabled]="!fileReady()"
          (click)="downloadFile()"
        >
          {{ 'italianVat.cu.file' | translate }}
        </button>
      </div>

      @if (store.cuValidation(); as validation) {
        <nz-alert
          data-testid="cu-validation"
          [nzType]="validation.valid ? 'success' : 'error'"
          nzShowIcon
          [nzMessage]="
            (validation.valid ? 'italianVat.ui.cuValid' : 'italianVat.error.cu_export_invalid')
              | translate
          "
        />
      }

      <nz-table
        nzSize="small"
        [nzData]="store.certifications()"
        [nzPageSize]="25"
        data-testid="certifications"
      >
        <thead>
          <tr>
            <th>{{ 'italianVat.ui.recipient' | translate }}</th>
            <th>{{ 'italianVat.ui.taxCode' | translate }}</th>
            <th>{{ 'italianVat.ui.reasonCode' | translate }}</th>
            <th nzAlign="right">{{ 'italianVat.cu.gross' | translate }}</th>
            <th nzAlign="right">{{ 'italianVat.cu.withheld' | translate }}</th>
            <th nzAlign="right">{{ 'italianVat.cu.contributions' | translate }}</th>
            <th>{{ 'italianVat.ui.status' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (cu of store.certifications(); track cu.id) {
            <tr>
              <td>{{ cu.recipient_name }}</td>
              <td>{{ cu.recipient_tax_code ?? cu.recipient_vat_number }}</td>
              <td>{{ cu.reason_code }}</td>
              <td nzAlign="right">{{ cu.gross_amount | money: currency() }}</td>
              <td nzAlign="right">{{ cu.withheld_amount | money: currency() }}</td>
              <td nzAlign="right">{{ cu.contributions_amount | money: currency() }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(cu)">{{
                  'italianVat.cu.status.' + cu.status | translate
                }}</nz-tag>
                @for (error of cu.validation_errors ?? []; track $index) {
                  <div class="ant-form-item-explain-error" [attr.data-testid]="'cu-error-' + cu.id">
                    {{ 'italianVat.error.' + error | translate }}
                  </div>
                }
              </td>
              <td>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [attr.data-testid]="'pdf-' + cu.id"
                  (click)="downloadPdf(cu)"
                >
                  {{ 'italianVat.cu.pdf' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card [nzTitle]="'italianVat.f24.title' | translate">
      <div class="filters">
        <button
          nz-button
          type="button"
          data-testid="f24-sync"
          [nzLoading]="store.saving()"
          (click)="sync()"
        >
          {{ 'italianVat.ui.syncF24' | translate }}
        </button>
      </div>

      @if (store.f24Reconciliation(); as reconciliation) {
        <p data-testid="f24-reconciliation">
          {{ 'italianVat.ui.certifiedWithheld' | translate }}:
          {{ reconciliation.certified_withheld | money: currency() }} -
          {{ 'italianVat.f24.due' | translate }}: {{ reconciliation.f24_due | money: currency() }} -
          {{ 'italianVat.f24.paid' | translate }}:
          {{ reconciliation.f24_paid | money: currency() }} -
          {{ 'italianVat.ui.difference' | translate }}:
          {{ reconciliation.due_difference | money: currency() }}
        </p>
      }
      @if (store.f24Unpaid().length > 0) {
        <nz-alert
          nzType="warning"
          nzShowIcon
          data-testid="f24-unpaid"
          [nzMessage]="'italianVat.ui.f24Unpaid' | translate: { count: store.f24Unpaid().length }"
        />
      }

      <nz-table nzSize="small" [nzData]="store.f24()" [nzPageSize]="25" data-testid="f24-table">
        <thead>
          <tr>
            <th>{{ 'italianVat.ui.period' | translate }}</th>
            <th>{{ 'italianVat.ui.taxCodeF24' | translate }}</th>
            <th>{{ 'italianVat.ui.dueDate' | translate }}</th>
            <th nzAlign="right">{{ 'italianVat.f24.due' | translate }}</th>
            <th nzAlign="right">{{ 'italianVat.f24.paid' | translate }}</th>
            <th>{{ 'italianVat.ui.status' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (payment of store.f24(); track payment.id) {
            <tr>
              <td>{{ payment.year }}/{{ payment.month }}</td>
              <td>{{ payment.tax_code }}</td>
              <td>{{ payment.due_date }}</td>
              <td nzAlign="right">{{ payment.amount_due | money: currency() }}</td>
              <td nzAlign="right">{{ payment.amount_paid | money: currency() }}</td>
              <td>
                <nz-tag
                  [nzColor]="f24Color(payment)"
                  [attr.data-testid]="'f24-status-' + payment.id"
                  >{{ 'italianVat.f24.status.' + payment.status | translate }}</nz-tag
                >
                {{ payment.f24_reference }}
              </td>
              <td>
                @if (outstanding(payment) !== '0.00') {
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [attr.data-testid]="'f24-pay-' + payment.id"
                    (click)="openPayment(payment)"
                  >
                    {{ 'italianVat.ui.recordPayment' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="paying() !== null"
      [nzTitle]="'italianVat.ui.recordPayment' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="!paymentValid()"
      (nzOnOk)="pay()"
      (nzOnCancel)="paying.set(null)"
    >
      <ng-container *nzModalContent>
        <label for="iv-pay-amount">{{ 'italianVat.ui.amount' | translate }}</label>
        <nz-input-number
          id="iv-pay-amount"
          [nzMin]="0"
          [nzPrecision]="2"
          [ngModel]="payAmount()"
          (ngModelChange)="payAmount.set($event ?? 0)"
        />
        <label for="iv-pay-date">{{ 'italianVat.ui.paidAt' | translate }}</label>
        <input
          id="iv-pay-date"
          nz-input
          type="date"
          [ngModel]="payDate()"
          (ngModelChange)="payDate.set($event)"
        />
        <label for="iv-pay-ref">{{ 'italianVat.ui.f24Reference' | translate }}</label>
        <input
          id="iv-pay-ref"
          nz-input
          maxlength="40"
          [ngModel]="payReference()"
          (ngModelChange)="payReference.set($event)"
        />
      </ng-container>
    </nz-modal>
  `,
})
export class ItalianVatCuComponent implements OnInit {
  protected readonly store = inject(ItalianVatStore);
  private readonly api = inject(ItalianVatApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;

  protected readonly year = signal(currentYear() - 1);
  protected readonly paying = signal<F24Payment | null>(null);
  protected readonly payAmount = signal(0);
  protected readonly payDate = signal(todayIso());
  protected readonly payReference = signal('');
  protected readonly paymentValid = computed(() => this.payAmount() > 0 && this.payDate() !== '');
  /** The telematic file needs every certification validated or issued and a passing validation. */
  protected readonly fileReady = computed(
    () => this.store.certifications().length > 0 && this.store.cuValidation()?.valid === true,
  );
  protected readonly outstanding = f24Outstanding;

  ngOnInit(): void {
    void this.load();
  }

  protected load(): Promise<void> {
    return this.store.loadCertifications(this.year());
  }

  protected statusColor(cu: CuCertification): string {
    return CU_STATUS_COLORS[cu.status];
  }

  protected f24Color(payment: F24Payment): string {
    return F24_STATUS_COLORS[payment.status];
  }

  protected async build(): Promise<void> {
    if (!(await this.store.buildCertifications(this.year()))) {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }

  protected async issue(): Promise<void> {
    if (await this.store.issueCertifications(this.year())) {
      this.message.success(this.i18n.translate('italianVat.ui.cuIssued'));
      await this.load();
    } else {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }

  protected downloadFile(): void {
    this.api
      .downloadCuFile(this.year())
      .subscribe((blob) => downloadBlob(blob, `cu-${this.year()}.txt`));
  }

  protected downloadPdf(cu: CuCertification): void {
    this.api
      .downloadCuPdf(cu.id)
      .subscribe((blob) => downloadBlob(blob, `cu-${cu.year}-${cu.recipient_name}.pdf`));
  }

  protected async sync(): Promise<void> {
    if (!(await this.store.syncF24(this.year()))) {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }

  protected openPayment(payment: F24Payment): void {
    this.payAmount.set(toCents(f24Outstanding(payment)) / 100);
    this.payDate.set(todayIso());
    this.payReference.set('');
    this.paying.set(payment);
  }

  protected async pay(): Promise<void> {
    const payment = this.paying();
    if (!payment || !this.paymentValid()) {
      return;
    }
    const paid = await this.store.payF24(
      payment.id,
      { amount: this.payAmount(), paid_at: this.payDate(), reference: this.payReference() || null },
      this.year(),
    );
    if (paid) {
      this.paying.set(null);
    } else {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }
}
