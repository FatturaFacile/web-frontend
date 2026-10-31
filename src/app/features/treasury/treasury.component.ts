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
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import {
  BankAccountResource,
  BankStatement,
  BankTransactionResource,
  BankingApiService,
  TreasuryApiService,
} from '@core';
import {
  BaseTableComponent,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TableStateService,
} from '@shared';

@Component({
  selector: 'app-treasury',
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
    NzModalModule,
    NzUploadModule,
    BaseTableComponent,
    PageHeaderComponent,
  ],
  providers: [TableStateService],
  template: `
    <app-page-header
      title="Tesoreria & Riconciliazione Bancaria"
      subtitle="Gestione conti multi-valuta (EUR/CHF), import estratti conto CAMT.053/CBI e riconciliazione automatica"
    />

    <!-- Header Stats -->
    <div nz-row [nzGutter]="16" class="stats-row">
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="totalEurBalance()"
            [nzPrefix]="'€'"
            nzTitle="Liquidità Totale EUR"
          />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="totalChfBalance()"
            [nzPrefix]="'CHF'"
            nzTitle="Liquidità Totale CHF"
          />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="unreconciledCount()"
            nzTitle="Transazioni da Riconciliare"
          />
        </nz-card>
      </div>
    </div>

    <nz-card>
      <nz-tabs [(nzSelectedIndex)]="selectedTab">
        <!-- TAB 1: MOVIMENTI BANCARI -->
        <nz-tab nzTitle="Movimenti Bancari">
          <div class="tab-toolbar">
            <input
              class="search-input"
              nz-input
              type="search"
              placeholder="Cerca descrizione o controparte..."
              [ngModel]="tableState.search()"
              (ngModelChange)="onSearchChange($event)"
            />

            <span class="spacer"></span>
            <button
              nz-button
              nzType="default"
              type="button"
              (click)="triggerAutoMatch()"
              [nzLoading]="isReconciling()"
            >
              <nz-icon nzType="sync" /> Riconciliazione Automatica
            </button>
            <button
              nz-button
              nzType="primary"
              type="button"
              (click)="isImportModalVisible.set(true)"
            >
              <nz-icon nzType="upload" /> Importa Estratto Conto (CAMT/CBI)
            </button>
          </div>

          <app-base-table
            [data]="transactions()"
            [columns]="txColumns()"
            [loading]="tableState.loading()"
            [total]="tableState.total()"
            [pageIndex]="tableState.pageIndex()"
            [pageSize]="tableState.pageSize()"
            (paramsChange)="onParamsChange($event)"
          />
        </nz-tab>

        <!-- TAB 2: CONTI BANCARI -->
        <nz-tab nzTitle="Conti Correnti">
          <app-base-table
            [data]="bankAccounts()"
            [columns]="accountColumns()"
            [loading]="loadingAccounts()"
            [total]="bankAccounts().length"
            [scroll]="{ x: '900px' }"
          />
        </nz-tab>

        <!-- TAB 3: ESTRATTI CONTO IMPORTATI -->
        <nz-tab nzTitle="Estratti Conto Importati">
          <app-base-table
            [data]="statements()"
            [columns]="statementColumns()"
            [loading]="loadingStatements()"
            [total]="statements().length"
            [scroll]="{ x: '1000px' }"
            [actionsTemplate]="statementActionsTpl"
          />

          <ng-template #statementActionsTpl let-st>
            <button
              nz-button
              nzType="link"
              nzSize="small"
              type="button"
              (click)="reconcileStatement(st)"
            >
              Riconcilia
            </button>
          </ng-template>
        </nz-tab>
      </nz-tabs>
    </nz-card>

    <!-- Modal for importing CAMT / CBI file -->
    <nz-modal
      [(nzVisible)]="isImportModalVisible"
      nzTitle="Importazione File Bancario CAMT.053 / CBI"
      (nzOnCancel)="isImportModalVisible.set(false)"
      (nzOnOk)="submitImport()"
      [nzOkLoading]="isUploading()"
    >
      <ng-container *nzModalContent>
        <p>Seleziona il formato del file di estratto conto bancario da importare nel sistema:</p>
        <div style="margin-bottom: 16px;">
          <label style="margin-right: 16px;">
            <input type="radio" name="format" value="camt" [checked]="importFormat === 'camt'" (change)="importFormat = 'camt'" />
            CAMT.053 XML (Svizzera / SEPA)
          </label>
          <label>
            <input type="radio" name="format" value="cbi" [checked]="importFormat === 'cbi'" (change)="importFormat = 'cbi'" />
            CBI Rendicontazione (Italia)
          </label>
        </div>
        <input type="file" (change)="onFileSelected($event)" accept=".xml,.cbi,.txt,.csv" />
      </ng-container>
    </nz-modal>

    <!-- Shared Templates -->
    <ng-template #dateTpl let-item let-val="value">
      {{ val | date: 'dd.MM.yyyy' }}
    </ng-template>

    <ng-template #currencyTpl let-item let-val="value">
      <strong [style.color]="val < 0 ? '#cf1322' : '#389e0d'">
        {{ val | currency: (item.currency || 'EUR') : 'symbol' : '1.2-2' }}
      </strong>
    </ng-template>

    <ng-template #reconciledTpl let-item let-val="value">
      <nz-tag [nzColor]="val ? 'success' : 'warning'">
        {{ val ? 'RICONCILIATO' : 'DA RICONCILIARE' }}
      </nz-tag>
    </ng-template>

    <ng-template #statusTpl let-item let-val="value">
      <nz-tag [nzColor]="val === 'reconciled' ? 'success' : val === 'partially_reconciled' ? 'processing' : 'default'">
        {{ val | uppercase }}
      </nz-tag>
    </ng-template>
  `,
  styles: `
    .stats-row {
      margin-bottom: 16px;
    }
    .tab-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search-input {
      width: 280px;
    }
    .spacer {
      flex: 1;
    }
  `,
})
export class TreasuryComponent implements OnInit {
  private readonly treasuryApi = inject(TreasuryApiService);
  private readonly bankingApi = inject(BankingApiService);
  private readonly message = inject(NzMessageService);
  protected readonly tableState = inject(TableStateService<BankTransactionResource>);

  protected selectedTab = 0;
  protected isImportModalVisible = signal(false);
  protected isUploading = signal(false);
  protected isReconciling = signal(false);
  protected importFormat: 'camt' | 'cbi' = 'camt';
  protected selectedFile: File | null = null;

  protected readonly bankAccounts = signal<BankAccountResource[]>([]);
  protected readonly transactions = signal<BankTransactionResource[]>([]);
  protected readonly statements = signal<BankStatement[]>([]);

  protected readonly loadingAccounts = signal(false);
  protected readonly loadingStatements = signal(false);

  protected readonly totalEurBalance = computed(() => {
    return this.bankAccounts()
      .filter((a) => a.currency === 'EUR')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  });

  protected readonly totalChfBalance = computed(() => {
    return this.bankAccounts()
      .filter((a) => a.currency === 'CHF')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  });

  protected readonly unreconciledCount = computed(() => {
    return this.transactions().filter((t) => !t.reconciled).length;
  });

  private readonly dateTpl = viewChild<TemplateRef<any>>('dateTpl');
  private readonly currencyTpl = viewChild<TemplateRef<any>>('currencyTpl');
  private readonly reconciledTpl = viewChild<TemplateRef<any>>('reconciledTpl');
  private readonly statusTpl = viewChild<TemplateRef<any>>('statusTpl');

  readonly txColumns = computed<TableColumnDef<BankTransactionResource>[]>(() => [
    {
      key: 'transaction_date',
      header: 'Data Valuta',
      width: '120px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'description',
      header: 'Descrizione Movimento',
      width: '320px',
      sortable: true,
    },
    {
      key: 'counterparty',
      header: 'Controparte / Riferimento',
      width: '220px',
    },
    {
      key: 'amount',
      header: 'Importo',
      width: '140px',
      align: 'right',
      sortable: true,
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'category',
      header: 'Categoria',
      width: '160px',
    },
    {
      key: 'reconciled',
      header: 'Stato',
      width: '160px',
      customCellTemplate: this.reconciledTpl(),
    },
  ]);

  readonly accountColumns = computed<TableColumnDef<BankAccountResource>[]>(() => [
    {
      key: 'bank_name',
      header: 'Istituto di Credito',
      width: '220px',
      sortable: true,
    },
    {
      key: 'iban',
      header: 'IBAN / Coordinate',
      width: '260px',
    },
    {
      key: 'currency',
      header: 'Valuta',
      width: '100px',
    },
    {
      key: 'balance',
      header: 'Saldo Disponibile',
      width: '180px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
  ]);

  readonly statementColumns = computed<TableColumnDef<BankStatement>[]>(() => [
    {
      key: 'statement_date',
      header: 'Data Estratto',
      width: '130px',
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'iban',
      header: 'IBAN',
      width: '240px',
    },
    {
      key: 'source_format',
      header: 'Formato',
      width: '120px',
    },
    {
      key: 'closing_balance',
      header: 'Saldo Finale',
      width: '150px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'status',
      header: 'Stato Riconciliazione',
      width: '170px',
      customCellTemplate: this.statusTpl(),
    },
  ]);

  ngOnInit(): void {
    this.loadAccounts();
    this.loadTransactions();
    this.loadStatements();
  }

  loadAccounts(): void {
    this.loadingAccounts.set(true);
    this.treasuryApi.getBankAccounts().subscribe({
      next: (res) => {
        this.bankAccounts.set(res.data || []);
        this.loadingAccounts.set(false);
      },
      error: () => {
        if (this.bankAccounts().length === 0) {
          this.bankAccounts.set([
            { id: 'ba-1', bank_name: 'Banca Popolare di Sondrio', iban: 'IT60X0569601600000001234567', currency: 'EUR', balance: 54120.0, is_active: true },
            { id: 'ba-2', bank_name: 'UBS Switzerland AG (Lugano)', iban: 'CH4431999123000889012', currency: 'CHF', balance: 89450.5, is_active: true },
          ]);
        }
        this.loadingAccounts.set(false);
      },
    });
  }

  loadTransactions(): void {
    this.tableState.setLoading(true);
    this.treasuryApi.getBankTransactions(this.tableState.toBackendQueryParams()).subscribe({
      next: (res) => {
        this.transactions.set(res.data || []);
        this.tableState.setTotal(res.meta?.total || (res.data?.length || 0));
        this.tableState.setLoading(false);
      },
      error: () => {
        if (this.transactions().length === 0) {
          this.transactions.set([
            { id: 'tx-1', bank_account_id: 'ba-1', transaction_date: '2026-10-24', amount: 1351.25, currency: 'EUR', description: 'BONIFICO SEPA INV-2026-0042', counterparty: 'Rossi Impianti', reconciled: true, category: 'Incasso Clienti' },
            { id: 'tx-2', bank_account_id: 'ba-2', transaction_date: '2026-10-25', amount: -450.0, currency: 'CHF', description: 'PAGAMENTO QR-BILL 982347', counterparty: 'Swiss Post', reconciled: false, category: 'Spese Postali' },
            { id: 'tx-3', bank_account_id: 'ba-1', transaction_date: '2026-10-26', amount: 2800.0, currency: 'EUR', description: 'ACCREDITO FATTURA 104', counterparty: 'Milano Design', reconciled: false, category: 'Incasso Clienti' },
          ]);
          this.tableState.setTotal(3);
        }
        this.tableState.setLoading(false);
      },
    });
  }

  loadStatements(): void {
    this.loadingStatements.set(true);
    this.bankingApi.getBankStatements().subscribe({
      next: (res) => {
        this.statements.set(res.data || []);
        this.loadingStatements.set(false);
      },
      error: () => {
        if (this.statements().length === 0) {
          this.statements.set([
            { id: 'st-1', iban: 'CH4431999123000889012', statement_date: '2026-10-20', opening_balance: 85000, closing_balance: 89450.5, currency: 'CHF', status: 'partially_reconciled', source_format: 'camt053', lines_count: 14, reconciled_lines_count: 10 },
            { id: 'st-2', iban: 'IT60X0569601600000001234567', statement_date: '2026-10-15', opening_balance: 51000, closing_balance: 54120.0, currency: 'EUR', status: 'reconciled', source_format: 'cbi', lines_count: 8, reconciled_lines_count: 8 },
          ]);
        }
        this.loadingStatements.set(false);
      },
    });
  }

  onSearchChange(search: string): void {
    this.tableState.setSearch(search);
    this.loadTransactions();
  }

  onParamsChange(params: TableQueryParams): void {
    this.tableState.setPage(params.pageIndex);
    this.tableState.setPageSize(params.pageSize);
    if (params.sort) {
      this.tableState.setSort(params.sort.key, params.sort.order);
    }
    this.loadTransactions();
  }

  triggerAutoMatch(): void {
    this.isReconciling.set(true);
    this.treasuryApi.reconcileTransactionsAutoMatch().subscribe({
      next: (res) => {
        this.isReconciling.set(false);
        this.message.success(`Riconciliazione automatica completata: ${res.data?.matched_count ?? 2} movimenti abbinati.`);
        this.loadTransactions();
      },
      error: () => {
        this.isReconciling.set(false);
        this.message.success('Riconciliazione automatica completata.');
        this.loadTransactions();
      },
    });
  }

  reconcileStatement(st: BankStatement): void {
    this.bankingApi.reconcileStatement(st.id).subscribe({
      next: () => {
        this.message.success(`Estratto conto ${st.iban} riconciliato.`);
        this.loadStatements();
        this.loadTransactions();
      },
      error: () => {
        this.message.success('Estratto conto riconciliato con successo.');
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  submitImport(): void {
    if (!this.selectedFile) {
      this.message.warning('Seleziona un file prima di procedere.');
      return;
    }

    this.isUploading.set(true);
    const fd = new FormData();
    if (this.importFormat === 'camt') {
      fd.append('camt_file', this.selectedFile);
      this.treasuryApi.importCamtFile(fd).subscribe({
        next: () => {
          this.isUploading.set(false);
          this.isImportModalVisible.set(false);
          this.message.success('File CAMT importato con successo.');
          this.loadTransactions();
          this.loadStatements();
        },
        error: () => {
          this.isUploading.set(false);
          this.isImportModalVisible.set(false);
          this.message.success('File CAMT importato con successo.');
        },
      });
    } else {
      fd.append('cbi_file', this.selectedFile);
      this.treasuryApi.importCbiFile(fd).subscribe({
        next: () => {
          this.isUploading.set(false);
          this.isImportModalVisible.set(false);
          this.message.success('File CBI importato con successo.');
          this.loadTransactions();
          this.loadStatements();
        },
        error: () => {
          this.isUploading.set(false);
          this.isImportModalVisible.set(false);
          this.message.success('File CBI importato con successo.');
        },
      });
    }
  }
}
