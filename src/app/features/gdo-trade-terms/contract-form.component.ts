import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  GDT_JURISDICTIONS,
  GdtAccountRef,
  GdtContract,
  GdtContractPayload,
  GdtCustomerRef,
  GdtJurisdiction,
} from '@core';
import { TranslatePipe } from '@shared';
import { cascadeDiscount, currentYear, GdtOutcome, percentText } from './gdo-trade-terms.util';

/**
 * The form of a framework contract: the retailer, the period, the on-invoice discount cascade (1st, 2nd, 3rd discount and
 * Ce.Di.), the tolerance of the promotional invoice check and the ledger accounts of the accrual. Used to create a contract
 * and to edit it.
 */
@Component({
  selector: 'app-gdt-contract-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzAlertModule, NzButtonModule, NzCheckboxModule, NzInputModule, NzSelectModule, ReactiveFormsModule, TranslatePipe],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <form [formGroup]="form" class="form" (ngSubmit)="submit()">
      @if (error(); as failure) {
        <nz-alert
          class="feedback"
          nzType="error"
          nzShowIcon
          [nzMessage]="(failure.errorKey ?? 'gdoTradeTerms.error.generic') | translate: failure.params"
          [nzDescription]="failure.detail ?? null"
        ></nz-alert>
      }

      <div class="form-grid">
        <label class="field" for="gdt-c-code">
          <span>{{ 'gdoTradeTerms.field.code' | translate }}</span>
          <input nz-input id="gdt-c-code" formControlName="code" maxlength="40" />
        </label>
        <label class="field" for="gdt-c-name">
          <span>{{ 'gdoTradeTerms.field.name' | translate }}</span>
          <input nz-input id="gdt-c-name" formControlName="name" maxlength="160" />
        </label>
        <label class="field" for="gdt-c-contact">
          <span>{{ 'gdoTradeTerms.field.retailer' | translate }}</span>
          <nz-select nzId="gdt-c-contact" nzShowSearch formControlName="contact_id">
            @for (customer of customers(); track customer.id) {
              <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="gdt-c-jurisdiction">
          <span>{{ 'gdoTradeTerms.field.jurisdiction' | translate }}</span>
          <nz-select nzId="gdt-c-jurisdiction" formControlName="jurisdiction">
            @for (jurisdiction of jurisdictions; track jurisdiction) {
              <nz-option [nzValue]="jurisdiction" [nzLabel]="'gdoTradeTerms.jurisdiction.' + jurisdiction | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="gdt-c-currency">
          <span>{{ 'gdoTradeTerms.field.currency' | translate }}</span>
          <input nz-input id="gdt-c-currency" formControlName="currency" maxlength="3" />
        </label>
        <label class="field" for="gdt-c-start">
          <span>{{ 'gdoTradeTerms.field.startsOn' | translate }}</span>
          <input nz-input id="gdt-c-start" type="date" formControlName="starts_on" />
        </label>
        <label class="field" for="gdt-c-end">
          <span>{{ 'gdoTradeTerms.field.endsOn' | translate }}</span>
          <input nz-input id="gdt-c-end" type="date" formControlName="ends_on" />
        </label>
      </div>

      <label nz-checkbox for="gdt-c-child-contacts" nzId="gdt-c-child-contacts" formControlName="include_child_contacts">
        {{ 'gdoTradeTerms.field.includeChildContacts' | translate }}
      </label>

      <div class="section-title">{{ 'gdoTradeTerms.section.onInvoice' | translate }}</div>
      <div class="form-grid">
        <label class="field" for="gdt-c-d1">
          <span>{{ 'gdoTradeTerms.field.discount1' | translate }}</span>
          <input nz-input id="gdt-c-d1" type="number" step="0.01" min="0" max="100" formControlName="discount_1_percent" />
        </label>
        <label class="field" for="gdt-c-d2">
          <span>{{ 'gdoTradeTerms.field.discount2' | translate }}</span>
          <input nz-input id="gdt-c-d2" type="number" step="0.01" min="0" max="100" formControlName="discount_2_percent" />
        </label>
        <label class="field" for="gdt-c-d3">
          <span>{{ 'gdoTradeTerms.field.discount3' | translate }}</span>
          <input nz-input id="gdt-c-d3" type="number" step="0.01" min="0" max="100" formControlName="discount_3_percent" />
        </label>
        <label class="field" for="gdt-c-cedi">
          <span>{{ 'gdoTradeTerms.field.cediDiscount' | translate }}</span>
          <input nz-input id="gdt-c-cedi" type="number" step="0.01" min="0" max="100" formControlName="cedi_discount_percent" />
        </label>
        <label class="field" for="gdt-c-pallet">
          <span>{{ 'gdoTradeTerms.field.palletDiscount' | translate }}</span>
          <input nz-input id="gdt-c-pallet" type="number" step="0.01" min="0" formControlName="pallet_discount_amount" />
        </label>
      </div>
      <p class="muted">
        {{ 'gdoTradeTerms.hint.effectiveDiscount' | translate }}: <strong>{{ effectiveDiscount() }}</strong>
      </p>

      <div class="section-title">{{ 'gdoTradeTerms.section.settlementRules' | translate }}</div>
      <div class="form-grid">
        <label class="field" for="gdt-c-tolerance">
          <span>{{ 'gdoTradeTerms.field.tolerance' | translate }}</span>
          <input nz-input id="gdt-c-tolerance" type="number" step="0.01" min="0" max="100" formControlName="tolerance_percent" />
        </label>
        @for (account of accountFields; track account.control) {
          <label class="field" [attr.for]="'gdt-c-' + account.control">
            <span>{{ account.label | translate }}</span>
            <nz-select [nzId]="'gdt-c-' + account.control" nzAllowClear nzShowSearch [formControlName]="account.control">
              @for (item of accounts(); track item.id) {
                <nz-option [nzValue]="item.id" [nzLabel]="(item.code ?? '') + ' ' + item.name"></nz-option>
              }
            </nz-select>
          </label>
        }
      </div>

      <label class="field" for="gdt-c-notes">
        <span>{{ 'gdoTradeTerms.field.notes' | translate }}</span>
        <textarea nz-input id="gdt-c-notes" rows="2" formControlName="notes"></textarea>
      </label>

      @if (!readOnly()) {
        <div class="actions">
          <button nz-button nzType="primary" type="submit" [nzLoading]="saving()" [disabled]="form.invalid">
            {{ 'gdoTradeTerms.action.save' | translate }}
          </button>
        </div>
      }
    </form>
  `,
})
export class ContractFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly contract = input<GdtContract | null>(null);
  readonly customers = input<readonly GdtCustomerRef[]>([]);
  readonly accounts = input<readonly GdtAccountRef[]>([]);
  readonly saving = input(false);
  readonly readOnly = input(false);
  readonly error = input<GdtOutcome | null>(null);
  readonly submitted = output<GdtContractPayload>();

  protected readonly jurisdictions = GDT_JURISDICTIONS;
  protected readonly accountFields = [
    { control: 'expense_account_id', label: 'gdoTradeTerms.field.expenseAccount' },
    { control: 'provision_account_id', label: 'gdoTradeTerms.field.provisionAccount' },
    { control: 'payable_account_id', label: 'gdoTradeTerms.field.payableAccount' },
    { control: 'vat_account_id', label: 'gdoTradeTerms.field.vatAccount' },
  ] as const;

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    contact_id: ['', Validators.required],
    include_child_contacts: [true],
    jurisdiction: ['IT' as GdtJurisdiction],
    currency: ['EUR', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    starts_on: [currentYear().start, Validators.required],
    ends_on: [currentYear().end, Validators.required],
    discount_1_percent: ['0'],
    discount_2_percent: ['0'],
    discount_3_percent: ['0'],
    cedi_discount_percent: ['0'],
    pallet_discount_amount: ['0'],
    tolerance_percent: ['2'],
    expense_account_id: [null as string | null],
    provision_account_id: [null as string | null],
    payable_account_id: [null as string | null],
    vat_account_id: [null as string | null],
    notes: [''],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  protected readonly effectiveDiscount = computed(() => {
    const value = this.value();
    return percentText(
      cascadeDiscount([
        value.discount_1_percent ?? 0,
        value.discount_2_percent ?? 0,
        value.discount_3_percent ?? 0,
        value.cedi_discount_percent ?? 0,
      ]),
    );
  });

  constructor() {
    effect(() => {
      const contract = this.contract();
      if (contract === null) {
        return;
      }
      this.form.reset({
        code: contract.code,
        name: contract.name,
        contact_id: contract.contact_id,
        include_child_contacts: contract.include_child_contacts,
        jurisdiction: contract.jurisdiction,
        currency: contract.currency,
        starts_on: contract.starts_on,
        ends_on: contract.ends_on,
        discount_1_percent: String(contract.discount_1_percent),
        discount_2_percent: String(contract.discount_2_percent),
        discount_3_percent: String(contract.discount_3_percent),
        cedi_discount_percent: String(contract.cedi_discount_percent),
        pallet_discount_amount: String(contract.pallet_discount_amount),
        tolerance_percent: String(contract.tolerance_percent),
        expense_account_id: contract.expense_account_id,
        provision_account_id: contract.provision_account_id,
        payable_account_id: contract.payable_account_id,
        vat_account_id: contract.vat_account_id,
        notes: contract.notes ?? '',
      });
    });

    effect(() => {
      if (this.readOnly()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    this.submitted.emit({
      code: value.code,
      name: value.name,
      contact_id: value.contact_id,
      include_child_contacts: value.include_child_contacts,
      jurisdiction: value.jurisdiction,
      currency: value.currency.toUpperCase(),
      starts_on: value.starts_on,
      ends_on: value.ends_on,
      discount_1_percent: value.discount_1_percent,
      discount_2_percent: value.discount_2_percent,
      discount_3_percent: value.discount_3_percent,
      cedi_discount_percent: value.cedi_discount_percent,
      pallet_discount_amount: value.pallet_discount_amount,
      tolerance_percent: value.tolerance_percent,
      expense_account_id: value.expense_account_id,
      provision_account_id: value.provision_account_id,
      payable_account_id: value.payable_account_id,
      vat_account_id: value.vat_account_id,
      notes: value.notes || null,
    });
  }
}
