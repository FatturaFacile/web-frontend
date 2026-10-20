import { Component, computed, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { QrBill } from '@domain/models/qr-bill.model';
import { QrBillStore } from '../../state/qr-bill.store';

@Component({
  selector: 'app-swiss-qr-bill',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    NzCardModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzAlertModule,
    NzSpinModule,
    NzStatisticModule,
    NzDividerModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'SWISS_QR.TITLE' | translate"
      [subtitle]="'SWISS_QR.SUBTITLE' | translate"
    />

    <!-- Summary KPI cards -->
    <div nz-row [nzGutter]="16" class="stats-row">
      <div nz-col [nzXs]="24" [nzSm]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="store.billsCount()"
            [nzTitle]="'SWISS_QR.TOTAL_BILLS' | translate"
            [nzPrefix]="billPrefix"
          />
          <ng-template #billPrefix><i class="fa-solid fa-qrcode fa-icon-spaced"></i></ng-template>
        </nz-card>
      </div>
      <div nz-col [nzXs]="24" [nzSm]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="(store.totalChfRevenue() | number: '1.2-2') + ' CHF'"
            [nzTitle]="'SWISS_QR.TOTAL_REVENUE' | translate"
            [nzPrefix]="chfPrefix"
          />
          <ng-template #chfPrefix><i class="fa-solid fa-coins fa-icon-spaced"></i></ng-template>
        </nz-card>
      </div>
      <div nz-col [nzXs]="24" [nzSm]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="store.pendingBillsCount()"
            [nzTitle]="'SWISS_QR.PENDING_COLLECTION' | translate"
            [nzValueStyle]="{ color: '#f59e0b' }"
          />
        </nz-card>
      </div>
    </div>

    <div nz-row [nzGutter]="24">
      <!-- Left Column: Form & Table -->
      <div nz-col [nzXs]="24" [nzLg]="13">
        <!-- New QR-Bill Generator Form -->
        <nz-card [nzTitle]="'SWISS_QR.CREATE_CARD_TITLE' | translate" [nzExtra]="swissBadge" class="generator-card">
          <ng-template #swissBadge>
            <nz-tag nzColor="red">🇨🇭 {{ 'SWISS_QR.STANDARDS_TAG' | translate }}</nz-tag>
          </ng-template>

          <form nz-form [formGroup]="billForm" (ngSubmit)="onCreateBill()" nzLayout="vertical">
            <div nz-row [nzGutter]="16">
              <div nz-col [nzSpan]="12">
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'SWISS_QR.DEBTOR_LABEL' | translate }}</nz-form-label>
                  <nz-form-control>
                    <input
                      nz-input
                      formControlName="debtorName"
                      [placeholder]="'SWISS_QR.DEBTOR_PLACEHOLDER' | translate"
                      [attr.aria-label]="'SWISS_QR.DEBTOR_LABEL' | translate"
                    />
                  </nz-form-control>
                </nz-form-item>
              </div>
              <div nz-col [nzSpan]="12">
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'SWISS_QR.ADDRESS_LABEL' | translate }}</nz-form-label>
                  <nz-form-control>
                    <input
                      nz-input
                      formControlName="debtorAddress"
                      [placeholder]="'SWISS_QR.ADDRESS_PLACEHOLDER' | translate"
                      [attr.aria-label]="'SWISS_QR.ADDRESS_LABEL' | translate"
                    />
                  </nz-form-control>
                </nz-form-item>
              </div>
            </div>

            <div nz-row [nzGutter]="16">
              <div nz-col [nzSpan]="8">
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'SWISS_QR.POSTAL_LABEL' | translate }}</nz-form-label>
                  <nz-form-control>
                    <input
                      nz-input
                      formControlName="debtorPostalCode"
                      placeholder="6900"
                      [attr.aria-label]="'SWISS_QR.POSTAL_LABEL' | translate"
                    />
                  </nz-form-control>
                </nz-form-item>
              </div>
              <div nz-col [nzSpan]="8">
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'SWISS_QR.CITY_LABEL' | translate }}</nz-form-label>
                  <nz-form-control>
                    <input
                      nz-input
                      formControlName="debtorCity"
                      placeholder="Lugano"
                      [attr.aria-label]="'SWISS_QR.CITY_LABEL' | translate"
                    />
                  </nz-form-control>
                </nz-form-item>
              </div>
              <div nz-col [nzSpan]="8">
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'SWISS_QR.RAW_AMOUNT_LABEL' | translate }}</nz-form-label>
                  <nz-form-control>
                    <nz-input-number
                      formControlName="rawAmount"
                      [nzMin]="0.05"
                      [nzStep]="0.01"
                      style="width: 100%;"
                      [attr.aria-label]="'SWISS_QR.RAW_AMOUNT_LABEL' | translate"
                    />
                  </nz-form-control>
                </nz-form-item>
              </div>
            </div>

            <!-- Dynamic 0.05 CHF rounding callout -->
            <div class="rounding-callout">
              <div class="rounding-info">
                <span>{{ 'SWISS_QR.ROUNDING_LABEL' | translate }}</span>
                <strong class="rounded-value">{{ roundedAmount() | number: '1.2-2' }} CHF</strong>
              </div>
              <span class="rounding-diff">
                {{ 'SWISS_QR.DIFF_LABEL' | translate }} {{ (roundedAmount() - billForm.controls.rawAmount.value) | number: '1.2-2' }} CHF
              </span>
            </div>

            <nz-form-item>
              <nz-form-label>{{ 'SWISS_QR.MESSAGE_LABEL' | translate }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  formControlName="message"
                  [placeholder]="'SWISS_QR.MESSAGE_PLACEHOLDER' | translate"
                  [attr.aria-label]="'SWISS_QR.MESSAGE_LABEL' | translate"
                />
              </nz-form-control>
            </nz-form-item>

            <button nz-button nzType="primary" nzBlock [disabled]="billForm.invalid">
              <i class="fa-solid fa-qrcode fa-icon-spaced"></i> {{ 'SWISS_QR.SUBMIT_BTN' | translate }}
            </button>
          </form>
        </nz-card>

        <!-- QR-Bills List Table -->
        <nz-card [nzTitle]="'SWISS_QR.LIST_TITLE' | translate" class="table-card">
          <nz-spin [nzSpinning]="store.isLoading()">
            <nz-table
              #billTable
              [nzData]="store.bills()"
              [nzFrontPagination]="true"
              [nzPageSize]="5"
              nzSize="small"
            >
              <thead>
                <tr>
                  <th>{{ 'SWISS_QR.COL_BILL_NUM' | translate }}</th>
                  <th>{{ 'SWISS_QR.COL_DEBTOR' | translate }}</th>
                  <th>{{ 'COMMON.AMOUNT' | translate }}</th>
                  <th>{{ 'SWISS_QR.COL_DUE_DATE' | translate }}</th>
                  <th>{{ 'COMMON.STATUS' | translate }}</th>
                  <th>{{ 'COMMON.ACTION' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (bill of billTable.data; track bill.id) {
                  <tr
                    (click)="store.setSelectedBill(bill)"
                    [class.selected-row]="bill.id === store.currentBill()?.id"
                    class="clickable-row"
                  >
                    <td><strong>{{ bill.billNumber }}</strong></td>
                    <td>{{ bill.debtor.name }}</td>
                    <td>{{ bill.amount | number: '1.2-2' }} {{ bill.currency }}</td>
                    <td>{{ bill.dueDate }}</td>
                    <td>
                      @switch (bill.status) {
                        @case ('PAID') {
                          <nz-tag nzColor="success">{{ 'SWISS_QR.STATUS_PAID' | translate }}</nz-tag>
                        }
                        @case ('PENDING') {
                          <nz-tag nzColor="warning">{{ 'SWISS_QR.STATUS_PENDING' | translate }}</nz-tag>
                        }
                        @default {
                          <nz-tag nzColor="default">{{ 'SWISS_QR.STATUS_DRAFT' | translate }}</nz-tag>
                        }
                      }
                    </td>
                    <td>
                      <button
                        type="button"
                        class="select-action-btn"
                        (click)="store.setSelectedBill(bill); $event.stopPropagation()"
                      >
                        {{ 'COMMON.PREVIEW' | translate }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-spin>
        </nz-card>
      </div>

      <!-- Right Column: Visual Swiss QR Voucher Preview -->
      <div nz-col [nzXs]="24" [nzLg]="11">
        @if (store.currentBill(); as bill) {
          <nz-card [nzTitle]="'SWISS_QR.VOUCHER_TITLE' | translate" class="voucher-card">
            <div class="qr-voucher-container">
              <!-- Header / Title -->
              <div class="voucher-header">
                <h3>{{ 'SWISS_QR.PAYMENT_PART_TITLE' | translate }}</h3>
                <span class="voucher-sub">{{ 'SWISS_QR.PAYMENT_PART_SUB' | translate }}</span>
              </div>

              <!-- Main voucher body -->
              <div class="voucher-grid">
                <!-- QR Code representation with Swiss Cross -->
                <div class="qr-box">
                  <div class="qr-graphic">
                    <!-- SVG Swiss Cross in center -->
                    <div class="qr-pattern">
                      <div class="swiss-cross-badge">
                        <div class="cross-v"></div>
                        <div class="cross-h"></div>
                      </div>
                    </div>
                  </div>
                  <div class="qr-amount-box">
                    <div class="amount-col">
                      <span class="lbl">{{ 'SWISS_QR.CURRENCY_LBL' | translate }}</span>
                      <span class="val">{{ bill.currency }}</span>
                    </div>
                    <div class="amount-col">
                      <span class="lbl">{{ 'SWISS_QR.AMOUNT_LBL' | translate }}</span>
                      <span class="val amount-main">{{ bill.amount | number: '1.2-2' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Creditor & Debtor Info -->
                <div class="qr-info-col">
                  <div class="info-group">
                    <span class="info-label">{{ 'SWISS_QR.ACCOUNT_PAYABLE_TO' | translate }}</span>
                    <span class="info-val strong">{{ bill.creditor.qrIban }}</span>
                    <span class="info-val">{{ bill.creditor.name }}</span>
                    <span class="info-val">{{ bill.creditor.address }}</span>
                    <span class="info-val">{{ bill.creditor.postalCode }} {{ bill.creditor.city }}</span>
                  </div>

                  <div class="info-group">
                    <span class="info-label">{{ 'SWISS_QR.REFERENCE_SCOR' | translate }}</span>
                    <span class="info-val scor-code">{{ formatScor(bill.reference) }}</span>
                  </div>

                  <div class="info-group">
                    <span class="info-label">{{ 'SWISS_QR.ADDITIONAL_INFO' | translate }}</span>
                    <span class="info-val">{{ bill.unstructuredMessage }}</span>
                  </div>

                  <div class="info-group">
                    <span class="info-label">{{ 'SWISS_QR.PAYABLE_BY' | translate }}</span>
                    <span class="info-val">{{ bill.debtor.name }}</span>
                    <span class="info-val">{{ bill.debtor.address }}</span>
                    <span class="info-val">{{ bill.debtor.postalCode }} {{ bill.debtor.city }}</span>
                  </div>
                </div>
              </div>

              <nz-divider />
              <!-- Receipt Part (Empfangsschein) -->
              <div class="receipt-part">
                <h4>{{ 'SWISS_QR.RECEIPT_TITLE' | translate }}</h4>
                <div class="receipt-content">
                  <div>
                    <span class="info-label">{{ 'SWISS_QR.RECEIPT_ACCOUNT' | translate }}</span> {{ bill.creditor.qrIban }}<br />
                    <span class="info-label">{{ 'SWISS_QR.RECEIPT_BENEFICIARY' | translate }}</span> {{ bill.creditor.name }}
                  </div>
                  <div class="receipt-amount">
                    <strong>{{ bill.currency }} {{ bill.amount | number: '1.2-2' }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </nz-card>
        }
      </div>
    </div>
  `,
  styles: `
    .stats-row {
      margin-bottom: 20px;
    }

    .generator-card {
      margin-bottom: 20px;
      border-radius: 8px;
    }

    .table-card {
      border-radius: 8px;
    }

    .rounding-callout {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }

    .rounded-value {
      color: #10b981;
      font-size: 15px;
      margin-left: 6px;
    }

    .rounding-diff {
      color: #10b981;
      font-size: 11px;
    }

    .clickable-row {
      cursor: pointer;
    }

    .clickable-row:hover {
      background-color: rgba(13, 148, 136, 0.05);
    }

    .selected-row {
      background-color: rgba(13, 148, 136, 0.12) !important;
    }

    .select-action-btn {
      background: none;
      border: 1px solid var(--border-color, #d9d9d9);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 12px;
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
    }

    .select-action-btn:hover {
      color: var(--primary-color, #0d9488);
      border-color: var(--primary-color, #0d9488);
    }

    /* Swiss QR Voucher styling */
    .voucher-card {
      border: 1px solid var(--border-color, #d9d9d9);
      background: var(--bg-card, #fafafa);
    }

    .qr-voucher-container {
      background: var(--bg-card, #ffffff);
      border: 1px dashed var(--border-color, #bfbfbf);
      padding: 20px;
      border-radius: 4px;
    }

    .voucher-header h3 {
      font-size: 16px;
      font-weight: 700;
      margin: 0;
      color: var(--text-primary);
    }

    .voucher-sub {
      font-size: 11px;
      color: var(--text-secondary, #8c8c8c);
    }

    .voucher-grid {
      display: flex;
      gap: 20px;
      margin-top: 16px;
    }

    .qr-box {
      width: 150px;
      flex-shrink: 0;
    }

    .qr-graphic {
      width: 140px;
      height: 140px;
      background: #000000;
      position: relative;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .qr-pattern {
      width: 128px;
      height: 128px;
      background: repeating-conic-gradient(#fff 0% 25%, #000 0% 50%) 50% / 16px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .swiss-cross-badge {
      width: 28px;
      height: 28px;
      background: #ff0000;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
    }

    .cross-v {
      position: absolute;
      width: 6px;
      height: 18px;
      background: #ffffff;
    }

    .cross-h {
      position: absolute;
      width: 18px;
      height: 6px;
      background: #ffffff;
    }

    .qr-amount-box {
      margin-top: 12px;
      display: flex;
      gap: 16px;
      border-top: 1px solid var(--border-color, #f0f0f0);
      padding-top: 8px;
    }

    .amount-col {
      display: flex;
      flex-direction: column;
    }

    .amount-col .lbl {
      font-size: 10px;
      color: var(--text-secondary, #8c8c8c);
      text-transform: uppercase;
    }

    .amount-col .val {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .amount-main {
      font-size: 16px !important;
      color: var(--primary-color, #0d9488) !important;
    }

    .qr-info-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .info-group {
      display: flex;
      flex-direction: column;
      font-size: 12px;
      line-height: 1.4;
    }

    .info-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-secondary, #8c8c8c);
      text-transform: uppercase;
    }

    .info-val {
      color: var(--text-primary);
    }

    .info-val.strong {
      font-weight: 700;
    }

    .scor-code {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      color: var(--primary-color, #0d9488);
      letter-spacing: 0.5px;
    }

    .receipt-part {
      font-size: 11px;
      color: var(--text-secondary, #595959);
    }

    .receipt-part h4 {
      font-size: 12px;
      margin: 0 0 8px 0;
      font-weight: 700;
      color: var(--text-primary);
    }

    .receipt-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .receipt-amount {
      font-size: 14px;
      color: var(--text-primary);
    }
  `,
})
export class SwissQrBillComponent implements OnInit {
  readonly store = inject(QrBillStore);

  readonly billForm = new FormGroup({
    debtorName: new FormControl('Bernasconi Costruzioni SA', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    debtorAddress: new FormControl('Corso Elvezia 18', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    debtorPostalCode: new FormControl('6900', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    debtorCity: new FormControl('Lugano', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    rawAmount: new FormControl<number>(1450.83, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.05)],
    }),
    message: new FormControl('Fornitura sistemi gestionali Q4 2026', { nonNullable: true }),
  });

  readonly roundedAmount = computed(() => {
    const raw = this.billForm.controls.rawAmount.value ?? 0;
    return Math.round(raw * 20) / 20;
  });

  ngOnInit(): void {
    this.store.loadBills();
  }

  formatScor(reference: string): string {
    return reference.replace(/(\d{2})(\d{5})(\d{5})(\d{5})(\d{5})(\d{5})/, '$1 $2 $3 $4 $5 $6');
  }

  onCreateBill(): void {
    if (this.billForm.valid) {
      const formVal = this.billForm.getRawValue();
      const rounded = Math.round(formVal.rawAmount * 20) / 20;
      const newBill: QrBill = {
        id: `qrb-${Date.now()}`,
        billNumber: `QR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        currency: 'CHF',
        amount: rounded,
        creditor: {
          name: 'Helvetia Tech SA',
          address: 'Via Nassa 12',
          postalCode: '6900',
          city: 'Lugano',
          country: 'CH',
          qrIban: 'CH4431999123000889012',
        },
        debtor: {
          name: formVal.debtorName,
          address: formVal.debtorAddress,
          postalCode: formVal.debtorPostalCode,
          city: formVal.debtorCity,
          country: 'CH',
        },
        reference: `21000000000${Math.floor(100000000000000 + Math.random() * 900000000000000)}`,
        unstructuredMessage: formVal.message,
        status: 'PENDING',
      };

      this.store.addBill(newBill);
    }
  }
}
