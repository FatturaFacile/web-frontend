import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { DormantStore } from './dormant.store';
import { dormantColor } from './industrial-laundry.util';

/** Dormant garments: at the customer for more than the threshold without going through the wash. */
@Component({
  selector: 'app-ilr-dormant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [DormantStore],
  styleUrl: './industrial-laundry.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.INDUSTRIAL_LAUNDRY_DORMANT' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field wide" for="ilr-dormant-customer">
        <span>{{ 'industrialLaundry.field.customer' | translate }}</span>
        <nz-select
          id="ilr-dormant-customer"
          nzAllowClear
          nzShowSearch
          [ngModel]="store.customerId()"
          (ngModelChange)="store.setFilters({ customerId: $event })"
          [nzPlaceHolder]="'industrialLaundry.field.allCustomers' | translate"
        >
          @for (customer of store.customers(); track customer.id) {
            <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="ilr-dormant-days">
        <span>{{ 'industrialLaundry.field.thresholdDays' | translate }}</span>
        <nz-input-number id="ilr-dormant-days" [nzMin]="1" [nzMax]="3650" [ngModel]="days()" (ngModelChange)="days.set($event)" [nzPlaceHolder]="'' + store.defaultDays()"></nz-input-number>
      </label>
      <button nz-button type="button" (click)="store.setFilters({ days: days() })">{{ 'industrialLaundry.action.search' | translate }}</button>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    @if (store.byCustomer().length > 0) {
      <nz-card class="main-card" [nzTitle]="'industrialLaundry.section.dormantByCustomer' | translate">
        <div class="chips">
          @for (item of store.byCustomer(); track item.customer) {
            <nz-tag nzColor="orange">{{ item.customer }}: {{ item.count }}</nz-tag>
          }
        </div>
      </nz-card>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table nzSize="small" [nzData]="store.rows()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'industrialLaundry.field.epc' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.articleType' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.customer' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.wearer' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.lastDelivered' | translate }}</th>
            <th scope="col" class="num">{{ 'industrialLaundry.field.dormantDays' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of store.rows(); track row.id) {
            <tr>
              <th scope="row" class="mono">{{ row.epc_uid_rfid_hex }}</th>
              <td>{{ 'industrialLaundry.articleType.' + row.article_type | translate }}</td>
              <td>{{ row.customer_name }}</td>
              <td>{{ row.assigned_wearer_employee_name }}</td>
              <td>{{ row.last_delivered_at.slice(0, 10) }}</td>
              <td class="num">
                <nz-tag [nzColor]="color(row.dormant_days, row.threshold_days)">{{ row.dormant_days }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (store.rows().length === 0 && !store.loading()) {
        <nz-empty [nzNotFoundContent]="'industrialLaundry.empty.dormant' | translate"></nz-empty>
      }
    </nz-spin>
  `,
})
export class DormantComponent implements OnInit {
  protected readonly store = inject(DormantStore);
  protected readonly days = signal<number | null>(null);
  protected readonly color = dormantColor;

  ngOnInit(): void {
    void this.store.init();
  }
}
