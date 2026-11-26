import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzInputModule } from 'ng-zorro-antd/input';
import {
  ALL_RATE_TYPES,
  CurrencyExportFormat,
  CurrencyRate,
  CurrencyRateType,
  I18nService,
  PermissionsService,
} from '@core';
import { ManualRateDialogComponent, PageHeaderComponent, TranslatePipe } from '@shared';
import { CurrencyExposureWidgetComponent } from './currency-exposure-widget.component';
import { CurrencySettingsComponent } from './currency-settings.component';
import { CURRENCY_FX_MODULE } from './currency-fx.util';
import { CurrencyRatesStore } from './currency-rates.store';
import { RateTrendComponent } from './rate-trend.component';
import { SyncRunsComponent } from './sync-runs.component';

/**
 * Exchange rates (Mod 003): the rates table with filters and paging, the trend of the filtered pair, the manual rate
 * dialog and the audit export, plus the tabs of the ECB / SNB / ESTV synchronisation, the exposure and the settings.
 */
@Component({
  selector: 'app-currency-rates-page',
  imports: [
    CurrencyExposureWidgetComponent,
    CurrencySettingsComponent,
    FormsModule,
    ManualRateDialogComponent,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    RateTrendComponent,
    RouterLink,
    SyncRunsComponent,
    TranslatePipe,
  ],
  providers: [CurrencyRatesStore],
  styleUrl: './currency-fx.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.FINANCE_CURRENCIES' | translate"></app-page-header>

    <nz-tabs>
      <nz-tab [nzTitle]="'FINANCE.CURRENCIES.TAB.RATES' | translate">
        <div class="toolbar">
          <label class="field" for="fx-f-base">
            <span>{{ 'FINANCE.CURRENCIES.FIELD.BASE' | translate }}</span>
            <input
              nz-input
              id="fx-f-base"
              maxlength="3"
              autocomplete="off"
              [value]="store.filters().base ?? ''"
              (change)="onCurrencyFilter('base', $event)"
            />
          </label>
          <label class="field" for="fx-f-quote">
            <span>{{ 'FINANCE.CURRENCIES.FIELD.QUOTE' | translate }}</span>
            <input
              nz-input
              id="fx-f-quote"
              maxlength="3"
              autocomplete="off"
              [value]="store.filters().quote ?? ''"
              (change)="onCurrencyFilter('quote', $event)"
            />
          </label>
          <label class="field" for="fx-f-type">
            <span>{{ 'FINANCE.CURRENCIES.FIELD.RATE_TYPE' | translate }}</span>
            <nz-select
              nzId="fx-f-type"
              nzAllowClear
              [ngModel]="store.filters().rate_type || null"
              (ngModelChange)="store.setFilters({ rate_type: $event ?? '' })"
            >
              @for (type of rateTypes; track type) {
                <nz-option
                  [nzValue]="type"
                  [nzLabel]="'FINANCE.CURRENCIES.RATE_TYPE.' + type | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="fx-f-from">
            <span>{{ 'FINANCE.CURRENCIES.FIELD.FROM' | translate }}</span>
            <input
              nz-input
              id="fx-f-from"
              type="date"
              [value]="store.filters().from ?? ''"
              (change)="onDateFilter('from', $event)"
            />
          </label>
          <label class="field" for="fx-f-to">
            <span>{{ 'FINANCE.CURRENCIES.FIELD.TO' | translate }}</span>
            <input
              nz-input
              id="fx-f-to"
              type="date"
              [value]="store.filters().to ?? ''"
              (change)="onDateFilter('to', $event)"
            />
          </label>
        </div>
        <div class="toolbar">
          @if (canWrite) {
            <button
              nz-button
              nzType="primary"
              type="button"
              class="new-rate"
              (click)="dialogOpen.set(true)"
            >
              {{ 'FINANCE.CURRENCIES.ACTION.NEW_MANUAL_RATE' | translate }}
            </button>
          }
          <button
            nz-button
            type="button"
            class="export-csv"
            [nzLoading]="store.exporting()"
            (click)="export('csv')"
          >
            {{ 'FINANCE.CURRENCIES.ACTION.EXPORT_CSV' | translate }}
          </button>
          <button
            nz-button
            type="button"
            class="export-xlsx"
            [nzLoading]="store.exporting()"
            (click)="export('xlsx')"
          >
            {{ 'FINANCE.CURRENCIES.ACTION.EXPORT_XLSX' | translate }}
          </button>
          <a nz-button routerLink="/finance/currencies/revaluation" class="open-revaluation">
            {{ 'FINANCE.CURRENCIES.ACTION.OPEN_REVALUATION' | translate }}
          </a>
        </div>

        @if (store.error(); as key) {
          <nz-alert
            class="form-alert"
            nzType="error"
            nzShowIcon
            [nzMessage]="key | translate"
            [nzDescription]="store.errorDetail()"
          ></nz-alert>
        }

        @if (store.pairSelected()) {
          <app-fx-rate-trend [points]="store.trend()" [pair]="pairLabel()" />
        }

        <nz-spin [nzSpinning]="store.loading()">
          <nz-table
            #table
            nzSize="middle"
            nzFrontPagination="false"
            [nzData]="store.rates()"
            [nzTotal]="store.total()"
            [nzPageIndex]="store.page()"
            [nzPageSize]="store.pageSize()"
            (nzPageIndexChange)="store.setPage($event)"
          >
            <thead>
              <tr>
                <th>{{ 'FINANCE.CURRENCIES.COLUMN.PAIR' | translate }}</th>
                <th class="num">{{ 'FINANCE.CURRENCIES.COLUMN.RATE' | translate }}</th>
                <th>{{ 'FINANCE.CURRENCIES.COLUMN.RATE_TYPE' | translate }}</th>
                <th>{{ 'FINANCE.CURRENCIES.COLUMN.SOURCE' | translate }}</th>
                <th>{{ 'FINANCE.CURRENCIES.COLUMN.VALID_ON' | translate }}</th>
                <th>{{ 'FINANCE.CURRENCIES.COLUMN.NOTES' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (rate of table.data; track rate.id) {
                <tr [class.superseded]="rate.superseded_by !== null">
                  <td>
                    <strong>{{ rate.base }}/{{ rate.quote }}</strong>
                  </td>
                  <td class="num">{{ rate.rate }}</td>
                  <td>{{ 'FINANCE.CURRENCIES.RATE_TYPE.' + rate.rate_type | translate }}</td>
                  <td>{{ 'FINANCE.CURRENCIES.SOURCE.' + rate.source | translate }}</td>
                  <td>{{ rate.valid_on }}</td>
                  <td>
                    @if (rate.is_derived) {
                      <nz-tag class="badge-derived" nzColor="blue">{{
                        'FINANCE.CURRENCIES.BADGE.DERIVED' | translate
                      }}</nz-tag>
                    }
                    @if (rate.is_contract) {
                      <nz-tag class="badge-contract" nzColor="purple">{{
                        'FINANCE.CURRENCIES.BADGE.CONTRACT' | translate
                      }}</nz-tag>
                    }
                    @if (rate.superseded_by !== null) {
                      <nz-tag nzColor="default">{{
                        'FINANCE.CURRENCIES.BADGE.SUPERSEDED' | translate
                      }}</nz-tag>
                    }
                    @if (rate.tenant_id === null) {
                      <nz-tag nzColor="default">{{
                        'FINANCE.CURRENCIES.BADGE.OFFICIAL' | translate
                      }}</nz-tag>
                    }
                    @if (rate.contract_reference) {
                      <span class="muted">{{ rate.contract_reference }}</span>
                    }
                    @if (rate.reason) {
                      <div class="muted">{{ rate.reason }}</div>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <nz-empty
                      [nzNotFoundContent]="'FINANCE.CURRENCIES.EMPTY.RATES' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-spin>
      </nz-tab>

      <nz-tab [nzTitle]="'FINANCE.CURRENCIES.TAB.SYNC' | translate">
        <ng-template nz-tab>
          <app-fx-sync-runs [canWrite]="canWrite" />
        </ng-template>
      </nz-tab>

      <nz-tab [nzTitle]="'FINANCE.CURRENCIES.TAB.EXPOSURE' | translate">
        <ng-template nz-tab>
          <app-currency-exposure-widget />
        </ng-template>
      </nz-tab>

      <nz-tab [nzTitle]="'FINANCE.CURRENCIES.TAB.SETTINGS' | translate">
        <ng-template nz-tab>
          <app-currency-settings [canWrite]="canWrite" />
        </ng-template>
      </nz-tab>
    </nz-tabs>

    <app-manual-rate-dialog
      [(open)]="dialogOpen"
      [base]="store.filters().base ?? ''"
      [quote]="store.filters().quote ?? ''"
      (saved)="onSaved($event)"
    />
  `,
})
export class CurrencyRatesPageComponent implements OnInit {
  protected readonly store = inject(CurrencyRatesStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = this.permissions.canWrite(CURRENCY_FX_MODULE);
  protected readonly rateTypes: readonly CurrencyRateType[] = ALL_RATE_TYPES;
  protected readonly dialogOpen = signal(false);

  protected readonly pairLabel = computed(
    () => `${this.store.filters().base ?? ''}/${this.store.filters().quote ?? ''}`,
  );

  ngOnInit(): void {
    void this.store.init();
  }

  /** Applies a currency filter when the box is empty or holds a complete ISO code. */
  protected onCurrencyFilter(field: 'base' | 'quote', event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim().toUpperCase();
    if (value === '' || /^[A-Z]{3}$/u.test(value)) {
      void this.store.setFilters({ [field]: value });
    }
  }

  protected onDateFilter(field: 'from' | 'to', event: Event): void {
    void this.store.setFilters({ [field]: (event.target as HTMLInputElement).value });
  }

  protected onSaved(_rate: CurrencyRate): void {
    void this.store.reload();
  }

  protected async export(format: CurrencyExportFormat): Promise<void> {
    if (await this.store.exportRates(format)) {
      this.message.success(this.i18n.translate('FINANCE.CURRENCIES.MESSAGE.EXPORT_READY'));
    }
  }
}
