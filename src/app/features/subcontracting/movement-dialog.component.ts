import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { SctComponent, SctMovementPayload, SctOrder, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { OrderDetailStore } from './order-detail.store';
import { isoDay, SctOutcome } from './subcontracting.util';

export type MovementKind = 'dispatch' | 'returnUnused' | 'receiveMaterials' | 'deliver';

interface MovementRow {
  component: SctComponent;
  max: number;
  quantity: number | null;
}

/**
 * The quick actions that move goods and emit or log a document: send the components to the vendor with the DDT Conto lavoro, bring the
 * unused material back (DDT Reso da terzista), receive the customer's material at zero value, and return the processed goods to the
 * customer (DDT Reso lavorato). The lines are the preview of the transfer between the warehouses.
 */
@Component({
  selector: 'app-sct-movement-dialog',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="640"
      [nzTitle]="'subcontracting.modal.' + kind() | translate"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        @if (feedback(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            nzCloseable
            [nzMessage]="failure.errorKey ?? 'subcontracting.error.generic' | translate: failure.params"
            [nzDescription]="failure.detail ?? null"
            (nzOnClose)="feedback.set(null)"
          ></nz-alert>
        }

        <p class="muted">{{ 'subcontracting.hint.' + kind() | translate: { partner: order().partner_name ?? '' } }}</p>
        @if (order().zero_balance_sheet_value && kind() !== 'deliver') {
          <nz-tag class="zero-value" nzColor="purple" data-test="zero-value">{{ 'subcontracting.badge.zeroValue' | translate }}</nz-tag>
        }

        @if (kind() === 'deliver') {
          <div class="form-grid">
            <label class="field" for="sct-m-qty">
              <span>{{ 'subcontracting.field.deliverQuantity' | translate }}</span>
              <nz-input-number nzId="sct-m-qty" [nzMin]="0" [nzMax]="deliverMax" [(ngModel)]="deliverQuantity" data-test="deliver-quantity"></nz-input-number>
            </label>
            <label nz-checkbox [(ngModel)]="returnUnused" data-test="return-unused">
              {{ 'subcontracting.field.returnUnusedMaterials' | translate }}
            </label>
          </div>
        } @else {
          <nz-table nzSize="small" [nzData]="rows()" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'subcontracting.field.component' | translate }}</th>
                <th scope="col" class="num">{{ 'subcontracting.field.open' | translate }}</th>
                <th scope="col" class="num">{{ 'subcontracting.field.quantity' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.component.id) {
                <tr [attr.data-test]="'row-' + row.component.id">
                  <td>
                    {{ row.component.product_name ?? row.component.component_product_id }}
                    <small class="muted">{{ row.component.sku }}</small>
                  </td>
                  <td class="num">{{ row.max }} {{ row.component.unit_of_measure }}</td>
                  <td class="num">
                    <nz-input-number [nzMin]="0" [nzMax]="row.max" [(ngModel)]="row.quantity"></nz-input-number>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }

        <div class="form-grid">
          <label class="field" for="sct-m-date">
            <span>{{ 'subcontracting.field.date' | translate }}</span>
            <nz-date-picker nzId="sct-m-date" [(ngModel)]="date"></nz-date-picker>
          </label>
          @if (kind() === 'dispatch' || kind() === 'deliver') {
            <label class="field" for="sct-m-carrier">
              <span>{{ 'subcontracting.field.carrier' | translate }}</span>
              <input nz-input id="sct-m-carrier" maxlength="255" [(ngModel)]="carrier" />
            </label>
          }
          @if (kind() === 'receiveMaterials') {
            <label class="field" for="sct-m-ddt">
              <span>{{ 'subcontracting.field.customerDdtNumber' | translate }}</span>
              <input nz-input id="sct-m-ddt" maxlength="60" [(ngModel)]="customerDdtNumber" data-test="customer-ddt" />
            </label>
            <label class="field" for="sct-m-ddt-date">
              <span>{{ 'subcontracting.field.customerDdtDate' | translate }}</span>
              <nz-date-picker nzId="sct-m-ddt-date" [(ngModel)]="customerDdtDate"></nz-date-picker>
            </label>
          }
        </div>
        <label class="field" for="sct-m-notes">
          <span>{{ 'subcontracting.field.notes' | translate }}</span>
          <textarea nz-input id="sct-m-notes" rows="2" maxlength="2000" [(ngModel)]="notes"></textarea>
        </label>

        <p class="actions-bar">
          <button nz-button nzType="primary" type="button" data-test="submit" [nzLoading]="store.saving()" (click)="submit()">
            {{ 'subcontracting.action.' + kind() | translate }}
          </button>
          <button nz-button type="button" (click)="closed.emit()">{{ 'subcontracting.action.close' | translate }}</button>
        </p>
      </ng-container>
    </nz-drawer>
  `,
})
export class MovementDialogComponent {
  readonly order = input.required<SctOrder>();
  readonly kind = input.required<MovementKind>();
  readonly visible = input.required<boolean>();
  readonly closed = output<void>();

  protected readonly store = inject(OrderDetailStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly rows = signal<MovementRow[]>([]);
  protected readonly feedback = signal<SctOutcome | null>(null);

  protected date: Date | null = null;
  protected carrier = '';
  protected customerDdtNumber = '';
  protected customerDdtDate: Date | null = null;
  protected notes = '';
  protected deliverQuantity: number | null = null;
  protected deliverMax = 0;
  protected returnUnused = false;

  constructor() {
    // Every opening starts from the quantities still open on the order.
    effect(() => {
      if (this.visible()) {
        this.reset(this.order(), this.kind());
      }
    });
  }

  private reset(order: SctOrder, kind: MovementKind): void {
    this.feedback.set(null);
    this.date = null;
    this.carrier = '';
    this.customerDdtNumber = '';
    this.customerDdtDate = null;
    this.notes = '';
    this.returnUnused = false;
    this.deliverMax = Math.max(0, Number(order.received_quantity) - Number(order.delivered_quantity));
    this.deliverQuantity = this.deliverMax;
    this.rows.set(
      (order.components ?? [])
        .map((component) => {
          const max = Number(kind === 'returnUnused' ? component.held_qty : component.to_dispatch_qty);
          return { component, max, quantity: max };
        })
        .filter((row) => row.max > 0),
    );
  }

  protected async submit(): Promise<void> {
    const kind = this.kind();
    const base: SctMovementPayload = {
      ...(isoDay(this.date) ? { date: isoDay(this.date) } : {}),
      ...(this.notes.trim() ? { notes: this.notes.trim() } : {}),
    };

    let outcome: SctOutcome;
    if (kind === 'deliver') {
      outcome = await this.store.deliver({
        quantity: String(this.deliverQuantity ?? 0),
        return_unused_materials: this.returnUnused,
        ...(base.date ? { date: base.date } : {}),
        ...(this.carrier.trim() ? { carrier_name: this.carrier.trim() } : {}),
        ...(base.notes ? { notes: base.notes } : {}),
      });
    } else {
      const lines = this.rows()
        .filter((row) => (row.quantity ?? 0) > 0)
        .map((row) => ({ component_id: row.component.id, quantity: String(row.quantity) }));
      const payload: SctMovementPayload = {
        ...base,
        lines,
        ...(kind === 'dispatch' && this.carrier.trim() ? { carrier_name: this.carrier.trim() } : {}),
        ...(kind === 'receiveMaterials' && this.customerDdtNumber.trim() ? { customer_ddt_number: this.customerDdtNumber.trim() } : {}),
        ...(kind === 'receiveMaterials' && isoDay(this.customerDdtDate) ? { customer_ddt_date: isoDay(this.customerDdtDate) } : {}),
      };
      outcome =
        kind === 'dispatch'
          ? await this.store.dispatch(payload)
          : kind === 'returnUnused'
            ? await this.store.returnUnused(payload)
            : await this.store.receiveMaterials(payload);
    }

    if (outcome.ok) {
      this.message.success(this.i18n.instant('subcontracting.message.' + kind));
      this.closed.emit();
    } else {
      this.feedback.set(outcome);
    }
  }
}
