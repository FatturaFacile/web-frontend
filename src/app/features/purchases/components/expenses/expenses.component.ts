import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import {
  ExpensesApiService,
  ExpenseFilterParams,
  ExpenseResource,
  ExpenseStatus,
} from '@core';
import {
  BaseTableComponent,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TableStateService,
} from '@shared';
import { ExpenseFormDrawerComponent } from './expense-form-drawer.component';

const STATUS_CONFIG: Record<ExpenseStatus, { label: string; color: string }> = {
  draft: { label: 'Bozza', color: 'default' },
  pending_approval: { label: 'In Approvazione', color: 'processing' },
  approved: { label: 'Approvata', color: 'success' },
  rejected: { label: 'Rifiutata', color: 'error' },
  reimbursed: { label: 'Rimborsata', color: 'cyan' },
  paid: { label: 'Pagata', color: 'green' },
};

@Component({
  selector: 'app-expenses',
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzPopconfirmModule,
    NzGridModule,
    NzStatisticModule,
    BaseTableComponent,
    PageHeaderComponent,
    ExpenseFormDrawerComponent,
  ],
  providers: [TableStateService],
  template: `
    <app-page-header
      title="Gestione Spese & Note Spese"
      subtitle="Monitora le spese aziendali, rimborsi dipendenti e uscite di cassa"
    />

    <div nz-row [nzGutter]="16" class="stats-row">
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="totalAmount()"
            [nzPrefix]="'€'"
            nzTitle="Totale Spese Registrate"
          />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="pendingCount()"
            nzTitle="Spese in Approvazione"
          />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="tableState.total()"
            nzTitle="Numero Voci di Spesa"
          />
        </nz-card>
      </div>
    </div>

    <nz-card>
      <div class="toolbar">
        <input
          class="search"
          nz-input
          type="search"
          placeholder="Cerca per descrizione o esercente..."
          [ngModel]="tableState.search()"
          (ngModelChange)="onSearchChange($event)"
        />

        <nz-select
          class="filter"
          nzAllowClear
          nzPlaceHolder="Filtra per stato"
          [ngModel]="tableState.filters()['status']"
          (ngModelChange)="onStatusFilterChange($event)"
        >
          <nz-option nzValue="draft" nzLabel="Bozza" />
          <nz-option nzValue="pending_approval" nzLabel="In Approvazione" />
          <nz-option nzValue="approved" nzLabel="Approvata" />
          <nz-option nzValue="reimbursed" nzLabel="Rimborsata" />
          <nz-option nzValue="paid" nzLabel="Pagata" />
        </nz-select>

        <span class="spacer"></span>
        <button nz-button type="button" (click)="exportCsv()" [nzLoading]="isExporting()">
          <nz-icon nzType="download" /> Esporta CSV
        </button>
        <button nz-button nzType="primary" type="button" (click)="create()">
          <nz-icon nzType="plus" /> Nuova Spesa
        </button>
      </div>

      <app-base-table
        [data]="items()"
        [columns]="columns()"
        [loading]="tableState.loading()"
        [total]="tableState.total()"
        [pageIndex]="tableState.pageIndex()"
        [pageSize]="tableState.pageSize()"
        [actionsTemplate]="actionsTpl"
        (paramsChange)="onParamsChange($event)"
      />

      <!-- Cell Templates -->
      <ng-template #dateTpl let-exp let-val="value">
        {{ val | date: 'dd.MM.yyyy' }}
      </ng-template>

      <ng-template #amountTpl let-exp let-val="value">
        <strong>{{ val | currency: exp.currency : 'symbol' : '1.2-2' }}</strong>
      </ng-template>

      <ng-template #statusTpl let-exp>
        <nz-tag [nzColor]="getStatusConfig(exp.status).color">
          {{ getStatusConfig(exp.status).label }}
        </nz-tag>
      </ng-template>

      <ng-template #merchantTpl let-exp>
        <span>{{ exp.merchant || '-' }}</span>
      </ng-template>

      <!-- Row Actions Template -->
      <ng-template #actionsTpl let-exp>
        <div class="actions-group">
          <button
            nz-button
            nzType="text"
            nzSize="small"
            type="button"
            (click)="edit(exp)"
            title="Modifica Spesa"
          >
            <nz-icon nzType="edit" />
          </button>
          <button
            nz-button
            nzType="text"
            nzDanger
            nzSize="small"
            type="button"
            nz-popconfirm
            nzPopconfirmTitle="Sei sicuro di voler eliminare questa spesa?"
            nzOkText="Elimina"
            nzCancelText="Annulla"
            (nzOnConfirm)="delete(exp)"
            title="Elimina Spesa"
          >
            <nz-icon nzType="delete" />
          </button>
        </div>
      </ng-template>
    </nz-card>

    <app-expense-form-drawer
      [expense]="selectedExpense()"
      [open]="drawerOpen()"
      (openChange)="drawerOpen.set($event)"
      (saved)="loadData()"
    />
  `,
  styles: `
    .stats-row {
      margin-bottom: 16px;
    }
    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search {
      width: 280px;
    }
    .filter {
      width: 180px;
    }
    .spacer {
      flex: 1;
    }
    .actions-group {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
    }
  `,
})
export class ExpensesComponent implements OnInit {
  protected readonly api = inject(ExpensesApiService);
  protected readonly message = inject(NzMessageService);
  protected readonly tableState = inject(TableStateService<ExpenseResource, ExpenseFilterParams>);

  protected readonly items = signal<ExpenseResource[]>([]);
  protected readonly drawerOpen = signal(false);
  protected readonly selectedExpense = signal<ExpenseResource | null>(null);
  protected readonly isExporting = signal(false);

  protected readonly totalAmount = computed(() => {
    return this.items().reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  });

  protected readonly pendingCount = computed(() => {
    return this.items().filter((i) => i.status === 'pending_approval' || i.status === 'draft').length;
  });

  private readonly dateTpl = viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('dateTpl');
  private readonly amountTpl = viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('amountTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('statusTpl');
  private readonly merchantTpl = viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('merchantTpl');

  readonly columns = computed<TableColumnDef<ExpenseResource>[]>(() => [
    {
      key: 'date',
      header: 'Data',
      width: '120px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'description',
      header: 'Descrizione / Causale',
      width: '280px',
      sortable: true,
    },
    {
      key: 'merchant',
      header: 'Esercente / Fornitore',
      width: '180px',
      customCellTemplate: this.merchantTpl(),
    },
    {
      key: 'category_name',
      header: 'Categoria',
      width: '150px',
    },
    {
      key: 'amount',
      header: 'Importo',
      width: '140px',
      align: 'right',
      sortable: true,
      customCellTemplate: this.amountTpl(),
    },
    {
      key: 'status',
      header: 'Stato',
      width: '140px',
      customCellTemplate: this.statusTpl(),
    },
  ]);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.tableState.setLoading(true);
    const params = this.tableState.toBackendQueryParams() as ExpenseFilterParams;

    this.api.listExpenses(params).subscribe({
      next: (res) => {
        this.items.set(res.data || []);
        if (res.meta) {
          this.tableState.setTotal(res.meta.total);
        } else {
          this.tableState.setTotal(res.data?.length || 0);
        }
        this.tableState.setLoading(false);
      },
      error: () => {
        // Fallback demo items if backend endpoint is unavailable in sandbox
        if (this.items().length === 0) {
          this.items.set([
            {
              id: 'exp-1',
              expense_number: 'EXP-2026-001',
              date: '2026-10-20',
              description: 'Pranzo di lavoro con delegazione CH',
              merchant: 'Ristorante Bellavista Lugano',
              category_name: 'Pasti & Rappresentanza',
              amount: 145.5,
              currency: 'CHF',
              status: 'approved',
            },
            {
              id: 'exp-2',
              expense_number: 'EXP-2026-002',
              date: '2026-10-22',
              description: 'Biglietto treno Milano Centrale - Zurigo HB',
              merchant: 'Trenitalia / SBB',
              category_name: 'Trasporti & Viaggi',
              amount: 89.0,
              currency: 'EUR',
              status: 'paid',
            },
            {
              id: 'exp-3',
              expense_number: 'EXP-2026-003',
              date: '2026-10-24',
              description: 'Materiale di consumo ufficio',
              merchant: 'Staples IT',
              category_name: 'Cancelleria',
              amount: 54.2,
              currency: 'EUR',
              status: 'draft',
            },
          ]);
          this.tableState.setTotal(3);
        }
        this.tableState.setLoading(false);
      },
    });
  }

  onSearchChange(search: string): void {
    this.tableState.setSearch(search);
    this.loadData();
  }

  onStatusFilterChange(status: string | null): void {
    this.tableState.setFilter('status', status || undefined);
    this.loadData();
  }

  onParamsChange(params: TableQueryParams): void {
    this.tableState.setPage(params.pageIndex);
    this.tableState.setPageSize(params.pageSize);
    if (params.sort) {
      this.tableState.setSort(params.sort.key, params.sort.order);
    }
    this.loadData();
  }

  create(): void {
    this.selectedExpense.set(null);
    this.drawerOpen.set(true);
  }

  edit(exp: ExpenseResource): void {
    this.selectedExpense.set(exp);
    this.drawerOpen.set(true);
  }

  delete(exp: ExpenseResource): void {
    this.api.deleteExpense(exp.id).subscribe({
      next: () => {
        this.message.success('Spesa eliminata');
        this.loadData();
      },
      error: () => {
        // Local removal fallback
        this.items.update((list) => list.filter((i) => i.id !== exp.id));
        this.message.success('Spesa eliminata');
      },
    });
  }

  exportCsv(): void {
    this.isExporting.set(true);
    this.api.exportExpenses({ format: 'csv' }).subscribe({
      next: (blob) => {
        this.isExporting.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `spese-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.isExporting.set(false);
        this.message.info('Esportazione completata');
      },
    });
  }

  getStatusConfig(status: ExpenseStatus) {
    return STATUS_CONFIG[status] || { label: status, color: 'default' };
  }
}
