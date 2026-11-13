import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  applyServerErrors,
  CoreDeliveryNote,
  CoreDocumentLine,
  DeliveryNoteFromDocumentPayload,
  SalesCycleApiService,
  TransportBy,
} from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { DECIMAL_PATTERN } from './document-lines-editor.component';
import { SalesLookupsService } from './sales-lookups.service';

export interface DeliveryNoteSource {
  kind: 'order' | 'quote';
  id: string;
  items: CoreDocumentLine[];
}

const TRANSPORT_BY: TransportBy[] = ['sender', 'recipient', 'carrier'];

/** Creates a (possibly partial) delivery note from an order or a quote, with the transport data. */
@Component({
  selector: 'app-delivery-note-form-modal',
  styleUrl: './delivery-note-form-modal.component.scss',
  imports: [
    ModalActionsDirective,
    ReactiveFormsModule,
    FormsModule,
    NzModalModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzSelectModule,
    NzCheckboxModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'SC.DDT.NEW' | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="form.invalid"
      nzWidth="860px"
      (nzOnCancel)="visible.set(false)"
      okAction="create"
      (nzOnOk)="submit()"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div nz-row [nzGutter]="16">
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label nzFor="ddt-warehouse">{{ 'SC.DDT.WAREHOUSE' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select nzId="ddt-warehouse" formControlName="warehouse_id" nzAllowClear>
                    @for (w of lookups.warehouses(); track w.id) {
                      <nz-option [nzValue]="w.id" [nzLabel]="w.code + ' - ' + w.name"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label nzFor="ddt-reason">{{ 'SC.DDT.TRANSPORT_REASON' | translate }}</nz-form-label>
                <nz-form-control>
                  <input nz-input id="ddt-reason" maxlength="100" formControlName="transport_reason" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label nzFor="ddt-appearance">{{ 'SC.DDT.GOODS_APPEARANCE' | translate }}</nz-form-label>
                <nz-form-control>
                  <input nz-input id="ddt-appearance" maxlength="100" formControlName="goods_appearance" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="6">
              <nz-form-item>
                <nz-form-label nzFor="ddt-packages">{{ 'SC.DDT.PACKAGES' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'SC.COMMON.INVALID' | translate">
                  <input nz-input id="ddt-packages" inputmode="numeric" formControlName="packages_count" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="6">
              <nz-form-item>
                <nz-form-label nzFor="ddt-gross">{{ 'SC.DDT.GROSS_WEIGHT' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'SC.COMMON.INVALID' | translate">
                  <input nz-input id="ddt-gross" inputmode="decimal" formControlName="gross_weight_kg" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="6">
              <nz-form-item>
                <nz-form-label nzFor="ddt-net">{{ 'SC.DDT.NET_WEIGHT' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'SC.COMMON.INVALID' | translate">
                  <input nz-input id="ddt-net" inputmode="decimal" formControlName="net_weight_kg" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="6">
              <nz-form-item>
                <nz-form-label nzFor="ddt-transport-by">{{ 'SC.DDT.TRANSPORT_BY' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select nzId="ddt-transport-by" formControlName="transport_by" nzAllowClear>
                    @for (t of transportBy; track t) {
                      <nz-option [nzValue]="t" [nzLabel]="'SC.DDT.TRANSPORT_BY_' + t | translate"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label nzFor="ddt-carrier">{{ 'SC.DDT.CARRIER' | translate }}</nz-form-label>
                <nz-form-control>
                  <input nz-input id="ddt-carrier" maxlength="255" formControlName="carrier_name" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label nzFor="ddt-plate">{{ 'SC.DDT.PLATE' | translate }}</nz-form-label>
                <nz-form-control>
                  <input nz-input id="ddt-plate" maxlength="30" formControlName="carrier_license_plate" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label nzFor="ddt-terms">{{ 'SC.DDT.SHIPPING_TERMS' | translate }}</nz-form-label>
                <nz-form-control>
                  <input nz-input id="ddt-terms" maxlength="100" formControlName="shipping_terms" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label nzFor="ddt-courier">{{ 'SC.DDT.COURIER' | translate }}</nz-form-label>
                <nz-form-control>
                  <input nz-input id="ddt-courier" maxlength="255" formControlName="courier" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label nzFor="ddt-tracking">{{ 'SC.DDT.TRACKING' | translate }}</nz-form-label>
                <nz-form-control>
                  <input nz-input id="ddt-tracking" maxlength="100" formControlName="tracking_number" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label nzFor="ddt-address">{{ 'SC.DDT.SHIPPING_ADDRESS' | translate }}</nz-form-label>
                <nz-form-control>
                  <input nz-input id="ddt-address" maxlength="1000" formControlName="shipping_address" />
                </nz-form-control>
              </nz-form-item>
            </div>
          </div>
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-checkbox formControlName="show_prices">{{ 'SC.DDT.SHOW_PRICES' | translate }}</label>
        </form>

        @if (source().items.length) {
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-checkbox class="partial" [ngModel]="partial()" (ngModelChange)="partial.set($event)">
            {{ 'SC.DDT.PARTIAL' | translate }}
          </label>
          @if (partial()) {
            <p class="hint">{{ 'SC.DDT.PARTIAL_HINT' | translate }}</p>
            @for (item of source().items; track item.id) {
              <div class="partial-line">
                <span class="desc">{{ item.description }}</span>
                <span class="qty">{{ item.quantity_delivered ?? '0' }} / {{ item.quantity }}</span>
                <input
                  nz-input
                  inputmode="decimal"
                  [attr.aria-label]="'SC.DDT.QUANTITY_TO_SHIP' | translate"
                  [placeholder]="'SC.DDT.QUANTITY_TO_SHIP' | translate"
                  [ngModel]="quantities()[item.id ?? ''] ?? ''"
                  (ngModelChange)="setQuantity(item.id ?? '', $event)"
                />
              </div>
            }
          }
        }
      </ng-container>
    </nz-modal>
  `,
})
export class DeliveryNoteFormModalComponent {
  protected readonly lookups = inject(SalesLookupsService);
  private readonly api = inject(SalesCycleApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);

  readonly source = input.required<DeliveryNoteSource>();
  readonly visible = model(false);
  readonly saved = output<CoreDeliveryNote>();

  protected readonly transportBy = TRANSPORT_BY;
  protected readonly saving = signal(false);
  protected readonly partial = signal(false);
  protected readonly quantities = signal<Record<string, string>>({});

  protected readonly form = this.fb.group({
    warehouse_id: [''],
    transport_reason: ['', [Validators.maxLength(100)]],
    goods_appearance: ['', [Validators.maxLength(100)]],
    packages_count: ['', [Validators.pattern(/^([1-9]\d*)?$/)]],
    gross_weight_kg: ['', [Validators.pattern(DECIMAL_PATTERN)]],
    net_weight_kg: ['', [Validators.pattern(DECIMAL_PATTERN)]],
    carrier_name: ['', [Validators.maxLength(255)]],
    carrier_license_plate: ['', [Validators.maxLength(30)]],
    shipping_terms: ['', [Validators.maxLength(100)]],
    transport_by: [''],
    courier: ['', [Validators.maxLength(255)]],
    tracking_number: ['', [Validators.maxLength(100)]],
    shipping_address: ['', [Validators.maxLength(1000)]],
    show_prices: [false],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.lookups.load();
        this.form.reset();
        this.partial.set(false);
        this.quantities.set({});
      }
    });
  }

  protected setQuantity(itemId: string, value: string): void {
    this.quantities.update((q) => ({ ...q, [itemId]: value }));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const source = this.source();
    const lines = this.partial()
      ? source.items
          .filter((item) => item.id && this.quantities()[item.id])
          .map((item) =>
            source.kind === 'order'
              ? { sales_order_item_id: item.id, quantity: this.quantities()[item.id ?? ''] }
              : { quote_item_id: item.id, quantity: this.quantities()[item.id ?? ''] },
          )
      : null;
    const payload: DeliveryNoteFromDocumentPayload = {
      lines,
      warehouse_id: v.warehouse_id || null,
      transport_reason: v.transport_reason || null,
      goods_appearance: v.goods_appearance || null,
      packages_count: v.packages_count ? Number(v.packages_count) : null,
      gross_weight_kg: v.gross_weight_kg || null,
      net_weight_kg: v.net_weight_kg || null,
      carrier_name: v.carrier_name || null,
      carrier_license_plate: v.carrier_license_plate || null,
      shipping_terms: v.shipping_terms || null,
      transport_by: (v.transport_by as TransportBy) || null,
      courier: v.courier || null,
      tracking_number: v.tracking_number || null,
      shipping_address: v.shipping_address || null,
      show_prices: v.show_prices,
    };
    this.saving.set(true);
    const request =
      source.kind === 'order'
        ? this.api.createDeliveryNoteFromOrder(source.id, payload)
        : this.api.createDeliveryNoteFromQuote(source.id, payload);
    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.visible.set(false);
        this.message.success(res.message);
        this.saved.emit(res.data);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form, err);
        this.message.error(unmapped[0] ?? (err as { error?: { message?: string } })?.error?.message ?? '');
      },
    });
  }
}