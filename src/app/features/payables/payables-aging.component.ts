import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { ApAgingBucket, ApExportFormat, TranslateService } from '@core';
import { downloadBlob, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { TimeTravelPanelComponent } from '../time-travel/time-travel-panel.component';
import { TimeTravelContextService } from '@core/services/time-travel-context.service';
import { PayablesAgingStore } from './payables-aging.store';
import { bucketLabelParts, fromIsoDate, toIsoDate } from './payables.util';

/**
 * Payables aging: exposure per supplier and time bucket for the cash-flow plan, with the Excel and PDF exports.
 * The columns come from the buckets of the response.
 */
@Component({
  selector: 'app-payables-aging',
  styleUrl: './payables.scss',
  providers: [PayablesAgingStore],
  imports: [
    TimeTravelPanelComponent,
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
  ],
  template: `
    <app-page-header
      [title]="'AP.AGING_TITLE' | translate"
      [subtitle]="'AP.AGING_SUBTITLE' | translate"
    >
    <ng-container ngProjectAs="[header-actions]">
      <a nz-button routerLink="/payables">{{ 'AP.BACK_TO_ITEMS' | translate }}</a>
      <button
        nz-button
        type="button"
        [nzLoading]="store.exporting() === 'xlsx'"
        [disabled]="store.exporting() !== null || store.isEmpty()"
        (click)="download('xlsx')"
      >
        {{ 'AP.EXPORT_XLSX' | translate }}
      </button>
      <button
        nz-button
        type="button"
        [nzLoading]="store.exporting() === 'pdf'"
        [disabled]="store.exporting() !== null || store.isEmpty()"
        (click)="download('pdf')"
      >
        {{ 'AP.EXPORT_PDF' | translate }}
      </button>
    </ng-container>
    </app-page-header>

    <app-time-travel-panel domain="aging" [filters]="{ partner_type: 'supplier' }" />
    @if (!timeTravel.isActive()) {
    <div class="filters" role="search" [attr.aria-label]="'AP.FILTERS' | translate">
      <div class="field">
        <label for="ag-asof">{{ 'AP.AS_OF' | translate }}</label>
        <nz-date-picker
          nzId="ag-asof"
          style="width: 100%"
          [ngModel]="asOf()"
          (ngModelChange)="onAsOf($event)"
        ></nz-date-picker>
      </div>
      @if ((store.aging()?.available_currencies ?? []).length > 1) {
        <div class="field">
          <label for="ag-currency">{{ 'AP.CURRENCY' | translate }}</label>
          <nz-select
            nzId="ag-currency"
            style="width: 100%"
            [ngModel]="store.aging()?.currency"
            (ngModelChange)="store.setFilters({ currency: $event })"
          >
            @for (code of store.aging()?.available_currencies; track code) {
              <nz-option [nzValue]="code" [nzLabel]="code"></nz-option>
            }
          </nz-select>
        </div>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.aging(); as aging) {
        <div class="kpi-grid">
          <nz-statistic
            class="kpi"
            [nzTitle]="'AP.KPI_OPEN' | translate"
            [nzValue]="aging.total_open | money: aging.currency"
          ></nz-statistic>
          <nz-statistic
            class="kpi danger"
            [nzTitle]="'AP.KPI_OVERDUE' | translate"
            [nzValue]="aging.total_overdue | money: aging.currency"
          ></nz-statistic>
        </div>

        @if (store.isEmpty()) {
          <nz-empty [nzNotFoundContent]="'AP.NO_AGING' | translate"></nz-empty>
        } @else {
          <div class="matrix-wrap">
            <table class="matrix">
              <caption class="sr-only">
                {{
                  'AP.AGING_TITLE' | translate
                }}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{{ 'AP.SUPPLIER' | translate }}</th>
                  @for (bucket of aging.buckets; track bucket.key) {
                    <th scope="col" class="num">{{ label(bucket) }}</th>
                  }
                  <th scope="col" class="num">{{ 'AP.TOTAL_OPEN' | translate }}</th>
                  <th scope="col" class="num">{{ 'AP.TOTAL_OVERDUE' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (supplier of aging.suppliers; track supplier.supplier_id) {
                  <tr>
                    <th scope="row">
                      <a
                        [routerLink]="['/payables']"
                        [queryParams]="{ supplier_id: supplier.supplier_id, open_only: 1 }"
                      >
                        {{ supplier.supplier_name }}
                      </a>
                    </th>
                    @for (bucket of aging.buckets; track bucket.key) {
                      <td class="num">
                        {{ supplier.buckets[bucket.key] ?? '0.00' | money: aging.currency }}
                      </td>
                    }
                    <td class="num">{{ supplier.total_open | money: aging.currency }}</td>
                    <td class="num negative">
                      {{ supplier.total_overdue | money: aging.currency }}
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{{ 'AP.TOTAL' | translate }}</th>
                  @for (bucket of aging.buckets; track bucket.key) {
                    <td class="num">
                      {{ aging.totals[bucket.key] ?? '0.00' | money: aging.currency }}
                    </td>
                  }
                  <td class="num">{{ aging.total_open | money: aging.currency }}</td>
                  <td class="num negative">{{ aging.total_overdue | money: aging.currency }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
      }
    </nz-spin>
    }
  `,
})
export class PayablesAgingComponent implements OnInit {
  protected readonly timeTravel = inject(TimeTravelContextService);
  readonly store = inject(PayablesAgingStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly asOf = computed(() =>
    fromIsoDate(this.store.filters().as_of ?? this.store.aging()?.as_of),
  );

  ngOnInit(): void {
    void this.store.init();
  }

  label(bucket: ApAgingBucket): string {
    const { key, params } = bucketLabelParts(bucket);
    return this.translate.instant(key, params);
  }

  onAsOf(date: Date | null): void {
    void this.store.setFilters({ as_of: toIsoDate(date) ?? undefined });
  }

  async download(format: ApExportFormat): Promise<void> {
    const result = await this.store.download(format);
    if (result.ok && result.blob) {
      downloadBlob(result.blob, result.filename);
    } else {
      this.message.error(result.message ?? this.translate.instant('AP.EXPORT_ERROR'));
    }
  }
}
