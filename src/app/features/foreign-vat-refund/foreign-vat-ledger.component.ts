import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FVR_EXPENSE_CATEGORIES,
  FVR_LEDGER_STATUSES,
  FVR_SOURCE_TYPES,
  FVR_VAT_BOOKED_ON,
  FvrLedgerEntry,
  FvrLedgerFilters,
  FvrLedgerStatus,
  FvrManualLedgerPayload,
  FvrSourceType,
  FvrVatBookedOn,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ForeignVatLedgerStore, ForeignVatReferenceStore } from './foreign-vat-refund.stores';
import {
  FOREIGN_VAT_MODULE,
  FvrOutcome,
  isoDay,
  ledgerStatusColor,
  toNumber,
} from './foreign-vat-refund.util';

interface ManualForm {
  document_number: string;
  document_date: Date | null;
  supplier_name: string;
  supplier_vat_number: string;
  supplier_country_code: string | null;
  expense_category_code: number;
  net_amount: number | null;
  foreign_vat_rate: number | null;
  foreign_vat_amount: number | null;
  currency_code: string;
  exchange_rate_to_base: number | null;
  vat_booked_on: FvrVatBookedOn;
}

const EMPTY_FORM: ManualForm = {
  document_number: '',
  document_date: null,
  supplier_name: '',
  supplier_vat_number: '',
  supplier_country_code: null,
  expense_category_code: 10,
  net_amount: null,
  foreign_vat_rate: null,
  foreign_vat_amount: null,
  currency_code: 'EUR',
  exchange_rate_to_base: 1,
  vat_booked_on: 'expense',
};

/**
 * The foreign VAT ledger ("Registro IVA estera"): filter by country, status, expense category, year, quarter and source; change the expense
 * code (1-10) of an open line and recalculate its eligible share; attach and preview the scan of the original invoice; register an item by hand.
 */
@Component({
  selector: 'app-foreign-vat-ledger',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [ForeignVatLedgerStore],
  styleUrl: './foreign-vat-refund.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.FOREIGN_VAT_LEDGER' | translate"
      [subtitle]="'foreignVat.section.ledgerSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <div class="toolbar">
      <label class="field" for="fv-l-country">
        <span>{{ 'foreignVat.filter.country' | translate }}</span>
        <nz-select nzId="fv-l-country" nzAllowClear [(ngModel)]="country" (ngModelChange)="reload()">
          @for (code of countries(); track code) {
            <nz-option [nzValue]="code" [nzLabel]="'foreignVat.country.' + code | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="fv-l-status">
        <span>{{ 'foreignVat.filter.status' | translate }}</span>
        <nz-select nzId="fv-l-status" nzAllowClear [(ngModel)]="status" (ngModelChange)="reload()">
          @for (item of statuses; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'foreignVat.ledgerStatus.' + item | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="fv-l-category">
        <span>{{ 'foreignVat.filter.category' | translate }}</span>
        <nz-select nzId="fv-l-category" nzAllowClear [(ngModel)]="category" (ngModelChange)="reload()">
          @for (item of categories; track item) {
            <nz-option [nzValue]="item" [nzLabel]="item + ' · ' + ('foreignVat.category.' + item | translate)"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="fv-l-year">
        <span>{{ 'foreignVat.filter.year' | translate }}</span>
        <nz-select nzId="fv-l-year" nzAllowClear [(ngModel)]="year" (ngModelChange)="reload()">
          @for (item of years; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'' + item"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="fv-l-quarter">
        <span>{{ 'foreignVat.filter.quarter' | translate }}</span>
        <nz-select nzId="fv-l-quarter" nzAllowClear [(ngModel)]="quarter" (ngModelChange)="reload()">
          @for (item of quarters; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'Q' + item"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="fv-l-source">
        <span>{{ 'foreignVat.filter.source' | translate }}</span>
        <nz-select nzId="fv-l-source" nzAllowClear [(ngModel)]="source" (ngModelChange)="reload()">
          @for (item of sources; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'foreignVat.source.' + item | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="fv-l-search">
        <span>{{ 'foreignVat.filter.search' | translate }}</span>
        <input nz-input id="fv-l-search" [(ngModel)]="search" (keyup.enter)="reload()" (blur)="reload()" />
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" data-test="add-manual" (click)="openManual()">
          {{ 'foreignVat.action.addManual' | translate }}
        </button>
      }
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table #ledger nzSize="small" [nzData]="store.entries()" [nzShowPagination]="false" [nzScroll]="{ x: '1400px' }">
        <thead>
          <tr>
            <th scope="col">{{ 'foreignVat.column.document' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.date' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.supplier' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.country' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.category' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.vat' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.eligible' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.recoverable' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.nonRecoverable' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.status' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.claim' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of ledger.data; track row.id) {
            <tr [attr.data-test]="'row-' + row.id">
              <td>
                {{ row.document_number }}
                <div class="hint">{{ 'foreignVat.source.' + row.source_type | translate }}</div>
              </td>
              <td>{{ row.document_date | date: 'mediumDate' }}</td>
              <td>{{ row.supplier_name }}</td>
              <td>{{ 'foreignVat.country.' + row.supplier_country_code | translate }}</td>
              <td>
                @if (row.editable && canWrite) {
                  <nz-select
                    class="category-select"
                    [ngModel]="row.expense_category_code"
                    (ngModelChange)="changeCategory(row, $event)"
                    [attr.data-test]="'category-' + row.id"
                  >
                    @for (item of categories; track item) {
                      <nz-option [nzValue]="item" [nzLabel]="item + ' · ' + ('foreignVat.category.' + item | translate)"></nz-option>
                    }
                  </nz-select>
                } @else {
                  {{ row.expense_category_code }} · {{ 'foreignVat.category.' + row.expense_category_code | translate }}
                }
              </td>
              <td>{{ num(row.foreign_vat_amount) | currency: row.currency_code }} ({{ num(row.foreign_vat_rate) }}%)</td>
              <td>{{ num(row.eligible_percentage) }}%</td>
              <td>{{ num(row.recoverable_vat_amount) | currency: row.currency_code }}</td>
              <td>{{ num(row.non_recoverable_vat_amount) | currency: row.currency_code }}</td>
              <td>
                <nz-tag [nzColor]="color(row.status)">{{ 'foreignVat.ledgerStatus.' + row.status | translate }}</nz-tag>
                @if (row.posting_error) {
                  <nz-tag nzColor="red" data-test="posting-error">{{ 'foreignVat.ledger.postingError' | translate }}</nz-tag>
                }
              </td>
              <td>{{ row.claim_number }}</td>
              <td class="row-actions">
                @if (row.editable && canWrite) {
                  <button nz-button nzSize="small" type="button" data-test="recalculate" (click)="recalculate(row)">
                    {{ 'foreignVat.action.recalculate' | translate }}
                  </button>
                }
                @if (canWrite && row.status !== 'REFUNDED') {
                  <button nz-button nzSize="small" type="button" data-test="attach" (click)="picker.click()">
                    {{ 'foreignVat.action.attach' | translate }}
                  </button>
                  <input #picker class="hidden-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff" [attr.aria-label]="'foreignVat.action.attach' | translate" (change)="attach(row, $event)" />
                }
                @if (row.has_attachment) {
                  <button nz-button nzSize="small" type="button" data-test="preview" (click)="preview(row)">
                    {{ 'foreignVat.action.preview' | translate }}
                  </button>
                }
                @if (canWrite && row.source_type === 'MANUAL' && row.status === 'PENDING_REVIEW') {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    data-test="delete"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'foreignVat.confirm.deleteEntry' | translate"
                    (nzOnConfirm)="remove(row)"
                  >
                    {{ 'foreignVat.action.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="12">
                <nz-empty [nzNotFoundContent]="'foreignVat.empty.ledger' | translate"></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-modal
      [nzVisible]="manualOpen()"
      [nzTitle]="'foreignVat.modal.manualTitle' | translate"
      [nzOkText]="'foreignVat.action.save' | translate"
      [nzCancelText]="'foreignVat.action.cancel' | translate"
      [nzOkDisabled]="!manualValid()"
      (nzOnOk)="saveManual()"
      (nzOnCancel)="manualOpen.set(false)"
    >
      <ng-container *nzModalContent>
        @if (manualError(); as error) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate" data-test="manual-error"></nz-alert>
        }
        <div class="form-grid">
          <label class="field" for="fv-m-doc">
            <span>{{ 'foreignVat.field.documentNumber' | translate }}</span>
            <input nz-input id="fv-m-doc" name="document_number" [(ngModel)]="form.document_number" />
          </label>
          <label class="field" for="fv-m-date">
            <span>{{ 'foreignVat.field.documentDate' | translate }}</span>
            <nz-date-picker nzId="fv-m-date" name="document_date" [(ngModel)]="form.document_date"></nz-date-picker>
          </label>
          <label class="field" for="fv-m-supplier">
            <span>{{ 'foreignVat.field.supplierName' | translate }}</span>
            <input nz-input id="fv-m-supplier" name="supplier_name" [(ngModel)]="form.supplier_name" />
          </label>
          <label class="field" for="fv-m-vatid">
            <span>{{ 'foreignVat.field.supplierVatNumber' | translate }}</span>
            <input nz-input id="fv-m-vatid" name="supplier_vat_number" [(ngModel)]="form.supplier_vat_number" />
          </label>
          <label class="field" for="fv-m-country">
            <span>{{ 'foreignVat.field.supplierCountry' | translate }}</span>
            <nz-select nzId="fv-m-country" name="supplier_country_code" [(ngModel)]="form.supplier_country_code">
              @for (code of allCountries(); track code) {
                <nz-option [nzValue]="code" [nzLabel]="'foreignVat.country.' + code | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="fv-m-category">
            <span>{{ 'foreignVat.field.category' | translate }}</span>
            <nz-select nzId="fv-m-category" name="expense_category_code" [(ngModel)]="form.expense_category_code">
              @for (item of categories; track item) {
                <nz-option [nzValue]="item" [nzLabel]="item + ' · ' + ('foreignVat.category.' + item | translate)"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="fv-m-net">
            <span>{{ 'foreignVat.field.netAmount' | translate }}</span>
            <nz-input-number nzId="fv-m-net" name="net_amount" [(ngModel)]="form.net_amount" [nzMin]="0" [nzStep]="0.01"></nz-input-number>
          </label>
          <label class="field" for="fv-m-rate">
            <span>{{ 'foreignVat.field.vatRate' | translate }}</span>
            <nz-input-number nzId="fv-m-rate" name="foreign_vat_rate" [(ngModel)]="form.foreign_vat_rate" [nzMin]="0" [nzMax]="100" [nzStep]="0.1"></nz-input-number>
          </label>
          <label class="field" for="fv-m-vat">
            <span>{{ 'foreignVat.field.vatAmount' | translate }}</span>
            <nz-input-number nzId="fv-m-vat" name="foreign_vat_amount" [(ngModel)]="form.foreign_vat_amount" [nzMin]="0" [nzStep]="0.01"></nz-input-number>
          </label>
          <label class="field" for="fv-m-currency">
            <span>{{ 'foreignVat.field.currency' | translate }}</span>
            <input nz-input id="fv-m-currency" name="currency_code" maxlength="3" [(ngModel)]="form.currency_code" />
          </label>
          <label class="field" for="fv-m-fx">
            <span>{{ 'foreignVat.field.exchangeRate' | translate }}</span>
            <nz-input-number nzId="fv-m-fx" name="exchange_rate_to_base" [(ngModel)]="form.exchange_rate_to_base" [nzMin]="0" [nzStep]="0.0001"></nz-input-number>
          </label>
          <label class="field" for="fv-m-booked">
            <span>{{ 'foreignVat.field.vatBookedOn' | translate }}</span>
            <nz-select nzId="fv-m-booked" name="vat_booked_on" [(ngModel)]="form.vat_booked_on">
              @for (item of bookedOn; track item) {
                <nz-option [nzValue]="item" [nzLabel]="'foreignVat.vatBookedOn.' + item | translate"></nz-option>
              }
            </nz-select>
          </label>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class ForeignVatLedgerComponent implements OnInit {
  protected readonly store = inject(ForeignVatLedgerStore);
  private readonly reference = inject(ForeignVatReferenceStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(FOREIGN_VAT_MODULE);
  protected readonly statuses = FVR_LEDGER_STATUSES;
  protected readonly sources = FVR_SOURCE_TYPES;
  protected readonly categories = FVR_EXPENSE_CATEGORIES;
  protected readonly bookedOn = FVR_VAT_BOOKED_ON;
  protected readonly quarters = [1, 2, 3, 4];
  protected readonly years = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index);
  protected readonly num = toNumber;
  protected readonly color = ledgerStatusColor;

  protected country: string | null = null;
  protected status: FvrLedgerStatus | null = null;
  protected category: number | null = null;
  protected year: number | null = null;
  protected quarter: number | null = null;
  protected source: FvrSourceType | null = null;
  protected search = '';

  protected readonly manualOpen = signal(false);
  protected readonly manualError = signal<string | null>(null);
  protected form: ManualForm = { ...EMPTY_FORM };

  protected readonly countries = computed(() => this.reference.reference()?.refund_countries ?? []);
  protected readonly allCountries = computed(() => (this.reference.reference()?.countries ?? []).map((country) => country.code));

  ngOnInit(): void {
    void this.reference.load();
    void this.reload();
  }

  protected filters(): FvrLedgerFilters {
    return {
      country: this.country,
      status: this.status,
      category: this.category,
      fiscal_year: this.year,
      fiscal_quarter: this.quarter,
      source_type: this.source,
      search: this.search.trim() === '' ? null : this.search.trim(),
    };
  }

  protected async reload(): Promise<void> {
    await this.store.load(this.filters());
  }

  protected openManual(): void {
    this.form = { ...EMPTY_FORM };
    this.manualError.set(null);
    this.manualOpen.set(true);
  }

  protected manualValid(): boolean {
    const f = this.form;
    return (
      f.document_number.trim() !== '' &&
      f.document_date !== null &&
      f.supplier_country_code !== null &&
      f.net_amount !== null &&
      f.foreign_vat_rate !== null &&
      (f.foreign_vat_amount ?? 0) > 0 &&
      f.currency_code.trim().length === 3
    );
  }

  protected async saveManual(): Promise<void> {
    const f = this.form;
    if (!this.manualValid() || f.document_date === null || f.supplier_country_code === null) {
      return;
    }
    const payload: FvrManualLedgerPayload = {
      document_number: f.document_number.trim(),
      document_date: isoDay(f.document_date),
      supplier_name: f.supplier_name.trim() || null,
      supplier_vat_number: f.supplier_vat_number.trim() || null,
      supplier_country_code: f.supplier_country_code,
      expense_category_code: f.expense_category_code,
      net_amount: f.net_amount ?? 0,
      foreign_vat_rate: f.foreign_vat_rate ?? 0,
      foreign_vat_amount: f.foreign_vat_amount ?? 0,
      currency_code: f.currency_code.trim().toUpperCase(),
      exchange_rate_to_base: f.exchange_rate_to_base,
      vat_booked_on: f.vat_booked_on,
      post_to_ledger: true,
    };
    const outcome = await this.store.create(payload);
    if (outcome.ok) {
      this.manualOpen.set(false);
      this.message.success(this.i18n.instant('foreignVat.toast.entryCreated'));
      await this.reload();
    } else {
      this.manualError.set(outcome.errorKey);
    }
  }

  protected async changeCategory(row: FvrLedgerEntry, category: number): Promise<void> {
    await this.act(this.store.changeCategory(row.id, category), 'foreignVat.toast.entryUpdated');
  }

  protected async recalculate(row: FvrLedgerEntry): Promise<void> {
    await this.act(this.store.recalculate(row.id), 'foreignVat.toast.entryUpdated');
  }

  protected async remove(row: FvrLedgerEntry): Promise<void> {
    await this.act(this.store.remove(row.id), 'foreignVat.toast.entryDeleted');
  }

  protected async attach(row: FvrLedgerEntry, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (file) {
      await this.act(this.store.attach(row.id, file), 'foreignVat.toast.attachmentSaved');
    }
    input.value = '';
  }

  protected async preview(row: FvrLedgerEntry): Promise<void> {
    const blob = await this.store.preview(row.id);
    if (blob) {
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    }
  }

  private async act(pending: Promise<FvrOutcome>, successKey: string): Promise<void> {
    const outcome = await pending;
    if (outcome.ok) {
      this.message.success(this.i18n.instant(successKey));
      await this.reload();
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'foreignVat.error.unknown', outcome.params));
      await this.reload();
    }
  }
}
