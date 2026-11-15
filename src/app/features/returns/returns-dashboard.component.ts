import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { RETURNS_AGEING_BUCKETS, ReturnsApiService, ReturnsSummary, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, todayIso } from './returns.util';

/** Return rate by product and reason, ageing of the open returns and the value refunded. */
@Component({
  selector: 'app-returns-dashboard',
  styleUrl: './returns.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzStatisticModule,
    NzTableModule,
  ],
  template: `
    <app-page-header [title]="'RETURNS.DASHBOARD_TITLE' | translate" [subtitle]="'RETURNS.DASHBOARD_SUBTITLE' | translate">
      <a nz-button nzType="primary" routerLink="/returns/rmas">{{ 'RETURNS.OPEN_RMA_LIST' | translate }}</a>
    </app-page-header>

    <div class="toolbar">
      <label>
        <span class="muted">{{ 'RETURNS.FROM' | translate }}</span>
        <input nz-input type="date" [ngModel]="from()" (ngModelChange)="from.set($event); load()" />
      </label>
      <label>
        <span class="muted">{{ 'RETURNS.TO' | translate }}</span>
        <input nz-input type="date" [ngModel]="to()" (ngModelChange)="to.set($event); load()" />
      </label>
    </div>

    @if (summary(); as report) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzValue]="report.totals.rma_count" [nzTitle]="'RETURNS.RMA_COUNT' | translate"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzValue]="report.totals.open_rma_count" [nzTitle]="'RETURNS.OPEN_RMAS' | translate"></nz-statistic></nz-card>
        <nz-card>
          <nz-statistic [nzValue]="(report.totals.refund_value | number: '1.2-2') ?? ''" [nzTitle]="'RETURNS.REFUND_VALUE' | translate"></nz-statistic>
        </nz-card>
        <nz-card>
          <nz-statistic [nzValue]="report.totals.open_warranty_claims" [nzTitle]="'RETURNS.OPEN_CLAIMS' | translate"></nz-statistic>
        </nz-card>
        <nz-card>
          <nz-statistic [nzValue]="report.totals.active_warranties" [nzTitle]="'RETURNS.ACTIVE_WARRANTIES' | translate"></nz-statistic>
        </nz-card>
        <nz-card>
          <nz-statistic [nzValue]="report.totals.open_supplier_returns" [nzTitle]="'RETURNS.OPEN_SUPPLIER_RETURNS' | translate"></nz-statistic>
          <span class="muted">{{ 'RETURNS.SUPPLIER_CREDIT_EXPECTED' | translate }}: {{ report.totals.supplier_credit_expected | number: '1.2-2' }}</span>
        </nz-card>
      </div>

      <nz-card class="main-card" [nzTitle]="'RETURNS.AGEING' | translate">
        <div class="stats-grid">
          @for (row of ageing(); track row.bucket) {
            <nz-statistic [nzValue]="row.count" [nzTitle]="('RETURNS.BUCKET_' + row.bucket.toUpperCase()) | translate"></nz-statistic>
          }
        </div>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'RETURNS.BY_REASON' | translate">
        <nz-table #reasonTable [nzData]="report.by_reason" [nzShowPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'RETURNS.REASON' | translate }}</th>
              <th class="num">{{ 'RETURNS.RMAS' | translate }}</th>
              <th class="num">{{ 'RETURNS.QUANTITY' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of reasonTable.data; track row.reason_code) {
              <tr>
                <td>{{ reasonLabel(row.reason_code) }}</td>
                <td class="num">{{ row.rma_count }}</td>
                <td class="num">{{ row.quantity | number: '1.0-4' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (report.by_reason.length === 0) {
          <nz-empty [nzNotFoundContent]="'RETURNS.NO_DATA' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'RETURNS.BY_PRODUCT' | translate">
        <nz-table #productTable [nzData]="report.by_product" [nzShowPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'RETURNS.PRODUCT' | translate }}</th>
              <th class="num">{{ 'RETURNS.RETURNED' | translate }}</th>
              <th class="num">{{ 'RETURNS.SOLD' | translate }}</th>
              <th class="num">{{ 'RETURNS.RETURN_RATE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of productTable.data; track row.product_id) {
              <tr>
                <td>{{ row.sku }} <span class="muted">{{ row.name }}</span></td>
                <td class="num">{{ row.returned_quantity | number: '1.0-4' }}</td>
                <td class="num">{{ row.sold_quantity | number: '1.0-4' }}</td>
                <td class="num">{{ row.return_rate === null ? '-' : (row.return_rate | number: '1.0-2') + '%' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (report.by_product.length === 0) {
          <nz-empty [nzNotFoundContent]="'RETURNS.NO_DATA' | translate"></nz-empty>
        }
      </nz-card>
    } @else if (!loading()) {
      <nz-empty [nzNotFoundContent]="'RETURNS.NO_DATA' | translate"></nz-empty>
    }
  `,
})
export class ReturnsDashboardComponent implements OnInit {
  private readonly api = inject(ReturnsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly from = signal(`${new Date().getFullYear()}-01-01`);
  readonly to = signal(todayIso());
  readonly summary = signal<ReturnsSummary | null>(null);
  readonly loading = signal(false);
  private readonly reasonLabels = signal<Record<string, string>>({});

  /** The ageing buckets in their fixed order, zero for a bucket the API left out. */
  readonly ageing = computed(() => {
    const counts = new Map((this.summary()?.ageing ?? []).map((row) => [row.bucket, row.count]));
    return RETURNS_AGEING_BUCKETS.map((bucket) => ({ bucket, count: counts.get(bucket) ?? 0 }));
  });

  ngOnInit(): void {
    this.api.getSettings().subscribe({
      next: (response) => this.reasonLabels.set(Object.fromEntries(response.data.reason_codes.map((reason) => [reason.code, reason.label]))),
    });
    this.load();
  }

  reasonLabel(code: string): string {
    return this.reasonLabels()[code] ?? code;
  }

  load(): void {
    this.loading.set(true);
    this.api.getSummary({ from: this.from() || undefined, to: this.to() || undefined }).subscribe({
      next: (response) => {
        this.summary.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR'));
      },
    });
  }
}
