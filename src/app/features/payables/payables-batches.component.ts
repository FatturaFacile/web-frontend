import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AP_BATCH_STATUSES, ApBatch, PermissionsService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { PayablesBatchesStore } from './payables-batches.store';
import { batchStatusColor, PAYABLES_MODULE } from './payables.util';

/** Payment batches (Distinte di Pagamento): the list with the status filter and the entry to the guided creation. */
@Component({
  selector: 'app-payables-batches',
  styleUrl: './payables.scss',
  providers: [PayablesBatchesStore],
  imports: [
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'AP.BATCHES_TITLE' | translate"
      [subtitle]="'AP.BATCHES_SUBTITLE' | translate"
    >
    <ng-container ngProjectAs="[header-actions]">
      <a nz-button routerLink="/payables">{{ 'AP.BACK_TO_ITEMS' | translate }}</a>
      @if (canWrite) {
        <a nz-button nzType="primary" routerLink="/payables/batches/new">{{
          'AP.NEW_BATCH' | translate
        }}</a>
      }
    </ng-container>
    </app-page-header>

    <div class="filters" role="search" [attr.aria-label]="'AP.FILTERS' | translate">
      <div class="field">
        <label for="ap-batch-status">{{ 'AP.STATUS' | translate }}</label>
        <nz-select
          nzId="ap-batch-status"
          style="width: 100%"
          nzAllowClear
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="store.setStatus($event ?? undefined)"
        >
          @for (status of statuses; track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'AP.BATCH_' + status.toUpperCase() | translate"
            ></nz-option>
          }
        </nz-select>
      </div>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.batches()"
        [nzFrontPagination]="false"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzNoResult]="empty"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th>{{ 'AP.BATCH_NUMBER' | translate }}</th>
            <th>{{ 'AP.CUTOFF_DATE' | translate }}</th>
            <th>{{ 'AP.STATUS' | translate }}</th>
            <th class="num">{{ 'AP.TOTAL_NET' | translate }}</th>
            <th class="num">{{ 'AP.TOTAL_SKONTO' | translate }}</th>
            <th class="num">{{ 'AP.TOTAL_TRANSFERS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.number ?? '—' }}</td>
              <td>{{ row.cutoff_date }}</td>
              <td>
                <nz-tag [nzColor]="color(row)">{{
                  'AP.BATCH_' + row.status.toUpperCase() | translate
                }}</nz-tag>
              </td>
              <td class="num">{{ row.totals.net_amount | money: row.currency }}</td>
              <td class="num">{{ row.totals.skonto_savings | money: row.currency }}</td>
              <td class="num">{{ row.totals.transfers }}</td>
              <td>
                <a nz-button nzSize="small" [routerLink]="['/payables/batches', row.id]">
                  {{ 'AP.OPEN' | translate }}
                </a>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      <ng-template #empty>
        <nz-empty [nzNotFoundContent]="'AP.NO_BATCHES' | translate"></nz-empty>
      </ng-template>
    </nz-spin>
  `,
})
export class PayablesBatchesComponent implements OnInit {
  readonly store = inject(PayablesBatchesStore);
  readonly canWrite = inject(PermissionsService).canWrite(PAYABLES_MODULE);
  readonly statuses = AP_BATCH_STATUSES;

  ngOnInit(): void {
    void this.store.loadList({ per_page: 20, page: 1 });
  }

  color(row: ApBatch): string {
    return batchStatusColor(row.status);
  }
}
