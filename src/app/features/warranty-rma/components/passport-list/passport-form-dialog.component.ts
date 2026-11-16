import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  applyServerErrors,
  CreatePassportPayload,
  CustomerType,
  EquipmentPassport,
  I18nService,
  Jurisdiction,
  serverErrorMessage,
  WarrantyRmaApiService,
} from '@core';
import { TranslatePipe } from '@shared';
import { RmaNotifier, runRequest } from '../../state/action-result';
import { CustomerSelectComponent } from '../shared/customer-select.component';

export interface PassportPrefill {
  serial_number?: string | null;
  stock_serial_number_id?: string | null;
  product_id?: string | null;
}

type ComponentRow = FormGroup<{
  position: FormControl<string>;
  component_serial: FormControl<string>;
  role: FormControl<string>;
}>;

const nullable = (v: string): string | null => v.trim() || null;

/** Creates an equipment passport (optionally prefilled from a lookup stock hint). */
@Component({
  selector: 'app-passport-form-dialog',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzButtonModule,
    TranslatePipe,
    CustomerSelectComponent,
  ],
  templateUrl: './passport-form-dialog.component.html',
})
export class PassportFormDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(WarrantyRmaApiService);
  private readonly notifier = inject(RmaNotifier);
  private readonly i18n = inject(I18nService);

  readonly open = model(false);
  readonly prefill = input<PassportPrefill | null>(null);
  readonly created = output<EquipmentPassport>();

  readonly saving = signal(false);
  readonly formErrors = signal<string[]>([]);

  readonly form = this.fb.group({
    serial_number: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
    current_owner_customer_id: this.fb.control<string | null>(null, Validators.required),
    delivery_date: this.fb.control('', Validators.required),
    customer_type: this.fb.control<CustomerType | null>(null),
    jurisdiction: this.fb.control<Jurisdiction | null>(null),
    original_sales_invoice_id: this.fb.control(''),
    stock_serial_number_id: this.fb.control(''),
    product_id: this.fb.control(''),
    contract_warranty_months: this.fb.control<number | null>(null),
    contract_clause_reference: this.fb.control(''),
    installed_firmware_version: this.fb.control(''),
    components: this.fb.array<ComponentRow>([]),
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const p = this.prefill();
      this.form.reset();
      this.components.clear();
      this.formErrors.set([]);
      this.form.patchValue({
        serial_number: p?.serial_number ?? '',
        stock_serial_number_id: p?.stock_serial_number_id ?? '',
        product_id: p?.product_id ?? '',
      });
    });
  }

  get components(): FormArray<ComponentRow> {
    return this.form.controls.components;
  }

  componentGroup(): ComponentRow {
    return this.fb.group({
      position: this.fb.control('', Validators.required),
      component_serial: this.fb.control('', Validators.required),
      role: this.fb.control(''),
    });
  }

  addComponent(): void {
    this.components.push(this.componentGroup());
  }

  removeComponent(index: number): void {
    this.components.removeAt(index);
  }

  errorTip(path: string): string {
    return serverErrorMessage(this.form, path) ?? this.i18n.translate('COMMON.VALIDATION.REQUIRED');
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Object.values(this.form.controls).forEach((c) => c.markAsDirty());
      this.components.controls.forEach((g) =>
        Object.values(g.controls).forEach((c) => c.markAsDirty()),
      );
      return;
    }
    const v = this.form.getRawValue();
    const payload: CreatePassportPayload = {
      serial_number: v.serial_number.trim(),
      current_owner_customer_id: v.current_owner_customer_id ?? '',
      delivery_date: v.delivery_date,
      customer_type: v.customer_type,
      jurisdiction: v.jurisdiction,
      original_sales_invoice_id: nullable(v.original_sales_invoice_id),
      stock_serial_number_id: nullable(v.stock_serial_number_id),
      product_id: nullable(v.product_id),
      contract_warranty_months: v.contract_warranty_months,
      contract_clause_reference: nullable(v.contract_clause_reference),
      installed_firmware_version: nullable(v.installed_firmware_version),
      components: v.components.map((c) => ({
        position: c.position.trim(),
        component_serial: c.component_serial.trim(),
        role: nullable(c.role),
      })),
    };
    this.saving.set(true);
    const res = await runRequest(this.api.createPassport(payload));
    this.saving.set(false);
    if (res.ok) {
      this.notifier.success('RMA.MESSAGES.PASSPORT_CREATED');
      this.open.set(false);
      this.created.emit(res.data.data);
      return;
    }
    this.formErrors.set(applyServerErrors(this.form, res.error));
  }
}
