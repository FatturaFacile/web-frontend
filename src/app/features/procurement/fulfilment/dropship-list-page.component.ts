import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n';
import { dropshipStatusColor, DropshipStatus } from '@domain/procurement/purchase-order-fulfilment.models';
import { DateFormatPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { extractApiErrorMessage } from '../requisitions/pr-status.helpers';
import { PurchaseOrderFulfilmentStore } from './purchase-order-fulfilment.store';

export const DROPSHIP_STATUSES: readonly DropshipStatus[] = ['pending', 'ddt_issued', 'partially_delivered', 'delivered'];

/** Dropshipments (triangulation): list with status filter and creation from a sales order. */
@Component({
  selector: 'app-dropship-list-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    DateFormatPipe,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'purchases.dropship.title' | translate" />
    <div class="toolbar">
      <nz-select
        class="status-filter"
        nzAllowClear
        [nzPlaceHolder]="'purchases.fulfilment.dropship.status' | translate"
        [attr.aria-label]="'purchases.fulfilment.dropship.status' | translate"
        (ngModelChange)="filterByStatus($event)"
        [ngModel]="status()"
        data-testid="dropship-status-filter"
      >
        @for (s of statuses; track s) {
          <nz-option [nzValue]="s" [nzLabel]="'purchases.dropship.statuses.' + s | translate" />
        }
      </nz-select>
      <button nz-button nzType="primary" type="button" (click)="createVisible.set(true)" data-testid="dropship-new">
        {{ 'purchases.fulfilment.dropship.new' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="error" />
    }

    <nz-table #table [nzData]="store.dropshipments()" [nzLoading]="store.loading()" [nzShowPagination]="false" data-testid="dropship-table">
      <thead>
        <tr>
          <th>{{ 'purchases.fulfilment.dropship.recipient' | translate }}</th>
          <th>{{ 'purchases.fulfilment.dropship.status' | translate }}</th>
          <th>{{ 'purchases.fulfilment.dropship.ddt' | translate }}</th>
          <th>{{ 'purchases.fulfilment.dropship.delivered_at' | translate }}</th>
          <th>{{ 'purchases.dropship.billing_authorized' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.id) {
          <tr>
            <td>{{ row.recipient_name ?? row.recipient_city }}</td>
            <td><nz-tag [nzColor]="statusColor(row.status)">{{ 'purchases.dropship.statuses.' + row.status | translate }}</nz-tag></td>
            <td>{{ row.ddt_number ?? '-' }}</td>
            <td>{{ row.delivered_at | appDate }}</td>
            <td>{{ row.billing_authorized ? '✓' : '-' }}</td>
            <td><a nz-button nzSize="small" [routerLink]="['/procurement/dropshipments', row.id]">{{ 'purchases.fulfilment.open' | translate }}</a></td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal
      [nzVisible]="createVisible()"
      [nzTitle]="'purchases.fulfilment.dropship.new' | translate"
      [nzOkLoading]="store.busy()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="create()"
      (nzOnCancel)="createVisible.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" data-testid="dropship-create-form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ds-so">{{ 'purchases.fulfilment.dropship.sales_order' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="ds-so" formControlName="sales_order_id" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ds-sup">{{ 'purchases.fulfilment.dropship.supplier' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="ds-sup" formControlName="supplier_id" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ds-name">{{ 'purchases.fulfilment.dropship.recipient' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="ds-name" formControlName="name" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ds-street">{{ 'purchases.fulfilment.dropship.street' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="ds-street" formControlName="street" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ds-zip">{{ 'purchases.fulfilment.dropship.postal_code' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="ds-zip" formControlName="postal_code" maxlength="20" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ds-city">{{ 'purchases.fulfilment.dropship.city' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="ds-city" formControlName="city" maxlength="120" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ds-country">{{ 'purchases.fulfilment.dropship.country' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="ds-country" formControlName="country_code" maxlength="2" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
    .status-filter { min-width: 220px; }
  `,
})
export class DropshipListPageComponent implements OnInit {
  protected readonly store = inject(PurchaseOrderFulfilmentStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly statuses = DROPSHIP_STATUSES;
  protected readonly status = signal<DropshipStatus | null>(null);
  protected readonly createVisible = signal(false);

  protected readonly form = this.fb.group({
    sales_order_id: this.fb.control('', Validators.required),
    supplier_id: this.fb.control('', Validators.required),
    name: this.fb.control('', Validators.maxLength(190)),
    street: this.fb.control('', [Validators.required, Validators.maxLength(190)]),
    postal_code: this.fb.control('', [Validators.required, Validators.maxLength(20)]),
    city: this.fb.control('', [Validators.required, Validators.maxLength(120)]),
    country_code: this.fb.control('', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]),
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    const status = this.status();
    this.store.loadDropshipments(status ? { status } : undefined).subscribe();
  }

  filterByStatus(status: DropshipStatus | null): void {
    this.status.set(status);
    this.reload();
  }

  protected statusColor(status: DropshipStatus): string {
    return dropshipStatusColor(status);
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.store
      .createDropshipment({
        sales_order_id: v.sales_order_id.trim(),
        supplier_id: v.supplier_id.trim(),
        delivery_address: {
          name: v.name.trim() || null,
          street: v.street.trim(),
          postal_code: v.postal_code.trim(),
          city: v.city.trim(),
          country_code: v.country_code.trim().toUpperCase(),
        },
      })
      .subscribe({
        next: (created) => {
          this.createVisible.set(false);
          this.message.success(this.i18n.translate('purchases.fulfilment.dropship.created'));
          void this.router.navigate(['/procurement/dropshipments', created.id]);
        },
        error: (err: unknown) => this.message.error(extractApiErrorMessage(err) || this.i18n.translate('common.errors.generic')),
      });
  }
}
