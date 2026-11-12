import { Component, inject, input, OnInit } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { CoreDocumentLine, CoreDocumentLinePayload } from '@core';
import { TranslatePipe } from '@shared';
import { SalesLookupsService } from './sales-lookups.service';

export const DECIMAL_PATTERN = /^\d+(\.\d{1,4})?$/;

export type LineGroup = FormGroup<{
  product_id: FormControl<string>;
  description: FormControl<string>;
  quantity: FormControl<string>;
  unit_price: FormControl<string>;
  tax_rate: FormControl<string>;
  discount_percentage: FormControl<string>;
}>;

export function createLineGroup(fb: NonNullableFormBuilder, line?: Partial<CoreDocumentLine>): LineGroup {
  return fb.group({
    product_id: fb.control(line?.product_id ?? ''),
    description: fb.control(line?.description ?? '', [Validators.required, Validators.maxLength(1000)]),
    quantity: fb.control(String(line?.quantity ?? '1'), [Validators.required, Validators.pattern(DECIMAL_PATTERN)]),
    unit_price: fb.control(String(line?.unit_price ?? '0'), [Validators.required, Validators.pattern(DECIMAL_PATTERN)]),
    tax_rate: fb.control(String(line?.tax_rate ?? '22'), [Validators.required, Validators.pattern(DECIMAL_PATTERN)]),
    discount_percentage: fb.control(String(line?.discount_percentage ?? ''), [Validators.pattern(DECIMAL_PATTERN)]),
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
  imports: [ReactiveFormsModule, NzButtonModule, NzIconModule, NzInputModule, NzSelectModule, TranslatePipe],
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
            nz-button
            nzType="text"
            nzDanger
            type="button"
            [disabled]="lines().length <= 1"
            [attr.aria-label]="'SC.LINES.REMOVE' | translate"
            (click)="remove(i)"
          >
            <nz-icon nzType="delete" />
          </button>
        </div>
      }
      <button nz-button nzType="dashed" type="button" (click)="add()">
        <nz-icon nzType="plus" /> {{ 'SC.LINES.ADD' | translate }}
      </button>
    </div>
  `,
})
export class DocumentLinesEditorComponent implements OnInit {
  protected readonly lookups = inject(SalesLookupsService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly lines = input.required<FormArray<LineGroup>>();

  ngOnInit(): void {
    this.lookups.load();
  }

  add(): void {
    this.lines().push(createLineGroup(this.fb));
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
    line.controls.unit_price.setValue(String(product.price));
  }
}
