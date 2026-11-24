import { Component, inject, input, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { CoreDocumentLine, CoreDocumentLinePayload } from '@core';
import { IconActionDirective, TranslatePipe } from '@shared';
import { SalesLookupsService } from './sales-lookups.service';

export const DECIMAL_PATTERN = /^\d+(\.\d{1,4})?$/;

/** The numeric text must be greater than zero (the API requires quantity gt:0). */
export const greaterThanZero: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const raw = String(control.value ?? '').trim();
  return raw === '' || Number(raw) > 0 ? null : { min: { min: 0 } };
};

/** The numeric text must not exceed the given maximum. */
export function maxNumber(limit: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = String(control.value ?? '').trim();
    return raw === '' || Number(raw) <= limit ? null : { max: { max: limit } };
  };
}

export type LineGroup = FormGroup<{
  product_id: FormControl<string>;
  description: FormControl<string>;
  quantity: FormControl<string>;
  unit_price: FormControl<string>;
  tax_rate: FormControl<string>;
  discount_percentage: FormControl<string>;
}>;

/** The numeric text must be strictly below the given limit (the API `lt:` rule). */
export function belowNumber(limit: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = String(control.value ?? '').trim();
    return raw === '' || Number(raw) < limit ? null : { max: { max: limit } };
  };
}

/** Stricter line rules of the documents whose API request is tighter than the quote/order one. */
export interface LineGroupOptions {
  /** `unit_price` gt:0 (debit note) instead of min:0. */
  positiveUnitPrice?: boolean;
  /** `discount_percentage` lt:100 (debit note) instead of max:100. */
  discountBelow100?: boolean;
}

export function createLineGroup(fb: NonNullableFormBuilder, line?: Partial<CoreDocumentLine>, options: LineGroupOptions = {}): LineGroup {
  return fb.group({
    product_id: fb.control(line?.product_id ?? ''),
    description: fb.control(line?.description ?? '', [Validators.required, Validators.maxLength(1000)]),
    quantity: fb.control(String(line?.quantity ?? '1'), [Validators.required, Validators.pattern(DECIMAL_PATTERN), greaterThanZero]),
    unit_price: fb.control(String(line?.unit_price ?? (options.positiveUnitPrice ? '' : '0')), [
      Validators.required,
      Validators.pattern(DECIMAL_PATTERN),
      ...(options.positiveUnitPrice ? [greaterThanZero] : []),
    ]),
    tax_rate: fb.control(String(line?.tax_rate ?? '22'), [Validators.required, Validators.pattern(DECIMAL_PATTERN), maxNumber(100)]),
    discount_percentage: fb.control(String(line?.discount_percentage ?? ''), [
      Validators.pattern(DECIMAL_PATTERN),
      options.discountBelow100 ? belowNumber(100) : maxNumber(100),
    ]),
  });
}

/** Converts the form rows into the API payload: decimals stay strings, empty optionals become null. */
export function linesToPayload(lines: FormArray<LineGroup>): CoreDocumentLinePayload[] {
  return lines.getRawValue().map((row) => ({
    product_id: row.product_id || null,
    description: row.description,
    quantity: row.quantity,
    unit_price: row.unit_price,
    tax_rate: row.tax_rate,
    discount_percentage: row.discount_percentage || null,
  }));
}

/** Editable table of document lines (product, description, quantity, price, VAT rate, discount). */
@Component({
  selector: 'app-document-lines-editor',
  styleUrl: './document-lines-editor.component.scss',
  imports: [IconActionDirective, ReactiveFormsModule, NzButtonModule, NzIconModule, NzInputModule, NzSelectModule, TranslatePipe],
  template: `
    <div class="lines" role="group" [attr.aria-label]="'SC.LINES.TITLE' | translate">
      @for (line of lines().controls; track line; let i = $index) {
        <div class="line" [formGroup]="line">
          <nz-select
            class="product"
            formControlName="product_id"
            nzShowSearch
            nzAllowClear
            [nzPlaceHolder]="'SC.LINES.PRODUCT' | translate"
            (ngModelChange)="onProductChange(line, $event)"
          >
            @for (p of lookups.products(); track p.id) {
              <nz-option [nzValue]="p.id" [nzLabel]="p.sku + ' - ' + p.name"></nz-option>
            }
          </nz-select>
          <input
            nz-input
            class="description"
            formControlName="description"
            [placeholder]="'SC.LINES.DESCRIPTION' | translate"
            [attr.aria-label]="'SC.LINES.DESCRIPTION' | translate"
          />
          <input
            nz-input
            class="num"
            inputmode="decimal"
            formControlName="quantity"
            [placeholder]="'SC.LINES.QUANTITY' | translate"
            [attr.aria-label]="'SC.LINES.QUANTITY' | translate"
          />
          <input
            nz-input
            class="num"
            inputmode="decimal"
            formControlName="unit_price"
            [placeholder]="'SC.LINES.UNIT_PRICE' | translate"
            [attr.aria-label]="'SC.LINES.UNIT_PRICE' | translate"
          />
          <input
            nz-input
            class="num"
            inputmode="decimal"
            formControlName="tax_rate"
            [placeholder]="'SC.LINES.TAX_RATE' | translate"
            [attr.aria-label]="'SC.LINES.TAX_RATE' | translate"
          />
          <input
            nz-input
            class="num"
            inputmode="decimal"
            formControlName="discount_percentage"
            [placeholder]="'SC.LINES.DISCOUNT' | translate"
            [attr.aria-label]="'SC.LINES.DISCOUNT' | translate"
          />
          <button
            nz-button appIconAction="delete"
            nzType="text"
            nzDanger
            type="button"
            [disabled]="lines().length <= 1"
            (click)="remove(i)"
          ></button>
        </div>
      }
      <button nz-button appIconAction="add" nzType="dashed" type="button" (click)="add()"></button>
    </div>
  `,
})
export class DocumentLinesEditorComponent implements OnInit {
  protected readonly lookups = inject(SalesLookupsService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly lines = input.required<FormArray<LineGroup>>();
  /** Stricter rules of the lines this editor adds (see `LineGroupOptions`). */
  readonly lineOptions = input<LineGroupOptions>({});

  ngOnInit(): void {
    this.lookups.load();
  }

  add(): void {
    this.lines().push(createLineGroup(this.fb, undefined, this.lineOptions()));
  }

  remove(index: number): void {
    if (this.lines().length > 1) {
      this.lines().removeAt(index);
    }
  }

  /** Fills description and net price from the catalog when a product is picked. */
  onProductChange(line: LineGroup, productId: string | null): void {
    const product = this.lookups.products().find((p) => p.id === productId);
    if (!product) {
      return;
    }
    if (!line.controls.description.value) {
      line.controls.description.setValue(product.name);
    }
    line.controls.unit_price.setValue(String(product.sale_price));
  }
}
