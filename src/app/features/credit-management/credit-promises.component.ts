import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CollectionPromise, CollectionPromiseStatus, CreditManagementApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, statusColor } from './credit.util';

/** Promises to pay of the customers; the broken ones by default, and the action that marks the lapsed ones as broken. */
@Component({
  selector: 'app-credit-promises',
  styleUrl: './credit-management.scss',
  imports: [DecimalPipe, FormsModule, RouterLink, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzEmptyModule, NzPopconfirmModule, NzSelectModule, NzTableModule, NzTagModule],
  template: `
    <app-page-header [title]="'CREDIT.PROMISES_TITLE' | translate" [subtitle]="'CREDIT.PROMISES_SUBTITLE' | translate">
      <button nz-button nz-popconfirm [nzPopconfirmTitle]="'CREDIT.MARK_BROKEN_CONFIRM' | translate" (nzOnConfirm)="markBroken()">{{ 'CREDIT.MARK_BROKEN' | translate }}</button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="status()" (ngModelChange)="status.set($event); changeFilter()" [nzPlaceHolder]="'CREDIT.STATUS' | translate">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('CREDIT.PROMISE_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table
        #table
        [nzData]="promises()"
        [nzLoading]="loading()"
        nzSize="small"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageIndex]="page()"
        [nzPageSize]="pageSize"
        (nzPageIndexChange)="changePage($event)"
      >
        <thead>
          <tr>
            <th>{{ 'CREDIT.PROMISED_ON' | translate }}</th>
            <th class="num">{{ 'CREDIT.PROMISED_AMOUNT' | translate }}</th>
            <th class="num">{{ 'CREDIT.PAID_AMOUNT' | translate }}</th>
            <th>{{ 'CREDIT.RESOLVED_ON' | translate }}</th>
            <th>{{ 'CREDIT.STATUS' | translate }}</th>
            <th>{{ 'CREDIT.NOTES' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.promised_on }}</td>
              <td class="num">{{ +row.promised_amount | number: '1.2-2' }}</td>
              <td class="num">{{ row.paid_amount === null ? '-' : (+row.paid_amount | number: '1.2-2') }}</td>
              <td>{{ row.resolved_on ?? '-' }}</td>
              <td><nz-tag [nzColor]="color(row.status)">{{ ('CREDIT.PROMISE_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td>{{ row.notes }}</td>
              <td><a [routerLink]="['/credit-management/cases', row.case_id]">{{ 'CREDIT.OPEN_CASE' | translate }}</a></td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && promises().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_PROMISES' | translate"></nz-empty>
      }
    </nz-card>
  `,
})
export class CreditPromisesComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly statuses: readonly CollectionPromiseStatus[] = ['pending', 'kept', 'broken', 'cancelled'];
  readonly pageSize = 25;
  readonly promises = signal<CollectionPromise[]>([]);
  readonly status = signal<CollectionPromiseStatus | null>('broken');
  readonly page = signal(1);
  readonly total = signal(0);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  color(status: string): string {
    return statusColor(status);
  }

  changeFilter(): void {
    this.page.set(1);
    this.load();
  }

  changePage(page: number): void {
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPromises({ status: this.status() ?? undefined, page: this.page(), per_page: this.pageSize }).subscribe({
      next: (response) => {
        this.promises.set(response.data);
        this.total.set(response.meta?.total ?? response.data.length);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
  }

  markBroken(): void {
    this.api.markPromisesBroken().subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('CREDIT.PROMISES_MARKED', { count: response.data.marked }));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR')),
    });
  }
}
