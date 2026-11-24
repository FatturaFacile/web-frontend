import { Component, computed, effect, inject, input, model, output } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PurchaseOrder, PurchaseOrderLine } from '@core/models';
import { I18nService } from '@core/i18n';
import {
  confirmationLineHasVariance,
  ConfirmationLinePayload,
  PurchaseOrderConfirmationLine,
} from '@domain/procurement/purchase-order-fulfilment.models';
import { DateFormatPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { extractApiErrorMessage, toIsoDateString } from '../requisitions/pr-status.helpers';
import { PurchaseOrderFulfilmentStore } from './purchase-order-fulfilment.store';

type LineGroup = FormGroup<{
  purchase_order_line_id: FormControl<string>;
  confirmed_quantity: FormControl<number | null>;
  confirmed_unit_price: FormControl<number | null>;
  confirmed_delivery_date: FormControl<Date | null>;
  variance_reason: FormControl<string>;
}>;

/** Whether the typed supplier value differs from the ordered one (both optional). */
export function differsFromOrdered(confirmed: number | null, ordered: string | number): boolean {
  return confirmed !== null && Math.abs(confirmed - Number(ordered)) > 1e-9;
}

/**
 * Records the supplier order confirmation of a purchase order. Lines that deviate from the order in quantity,
 * price or date are highlighted while typing; previous confirmations are listed with the variances the API computed.
 */
@Component({
  selector: 'app-po-confirmation-drawer',
  imports: [
    ReactiveFormsModule,
    DateFormatPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzTableModule,
    NzTagModule,
  ],
  styles: `
    .variance { background: var(--ant-warning-color-deprecated-bg, #fffbe6); }
    .variance-flag { font-weight: 600; }
    .row { display: flex; gap: 16px; flex-wrap: wrap; }
  `,
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzTitle]="('purchases.confirmation.title' | translate) + ' - ' + (order()?.po_number ?? '')"
      nzWidth="min(960px, 100vw)"
      (nzOnClose)="visible.set(false)"
      data-testid="po-confirmation-drawer"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <div class="row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="conf-number">{{ 'purchases.fulfilment.confirmation.number' | translate }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="conf-number" formControlName="confirmation_number" maxlength="80" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="conf-date">{{ 'purchases.fulfilment.confirmation.confirmed_at' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-date-picker nzId="conf-date" formControlName="confirmed_at" />
              </nz-form-control>
            </nz-form-item>
          </div>

          <nz-table #linesTable [nzData]="lines.controls" nzSize="small" [nzShowPagination]="false" data-testid="po-confirmation-lines">
            <thead>
              <tr>
                <th>{{ 'purchases.fulfilment.confirmation.line' | translate }}</th>
                <th>{{ 'purchases.fulfilment.confirmation.quantity' | translate }}</th>
                <th>{{ 'purchases.fulfilment.confirmation.price' | translate }}</th>
                <th>{{ 'purchases.fulfilment.confirmation.date' | translate }}</th>
                <th>{{ 'purchases.fulfilment.confirmation.reason' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (group of linesTable.data; track group.controls.purchase_order_line_id.value; let i = $index) {
                <tr [class.variance]="lineDiffers(group)" [attr.data-testid]="'po-confirmation-line-' + i">
                  <td>{{ lineLabel(group.controls.purchase_order_line_id.value) }}</td>
                  <td [formGroup]="group">
                    <nz-input-number formControlName="confirmed_quantity" [nzMin]="0" [attr.aria-label]="'purchases.fulfilment.confirmation.quantity' | translate" />
                    <small>/ {{ orderedLine(group)?.quantity_ordered }}</small>
                  </td>
                  <td [formGroup]="group">
                    <nz-input-number formControlName="confirmed_unit_price" [nzMin]="0" [attr.aria-label]="'purchases.fulfilment.confirmation.price' | translate" />
                    <small>/ {{ orderedLine(group)?.unit_price }}</small>
                  </td>
                  <td [formGroup]="group">
                    <nz-date-picker formControlName="confirmed_delivery_date" />
                  </td>
                  <td [formGroup]="group">
                    <input nz-input formControlName="variance_reason" maxlength="255" [attr.aria-label]="'purchases.fulfilment.confirmation.reason' | translate" />
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          <nz-form-item>
            <nz-form-label nzFor="conf-notes">{{ 'purchases.fulfilment.confirmation.notes' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input id="conf-notes" formControlName="notes" rows="2" maxlength="2000"></textarea>
            </nz-form-control>
          </nz-form-item>

          <button nz-button nzType="primary" type="submit" [disabled]="form.invalid" [nzLoading]="store.busy()" data-testid="po-confirmation-save">
            {{ 'purchases.fulfilment.confirmation.save' | translate }}
          </button>
        </form>

        @if (store.confirmations().length > 0) {
          <h4 class="history-title">{{ 'purchases.fulfilment.confirmation.history' | translate }}</h4>
          @for (confirmation of store.confirmations(); track confirmation.id) {
            <section [attr.data-testid]="'po-confirmation-' + confirmation.id">
              <p>
                <strong>{{ confirmation.confirmation_number }}</strong> - {{ confirmation.confirmed_at | appDate }}
                @if (confirmation.requires_review) {
                  <nz-tag nzColor="error">{{ 'purchases.fulfilment.confirmation.requires_review' | translate }}</nz-tag>
                } @else if (confirmation.has_variance) {
                  <nz-tag nzColor="warning">{{ 'purchases.confirmation.variance' | translate }}</nz-tag>
                } @else {
                  <nz-tag nzColor="success">{{ 'purchases.fulfilment.confirmation.no_variance' | translate }}</nz-tag>
                }
              </p>
              @if (confirmation.has_variance) {
                <nz-alert nzType="warning" nzShowIcon [nzMessage]="varianceSummary(confirmation.price_variance_total, confirmation.quantity_variance_total)" />
              }
              <nz-table #historyTable [nzData]="confirmation.lines ?? []" nzSize="small" [nzShowPagination]="false">
                <thead>
                  <tr>
                    <th>{{ 'purchases.fulfilment.confirmation.line' | translate }}</th>
                    <th>{{ 'purchases.fulfilment.confirmation.quantity' | translate }}</th>
                    <th>{{ 'purchases.fulfilment.confirmation.price' | translate }}</th>
                    <th>{{ 'purchases.fulfilment.confirmation.date' | translate }}</th>
                    <th>{{ 'purchases.confirmation.variance' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of historyTable.data; track line.purchase_order_line_id) {
                    <tr [class.variance]="hasVariance(line)">
                      <td>{{ lineLabel(line.purchase_order_line_id) }}</td>
                      <td>{{ line.ordered_quantity }} → {{ line.confirmed_quantity }}</td>
                      <td>{{ line.ordered_unit_price }} → {{ line.confirmed_unit_price }}</td>
                      <td>{{ line.confirmed_delivery_date | appDate }}</td>
                      <td class="variance-flag">
                        @if (hasVariance(line)) {
                          {{ line.price_variance_percent }}% / {{ line.quantity_variance }}
                          @if (line.delivery_delay_days > 0) {
                            / +{{ line.delivery_delay_days }}d
                          }
                          @if (line.variance_reason) {
                            <br /><small>{{ line.variance_reason }}</small>
                          }
                        } @else {
                          -
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </section>
          }
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class PoConfirmationDrawerComponent {
  protected readonly store = inject(PurchaseOrderFulfilmentStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly order = input<PurchaseOrder | null>(null);
  readonly visible = model(false);
  readonly recorded = output<void>();

  protected readonly lines = new FormArray<LineGroup>([]);
  protected readonly form = this.fb.group({
    confirmation_number: this.fb.control('', [Validators.required, Validators.maxLength(80)]),
    confirmed_at: this.fb.control<Date | null>(new Date()),
    notes: this.fb.control('', Validators.maxLength(2000)),
    lines: this.lines,
  });

  private readonly orderLines = computed<PurchaseOrderLine[]>(() => this.order()?.lines ?? []);

  constructor() {
    effect(() => {
      const order = this.order();
      if (this.visible() && order) {
        this.buildLines(order.lines ?? []);
        this.store.loadConfirmations(order.id).subscribe();
      }
    });
  }

  protected orderedLine(group: LineGroup): PurchaseOrderLine | undefined {
    return this.orderLines().find((l) => l.id === group.controls.purchase_order_line_id.value);
  }

  protected lineLabel(lineId: string): string {
    const line = this.orderLines().find((l) => l.id === lineId);
    return line ? `${line.line_number}. ${line.description}` : lineId;
  }

  /** True while the typed confirmation deviates from the ordered line. */
  lineDiffers(group: LineGroup): boolean {
    const ordered = this.orderedLine(group);
    if (!ordered) {
      return false;
    }
    const value = group.getRawValue();
    return (
      differsFromOrdered(value.confirmed_quantity, ordered.quantity_ordered) ||
      differsFromOrdered(value.confirmed_unit_price, ordered.unit_price)
    );
  }

  protected hasVariance(line: PurchaseOrderConfirmationLine): boolean {
    return confirmationLineHasVariance(line);
  }

  protected varianceSummary(price: string, quantity: string): string {
    return `${this.i18n.translate('purchases.confirmation.variance')}: ${price} / ${quantity}`;
  }

  /** Builds the request body; the API computes the variances against the ordered values. */
  buildPayload(): { confirmation_number: string; confirmed_at: string | null; notes: string | null; lines: ConfirmationLinePayload[] } {
    const raw = this.form.getRawValue();
    return {
      confirmation_number: raw.confirmation_number.trim(),
      confirmed_at: toIsoDateString(raw.confirmed_at),
      notes: raw.notes.trim() || null,
      lines: raw.lines.map((line) => ({
        purchase_order_line_id: line.purchase_order_line_id,
        confirmed_quantity: line.confirmed_quantity,
        confirmed_unit_price: line.confirmed_unit_price,
        confirmed_delivery_date: toIsoDateString(line.confirmed_delivery_date),
        variance_reason: line.variance_reason.trim() || null,
      })),
    };
  }

  submit(): void {
    const order = this.order();
    if (!order || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.recordConfirmation(order.id, this.buildPayload()).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('purchases.fulfilment.confirmation.success'));
        this.recorded.emit();
      },
      error: (err: unknown) => this.message.error(extractApiErrorMessage(err) || this.i18n.translate('common.errors.generic')),
    });
  }

  private buildLines(source: PurchaseOrderLine[]): void {
    this.lines.clear();
    for (const line of source) {
      this.lines.push(
        this.fb.group({
          purchase_order_line_id: this.fb.control(line.id),
          confirmed_quantity: this.fb.control<number | null>(Number(line.quantity_ordered)),
          confirmed_unit_price: this.fb.control<number | null>(Number(line.unit_price)),
          confirmed_delivery_date: this.fb.control<Date | null>(null),
          variance_reason: this.fb.control('', Validators.maxLength(255)),
        }),
      );
    }
  }
}
