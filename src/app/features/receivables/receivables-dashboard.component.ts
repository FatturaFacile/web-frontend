import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { ArBucket, PermissionsService, TranslateService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { ReceivablesDashboardStore } from './receivables-dashboard.store';
import {
  bucketColor,
  bucketLabelParts,
  drilldownQuery,
  isPositiveAmount,
  RECEIVABLES_MODULE,
} from './receivables.util';

/**
 * AR and credit dashboard (Mod 013): exposure, overdue, DSO, provision and blocked customers, the aging chart and the
 * aging matrix. Every bucket total and every customer/bucket cell drills down to the open items list.
 */
@Component({
  selector: 'app-receivables-dashboard',
  styleUrl: './receivables.scss',
  providers: [ReceivablesDashboardStore],
  imports: [
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
  ],
  template: `
    <app-page-header
      [title]="'AR.DASHBOARD_TITLE' | translate"
      [subtitle]="'AR.DASHBOARD_SUBTITLE' | translate"
    >
      <div class="header-actions">
        @if (store.availableCurrencies().length > 1) {
          <nz-select
            class="currency-select"
            style="width: 100px"
            [ngModel]="store.activeCurrency()"
            [attr.aria-label]="'AR.CURRENCY' | translate"
            (ngModelChange)="onCurrency($event)"
          >
            @for (code of store.availableCurrencies(); track code) {
              <nz-option [nzValue]="code" [nzLabel]="code"></nz-option>
            }
          </nz-select>
        }
        @if (canWrite) {
          <button
            nz-button
            type="button"
            [nzLoading]="store.posting()"
            [disabled]="!store.hasData()"
            (click)="postProvision()"
          >
            {{ 'AR.POST_PROVISION' | translate }}
          </button>
        }
        <button nz-button type="button" (click)="store.refresh()">
          {{ 'AR.REFRESH' | translate }}
        </button>
      </div>
    </app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.kpis(); as kpis) {
        @let currency = store.activeCurrency();

        <div class="kpi-grid" role="list">
          <nz-card class="kpi" role="listitem">
            <nz-statistic
              [nzTitle]="'AR.KPI_TOTAL_EXPOSURE' | translate"
              [nzValue]="kpis.total_exposure | money: currency"
            ></nz-statistic>
          </nz-card>
          <nz-card class="kpi danger" role="listitem">
            <a
              routerLink="/receivables/items"
              [queryParams]="overdueQuery()"
              [attr.aria-label]="'AR.KPI_OVERDUE_LINK' | translate"
            >
              <nz-statistic
                [nzTitle]="'AR.KPI_OVERDUE' | translate"
                [nzValue]="kpis.overdue_amount | money: currency"
              ></nz-statistic>
            </a>
          </nz-card>
          <nz-card class="kpi" role="listitem">
            <nz-statistic
              [nzTitle]="'AR.KPI_DSO' | translate"
              [nzValue]="kpis.dso ?? '—'"
            ></nz-statistic>
          </nz-card>
          <nz-card class="kpi" role="listitem">
            <nz-statistic
              [nzTitle]="'AR.KPI_PROVISION' | translate"
              [nzValue]="kpis.bad_debt_provision | money: currency"
            ></nz-statistic>
          </nz-card>
          <nz-card class="kpi" [class.danger]="kpis.blocked_customers > 0" role="listitem">
            <nz-statistic
              [nzTitle]="'AR.KPI_BLOCKED' | translate"
              [nzValue]="kpis.blocked_customers"
            ></nz-statistic>
          </nz-card>
        </div>

        <div class="grid-2">
          <nz-card class="card" [nzTitle]="'AR.AGING_CHART' | translate">
            <ul class="aging-bars">
              @for (bar of store.bars(); track bar.bucket.key; let index = $index) {
                @let part = parts(bar.bucket);
                <li>
                  <button
                    type="button"
                    class="aging-bar"
                    [attr.title]="'AR.DRILL_DOWN' | translate"
                    (click)="drill(bar.bucket.key)"
                  >
                    <span>{{ part.key | translate: part.params }}</span>
                    <span class="track" aria-hidden="true">
                      <span
                        class="fill"
                        [style.width.%]="bar.share"
                        [style.background-color]="color(index)"
                      ></span>
                    </span>
                    <span class="num">{{ bar.amount | money: currency }}</span>
                  </button>
                </li>
              }
            </ul>
          </nz-card>

          <nz-card class="card" [nzTitle]="'AR.BLOCKED_CUSTOMERS' | translate">
            @if (store.blocked().length === 0) {
              <nz-empty [nzNotFoundContent]="'AR.NO_BLOCKED' | translate"></nz-empty>
            } @else {
              <table class="matrix">
                <thead>
                  <tr>
                    <th scope="col">{{ 'AR.CUSTOMER' | translate }}</th>
                    <th scope="col">{{ 'AR.BLOCK_REASON' | translate }}</th>
                    <th scope="col" class="num">{{ 'AR.EXPOSURE' | translate }}</th>
                    <th scope="col" class="num">{{ 'AR.CREDIT_LIMIT' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of store.blocked(); track row.customer_id) {
                    <tr>
                      <th scope="row">
                        <a [routerLink]="['/receivables/credit', row.customer_id]">{{
                          row.customer_name ?? row.customer_id
                        }}</a>
                      </th>
                      <td>{{ row.reason }}</td>
                      <td class="num">{{ row.exposure | money: currency }}</td>
                      <td class="num">{{ row.limit | money: currency }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </nz-card>
        </div>

        <nz-card class="card" [nzTitle]="'AR.AGING_MATRIX' | translate">
          @if (store.isEmpty()) {
            <nz-empty [nzNotFoundContent]="'AR.NO_OPEN_ITEMS' | translate"></nz-empty>
          } @else {
            <div class="matrix-wrap">
              <table class="matrix">
                <caption class="sr-only">
                  {{
                    'AR.AGING_MATRIX' | translate
                  }}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{{ 'AR.CUSTOMER' | translate }}</th>
                    @for (bucket of store.buckets(); track bucket.key) {
                      @let part = parts(bucket);
                      <th scope="col">{{ part.key | translate: part.params }}</th>
                    }
                    <th scope="col">{{ 'AR.TOTAL_OPEN' | translate }}</th>
                    <th scope="col">{{ 'AR.ACTIONS' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of store.customers(); track row.customer_id) {
                    <tr>
                      <th scope="row">{{ row.customer_name }}</th>
                      @for (bucket of store.buckets(); track bucket.key) {
                        @let amount = row.buckets[bucket.key] ?? '0.00';
                        <td class="num">
                          @if (isPositive(amount)) {
                            <button
                              type="button"
                              class="link-button"
                              (click)="drill(bucket.key, row.customer_id)"
                            >
                              {{ amount | money: currency }}
                            </button>
                          } @else {
                            <span class="muted">–</span>
                          }
                        </td>
                      }
                      <td class="num">
                        <button
                          type="button"
                          class="link-button"
                          (click)="drill(null, row.customer_id)"
                        >
                          {{ row.total_open | money: currency }}
                        </button>
                      </td>
                      <td>
                        <a [routerLink]="['/receivables/ledger', row.customer_id]">{{
                          'AR.LEDGER' | translate
                        }}</a>
                        ·
                        <a [routerLink]="['/receivables/credit', row.customer_id]">{{
                          'AR.CREDIT' | translate
                        }}</a>
                        ·
                        <a [routerLink]="['/receivables/statement', row.customer_id]">{{
                          'AR.STATEMENT' | translate
                        }}</a>
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">{{ 'AR.TOTAL' | translate }}</th>
                    @for (bucket of store.buckets(); track bucket.key) {
                      <td class="num">
                        <button type="button" class="link-button" (click)="drill(bucket.key)">
                          {{ store.aging()?.totals[bucket.key] ?? '0.00' | money: currency }}
                        </button>
                      </td>
                    }
                    <td class="num">
                      <button type="button" class="link-button" (click)="drill(null)">
                        {{ store.aging()?.total_open ?? '0.00' | money: currency }}
                      </button>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        </nz-card>
      } @else if (!store.loading() && !store.error()) {
        <nz-empty [nzNotFoundContent]="'AR.NO_DATA' | translate"></nz-empty>
      }
    </nz-spin>
  `,
})
export class ReceivablesDashboardComponent implements OnInit {
  readonly store = inject(ReceivablesDashboardStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly canWrite = inject(PermissionsService).canWrite(RECEIVABLES_MODULE);

  readonly isPositive = isPositiveAmount;

  ngOnInit(): void {
    void this.store.load();
  }

  parts(bucket: ArBucket): { key: string; params?: Record<string, number> } {
    return bucketLabelParts(bucket);
  }

  color(index: number): string {
    return bucketColor(index, this.store.bars().length);
  }

  onCurrency(currency: string | null): void {
    if (currency) {
      void this.store.setCurrency(currency);
    }
  }

  /** Books the provision to the ledger: only the difference to what is already booked is posted. */
  async postProvision(): Promise<void> {
    const outcome = await this.store.postProvision();
    if (!outcome.ok) {
      this.message.error(outcome.message ?? this.translate.instant('AR.SAVE_ERROR'));
    } else if (outcome.result?.posted) {
      this.message.success(this.translate.instant('AR.PROVISION_POSTED'));
    } else {
      this.message.info(this.translate.instant('AR.PROVISION_ALREADY_POSTED'));
    }
  }

  overdueQuery(): Record<string, string> {
    return { status: 'overdue', open_only: '1', ...this.currencyQuery() };
  }

  /** Opens the open items on a bucket (and a customer); no bucket lists everything open of the customer. */
  drill(bucket: string | null, customerId?: string): void {
    void this.router.navigate(['/receivables/items'], {
      queryParams: drilldownQuery(bucket, customerId, this.store.activeCurrency()),
    });
  }

  private currencyQuery(): Record<string, string> {
    const currency = this.store.activeCurrency();
    return currency ? { currency } : {};
  }
}
