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
import { AccountingApiService, ChartOfAccount, LedgerEntry, VatSettlement } from '@core';
import {
  BaseTableComponent,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TableStateService,
  TranslatePipe,
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
    TranslatePipe,
  ],
  providers: [TableStateService],
  templateUrl: './accounting.component.html',
  styleUrl: './accounting.component.scss',
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

  private readonly dateTpl = viewChild<TemplateRef<unknown>>('dateTpl');
  private readonly currencyTpl = viewChild<TemplateRef<unknown>>('currencyTpl');
  private readonly accountTypeTpl = viewChild<TemplateRef<unknown>>('accountTypeTpl');
  private readonly vatStatusTpl = viewChild<TemplateRef<unknown>>('vatStatusTpl');

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
        this.ledgerEntries.set([]);
        this.tableState.setTotal(0);
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
        this.chartOfAccounts.set([]);
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
        this.vatSettlements.set([]);
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
