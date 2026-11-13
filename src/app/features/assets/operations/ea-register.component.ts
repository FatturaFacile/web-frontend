import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AssetLedgerType, AssetRegisterRow, AuthStore, EamOpsApiService, ExpiringAsset } from '@core';
import { MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { downloadBlob } from '../../general-ledger/shared/gl-dates';

/** Asset register of a year and ledger (JSON or CSV) and the warranty and insurance expiry alerts. */
@Component({
  selector: 'app-ea-register',
  styleUrl: './ea-register.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    FormsModule, NzButtonModule, NzCardModule, NzInputNumberModule, NzSelectModule, NzTableModule, NzTabsModule, NzTagModule, MoneyPipe, TranslatePipe],
  template: `
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'EA.ASSET_REGISTER' | translate">
          <div class="report-toolbar">
            <label for="rg-year">{{ 'EA.YEAR' | translate }}</label>
            <nz-input-number id="rg-year" [(ngModel)]="year" [nzMin]="2000" [nzMax]="2100" />
            <nz-select [attr.aria-label]="'EA.LEDGER' | translate" [(ngModel)]="ledger">
              @for (type of ledgers; track type) {
                <nz-option [nzValue]="type" [nzLabel]="type" />
              }
            </nz-select>
            <button nz-button nzType="primary" type="button" [nzLoading]="loading()" (click)="load()">{{ 'EA.RUN_REPORT' | translate }}</button>
            <button nz-button type="button" (click)="exportCsv()">{{ 'EA.EXPORT_CSV' | translate }}</button>
          </div>
          <nz-table
            #registerTable
            nzSize="small"
            [nzData]="rows()"
            [nzFrontPagination]="false"
            [nzTotal]="total()"
            [nzPageIndex]="pageIndex()"
            [nzPageSize]="50"
            [nzScroll]="{ x: '1400px' }"
            (nzPageIndexChange)="load($event)"
          >
            <thead>
              <tr>
                <th [nzSortFn]="'asset_number' | gridSort" [nzFilters]="'asset_number' | gridFilterList: registerTable.nzData" [nzFilterFn]="'asset_number' | gridFilterFn">{{ 'EA.CODE' | translate }}</th>
                <th [nzSortFn]="'name' | gridSort" [nzFilters]="'name' | gridFilterList: registerTable.nzData" [nzFilterFn]="'name' | gridFilterFn">{{ 'EA.NAME' | translate }}</th>
                <th nzAlign="right" [nzSortFn]="'cost_start' | gridSort" [nzFilters]="'cost_start' | gridFilterList: registerTable.nzData" [nzFilterFn]="'cost_start' | gridFilterFn">{{ 'EA.COST_START' | translate }}</th>
                <th nzAlign="right" [nzSortFn]="'additions' | gridSort" [nzFilters]="'additions' | gridFilterList: registerTable.nzData" [nzFilterFn]="'additions' | gridFilterFn">{{ 'EA.ADDITIONS' | translate }}</th>
                <th nzAlign="right" [nzSortFn]="'disposals_cost' | gridSort" [nzFilters]="'disposals_cost' | gridFilterList: registerTable.nzData" [nzFilterFn]="'disposals_cost' | gridFilterFn">{{ 'EA.DISPOSALS' | translate }}</th>
                <th nzAlign="right" [nzSortFn]="'cost_end' | gridSort" [nzFilters]="'cost_end' | gridFilterList: registerTable.nzData" [nzFilterFn]="'cost_end' | gridFilterFn">{{ 'EA.COST_END' | translate }}</th>
                <th nzAlign="right" [nzSortFn]="'depreciation_year' | gridSort" [nzFilters]="'depreciation_year' | gridFilterList: registerTable.nzData" [nzFilterFn]="'depreciation_year' | gridFilterFn">{{ 'EA.DEPRECIATION_YEAR' | translate }}</th>
                <th nzAlign="right" [nzSortFn]="'accumulated_end' | gridSort" [nzFilters]="'accumulated_end' | gridFilterList: registerTable.nzData" [nzFilterFn]="'accumulated_end' | gridFilterFn">{{ 'EA.ACCUMULATED_END' | translate }}</th>
                <th nzAlign="right" [nzSortFn]="'net_book_value_end' | gridSort" [nzFilters]="'net_book_value_end' | gridFilterList: registerTable.nzData" [nzFilterFn]="'net_book_value_end' | gridFilterFn">{{ 'EA.NET_BOOK_VALUE' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of registerTable.data; track row.asset_id) {
                <tr>
                  <td>{{ row.asset_number }}</td>
                  <td>{{ row.name }}</td>
                  <td nzAlign="right">{{ row.cost_start | money: currency() }}</td>
                  <td nzAlign="right">{{ row.additions | money: currency() }}</td>
                  <td nzAlign="right">{{ row.disposals_cost | money: currency() }}</td>
                  <td nzAlign="right">{{ row.cost_end | money: currency() }}</td>
                  <td nzAlign="right">{{ row.depreciation_year | money: currency() }}</td>
                  <td nzAlign="right">{{ row.accumulated_end | money: currency() }}</td>
                  <td nzAlign="right">{{ row.net_book_value_end | money: currency() }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'EA.EXPIRING' | translate">
          <nz-table #expiringTable nzSize="middle" [nzData]="expiring()" [nzShowPagination]="false">
            <thead>
              <tr>
                <th [nzSortFn]="'asset_number' | gridSort" [nzFilters]="'asset_number' | gridFilterList: expiringTable.nzData" [nzFilterFn]="'asset_number' | gridFilterFn">{{ 'EA.CODE' | translate }}</th>
                <th [nzSortFn]="'name' | gridSort" [nzFilters]="'name' | gridFilterList: expiringTable.nzData" [nzFilterFn]="'name' | gridFilterFn">{{ 'EA.NAME' | translate }}</th>
                <th [nzSortFn]="'warranty_provider' | gridSort" [nzFilters]="'warranty_provider' | gridFilterList: expiringTable.nzData" [nzFilterFn]="'warranty_provider' | gridFilterFn">{{ 'EA.WARRANTY_EXPIRY' | translate }}</th>
                <th [nzSortFn]="'insurance_provider' | gridSort" [nzFilters]="'insurance_provider' | gridFilterList: expiringTable.nzData" [nzFilterFn]="'insurance_provider' | gridFilterFn">{{ 'EA.INSURANCE_EXPIRY' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (asset of expiringTable.data; track asset.asset_id) {
                <tr>
                  <td>{{ asset.asset_number }}</td>
                  <td>{{ asset.name }}</td>
                  <td>
                    {{ asset.warranty_expiry_date ?? '' }}
                    @if (asset.warranty_provider) {
                      <nz-tag>{{ asset.warranty_provider }}</nz-tag>
                    }
                  </td>
                  <td>
                    {{ asset.insurance_expiry_date ?? '' }}
                    @if (asset.insurance_provider) {
                      <nz-tag>{{ asset.insurance_provider }}</nz-tag>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-card>
  `,
})
export class EaRegisterComponent implements OnInit {
  private readonly api = inject(EamOpsApiService);
  protected readonly currency = inject(AuthStore).activeCurrency;

  protected readonly ledgers: AssetLedgerType[] = ['statutory', 'tax', 'ifrs', 'management', 'civil', 'fiscal'];
  protected readonly rows = signal<AssetRegisterRow[]>([]);
  protected readonly expiring = signal<ExpiringAsset[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly loading = signal(false);
  protected year = new Date().getFullYear();
  protected ledger: AssetLedgerType = 'statutory';

  ngOnInit(): void {
    this.api.getExpiringAssets().subscribe({ next: (res) => this.expiring.set(res.data ?? []) });
  }

  protected load(page = 1): void {
    this.pageIndex.set(page);
    this.loading.set(true);
    this.api.getAssetRegister({ year: this.year, ledger_type: this.ledger, per_page: 50, page }).subscribe({
      next: (res) => {
        this.rows.set(res.data ?? []);
        this.total.set(res.meta?.total ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected exportCsv(): void {
    this.api.exportAssetRegister({ year: this.year, ledger_type: this.ledger }).subscribe({
      next: (blob) => downloadBlob(blob, `asset-register-${this.year}-${this.ledger}.csv`),
    });
  }
}
