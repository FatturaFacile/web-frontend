import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { I18nService, LEASE_CURRENCIES, LeaseAccountingApiService, LeaseMaturityReport } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

/**
 * Maturity analysis of the lease liabilities for the notes to the financial statements: undiscounted payments within
 * one year, between one and five years and after five years, against the discounted amount (the lease liability).
 * One section per currency: amounts of different currencies are never added.
 */
@Component({
  selector: 'app-lease-maturity-report',
  imports: [FormsModule, RouterLink, MoneyPipe, NzButtonModule, NzCardModule, NzEmptyModule, NzInputModule, NzSelectModule, NzTableModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="'LEASES.MATURITY_TITLE' | translate" [subtitle]="'LEASES.MATURITY_SUBTITLE' | translate">
      <a nz-button routerLink="/leases">{{ 'LEASES.BACK' | translate }}</a>
    </app-page-header>

    <nz-card>
      <div class="toolbar">
        <label for="lease-as-of">{{ 'LEASES.AS_OF' | translate }}</label>
        <input nz-input id="lease-as-of" class="date" type="date" [(ngModel)]="asOf" (ngModelChange)="load()" />
        <nz-select class="filter" nzAllowClear [nzPlaceHolder]="'LEASES.FILTER_CURRENCY' | translate" [attr.aria-label]="'LEASES.FILTER_CURRENCY' | translate" [(ngModel)]="currency" (ngModelChange)="load()">
          @for (value of currencies; track value) {
            <nz-option [nzValue]="value" [nzLabel]="value"></nz-option>
          }
        </nz-select>
      </div>

      @for (section of sections(); track section.currency) {
        <h3>{{ section.currency }}</h3>
        <nz-table #table [nzData]="section.leases" nzSize="small" [nzShowPagination]="false" [nzScroll]="{ x: '1300px' }" [nzLoading]="loading()">
          <thead>
            <tr>
              <th scope="col">{{ 'LEASES.COL_NUMBER' | translate }}</th>
              <th scope="col">{{ 'LEASES.COL_LESSOR' | translate }}</th>
              <th scope="col">{{ 'LEASES.WITHIN_ONE_YEAR' | translate }}</th>
              <th scope="col">{{ 'LEASES.ONE_TO_FIVE_YEARS' | translate }}</th>
              <th scope="col">{{ 'LEASES.OVER_FIVE_YEARS' | translate }}</th>
              <th scope="col">{{ 'LEASES.TOTAL_UNDISCOUNTED' | translate }}</th>
              <th scope="col">{{ 'LEASES.UNEARNED_INTEREST' | translate }}</th>
              <th scope="col">{{ 'LEASES.TOTAL_DISCOUNTED' | translate }}</th>
              <th scope="col">{{ 'LEASES.CURRENT_LIABILITY' | translate }}</th>
              <th scope="col">{{ 'LEASES.NON_CURRENT_LIABILITY' | translate }}</th>
              <th scope="col">{{ 'LEASES.ROU_CARRYING' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.contract_id) {
              <tr>
                <td>
                  <a [routerLink]="['/leases', row.contract_id]">{{ row.number }}</a>
                </td>
                <td>{{ row.lessor_name }}</td>
                <td>{{ row.within_one_year | money: section.currency }}</td>
                <td>{{ row.one_to_five_years | money: section.currency }}</td>
                <td>{{ row.over_five_years | money: section.currency }}</td>
                <td>{{ row.total_undiscounted | money: section.currency }}</td>
                <td>{{ row.unearned_interest | money: section.currency }}</td>
                <td>{{ row.total_discounted | money: section.currency }}</td>
                <td>{{ row.current_liability | money: section.currency }}</td>
                <td>{{ row.non_current_liability | money: section.currency }}</td>
                <td>{{ row.rou_carrying_amount | money: section.currency }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr class="totals">
              <th scope="row" colspan="2">{{ 'LEASES.TOTALS' | translate }}</th>
              <td>{{ section.totals.within_one_year | money: section.currency }}</td>
              <td>{{ section.totals.one_to_five_years | money: section.currency }}</td>
              <td>{{ section.totals.over_five_years | money: section.currency }}</td>
              <td>{{ section.totals.total_undiscounted | money: section.currency }}</td>
              <td>{{ section.totals.unearned_interest | money: section.currency }}</td>
              <td>{{ section.totals.total_discounted | money: section.currency }}</td>
              <td>{{ section.totals.current_liability | money: section.currency }}</td>
              <td>{{ section.totals.non_current_liability | money: section.currency }}</td>
              <td>{{ section.totals.rou_carrying_amount | money: section.currency }}</td>
            </tr>
          </tfoot>
        </nz-table>
        <p class="commitments">
          <strong>{{ 'LEASES.EXEMPT_COMMITMENTS' | translate }}</strong>:
          {{ 'LEASES.WITHIN_ONE_YEAR' | translate }} {{ section.exempt_commitments.within_one_year | money: section.currency }},
          {{ 'LEASES.ONE_TO_FIVE_YEARS' | translate }} {{ section.exempt_commitments.one_to_five_years | money: section.currency }},
          {{ 'LEASES.OVER_FIVE_YEARS' | translate }} {{ section.exempt_commitments.over_five_years | money: section.currency }}
        </p>
      } @empty {
        <nz-empty [nzNotFoundContent]="'LEASES.NO_LEASES' | translate"></nz-empty>
      }
    </nz-card>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 16px;
    }
    .date {
      width: 170px;
    }
    .filter {
      min-width: 160px;
    }
    .totals {
      font-weight: 600;
    }
    .commitments {
      margin: 12px 0 24px;
    }
  `,
})
export class LeaseMaturityReportComponent implements OnInit {
  private readonly api = inject(LeaseAccountingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly currencies = LEASE_CURRENCIES;
  protected readonly report = signal<LeaseMaturityReport | null>(null);
  protected readonly loading = signal(false);
  protected readonly sections = computed(() => this.report()?.currencies ?? []);
  protected asOf = new Date().toISOString().slice(0, 10);
  protected currency: string | null = null;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getMaturityReport({ as_of: this.asOf || undefined, currency: this.currency ?? undefined }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.report.set(res.data);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.i18n.translate('LEASES.MSG_ERROR'));
      },
    });
  }
}
