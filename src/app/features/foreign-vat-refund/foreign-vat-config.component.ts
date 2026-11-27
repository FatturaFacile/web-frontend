import { DatePipe } from '@angular/common';
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
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FvrMandate, FvrMandatePayload, FvrRule, FvrRulePayload, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ForeignVatConfigStore, ForeignVatReferenceStore } from './foreign-vat-refund.stores';
import { FOREIGN_VAT_MODULE, FvrOutcome, isoDay, saveBlob, toNumber } from './foreign-vat-refund.util';

interface MandateForm {
  country_code: string | null;
  representative_name: string;
  representative_tax_id: string;
  address: string;
  postal_code: string;
  city: string;
  email: string;
  phone: string;
  mandate_start_date: Date | null;
  mandate_end_date: Date | null;
  certificate_expiry_date: Date | null;
}

const EMPTY_MANDATE: MandateForm = {
  country_code: null,
  representative_name: '',
  representative_tax_id: '',
  address: '',
  postal_code: '',
  city: '',
  email: '',
  phone: '',
  mandate_start_date: null,
  mandate_end_date: null,
  certificate_expiry_date: null,
};

/**
 * Configuration: the reciprocity and deductibility matrix per country (codes 1-10, with company overrides over the standard rules), the fiscal
 * representative mandates with their documents and the expiry of the certificate of taxable status, and the interception settings.
 */
@Component({
  selector: 'app-foreign-vat-config',
  imports: [
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
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [ForeignVatConfigStore],
  styleUrl: './foreign-vat-refund.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.FOREIGN_VAT_CONFIG' | translate"
      [subtitle]="'foreignVat.section.configSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as key) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="key | translate" data-test="config-error"></nz-alert>
    }

    <nz-tabs>
      <nz-tab [nzTitle]="'foreignVat.tab.rules' | translate">
        <div class="toolbar">
          <label class="field" for="fv-r-country">
            <span>{{ 'foreignVat.filter.country' | translate }}</span>
            <nz-select nzId="fv-r-country" [(ngModel)]="ruleCountry" (ngModelChange)="loadRules()">
              @for (code of ruleCountries(); track code) {
                <nz-option [nzValue]="code" [nzLabel]="'foreignVat.country.' + code | translate"></nz-option>
              }
            </nz-select>
          </label>
          <span class="hint">{{ 'foreignVat.rules.defaultsNote' | translate }}</span>
        </div>
        <nz-table #matrix nzSize="small" [nzData]="store.rules()" [nzShowPagination]="false" [nzScroll]="{ x: '1100px' }">
          <thead>
            <tr>
              <th scope="col">{{ 'foreignVat.column.category' | translate }}</th>
              <th scope="col">{{ 'foreignVat.column.regime' | translate }}</th>
              <th scope="col">{{ 'foreignVat.column.reciprocity' | translate }}</th>
              <th scope="col">{{ 'foreignVat.column.deductible' | translate }}</th>
              <th scope="col">{{ 'foreignVat.column.thresholds' | translate }}</th>
              <th scope="col">{{ 'foreignVat.column.deadline' | translate }}</th>
              <th scope="col">{{ 'foreignVat.column.source' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (rule of matrix.data; track rule.id) {
              <tr [attr.data-test]="'rule-' + rule.expense_category_code">
                <td>{{ rule.expense_category_code }} · {{ 'foreignVat.category.' + rule.expense_category_code | translate }}</td>
                <td>{{ 'foreignVat.regime.' + rule.regime_type | translate }}</td>
                <td><nz-tag [nzColor]="rule.has_reciprocity ? 'green' : 'red'">{{ (rule.has_reciprocity ? 'foreignVat.reciprocity.yes' : 'foreignVat.reciprocity.no') | translate }}</nz-tag></td>
                <td>{{ num(rule.deductible_percentage) }}%</td>
                <td>{{ rule.min_annual_amount ?? '-' }} / {{ rule.min_quarterly_amount ?? '-' }} {{ rule.currency_code }}</td>
                <td>{{ rule.filing_deadline_day }}.{{ rule.filing_deadline_month }}</td>
                <td><nz-tag [nzColor]="rule.is_global ? 'default' : 'purple'">{{ (rule.is_global ? 'foreignVat.rules.standard' : 'foreignVat.rules.company') | translate }}</nz-tag></td>
                <td class="row-actions">
                  @if (canWrite) {
                    <button nz-button nzSize="small" type="button" data-test="customize" (click)="editRule(rule)">{{ 'foreignVat.action.customize' | translate }}</button>
                    @if (!rule.is_global) {
                      <button nz-button nzSize="small" type="button" data-test="revert" nz-popconfirm [nzPopconfirmTitle]="'foreignVat.confirm.revertRule' | translate" (nzOnConfirm)="revertRule(rule)">
                        {{ 'foreignVat.action.revert' | translate }}
                      </button>
                    }
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8"><nz-empty [nzNotFoundContent]="'foreignVat.empty.rules' | translate"></nz-empty></td></tr>
            }
          </tbody>
        </nz-table>
      </nz-tab>

      <nz-tab [nzTitle]="'foreignVat.tab.mandates' | translate">
        <div class="toolbar">
          <span class="spacer"></span>
          @if (canWrite) {
            <button nz-button nzType="primary" type="button" data-test="add-mandate" (click)="openMandate(null)">{{ 'foreignVat.action.addMandate' | translate }}</button>
          }
        </div>
        <nz-table #mandates nzSize="small" [nzData]="store.mandates()" [nzShowPagination]="false" [nzScroll]="{ x: '1000px' }">
          <thead>
            <tr>
              <th scope="col">{{ 'foreignVat.column.country' | translate }}</th>
              <th scope="col">{{ 'foreignVat.column.representative' | translate }}</th>
              <th scope="col">{{ 'foreignVat.column.mandate' | translate }}</th>
              <th scope="col">{{ 'foreignVat.column.certificate' | translate }}</th>
              <th scope="col">{{ 'foreignVat.column.status' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (mandate of mandates.data; track mandate.id) {
              <tr [attr.data-test]="'mandate-' + mandate.id">
                <td>{{ 'foreignVat.country.' + mandate.country_code | translate }}</td>
                <td>{{ mandate.representative_name }}<div class="hint">{{ mandate.representative_tax_id }}</div></td>
                <td>{{ mandate.mandate_start_date | date: 'mediumDate' }} – {{ mandate.mandate_end_date | date: 'mediumDate' }}</td>
                <td>
                  @if (mandate.has_certificate) {
                    <nz-tag [nzColor]="mandate.certificate_valid ? 'green' : 'red'">{{ mandate.certificate_expiry_date | date: 'mediumDate' }}</nz-tag>
                  } @else {
                    <nz-tag nzColor="red">{{ 'foreignVat.mandateStatus.CERTIFICATE_MISSING' | translate }}</nz-tag>
                  }
                </td>
                <td><nz-tag [nzColor]="mandate.is_active ? 'green' : 'default'">{{ (mandate.is_active ? 'foreignVat.mandate.active' : 'foreignVat.mandate.inactive') | translate }}</nz-tag></td>
                <td class="row-actions">
                  @if (canWrite) {
                    <button nz-button nzSize="small" type="button" (click)="openMandate(mandate)">{{ 'foreignVat.action.edit' | translate }}</button>
                    <button nz-button nzSize="small" type="button" data-test="upload-poa" (click)="poa.click()">{{ 'foreignVat.action.uploadPowerOfAttorney' | translate }}</button>
                    <input #poa class="hidden-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff" [attr.aria-label]="'foreignVat.action.uploadPowerOfAttorney' | translate" (change)="upload(mandate, 'power_of_attorney', $event)" />
                    <button nz-button nzSize="small" type="button" data-test="upload-certificate" (click)="cert.click()">{{ 'foreignVat.action.uploadCertificate' | translate }}</button>
                    <input #cert class="hidden-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff" [attr.aria-label]="'foreignVat.action.uploadCertificate' | translate" (change)="upload(mandate, 'certificate', $event)" />
                  }
                  @if (mandate.has_power_of_attorney) {
                    <button nz-button nzSize="small" type="button" (click)="open(mandate, 'power_of_attorney')">{{ 'foreignVat.action.viewPowerOfAttorney' | translate }}</button>
                  }
                  @if (mandate.has_certificate) {
                    <button nz-button nzSize="small" type="button" (click)="open(mandate, 'certificate')">{{ 'foreignVat.action.viewCertificate' | translate }}</button>
                  }
                  @if (canWrite) {
                    <button nz-button nzSize="small" nzDanger type="button" nz-popconfirm [nzPopconfirmTitle]="'foreignVat.confirm.deleteMandate' | translate" (nzOnConfirm)="removeMandate(mandate)">
                      {{ 'foreignVat.action.delete' | translate }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6"><nz-empty [nzNotFoundContent]="'foreignVat.empty.mandates' | translate"></nz-empty></td></tr>
            }
          </tbody>
        </nz-table>
      </nz-tab>

      <nz-tab [nzTitle]="'foreignVat.tab.settings' | translate">
        @if (store.settings(); as settings) {
          <div class="panel">
            <label class="field switch" for="fv-s-auto">
              <span>{{ 'foreignVat.settings.autoIntercept' | translate }}</span>
              <nz-switch nzId="fv-s-auto" [ngModel]="settings.auto_intercept" [nzDisabled]="!canWrite" (ngModelChange)="toggleIntercept($event)"></nz-switch>
            </label>
            <p class="hint">{{ 'foreignVat.settings.autoInterceptHint' | translate }}</p>
            <p class="hint">{{ 'foreignVat.settings.accountsHint' | translate }}</p>
          </div>
        }
      </nz-tab>
    </nz-tabs>

    <nz-modal
      [nzVisible]="ruleDraft() !== null"
      [nzTitle]="'foreignVat.modal.ruleTitle' | translate"
      [nzOkText]="'foreignVat.action.save' | translate"
      [nzCancelText]="'foreignVat.action.cancel' | translate"
      (nzOnOk)="saveRule()"
      (nzOnCancel)="ruleDraft.set(null)"
    >
      <ng-container *nzModalContent>
        @if (ruleDraft(); as draft) {
          <p>{{ draft.expense_category_code }} · {{ 'foreignVat.category.' + draft.expense_category_code | translate }}</p>
          <label class="field switch" for="fv-r-reciprocity">
            <span>{{ 'foreignVat.column.reciprocity' | translate }}</span>
            <nz-switch nzId="fv-r-reciprocity" [(ngModel)]="ruleForm.has_reciprocity"></nz-switch>
          </label>
          <label class="field" for="fv-r-deductible">
            <span>{{ 'foreignVat.column.deductible' | translate }} (%)</span>
            <nz-input-number nzId="fv-r-deductible" name="deductible_percentage" [(ngModel)]="ruleForm.deductible" [nzMin]="0" [nzMax]="100" [nzStep]="1"></nz-input-number>
          </label>
          <label class="field" for="fv-r-annual">
            <span>{{ 'foreignVat.field.minAnnual' | translate }}</span>
            <nz-input-number nzId="fv-r-annual" name="min_annual_amount" [(ngModel)]="ruleForm.annual" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="fv-r-quarterly">
            <span>{{ 'foreignVat.field.minQuarterly' | translate }}</span>
            <nz-input-number nzId="fv-r-quarterly" name="min_quarterly_amount" [(ngModel)]="ruleForm.quarterly" [nzMin]="0"></nz-input-number>
          </label>
        }
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="mandateOpen()"
      [nzTitle]="'foreignVat.modal.mandateTitle' | translate"
      [nzOkText]="'foreignVat.action.save' | translate"
      [nzCancelText]="'foreignVat.action.cancel' | translate"
      [nzOkDisabled]="!mandateValid()"
      (nzOnOk)="saveMandate()"
      (nzOnCancel)="mandateOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <div class="form-grid">
          <label class="field" for="fv-f-country">
            <span>{{ 'foreignVat.field.country' | translate }}</span>
            <nz-select nzId="fv-f-country" name="country_code" [(ngModel)]="mandateForm.country_code">
              @for (code of countryCodes(); track code) {
                <nz-option [nzValue]="code" [nzLabel]="'foreignVat.country.' + code | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="fv-f-name">
            <span>{{ 'foreignVat.field.representativeName' | translate }}</span>
            <input nz-input id="fv-f-name" name="representative_name" [(ngModel)]="mandateForm.representative_name" />
          </label>
          <label class="field" for="fv-f-taxid">
            <span>{{ 'foreignVat.field.representativeTaxId' | translate }}</span>
            <input nz-input id="fv-f-taxid" name="representative_tax_id" [(ngModel)]="mandateForm.representative_tax_id" />
          </label>
          <label class="field" for="fv-f-address">
            <span>{{ 'foreignVat.field.address' | translate }}</span>
            <input nz-input id="fv-f-address" name="address" [(ngModel)]="mandateForm.address" />
          </label>
          <label class="field" for="fv-f-postal">
            <span>{{ 'foreignVat.field.postalCode' | translate }}</span>
            <input nz-input id="fv-f-postal" name="postal_code" [(ngModel)]="mandateForm.postal_code" />
          </label>
          <label class="field" for="fv-f-city">
            <span>{{ 'foreignVat.field.city' | translate }}</span>
            <input nz-input id="fv-f-city" name="city" [(ngModel)]="mandateForm.city" />
          </label>
          <label class="field" for="fv-f-email">
            <span>{{ 'foreignVat.field.email' | translate }}</span>
            <input nz-input id="fv-f-email" name="email" [(ngModel)]="mandateForm.email" />
          </label>
          <label class="field" for="fv-f-phone">
            <span>{{ 'foreignVat.field.phone' | translate }}</span>
            <input nz-input id="fv-f-phone" name="phone" [(ngModel)]="mandateForm.phone" />
          </label>
          <label class="field" for="fv-f-start">
            <span>{{ 'foreignVat.field.mandateStart' | translate }}</span>
            <nz-date-picker nzId="fv-f-start" name="mandate_start_date" [(ngModel)]="mandateForm.mandate_start_date"></nz-date-picker>
          </label>
          <label class="field" for="fv-f-end">
            <span>{{ 'foreignVat.field.mandateEnd' | translate }}</span>
            <nz-date-picker nzId="fv-f-end" name="mandate_end_date" [(ngModel)]="mandateForm.mandate_end_date"></nz-date-picker>
          </label>
          <label class="field" for="fv-f-expiry">
            <span>{{ 'foreignVat.field.certificateExpiry' | translate }}</span>
            <nz-date-picker nzId="fv-f-expiry" name="certificate_expiry_date" [(ngModel)]="mandateForm.certificate_expiry_date"></nz-date-picker>
          </label>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class ForeignVatConfigComponent implements OnInit {
  protected readonly store = inject(ForeignVatConfigStore);
  private readonly reference = inject(ForeignVatReferenceStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(FOREIGN_VAT_MODULE);
  protected readonly num = toNumber;

  protected ruleCountry: string | null = null;
  protected readonly feedback = signal<string | null>(null);
  protected readonly ruleDraft = signal<FvrRule | null>(null);
  protected ruleForm: { has_reciprocity: boolean; deductible: number; annual: number | null; quarterly: number | null } = {
    has_reciprocity: true,
    deductible: 100,
    annual: null,
    quarterly: null,
  };
  protected readonly mandateOpen = signal(false);
  protected mandateForm: MandateForm = { ...EMPTY_MANDATE };
  private editingMandate: string | null = null;

  protected readonly ruleCountries = computed(() => this.reference.reference()?.refund_countries ?? []);
  protected readonly countryCodes = computed(() => (this.reference.reference()?.countries ?? []).map((country) => country.code));

  async ngOnInit(): Promise<void> {
    await this.reference.load();
    this.ruleCountry = this.ruleCountries()[0] ?? null;
    await Promise.all([this.loadRules(), this.store.loadMandates(), this.store.loadSettings()]);
  }

  protected async loadRules(): Promise<void> {
    await this.store.loadRules(this.ruleCountry ?? undefined);
  }

  protected editRule(rule: FvrRule): void {
    this.ruleForm = {
      has_reciprocity: rule.has_reciprocity,
      deductible: toNumber(rule.deductible_percentage),
      annual: rule.min_annual_amount === null ? null : toNumber(rule.min_annual_amount),
      quarterly: rule.min_quarterly_amount === null ? null : toNumber(rule.min_quarterly_amount),
    };
    this.ruleDraft.set({ ...rule });
  }

  protected async saveRule(): Promise<void> {
    const draft = this.ruleDraft();
    if (draft === null) {
      return;
    }
    const payload: FvrRulePayload = {
      home_country_code: draft.home_country_code,
      refund_country_code: draft.refund_country_code,
      regime_type: draft.regime_type,
      has_reciprocity: this.ruleForm.has_reciprocity,
      expense_category_code: draft.expense_category_code,
      sub_code: draft.sub_code,
      deductible_percentage: this.ruleForm.deductible,
      min_annual_amount: this.ruleForm.annual,
      min_quarterly_amount: this.ruleForm.quarterly,
      currency_code: draft.currency_code,
      filing_deadline_month: draft.filing_deadline_month,
      filing_deadline_day: draft.filing_deadline_day,
      vat_rates: draft.vat_rates,
      requires_fiscal_representative: draft.requires_fiscal_representative,
      requires_taxable_status_certificate: draft.requires_taxable_status_certificate,
      notes_key: draft.notes_key,
      is_active: true,
    };
    // A global rule is customised with a new company rule; a company rule is changed in place.
    const outcome = await this.store.saveRule(payload, draft.is_global ? undefined : draft.id);
    await this.done(outcome, 'foreignVat.toast.ruleSaved', () => this.ruleDraft.set(null), () => this.loadRules());
  }

  protected async revertRule(rule: FvrRule): Promise<void> {
    await this.done(await this.store.revertRule(rule.id), 'foreignVat.toast.ruleReverted', () => undefined, () => this.loadRules());
  }

  protected openMandate(mandate: FvrMandate | null): void {
    this.editingMandate = mandate?.id ?? null;
    this.mandateForm =
      mandate === null
        ? { ...EMPTY_MANDATE }
        : {
            country_code: mandate.country_code,
            representative_name: mandate.representative_name,
            representative_tax_id: mandate.representative_tax_id ?? '',
            address: mandate.address ?? '',
            postal_code: mandate.postal_code ?? '',
            city: mandate.city ?? '',
            email: mandate.email ?? '',
            phone: mandate.phone ?? '',
            mandate_start_date: new Date(mandate.mandate_start_date),
            mandate_end_date: mandate.mandate_end_date ? new Date(mandate.mandate_end_date) : null,
            certificate_expiry_date: mandate.certificate_expiry_date ? new Date(mandate.certificate_expiry_date) : null,
          };
    this.mandateOpen.set(true);
  }

  protected mandateValid(): boolean {
    return this.mandateForm.country_code !== null && this.mandateForm.representative_name.trim() !== '' && this.mandateForm.mandate_start_date !== null;
  }

  protected async saveMandate(): Promise<void> {
    const f = this.mandateForm;
    if (!this.mandateValid() || f.country_code === null || f.mandate_start_date === null) {
      return;
    }
    const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());
    const payload: FvrMandatePayload = {
      country_code: f.country_code,
      representative_name: f.representative_name.trim(),
      representative_tax_id: orNull(f.representative_tax_id),
      address: orNull(f.address),
      postal_code: orNull(f.postal_code),
      city: orNull(f.city),
      email: orNull(f.email),
      phone: orNull(f.phone),
      mandate_start_date: isoDay(f.mandate_start_date),
      mandate_end_date: f.mandate_end_date ? isoDay(f.mandate_end_date) : null,
      certificate_expiry_date: f.certificate_expiry_date ? isoDay(f.certificate_expiry_date) : null,
      is_active: true,
    };
    const outcome = await this.store.saveMandate(payload, this.editingMandate ?? undefined);
    await this.done(outcome, 'foreignVat.toast.mandateSaved', () => this.mandateOpen.set(false), () => this.store.loadMandates());
  }

  protected async removeMandate(mandate: FvrMandate): Promise<void> {
    await this.done(await this.store.removeMandate(mandate.id), 'foreignVat.toast.mandateDeleted', () => undefined, () => this.store.loadMandates());
  }

  protected async upload(mandate: FvrMandate, type: 'power_of_attorney' | 'certificate', event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (file) {
      const expiry = type === 'certificate' ? mandate.certificate_expiry_date : null;
      await this.done(await this.store.uploadDocument(mandate.id, type, file, expiry), 'foreignVat.toast.documentSaved', () => undefined, () => this.store.loadMandates());
    }
    input.value = '';
  }

  protected async open(mandate: FvrMandate, type: 'power_of_attorney' | 'certificate'): Promise<void> {
    const blob = await this.store.downloadDocument(mandate.id, type);
    if (blob) {
      saveBlob(blob, `${type}-${mandate.country_code}`);
    }
  }

  protected async toggleIntercept(value: boolean): Promise<void> {
    await this.done(await this.store.saveSettings({ auto_intercept: value }), 'foreignVat.toast.settingsSaved', () => undefined, () => this.store.loadSettings());
  }

  private async done(outcome: FvrOutcome, successKey: string, onSuccess: () => void, refresh: () => Promise<void>): Promise<void> {
    if (outcome.ok) {
      this.feedback.set(null);
      onSuccess();
      this.message.success(this.i18n.instant(successKey));
    } else {
      this.feedback.set(outcome.errorKey);
    }
    await refresh();
  }
}
