import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n';
import { dropshipStatusColor, DropshipStatus } from '@domain/procurement/purchase-order-fulfilment.models';
import { DateFormatPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { extractApiErrorMessage, toIsoDateString } from '../requisitions/pr-status.helpers';
import { PurchaseOrderFulfilmentStore } from './purchase-order-fulfilment.store';

/** Dropshipment detail: recipient, DDT, delivery proof, billing authorisation and virtual stock movements. */
@Component({
  selector: 'app-dropship-detail-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DateFormatPipe,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'purchases.dropship.title' | translate" />
    <a nz-button routerLink="/procurement/dropshipments">{{ 'purchases.fulfilment.back' | translate }}</a>

    @if (store.error(); as error) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="error" />
    }

    @if (store.selectedDropship(); as drop) {
      <div class="actions">
        <nz-tag [nzColor]="statusColor(drop.status)" data-testid="dropship-status">{{ 'purchases.dropship.statuses.' + drop.status | translate }}</nz-tag>
        @if (drop.billing_authorized) {
          <nz-tag nzColor="success" data-testid="dropship-billing">{{ 'purchases.dropship.billing_authorized' | translate }}</nz-tag>
        }
        @if (canIssueDdt()) {
          <button nz-button type="button" (click)="ddtVisible.set(true)" data-testid="dropship-issue-ddt">
            {{ 'purchases.fulfilment.dropship.issue_ddt' | translate }}
          </button>
        }
        @if (canRecordDelivery()) {
          <button nz-button nzType="primary" type="button" (click)="deliveryVisible.set(true)" data-testid="dropship-record-delivery">
            {{ 'purchases.fulfilment.dropship.record_delivery' | translate }}
          </button>
        }
      </div>

      <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
        <nz-descriptions-item [nzTitle]="'purchases.fulfilment.dropship.recipient' | translate">
          {{ drop.recipient_name }}<br />
          {{ drop.recipient_street }} {{ drop.recipient_house_number }}<br />
          {{ drop.recipient_postal_code }} {{ drop.recipient_city }} ({{ drop.recipient_country_code }})
        </nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'purchases.fulfilment.dropship.ddt' | translate">
          {{ drop.ddt_number ?? '-' }} {{ drop.ddt_issued_at | appDate }}
        </nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'purchases.fulfilment.dropship.supplier_ref' | translate">{{ drop.supplier_shipment_reference ?? '-' }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'purchases.fulfilment.dropship.proof' | translate">{{ drop.delivery_proof_reference ?? '-' }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'purchases.fulfilment.dropship.delivered_at' | translate">{{ drop.delivered_at | appDate }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'purchases.dropship.billing_authorized' | translate">{{ drop.billing_authorization_reference ?? '-' }}</nz-descriptions-item>
      </nz-descriptions>

      @if ((drop.virtual_stock_movements ?? []).length > 0) {
        <h4>{{ 'purchases.fulfilment.dropship.movements' | translate }}</h4>
        <nz-table #movements [nzData]="drop.virtual_stock_movements ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'purchases.fulfilment.dropship.direction' | translate }}</th>
              <th>{{ 'purchases.fulfilment.dropship.quantity_base' | translate }}</th>
              <th>{{ 'purchases.fulfilment.dropship.valued_amount' | translate }}</th>
              <th>{{ 'purchases.fulfilment.dropship.moved_at' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (movement of movements.data; track $index) {
              <tr>
                <td>{{ movement.direction }}</td>
                <td>{{ movement.quantity_base }} {{ movement.base_uom }}</td>
                <td>{{ movement.valued_amount }}</td>
                <td>{{ movement.moved_at | appDate }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }

      <nz-modal
        [nzVisible]="ddtVisible()"
        [nzTitle]="'purchases.fulfilment.dropship.issue_ddt' | translate"
        [nzOkLoading]="store.busy()"
        (nzOnOk)="issueDdt(drop.id)"
        (nzOnCancel)="ddtVisible.set(false)"
      >
        <ng-container *nzModalContent>
          <form nz-form nzLayout="vertical" [formGroup]="ddtForm" data-testid="dropship-ddt-form">
            <nz-form-item>
              <nz-form-label nzFor="ddt-carrier">{{ 'purchases.fulfilment.dropship.carrier' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ddt-carrier" formControlName="carrier" maxlength="120" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ddt-tracking">{{ 'purchases.fulfilment.dropship.tracking' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ddt-tracking" formControlName="tracking_number" maxlength="120" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ddt-packages">{{ 'purchases.fulfilment.dropship.packages' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number nzId="ddt-packages" formControlName="packages" [nzMin]="1" [nzStep]="1" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ddt-weight">{{ 'purchases.fulfilment.dropship.weight' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number nzId="ddt-weight" formControlName="gross_weight" [nzMin]="0" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ddt-date">{{ 'purchases.fulfilment.dropship.shipment_date' | translate }}</nz-form-label>
              <nz-form-control><nz-date-picker nzId="ddt-date" formControlName="shipment_date" /></nz-form-control>
            </nz-form-item>
          </form>
        </ng-container>
      </nz-modal>

      <nz-modal
        [nzVisible]="deliveryVisible()"
        [nzTitle]="'purchases.fulfilment.dropship.record_delivery' | translate"
        [nzOkLoading]="store.busy()"
        [nzOkDisabled]="deliveryForm.invalid"
        (nzOnOk)="recordDelivery(drop.id)"
        (nzOnCancel)="deliveryVisible.set(false)"
      >
        <ng-container *nzModalContent>
          <form nz-form nzLayout="vertical" [formGroup]="deliveryForm" data-testid="dropship-delivery-form">
            <nz-form-item>
              <nz-form-label nzFor="del-date">{{ 'purchases.fulfilment.dropship.delivered_at' | translate }}</nz-form-label>
              <nz-form-control><nz-date-picker nzId="del-date" formControlName="delivered_at" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="del-proof">{{ 'purchases.fulfilment.dropship.proof' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="del-proof" formControlName="delivery_proof_reference" maxlength="190" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="del-ref">{{ 'purchases.fulfilment.dropship.supplier_ref' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="del-ref" formControlName="supplier_shipment_reference" maxlength="120" /></nz-form-control>
            </nz-form-item>
          </form>
        </ng-container>
      </nz-modal>
    }
  `,
  styles: `
    .actions { display: flex; gap: 8px; align-items: center; margin: 16px 0; }
  `,
})
export class DropshipDetailPageComponent implements OnInit {
  protected readonly store = inject(PurchaseOrderFulfilmentStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly route = inject(ActivatedRoute);

  protected readonly ddtVisible = signal(false);
  protected readonly deliveryVisible = signal(false);

  protected readonly canIssueDdt = computed(() => this.store.selectedDropship()?.status === 'pending');
  protected readonly canRecordDelivery = computed(() => {
    const status = this.store.selectedDropship()?.status;
    return status === 'ddt_issued' || status === 'partially_delivered';
  });

  protected readonly ddtForm = this.fb.group({
    carrier: this.fb.control('', Validators.maxLength(120)),
    tracking_number: this.fb.control('', Validators.maxLength(120)),
    packages: this.fb.control<number | null>(null),
    gross_weight: this.fb.control<number | null>(null),
    shipment_date: this.fb.control<Date | null>(null),
  });

  protected readonly deliveryForm = this.fb.group({
    delivered_at: this.fb.control<Date | null>(new Date()),
    delivery_proof_reference: this.fb.control('', Validators.maxLength(190)),
    supplier_shipment_reference: this.fb.control('', Validators.maxLength(120)),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.loadDropshipment(id).subscribe();
    }
  }

  protected statusColor(status: DropshipStatus): string {
    return dropshipStatusColor(status);
  }

  issueDdt(id: string): void {
    const v = this.ddtForm.getRawValue();
    this.store
      .issueDdt(id, {
        carrier: v.carrier.trim() || null,
        tracking_number: v.tracking_number.trim() || null,
        packages: v.packages,
        gross_weight: v.gross_weight,
        shipment_date: toIsoDateString(v.shipment_date),
      })
      .subscribe({
        next: () => {
          this.ddtVisible.set(false);
          this.message.success(this.i18n.translate('purchases.fulfilment.dropship.ddt_issued'));
        },
        error: (err: unknown) => this.message.error(extractApiErrorMessage(err) || this.i18n.translate('common.errors.generic')),
      });
  }

  recordDelivery(id: string): void {
    const v = this.deliveryForm.getRawValue();
    this.store
      .recordDelivery(id, {
        delivered_at: toIsoDateString(v.delivered_at),
        delivery_proof_reference: v.delivery_proof_reference.trim() || null,
        supplier_shipment_reference: v.supplier_shipment_reference.trim() || null,
      })
      .subscribe({
        next: () => {
          this.deliveryVisible.set(false);
          this.message.success(this.i18n.translate('purchases.fulfilment.dropship.delivery_recorded'));
        },
        error: (err: unknown) => this.message.error(extractApiErrorMessage(err) || this.i18n.translate('common.errors.generic')),
      });
  }
}
