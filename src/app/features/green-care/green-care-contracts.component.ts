import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  GC_BILLING_MODES,
  GC_CONTRACT_STATUSES,
  GC_INSTALLMENT_FREQUENCIES,
  GC_SERVICES,
  GcBillingMode,
  GcBillingRequest,
  GcContract,
  GcContractPayload,
  GcContractStatus,
  GcInstallmentFrequency,
  GcService,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { GreenCarePassageCounterComponent } from './green-care-passage-counter.component';
import { GreenCareContractsStore, GreenCareLookupStore, GreenCareReferenceStore } from './green-care.stores';
import { GREEN_CARE_MODULE, contractStatusColor, isoDay, parseDay } from './green-care.util';

interface ContractForm {
  contract_number: string;
  site_id: string | null;
  customer_id: string | null;
  condominium_administrator_id: string | null;
  season: [Date, Date] | null;
  billing_mode: GcBillingMode;
  included_passages_count: number;
  extra_passage_unit_price: number | null;
  fixed_fee_amount: number | null;
  installment_frequency: GcInstallmentFrequency | null;
  time_and_material_hourly_rate: number | null;
  snow_removal_standby_fee: number | null;
  snow_trigger_threshold_cm: number | null;
  included_services: GcService[];
  auto_bill_extra_passages: boolean;
  apply_condominium_withholding: boolean;
  is_condominium: boolean;
  condominium_fiscal_code: string;
}

const EMPTY_FORM: ContractForm = {
  contract_number: '',
  site_id: null,
  customer_id: null,
  condominium_administrator_id: null,
  season: null,
  billing_mode: 'fixed_installments',
  included_passages_count: 16,
  extra_passage_unit_price: null,
  fixed_fee_amount: null,
  installment_frequency: 'monthly',
  time_and_material_hourly_rate: null,
  snow_removal_standby_fee: null,
  snow_trigger_threshold_cm: null,
  included_services: ['mowing'],
  auto_bill_extra_passages: true,
  apply_condominium_withholding: false,
  is_condominium: false,
  condominium_fiscal_code: '',
};

/**
 * Seasonal maintenance and condominium contracts: the list with the visual passage counter ("Passage 8 of 16", red "17 of 16 - extra
 * to invoice"), the contract drawer, the lifecycle and the one-click invoice generation with the 4% condominium withholding preview.
 */
@Component({
  selector: 'app-green-care-contracts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    GreenCarePassageCounterComponent,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [GreenCareContractsStore],
  styleUrl: './green-care.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.GREEN_CARE_CONTRACTS' | translate"
      [subtitle]="'greenCare.section.contractsSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <div class="toolbar">
      <label class="field" for="gc-c-status">
        <span>{{ 'greenCare.filter.status' | translate }}</span>
        <nz-select nzId="gc-c-status" nzAllowClear [(ngModel)]="status" (ngModelChange)="reload()">
          @for (item of statuses; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'greenCare.enum.contractStatus.' + item | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gc-c-search">
        <span>{{ 'greenCare.filter.search' | translate }}</span>
        <input nz-input id="gc-c-search" [(ngModel)]="search" (keyup.enter)="reload()" (blur)="reload()" />
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" data-test="add-contract" (click)="openForm(null)">
          {{ 'greenCare.action.newContract' | translate }}
        </button>
      }
    </div>

    <nz-table #contracts nzSize="small" [nzData]="store.contracts()" [nzLoading]="store.loading()" [nzShowPagination]="false" [nzScroll]="{ x: '1200px' }">
      <thead>
        <tr>
          <th>{{ 'greenCare.field.contractNumber' | translate }}</th>
          <th>{{ 'greenCare.field.site' | translate }}</th>
          <th>{{ 'greenCare.field.customer' | translate }}</th>
          <th>{{ 'greenCare.field.season' | translate }}</th>
          <th>{{ 'greenCare.field.billingMode' | translate }}</th>
          <th>{{ 'greenCare.field.passages' | translate }}</th>
          <th>{{ 'greenCare.field.status' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (contract of contracts.data; track contract.id) {
          <tr [attr.data-test]="'contract-' + contract.id">
            <td>
              {{ contract.contract_number }}
              @if (contract.is_condominium) {
                <nz-tag nzColor="purple">{{ 'greenCare.badge.condominium' | translate }}</nz-tag>
              }
            </td>
            <td>{{ contract.site_name }}</td>
            <td>{{ contract.customer_name }}</td>
            <td>{{ contract.season_start_date | date: 'mediumDate' }} – {{ contract.season_end_date | date: 'mediumDate' }}</td>
            <td>{{ 'greenCare.enum.billingMode.' + contract.billing_mode | translate }}</td>
            <td><app-green-care-passage-counter [counter]="contract.passage_counter"></app-green-care-passage-counter></td>
            <td>
              <nz-tag [nzColor]="color(contract.status)">{{ 'greenCare.enum.contractStatus.' + contract.status | translate }}</nz-tag>
            </td>
            <td>
              <div class="row-actions">
                @if (canWrite) {
                  <button nz-button nzSize="small" nzType="primary" type="button" [attr.data-test]="'invoice-' + contract.id" (click)="openBilling(contract)">
                    {{ 'greenCare.action.generateInvoice' | translate }}
                  </button>
                  <button nz-button nzSize="small" type="button" (click)="openForm(contract)">{{ 'greenCare.action.edit' | translate }}</button>
                  @if (contract.status === 'active') {
                    <button nz-button nzSize="small" type="button" (click)="suspend(contract)">{{ 'greenCare.action.suspend' | translate }}</button>
                  } @else if (contract.status === 'draft' || contract.status === 'suspended') {
                    <button nz-button nzSize="small" type="button" (click)="activate(contract)">{{ 'greenCare.action.activate' | translate }}</button>
                  }
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'greenCare.confirm.deleteContract' | translate"
                    (nzOnConfirm)="remove(contract)"
                  >
                    {{ 'greenCare.action.delete' | translate }}
                  </button>
                }
              </div>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-drawer
      [nzVisible]="formOpen()"
      [nzWidth]="720"
      [nzTitle]="(editingId() ? 'greenCare.action.editContract' : 'greenCare.action.newContract') | translate"
      (nzOnClose)="formOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as error) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate: formErrorParams()"></nz-alert>
        }
        <div class="form-grid">
          <label class="field" for="gc-cf-number">
            <span>{{ 'greenCare.field.contractNumber' | translate }}</span>
            <input nz-input id="gc-cf-number" name="contract_number" [(ngModel)]="form.contract_number" />
          </label>
          <label class="field" for="gc-cf-site">
            <span>{{ 'greenCare.field.site' | translate }} *</span>
            <nz-select nzId="gc-cf-site" nzShowSearch [(ngModel)]="form.site_id">
              @for (option of lookup.sites(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-cf-customer">
            <span>{{ 'greenCare.field.customer' | translate }} *</span>
            <nz-select nzId="gc-cf-customer" nzShowSearch nzServerSearch [(ngModel)]="form.customer_id" (nzOnSearch)="lookup.searchCustomers($event)">
              @for (option of customerOptions(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-cf-admin">
            <span>{{ 'greenCare.field.condominiumAdministrator' | translate }}</span>
            <nz-select nzId="gc-cf-admin" nzShowSearch nzServerSearch nzAllowClear [(ngModel)]="form.condominium_administrator_id" (nzOnSearch)="lookup.searchCustomers($event)">
              @for (option of customerOptions(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-cf-season">
            <span>{{ 'greenCare.field.season' | translate }} *</span>
            <nz-range-picker id="gc-cf-season" name="season" [(ngModel)]="form.season"></nz-range-picker>
          </label>
          <label class="field" for="gc-cf-mode">
            <span>{{ 'greenCare.field.billingMode' | translate }} *</span>
            <nz-select nzId="gc-cf-mode" [(ngModel)]="form.billing_mode">
              @for (item of billingModes; track item) {
                <nz-option [nzValue]="item" [nzLabel]="'greenCare.enum.billingMode.' + item | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-cf-passages">
            <span>{{ 'greenCare.field.includedPassages' | translate }}</span>
            <nz-input-number nzId="gc-cf-passages" name="included_passages_count" [(ngModel)]="form.included_passages_count" [nzMin]="0" [nzStep]="1"></nz-input-number>
          </label>
          <label class="field" for="gc-cf-extra">
            <span>{{ 'greenCare.field.extraPassagePrice' | translate }}</span>
            <nz-input-number nzId="gc-cf-extra" name="extra_passage_unit_price" [(ngModel)]="form.extra_passage_unit_price" [nzMin]="0" [nzStep]="0.01"></nz-input-number>
          </label>
          <label class="field" for="gc-cf-fee">
            <span>{{ 'greenCare.field.fixedFee' | translate }}</span>
            <nz-input-number nzId="gc-cf-fee" name="fixed_fee_amount" [(ngModel)]="form.fixed_fee_amount" [nzMin]="0" [nzStep]="0.01"></nz-input-number>
          </label>
          <label class="field" for="gc-cf-frequency">
            <span>{{ 'greenCare.field.installmentFrequency' | translate }}</span>
            <nz-select nzId="gc-cf-frequency" nzAllowClear [(ngModel)]="form.installment_frequency">
              @for (item of frequencies; track item) {
                <nz-option [nzValue]="item" [nzLabel]="'greenCare.enum.installmentFrequency.' + item | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-cf-rate">
            <span>{{ 'greenCare.field.hourlyRate' | translate }}</span>
            <nz-input-number nzId="gc-cf-rate" name="time_and_material_hourly_rate" [(ngModel)]="form.time_and_material_hourly_rate" [nzMin]="0" [nzStep]="0.01"></nz-input-number>
          </label>
          <label class="field" for="gc-cf-snow-fee">
            <span>{{ 'greenCare.field.snowStandbyFee' | translate }}</span>
            <nz-input-number nzId="gc-cf-snow-fee" name="snow_removal_standby_fee" [(ngModel)]="form.snow_removal_standby_fee" [nzMin]="0" [nzStep]="0.01"></nz-input-number>
          </label>
          <label class="field" for="gc-cf-snow-cm">
            <span>{{ 'greenCare.field.snowThreshold' | translate }}</span>
            <nz-input-number nzId="gc-cf-snow-cm" name="snow_trigger_threshold_cm" [(ngModel)]="form.snow_trigger_threshold_cm" [nzMin]="0" [nzStep]="0.5"></nz-input-number>
          </label>
          <label class="field full" for="gc-cf-services">
            <span>{{ 'greenCare.field.includedServices' | translate }}</span>
            <nz-select nzId="gc-cf-services" nzMode="multiple" [(ngModel)]="form.included_services">
              @for (item of services; track item) {
                <nz-option [nzValue]="item" [nzLabel]="'greenCare.enum.service.' + item | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field switch" for="gc-cf-auto">
            <span>{{ 'greenCare.field.autoBillExtra' | translate }}</span>
            <nz-switch nzId="gc-cf-auto" name="auto_bill_extra_passages" [(ngModel)]="form.auto_bill_extra_passages"></nz-switch>
          </label>
          <label class="field switch" for="gc-cf-condo">
            <span>{{ 'greenCare.field.isCondominium' | translate }}</span>
            <nz-switch nzId="gc-cf-condo" name="is_condominium" [(ngModel)]="form.is_condominium" (ngModelChange)="onCondominium($event)"></nz-switch>
          </label>
          <label class="field switch" for="gc-cf-withholding">
            <span>{{ 'greenCare.field.applyWithholding' | translate }}</span>
            <nz-switch nzId="gc-cf-withholding" name="apply_condominium_withholding" [(ngModel)]="form.apply_condominium_withholding"></nz-switch>
          </label>
          @if (form.is_condominium) {
            <label class="field" for="gc-cf-cf">
              <span>{{ 'greenCare.field.condominiumFiscalCode' | translate }}</span>
              <input nz-input id="gc-cf-cf" name="condominium_fiscal_code" [(ngModel)]="form.condominium_fiscal_code" />
            </label>
          }
        </div>
        <div class="actions section-title">
          <button nz-button nzType="primary" type="button" data-test="save-contract" [disabled]="!formValid()" (click)="save()">
            {{ 'greenCare.action.save' | translate }}
          </button>
          <button nz-button type="button" (click)="formOpen.set(false)">{{ 'greenCare.action.cancel' | translate }}</button>
        </div>
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="billingTarget() !== null"
      [nzTitle]="'greenCare.billing.title' | translate"
      [nzWidth]="860"
      [nzFooter]="billingFooter"
      (nzOnCancel)="closeBilling()"
    >
      <ng-container *nzModalContent>
        @if (billingError(); as error) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate: billingErrorParams()"></nz-alert>
        }
        <div class="form-grid">
          <label class="field" for="gc-b-period">
            <span>{{ 'greenCare.billing.period' | translate }}</span>
            <nz-range-picker id="gc-b-period" name="period" [(ngModel)]="period"></nz-range-picker>
          </label>
          <label nz-checkbox name="include_installment" [(ngModel)]="options.installment">{{ 'greenCare.billing.installment' | translate }}</label>
          <label nz-checkbox name="include_snow_standby" [(ngModel)]="options.snow">{{ 'greenCare.billing.snowStandby' | translate }}</label>
          <label nz-checkbox name="include_extra_passages" [(ngModel)]="options.extra">{{ 'greenCare.billing.extraPassages' | translate }}</label>
          <label nz-checkbox name="include_time_and_material" [(ngModel)]="options.material">{{ 'greenCare.billing.timeAndMaterial' | translate }}</label>
          <label nz-checkbox name="include_waste" [(ngModel)]="options.waste">{{ 'greenCare.billing.waste' | translate }}</label>
        </div>

        @if (billingTarget(); as target) {
          @if (target.is_condominium && target.apply_condominium_withholding && !store.billing()) {
            <div class="withholding" data-test="withholding-hint">
              {{ 'greenCare.billing.withholdingHint' | translate: { percent: withholdingPercent() } }}
            </div>
          }
        }

        <nz-spin [nzSpinning]="store.billingBusy()">
          @if (store.billing(); as billing) {
            <nz-table #lines nzSize="small" class="section-title" [nzData]="billing.lines" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'greenCare.billing.line' | translate }}</th>
                  <th>{{ 'greenCare.field.quantity' | translate }}</th>
                  <th>{{ 'greenCare.field.unitPrice' | translate }}</th>
                  <th>{{ 'greenCare.field.vatRate' | translate }}</th>
                  <th>{{ 'greenCare.billing.net' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of lines.data; track $index) {
                  <tr>
                    <td>
                      <nz-tag>{{ 'greenCare.enum.invoiceLine.' + line.kind | translate }}</nz-tag>
                      {{ line.description }}
                    </td>
                    <td>{{ line.quantity }}</td>
                    <td>{{ line.unit_price | currency: currency() }}</td>
                    <td>{{ line.tax_rate }}%</td>
                    <td>{{ line.net | currency: currency() }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <div class="totals" data-test="billing-totals">
              <span>{{ 'greenCare.billing.totalNet' | translate }}</span>
              <span>{{ billing.total_net | currency: currency() }}</span>
              <span>{{ 'greenCare.billing.totalVat' | translate }}</span>
              <span>{{ billing.total_vat | currency: currency() }}</span>
              @if (billing.withholding?.applies) {
                <span data-test="withholding-line">
                  {{ 'greenCare.billing.withholding' | translate: { percent: billing.withholding?.percent ?? 0 } }}
                </span>
                <span>− {{ billing.withholding?.amount ?? 0 | currency: currency() }}</span>
              }
              <span class="grand">{{ 'greenCare.billing.netPayable' | translate }}</span>
              <span class="grand">{{ billing.net_payable | currency: currency() }}</span>
            </div>
            @if (billing.withholding?.applies) {
              <div class="withholding">
                {{ 'greenCare.billing.withholdingNote' | translate: { type: billing.withholding?.type ?? '', reason: billing.withholding?.reason ?? '' } }}
                @if (billing.condominium; as condominium) {
                  <div>
                    {{ 'greenCare.billing.condominiumFiscalCode' | translate }}: {{ condominium.fiscal_code ?? '-' }} ·
                    {{ 'greenCare.field.condominiumAdministrator' | translate }}: {{ condominium.administrator_name ?? '-' }}
                  </div>
                }
              </div>
            }
            @if (billing.invoice_id) {
              <nz-alert class="section-title" nzType="success" nzShowIcon [nzMessage]="'greenCare.billing.invoiceCreated' | translate"></nz-alert>
            }
          }
        </nz-spin>
      </ng-container>
      <ng-template #billingFooter>
        <button nz-button type="button" data-test="billing-close" (click)="closeBilling()">{{ 'greenCare.action.close' | translate }}</button>
        <button nz-button type="button" data-test="billing-preview" [disabled]="store.billingBusy()" (click)="previewBilling()">
          {{ 'greenCare.action.preview' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="billing-generate"
          [disabled]="store.billingBusy() || !store.billing() || !!store.billing()?.invoice_id"
          (click)="generateInvoice()"
        >
          {{ 'greenCare.action.generateInvoice' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class GreenCareContractsComponent implements OnInit {
  protected readonly store = inject(GreenCareContractsStore);
  protected readonly lookup = inject(GreenCareLookupStore);
  private readonly reference = inject(GreenCareReferenceStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(GREEN_CARE_MODULE);
  protected readonly statuses = GC_CONTRACT_STATUSES;
  protected readonly billingModes = GC_BILLING_MODES;
  protected readonly frequencies = GC_INSTALLMENT_FREQUENCIES;
  protected readonly services = GC_SERVICES;
  protected readonly color = contractStatusColor;

  protected status: GcContractStatus | null = null;
  protected search = '';

  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly formErrorParams = signal<Record<string, string>>({});
  protected form: ContractForm = { ...EMPTY_FORM, included_services: [...EMPTY_FORM.included_services] };
  private readonly pinned = signal<{ id: string; label: string }[]>([]);

  protected readonly billingTarget = signal<GcContract | null>(null);
  protected readonly billingError = signal<string | null>(null);
  protected readonly billingErrorParams = signal<Record<string, string>>({});
  protected period: [Date, Date] | null = null;
  protected options = { installment: true, snow: true, extra: true, material: true, waste: true };

  protected readonly withholdingPercent = computed(() => this.reference.reference()?.condominium_withholding_percent ?? 4);
  protected readonly customerOptions = computed(() => {
    const known = this.lookup.customers();
    return [...this.pinned().filter((option) => !known.some((item) => item.id === option.id)), ...known];
  });

  ngOnInit(): void {
    void this.reference.load();
    void this.lookup.searchCustomers();
    void this.lookup.loadSites();
    void this.reload();
  }

  protected currency(): string {
    return this.store.billing()?.jurisdiction === 'CH' ? 'CHF' : 'EUR';
  }

  protected async reload(): Promise<void> {
    await this.store.load({ status: this.status, search: this.search.trim() === '' ? null : this.search.trim() });
  }

  protected openForm(contract: GcContract | null): void {
    this.formError.set(null);
    this.editingId.set(contract?.id ?? null);
    const pinned: { id: string; label: string }[] = [];
    if (contract?.customer_id && contract.customer_name) {
      pinned.push({ id: contract.customer_id, label: contract.customer_name });
    }
    if (contract?.condominium_administrator_id && contract.condominium_administrator_name) {
      pinned.push({ id: contract.condominium_administrator_id, label: contract.condominium_administrator_name });
    }
    this.pinned.set(pinned);
    this.form =
      contract === null
        ? { ...EMPTY_FORM, included_services: [...EMPTY_FORM.included_services] }
        : {
            contract_number: contract.contract_number,
            site_id: contract.site_id,
            customer_id: contract.customer_id,
            condominium_administrator_id: contract.condominium_administrator_id,
            season: [parseDay(contract.season_start_date), parseDay(contract.season_end_date)],
            billing_mode: contract.billing_mode,
            included_passages_count: contract.included_passages_count,
            extra_passage_unit_price: contract.extra_passage_unit_price,
            fixed_fee_amount: contract.fixed_fee_amount,
            installment_frequency: contract.installment_frequency,
            time_and_material_hourly_rate: contract.time_and_material_hourly_rate,
            snow_removal_standby_fee: contract.snow_removal_standby_fee,
            snow_trigger_threshold_cm: contract.snow_trigger_threshold_cm,
            included_services: [...contract.included_services],
            auto_bill_extra_passages: contract.auto_bill_extra_passages,
            apply_condominium_withholding: contract.apply_condominium_withholding,
            is_condominium: contract.is_condominium,
            condominium_fiscal_code: contract.condominium_fiscal_code ?? '',
          };
    this.formOpen.set(true);
  }

  /** An Italian condominium turns the 4% withholding on by default. */
  protected onCondominium(value: boolean): void {
    this.form.apply_condominium_withholding = value;
  }

  protected formValid(): boolean {
    const f = this.form;
    const season = f.season;
    return (
      f.site_id !== null &&
      f.customer_id !== null &&
      season !== null &&
      season[0] <= season[1] &&
      (f.billing_mode !== 'fixed_installments' || (f.fixed_fee_amount ?? 0) > 0) &&
      (!f.is_condominium || f.condominium_fiscal_code.trim() !== '' || !f.apply_condominium_withholding)
    );
  }

  protected payload(): GcContractPayload {
    const f = this.form;
    const season = f.season ?? [new Date(), new Date()];
    return {
      contract_number: f.contract_number.trim() || null,
      site_id: f.site_id ?? '',
      customer_id: f.customer_id ?? '',
      condominium_administrator_id: f.condominium_administrator_id,
      season_start_date: isoDay(season[0]),
      season_end_date: isoDay(season[1]),
      billing_mode: f.billing_mode,
      included_passages_count: f.included_passages_count ?? 0,
      extra_passage_unit_price: f.extra_passage_unit_price,
      fixed_fee_amount: f.fixed_fee_amount,
      installment_frequency: f.billing_mode === 'fixed_installments' ? f.installment_frequency : null,
      time_and_material_hourly_rate: f.time_and_material_hourly_rate,
      snow_removal_standby_fee: f.snow_removal_standby_fee,
      snow_trigger_threshold_cm: f.snow_trigger_threshold_cm,
      included_services: f.included_services,
      auto_bill_extra_passages: f.auto_bill_extra_passages,
      apply_condominium_withholding: f.is_condominium && f.apply_condominium_withholding,
      is_condominium: f.is_condominium,
      condominium_fiscal_code: f.is_condominium ? f.condominium_fiscal_code.trim() || null : null,
    };
  }

  protected async save(): Promise<void> {
    if (!this.formValid()) {
      return;
    }
    const outcome = await this.store.save(this.editingId(), this.payload());
    if (outcome.ok) {
      this.formOpen.set(false);
      this.message.success(this.i18n.instant('greenCare.toast.contractSaved'));
      await this.reload();
    } else {
      this.formError.set(outcome.errorKey);
      this.formErrorParams.set(outcome.params);
    }
  }

  protected async activate(contract: GcContract): Promise<void> {
    await this.run(this.store.activate(contract.id), 'greenCare.toast.contractActivated');
  }

  protected async suspend(contract: GcContract): Promise<void> {
    await this.run(this.store.suspend(contract.id), 'greenCare.toast.contractSuspended');
  }

  protected async remove(contract: GcContract): Promise<void> {
    await this.run(this.store.remove(contract.id), 'greenCare.toast.contractDeleted');
  }

  protected openBilling(contract: GcContract): void {
    this.store.clearBilling();
    this.billingError.set(null);
    this.period = null;
    this.options = { installment: true, snow: true, extra: true, material: true, waste: true };
    this.billingTarget.set(contract);
  }

  protected closeBilling(): void {
    this.billingTarget.set(null);
    this.store.clearBilling();
  }

  protected request(): GcBillingRequest {
    return {
      period_start: this.period ? isoDay(this.period[0]) : null,
      period_end: this.period ? isoDay(this.period[1]) : null,
      include_installment: this.options.installment,
      include_snow_standby: this.options.snow,
      include_extra_passages: this.options.extra,
      include_time_and_material: this.options.material,
      include_waste: this.options.waste,
    };
  }

  protected async previewBilling(): Promise<void> {
    const target = this.billingTarget();
    if (target === null) {
      return;
    }
    this.billingError.set(null);
    const outcome = await this.store.previewBilling(target.id, this.request());
    if (!outcome.ok) {
      this.billingError.set(outcome.errorKey);
      this.billingErrorParams.set(outcome.params);
    }
  }

  protected async generateInvoice(): Promise<void> {
    const target = this.billingTarget();
    if (target === null) {
      return;
    }
    this.billingError.set(null);
    const outcome = await this.store.generateInvoice(target.id, this.request());
    if (outcome.ok) {
      this.message.success(this.i18n.instant('greenCare.toast.invoiceGenerated'));
    } else {
      this.billingError.set(outcome.errorKey);
      this.billingErrorParams.set(outcome.params);
    }
  }

  private async run(pending: Promise<{ ok: boolean; errorKey: string | null; params: Record<string, string> }>, successKey: string): Promise<void> {
    const outcome = await pending;
    if (outcome.ok) {
      this.message.success(this.i18n.instant(successKey));
      await this.reload();
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'greenCare.error.unknown', outcome.params));
    }
  }
}
