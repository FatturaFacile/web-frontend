import { Component, computed, inject, input, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CurrencyApiService, CurrencyExposure } from '@core';
import { currencyProblemText, TranslatePipe } from '@shared';
import { signClass } from './currency-fx.util';

/**
 * Foreign-currency exposure at a date: receivables, payables, bank and cash per currency, the historical and the current
 * value in the functional currency and the unrealised gain or loss. Usable on a dashboard (`<app-currency-exposure-widget />`).
 */
@Component({
  selector: 'app-currency-exposure-widget',
  imports: [NzAlertModule, NzEmptyModule, NzSpinModule, NzTableModule, NzTagModule, TranslatePipe],
  styleUrl: './currency-fx.scss',
  template: `
    <nz-spin [nzSpinning]="resourceRef.isLoading()">
      @if (hasError()) {
        <nz-alert
          class="form-alert exposure-error"
          nzType="error"
          nzShowIcon
          [nzMessage]="'FINANCE.CURRENCIES.ERROR.EXPOSURE_FAILED' | translate"
          [nzDescription]="failureDetail()"
        ></nz-alert>
      }
      @if (data(); as exposure) {
        @if (anyRateMissing()) {
          <nz-alert
            class="form-alert rate-missing"
            nzType="warning"
            nzShowIcon
            [nzMessage]="'FINANCE.CURRENCIES.EXPOSURE.RATE_MISSING_WARNING' | translate"
          ></nz-alert>
        }
        <div class="totals">
          <div>
            <span class="muted">{{
              'FINANCE.CURRENCIES.EXPOSURE.HISTORICAL_TOTAL' | translate
            }}</span>
            <strong
              >{{ exposure.totals.historical_value }} {{ exposure.functional_currency }}</strong
            >
          </div>
          <div>
            <span class="muted">{{ 'FINANCE.CURRENCIES.EXPOSURE.CURRENT_TOTAL' | translate }}</span>
            <strong>{{ exposure.totals.current_value }} {{ exposure.functional_currency }}</strong>
          </div>
          <div>
            <span class="muted">{{
              'FINANCE.CURRENCIES.EXPOSURE.UNREALIZED_TOTAL' | translate
            }}</span>
            <strong [class]="gainClass(exposure.totals.unrealized_gain_loss)">
              {{ exposure.totals.unrealized_gain_loss }} {{ exposure.functional_currency }}
            </strong>
          </div>
        </div>
        <nz-table
          #table
          nzSize="small"
          [nzData]="exposure.items"
          [nzShowPagination]="false"
          [nzFrontPagination]="false"
        >
          <thead>
            <tr>
              <th>{{ 'FINANCE.CURRENCIES.COLUMN.CURRENCY' | translate }}</th>
              <th class="num">{{ 'FINANCE.CURRENCIES.EXPOSURE.RECEIVABLES' | translate }}</th>
              <th class="num">{{ 'FINANCE.CURRENCIES.EXPOSURE.PAYABLES' | translate }}</th>
              <th class="num">{{ 'FINANCE.CURRENCIES.EXPOSURE.BANK' | translate }}</th>
              <th class="num">{{ 'FINANCE.CURRENCIES.EXPOSURE.CASH' | translate }}</th>
              <th class="num">{{ 'FINANCE.CURRENCIES.EXPOSURE.NET' | translate }}</th>
              <th class="num">{{ 'FINANCE.CURRENCIES.EXPOSURE.HISTORICAL' | translate }}</th>
              <th class="num">{{ 'FINANCE.CURRENCIES.EXPOSURE.CURRENT' | translate }}</th>
              <th class="num">{{ 'FINANCE.CURRENCIES.EXPOSURE.UNREALIZED' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (item of table.data; track item.currency) {
              <tr>
                <td>
                  <strong>{{ item.currency }}</strong>
                  @if (item.rate_missing) {
                    <nz-tag nzColor="warning" class="rate-missing-tag">{{
                      'FINANCE.CURRENCIES.EXPOSURE.RATE_MISSING' | translate
                    }}</nz-tag>
                  } @else if (item.closing_rate) {
                    <div class="muted">{{ item.closing_rate }}</div>
                  }
                </td>
                <td class="num">{{ item.receivables }}</td>
                <td class="num">{{ item.payables }}</td>
                <td class="num">{{ item.bank }}</td>
                <td class="num">{{ item.cash }}</td>
                <td class="num">{{ item.net_amount }}</td>
                <td class="num">{{ item.historical_value }}</td>
                <td class="num">{{ item.current_value }}</td>
                <td class="num" [class]="gainClass(item.unrealized_gain_loss)">
                  {{ item.unrealized_gain_loss }}
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9">
                  <nz-empty
                    [nzNotFoundContent]="'FINANCE.CURRENCIES.EMPTY.EXPOSURE' | translate"
                  ></nz-empty>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-spin>
  `,
})
export class CurrencyExposureWidgetComponent {
  private readonly api = inject(CurrencyApiService);

  /** Reference date (`YYYY-MM-DD`); today when omitted. */
  readonly asOf = input<string | null>(null);

  protected readonly resourceRef = resource({
    params: () => ({ asOf: this.asOf() }),
    loader: async ({ params }): Promise<CurrencyExposure> =>
      (await firstValueFrom(this.api.getExposure(params.asOf ?? undefined))).data,
  });

  protected readonly data = computed(() =>
    this.resourceRef.hasValue() ? this.resourceRef.value() : null,
  );
  protected readonly hasError = computed(() => this.resourceRef.error() !== undefined);
  protected readonly failureDetail = computed(() => {
    const error: unknown = this.resourceRef.error();
    return currencyProblemText((error as { cause?: unknown } | undefined)?.cause ?? error);
  });
  protected readonly anyRateMissing = computed(
    () => this.data()?.items.some((item) => item.rate_missing) ?? false,
  );

  protected readonly gainClass = signClass;
}
