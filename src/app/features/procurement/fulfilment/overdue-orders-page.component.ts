import { Component, inject, OnInit } from '@angular/core';
import { I18nService } from '@core/i18n';
import { OverdueOrderRow } from '@domain/procurement/purchase-order-fulfilment.models';
import { DateFormatPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { extractApiErrorMessage } from '../requisitions/pr-status.helpers';
import { PurchaseOrderFulfilmentStore } from './purchase-order-fulfilment.store';

/** Tag colour of the days an order is past its (promised) delivery date. */
export function overdueSeverityColor(days: number): string {
  if (days >= 14) {
    return 'error';
  }
  return days >= 7 ? 'warning' : 'gold';
}

/** Orders past their expected or promised delivery date, with a manual reminder action per order. */
@Component({
  selector: 'app-overdue-orders-page',
  imports: [
    DateFormatPipe,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'purchases.overdue.title' | translate" />
    <div class="toolbar">
      <button nz-button type="button" (click)="reload()" [nzLoading]="store.loading()">
        <span nz-icon nzType="reload" aria-hidden="true"></span>
        {{ 'purchases.fulfilment.refresh' | translate }}
      </button>
      <button
        nz-button
        type="button"
        nz-popconfirm
        [nzPopconfirmTitle]="'purchases.fulfilment.overdue.run_confirm' | translate"
        (nzOnConfirm)="runAll()"
        [nzLoading]="store.busy()"
        data-testid="overdue-run-reminders"
      >
        {{ 'purchases.fulfilment.overdue.run_all' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="error" />
    }

    <nz-table #table [nzData]="store.overdue()" [nzLoading]="store.loading()" [nzShowPagination]="false" data-testid="overdue-table">
      <thead>
        <tr>
          <th>{{ 'purchases.fulfilment.overdue.order' | translate }}</th>
          <th>{{ 'purchases.fulfilment.overdue.supplier' | translate }}</th>
          <th>{{ 'purchases.fulfilment.overdue.expected' | translate }}</th>
          <th>{{ 'purchases.fulfilment.overdue.promised' | translate }}</th>
          <th>{{ 'purchases.overdue.days' | translate }}</th>
          <th>{{ 'purchases.fulfilment.overdue.reminders' | translate }}</th>
          <th>{{ 'purchases.fulfilment.overdue.last_reminder' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.order.id) {
          <tr [attr.data-testid]="'overdue-row-' + row.order.id">
            <td>{{ row.order.po_number }}</td>
            <td>{{ row.order.supplier?.company_name ?? '-' }}</td>
            <td>{{ row.order.expected_delivery_date | appDate }}</td>
            <td>{{ row.order.promised_delivery_date | appDate }}</td>
            <td><nz-tag [nzColor]="severity(row)">{{ row.days_overdue }}</nz-tag></td>
            <td>{{ row.reminder_count }}</td>
            <td>{{ row.last_reminder_at | appDate }}</td>
            <td>
              <button nz-button nzSize="small" type="button" (click)="remind(row)" [disabled]="store.busy()" data-testid="overdue-remind">
                <span nz-icon nzType="bell" aria-hidden="true"></span>
                {{ 'purchases.reminders.send' | translate }}
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    @if (!store.loading() && store.overdue().length === 0) {
      <nz-empty [nzNotFoundContent]="'purchases.fulfilment.overdue.empty' | translate" />
    }
  `,
  styles: `
    .toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
  `,
})
export class OverdueOrdersPageComponent implements OnInit {
  protected readonly store = inject(PurchaseOrderFulfilmentStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.store.loadOverdue().subscribe();
  }

  protected severity(row: OverdueOrderRow): string {
    return overdueSeverityColor(row.days_overdue);
  }

  remind(row: OverdueOrderRow): void {
    this.store.sendReminder(row.order.id).subscribe({
      next: () => this.message.success(this.i18n.translate('purchases.fulfilment.overdue.reminder_sent')),
      error: (err: unknown) => this.message.error(extractApiErrorMessage(err) || this.i18n.translate('common.errors.generic')),
    });
  }

  runAll(): void {
    this.store.runReminders().subscribe({
      next: (sent) => {
        this.message.success(this.i18n.translate('purchases.fulfilment.overdue.run_done', { count: sent }));
        this.reload();
      },
      error: (err: unknown) => this.message.error(extractApiErrorMessage(err) || this.i18n.translate('common.errors.generic')),
    });
  }
}
