import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NotificationDelivery, PlatformApiService } from '@core';
import { TranslatePipe } from '@shared';

/** The delivery register of the signed-in user: per channel queued, sent, opened or failed (with the error). */
@Component({
  selector: 'app-delivery-log',
  imports: [DatePipe, FormsModule, NzCardModule, NzTableModule, TranslatePipe],
  template: `
    <nz-card [nzTitle]="'PLATFORM.DELIVERY_LOG' | translate">
      <label class="filter">
        {{ 'PLATFORM.STATUS' | translate }}
        <select [ngModel]="status()" (ngModelChange)="load($event)">
          <option value="">{{ 'PLATFORM.ALL' | translate }}</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ 'PLATFORM.STATUS_' + s.toUpperCase() | translate }}</option>
          }
        </select>
      </label>
      <nz-table [nzData]="rows()" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'PLATFORM.DATE' | translate }}</th>
            <th>{{ 'PLATFORM.CHANNEL' | translate }}</th>
            <th>{{ 'PLATFORM.CATEGORY' | translate }}</th>
            <th>{{ 'PLATFORM.TITLE' | translate }}</th>
            <th>{{ 'PLATFORM.STATUS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr>
              <td>{{ row.created_at | date: 'short' }}</td>
              <td>{{ 'PLATFORM.CHANNEL_' + row.channel.toUpperCase() | translate }}</td>
              <td>{{ 'PLATFORM.CATEGORY_' + row.category.toUpperCase() | translate }}</td>
              <td>{{ row.title }}</td>
              <td [title]="row.error ?? ''">{{ 'PLATFORM.STATUS_' + row.status.toUpperCase() | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .filter {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }
  `,
})
export class DeliveryLogComponent implements OnInit {
  private readonly api = inject(PlatformApiService);

  readonly statuses = ['queued', 'sent', 'opened', 'failed'] as const;
  readonly rows = signal<NotificationDelivery[]>([]);
  readonly status = signal('');

  ngOnInit(): void {
    this.load('');
  }

  load(status: string): void {
    this.status.set(status);
    this.api.getNotificationDeliveries(status || undefined).subscribe((res) => this.rows.set(res.data));
  }
}
