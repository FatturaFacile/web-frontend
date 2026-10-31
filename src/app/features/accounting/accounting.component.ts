import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import {
  AccountingApiService,
  ChartOfAccount,
  LedgerEntry,
  VatSettlement,
} from '@core';
import {
  BaseTableComponent,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TableStateService,
} from '@shared';
import { LedgerEntryFormDrawerComponent } from './components/ledger-entry-form-drawer.component';

@Component({
  selector: 'app-accounting',
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    UpperCasePipe,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzIconModule,
    NzTabsModule,
    NzGridModule,
    NzStatisticModule,
    BaseTableComponent,
    PageHeaderComponent,
    LedgerEntryFormDrawerComponent,
  ],
  providers: [TableStateService],
  template: `
    <app-page-header
      title="Contabilità Generale & Dual-Ledger"
      subtitle="Sistema a doppia partita cross-border per normative fiscali IT (SDI) e CH (CO/PCO)"
    />

    <nz-card>
      <nz-tabs [(nzSelectedIndex)]="selectedTab" (nzSelectedIndexChange)="onTabChange($event)">
        <!-- TAB 1: LIBRO GIORNALE -->
        <nz-tab nzTitle="Libro Giornale">
          <div class="tab-toolbar">
            <input
              class="search-input"
              nz-input
              type="search"
              placeholder="Cerca numero o causale..."
              [ngModel]="tableState.search()"
              (ngModelChange)="onSearchChange($event)"
            />

            <span class="spacer"></span>
            <button nz-button nzType="primary" type="button" (click)="drawerOpen.set(true)">
              <nz-icon nzType="plus" /> Nuova Registrazione
            </button>
          </div>

          <app-base-table
            [data]="ledgerEntries()"
            [columns]="ledgerColumns()"
            [loading]="tableState.loading()"
            [total]="tableState.total()"
            [pageIndex]="tableState.pageIndex()"
            [pageSize]="tableState.pageSize()"
            [expandable]="true"
            [detailTemplate]="ledgerDetailTpl"
            (paramsChange)="onParamsChange($event)"
          />

          <!-- Detail row expandable template -->
          <ng-template #ledgerDetailTpl let-entry>
            <div class="expandable-detail-wrapper">
              <h5>Dettaglio Righe Registrazione {{ entry.entry_number }}</h5>
              <table class="nested-lines-table">
                <thead>
                  <tr>
                    <th>Conto</th>
                    <th>Descrizione</th>
                    <th style="text-align: right;">Dare (€/CHF)</th>
                    <th style="text-align: right;">Avere (€/CHF)</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of entry.lines; track $index) {
                    <tr>
                      <td><code>{{ line.account_code || line.account_id }}</code> - {{ line.account_name || 'Conto Contabile' }}</td>
                      <td>{{ line.description || '-' }}</td>
                      <td style="text-align: right;">{{ line.debit > 0 ? (line.debit | currency: 'EUR' : 'symbol' : '1.2-2') : '-' }}</td>
                      <td style="text-align: right;">{{ line.credit > 0 ? (line.credit | currency: 'EUR' : 'symbol' : '1.2-2') : '-' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </ng-template>
        </nz-tab>

        <!-- TAB 2: PIANO DEI CONTI -->
        <nz-tab nzTitle="Piano dei Conti">
          <app-base-table
            [data]="chartOfAccounts()"
            [columns]="coaColumns()"
            [loading]="loadingCoa()"
            [total]="chartOfAccounts().length"
            [scroll]="{ x: '900px' }"
          />
        </nz-tab>

        <!-- TAB 3: LIQUIDAZIONI IVA -->
        <nz-tab nzTitle="Liquidazioni IVA & Fiscale">
          <app-base-table
            [data]="vatSettlements()"
            [columns]="vatColumns()"
            [loading]="loadingVat()"
            [total]="vatSettlements().length"
            [scroll]="{ x: '900px' }"
          />
        </nz-tab>
      </nz-tabs>
    </nz-card>

    <app-ledger-entry-form-drawer
      [open]="drawerOpen()"
      (openChange)="drawerOpen.set($event)"
      (saved)="loadLedgerEntries()"
    />

    <!-- Shared Templates -->
    <ng-template #dateTpl let-item let-val="value">
      {{ val | date: 'dd.MM.yyyy' }}
    </ng-template>

    <ng-template #currencyTpl let-item let-val="value">
      {{ val | currency: (item.currency || 'EUR') : 'symbol' : '1.2-2' }}
    </ng-template>

    <ng-template #accountTypeTpl let-item let-val="value">
      <nz-tag [nzColor]="getAccountTypeColor(val)">{{ val | uppercase }}</nz-tag>
    </ng-template>

    <ng-template #vatStatusTpl let-item let-val="value">
      <nz-tag [nzColor]="val === 'paid' ? 'success' : val === 'settled' ? 'processing' : 'default'">
        {{ val | uppercase }}
      </nz-tag>
    </ng-template>
  `,
  styles: `
    .tab-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .search-input {
      width: 280px;
    }
    .spacer {
      flex: 1;
    }
    .expandable-detail-wrapper {
      padding: 12px 16px;
      background: #fafafa;
      border-radius: 4px;
      margin: 8px 0;
    }
    .nested-lines-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 8px;

      th, td {
        padding: 6px 12px;
        border-bottom: 1px solid #f0f0f0;
      }
      th {
        background: #f5f5f5;
        font-weight: 600;
      }
    }
  `,
})
export class AccountingComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly message = inject(NzMessageService);
  protected readonly tableState = inject(TableStateService<LedgerEntry>);

  protected selectedTab = 0;
  protected readonly drawerOpen = signal(false);

  protected readonly ledgerEntries = signal<LedgerEntry[]>([]);
  protected readonly chartOfAccounts = signal<ChartOfAccount[]>([]);
  protected readonly vatSettlements = signal<VatSettlement[]>([]);

  protected readonly loadingCoa = signal(false);
  protected readonly loadingVat = signal(false);

  private readonly dateTpl = viewChild<TemplateRef<any>>('dateTpl');
  private readonly currencyTpl = viewChild<TemplateRef<any>>('currencyTpl');
  private readonly accountTypeTpl = viewChild<TemplateRef<any>>('accountTypeTpl');
  private readonly vatStatusTpl = viewChild<TemplateRef<any>>('vatStatusTpl');

  readonly ledgerColumns = computed<TableColumnDef<LedgerEntry>[]>(() => [
    {
      key: 'entry_number',
      header: 'Numero Registrazione',
      width: '180px',
      sortable: true,
    },
    {
      key: 'date',
      header: 'Data Contabile',
      width: '130px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'description',
      header: 'Descrizione / Causale',
      width: '320px',
    },
    {
      key: 'total_debit',
      header: 'Totale Dare',
      width: '140px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'total_credit',
      header: 'Totale Avere',
      width: '140px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
  ]);

  readonly coaColumns = computed<TableColumnDef<ChartOfAccount>[]>(() => [
    {
      key: 'code',
      header: 'Codice Conto',
      width: '140px',
      sortable: true,
    },
    {
      key: 'name',
      header: 'Denominazione Conto',
      width: '300px',
      sortable: true,
    },
    {
      key: 'type',
      header: 'Tipologia',
      width: '140px',
      customCellTemplate: this.accountTypeTpl(),
    },
    {
      key: 'balance',
      header: 'Saldo Attuale',
      width: '160px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
  ]);

  readonly vatColumns = computed<TableColumnDef<VatSettlement>[]>(() => [
    {
      key: 'period',
      header: 'Periodo Fiscale',
      width: '140px',
    },
    {
      key: 'year',
      header: 'Anno',
      width: '100px',
    },
    {
      key: 'jurisdiction',
      header: 'Giurisdizione',
      width: '120px',
    },
    {
      key: 'total_vat_collected',
      header: 'IVA a Debito (Vendite)',
      width: '180px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'total_vat_paid',
      header: 'IVA a Credito (Acquisti)',
      width: '180px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'balance',
      header: 'Saldo IVA',
      width: '150px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'status',
      header: 'Stato',
      width: '120px',
      customCellTemplate: this.vatStatusTpl(),
    },
  ]);

  ngOnInit(): void {
    this.loadLedgerEntries();
    this.loadChartOfAccounts();
    this.loadVatSettlements();
  }

  onTabChange(index: number): void {
    if (index === 1 && this.chartOfAccounts().length === 0) {
      this.loadChartOfAccounts();
    } else if (index === 2 && this.vatSettlements().length === 0) {
      this.loadVatSettlements();
    }
  }

  loadLedgerEntries(): void {
    this.tableState.setLoading(true);
    this.api.getLedgerEntries(this.tableState.toBackendQueryParams()).subscribe({
      next: (res) => {
        const data = (res.data || []).map((e) => ({
          ...e,
          total_debit: e.lines?.reduce((s, l) => s + (Number(l.debit) || 0), 0) || 0,
          total_credit: e.lines?.reduce((s, l) => s + (Number(l.credit) || 0), 0) || 0,
        }));
        this.ledgerEntries.set(data);
        this.tableState.setTotal(res.meta?.total || data.length);
        this.tableState.setLoading(false);
      },
      error: () => {
        // Fallback demo data
        if (this.ledgerEntries().length === 0) {
          const sample: LedgerEntry[] = [
            {
              id: 'gl-1',
              entry_number: 'GL-2026-0001',
              date: '2026-10-15',
              description: 'Incasso fattura cliente INV-2026-0038',
              lines: [
                { id: 'l-1', account_id: '1020', account_code: '1020', account_name: 'Banca Popolare c/c', debit: 1250, credit: 0 },
                { id: 'l-2', account_id: '1100', account_code: '1100', account_name: 'Crediti v/Clienti', debit: 0, credit: 1250 },
              ],
              total_debit: 1250,
              total_credit: 1250,
            },
            {
              id: 'gl-2',
              entry_number: 'GL-2026-0002',
              date: '2026-10-18',
              description: 'Pagamento fornitore Swiss Solutions SA',
              lines: [
                { id: 'l-3', account_id: '2100', account_code: '2100', account_name: 'Debiti v/Fornitori CH', debit: 3400, credit: 0 },
                { id: 'l-4', account_id: '1025', account_code: '1025', account_name: 'UBS Svizzera c/c CHF', debit: 0, credit: 3400 },
              ],
              total_debit: 3400,
              total_credit: 3400,
            },
          ];
          this.ledgerEntries.set(sample);
          this.tableState.setTotal(2);
        }
        this.tableState.setLoading(false);
      },
    });
  }

  loadChartOfAccounts(): void {
    this.loadingCoa.set(true);
    this.api.getChartOfAccounts().subscribe({
      next: (res) => {
        this.chartOfAccounts.set(res.data || []);
        this.loadingCoa.set(false);
      },
      error: () => {
        if (this.chartOfAccounts().length === 0) {
          this.chartOfAccounts.set([
            { id: 'coa-1', code: '1010', name: 'Cassa contanti', type: 'asset', balance: 2450.8, currency: 'EUR' },
            { id: 'coa-2', code: '1020', name: 'Banca c/c ordinario Italia', type: 'asset', balance: 54120.0, currency: 'EUR' },
            { id: 'coa-3', code: '1025', name: 'UBS AG c/c Lugano CHF', type: 'asset', balance: 89450.5, currency: 'CHF' },
            { id: 'coa-4', code: '1100', name: 'Crediti commerciali Italia', type: 'asset', balance: 32400.0, currency: 'EUR' },
            { id: 'coa-5', code: '2100', name: 'Debiti fornitori CH & IT', type: 'liability', balance: -18500.0, currency: 'EUR' },
            { id: 'coa-6', code: '4010', name: 'Ricavi vendite servizi software', type: 'revenue', balance: 145000.0, currency: 'EUR' },
            { id: 'coa-7', code: '5020', name: 'Costi canoni e licenze cloud', type: 'expense', balance: 28900.0, currency: 'EUR' },
          ]);
        }
        this.loadingCoa.set(false);
      },
    });
  }

  loadVatSettlements(): void {
    this.loadingVat.set(true);
    this.api.getVatSettlements().subscribe({
      next: (res) => {
        this.vatSettlements.set(res.data || []);
        this.loadingVat.set(false);
      },
      error: () => {
        if (this.vatSettlements().length === 0) {
          this.vatSettlements.set([
            { id: 'vat-1', period: 'Q3', year: 2026, jurisdiction: 'IT', total_vat_collected: 18450, total_vat_paid: 12200, balance: 6250, status: 'settled' },
            { id: 'vat-2', period: 'Q2', year: 2026, jurisdiction: 'IT', total_vat_collected: 15300, total_vat_paid: 11100, balance: 4200, status: 'paid' },
            { id: 'vat-3', period: 'S1', year: 2026, jurisdiction: 'CH', total_vat_collected: 8400, total_vat_paid: 3200, balance: 5200, status: 'settled' },
          ]);
        }
        this.loadingVat.set(false);
      },
    });
  }

  onSearchChange(search: string): void {
    this.tableState.setSearch(search);
    this.loadLedgerEntries();
  }

  onParamsChange(params: TableQueryParams): void {
    this.tableState.setPage(params.pageIndex);
    this.tableState.setPageSize(params.pageSize);
    if (params.sort) {
      this.tableState.setSort(params.sort.key, params.sort.order);
    }
    this.loadLedgerEntries();
  }

  getAccountTypeColor(type: string): string {
    switch (type) {
      case 'asset':
        return 'blue';
      case 'liability':
        return 'volcano';
      case 'equity':
        return 'purple';
      case 'revenue':
        return 'green';
      case 'expense':
        return 'orange';
      default:
        return 'default';
    }
  }
}
