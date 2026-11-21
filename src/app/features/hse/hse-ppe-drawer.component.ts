import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@core';
import { SignaturePadComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { InventoryApiService } from '../../core/api/inventory-api.service';
import { ProductItem, WarehouseItem } from '../../core/models/inventory.model';
import { HseApiService } from './hse-api.service';
import { PpeDistribution } from './hse.models';
import { HseStore } from './hse.store';

/**
 * PPE issuance drawer: warehouse and product lookup against Warehouse Management (Mod 051) with the stock available, lot or
 * serial, the worker signature on a canvas (the web fallback of the mobile signature) and the signed Verbale di Consegna as a PDF
 * once the hand-over is recorded. The signature payload is the drawn image; the server hashes it with the hand-over data.
 */
@Component({
  selector: 'app-hse-ppe-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    SignaturePadComponent,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      [nzTitle]="'HSE.PPE_TITLE' | translate"
      nzWidth="480"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        <p class="muted">{{ employeeName() }}</p>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()" data-testid="ppe-form">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'HSE.PPE_WAREHOUSE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="warehouseId" (ngModelChange)="loadStock()" data-testid="warehouse">
                @for (warehouse of warehouses(); track warehouse.id) {
                  <nz-option [nzValue]="warehouse.id" [nzLabel]="warehouse.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'HSE.PPE_PRODUCT' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="productId" nzShowSearch data-testid="product">
                @for (product of products(); track product.id) {
                  <nz-option [nzValue]="product.id" [nzLabel]="product.sku + ' · ' + product.name"></nz-option>
                }
              </nz-select>
              @if (availableStock() !== null) {
                <span class="muted" data-testid="stock">{{
                  'HSE.PPE_STOCK' | translate: { quantity: availableStock() ?? 0 }
                }}</span>
              }
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.PPE_LOT' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="lot" data-testid="lot" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'HSE.PPE_QUANTITY' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-input-number formControlName="quantity" [nzMin]="1" data-testid="quantity"></nz-input-number>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.PPE_REPLACEMENT' | translate }}</nz-form-label>
            <nz-form-control><nz-date-picker formControlName="replacementDue"></nz-date-picker></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'HSE.PPE_SIGN_HERE' | translate }}</nz-form-label>
            <nz-form-control>
              <p class="muted">{{ legalKey() | translate }}</p>
              <app-signature-pad (signatureChange)="signature.set($event)"></app-signature-pad>
            </nz-form-control>
          </nz-form-item>
          <button
            nz-button
            nzType="primary"
            type="submit"
            data-testid="confirm"
            [nzLoading]="store.busy()"
            [disabled]="form.invalid || signature() === null"
          >
            {{ 'HSE.PPE_CONFIRM' | translate }}
          </button>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class HsePpeDrawerComponent {
  protected readonly store = inject(HseStore);
  private readonly hseApi = inject(HseApiService);
  private readonly inventory = inject(InventoryApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  readonly employeeId = input.required<string>();
  readonly employeeName = input<string>('');
  /** The statutory regime of the tenant, which picks the legal notice shown before the worker signs. */
  readonly jurisdiction = input<'IT' | 'CH'>('IT');
  readonly closed = output<void>();
  readonly issued = output<PpeDistribution>();

  protected readonly warehouses = signal<WarehouseItem[]>([]);
  protected readonly products = signal<ProductItem[]>([]);
  protected readonly availableStock = signal<number | null>(null);
  protected readonly signature = signal<string | null>(null);

  protected readonly form = this.fb.group({
    warehouseId: ['', Validators.required],
    productId: ['', Validators.required],
    lot: [''],
    quantity: [1, [Validators.required, Validators.min(1)]],
    replacementDue: [null as Date | null],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.inventory.getWarehouses({ is_active: true }).subscribe({
          next: (res) => this.warehouses.set(res.data),
          error: () => this.message.error(this.i18n.instant('HSE.LOAD_ERROR')),
        });
        this.inventory.getProducts({ per_page: 100 }).subscribe({
          next: (res) => this.products.set(res.data),
          error: () => this.message.error(this.i18n.instant('HSE.LOAD_ERROR')),
        });
      }
    });

    this.form.controls.productId.valueChanges.subscribe(() => this.loadStock());
  }

  protected legalKey(): string {
    return this.jurisdiction() === 'CH' ? 'HSE.PPE_LEGAL_CH' : 'HSE.PPE_LEGAL_IT';
  }

  protected loadStock(): void {
    const { warehouseId, productId } = this.form.getRawValue();

    if (warehouseId === '' || productId === '') {
      this.availableStock.set(null);

      return;
    }

    this.inventory.getStockLevels(warehouseId).subscribe({
      next: (res) =>
        this.availableStock.set(res.data.find((level) => level.product_id === productId)?.available ?? 0),
      error: () => this.availableStock.set(null),
    });
  }

  protected submit(): void {
    const signature = this.signature();

    if (this.form.invalid || signature === null) {
      return;
    }

    const value = this.form.getRawValue();

    this.store
      .issuePpe({
        employee_id: this.employeeId(),
        product_id: value.productId,
        warehouse_id: value.warehouseId,
        lot_or_serial_id: value.lot === '' ? null : value.lot,
        quantity: value.quantity,
        ce_marking_standard: null,
        replacement_due_at: value.replacementDue === null ? null : value.replacementDue.toISOString().slice(0, 10),
        signature_payload: signature,
        signature_image: signature,
        locale: this.i18n.currentLanguage(),
      })
      .subscribe({
        next: (distribution) => {
          this.message.success(this.i18n.instant('HSE.PPE_DONE'));
          this.issued.emit(distribution);
          this.previewVerbale(distribution);
          this.closed.emit();
        },
        error: (error: HttpErrorResponse) =>
          this.message.error((error.error as { detail?: string } | null)?.detail ?? this.i18n.instant('HSE.SAVE_ERROR')),
      });
  }

  /** Opens the signed record in a new tab; the PDF is archived in the dossier either way. */
  private previewVerbale(distribution: PpeDistribution): void {
    this.hseApi.verbale(distribution.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => undefined,
    });
  }
}
