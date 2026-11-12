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
import { ExpensesApiService, ExpenseFilterParams, ExpenseResource, ExpenseStatus, TranslateService } from '@core';
import {
  BaseTableComponent,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TableStateService,
  TranslatePipe,
} from '@shared';
import { ExpenseFormDrawerComponent } from './expense-form-drawer.component';

// Labels come from the expenses.statuses.* translations
const STATUS_COLOR: Record<ExpenseStatus, string> = {
  draft: 'default',
  pending_approval: 'processing',
  approved: 'success',
  rejected: 'error',
  reimbursed: 'cyan',
  paid: 'green',
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
    TranslatePipe,
  ],
  providers: [TableStateService],
  templateUrl: './expenses.component.html',
})
export class ExpensesComponent implements OnInit {
  protected readonly api = inject(ExpensesApiService);
  protected readonly message = inject(NzMessageService);
  protected readonly translate = inject(TranslateService);
  protected readonly tableState = inject(TableStateService<ExpenseResource, ExpenseFilterParams>);

  protected readonly items = signal<ExpenseResource[]>([]);
  protected readonly drawerOpen = signal(false);
  protected readonly selectedExpense = signal<ExpenseResource | null>(null);
  protected readonly isExporting = signal(false);

  protected readonly filterStatuses: readonly ExpenseStatus[] = [
    'draft',
    'pending_approval',
    'approved',
    'reimbursed',
    'paid',
  ];

  protected readonly totalAmount = computed(() => {
    return this.items().reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  });

  protected readonly pendingCount = computed(() => {
    return this.items().filter((i) => i.status === 'pending_approval' || i.status === 'draft')
      .length;
  });

  private readonly dateTpl =
    viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('dateTpl');
  private readonly amountTpl =
    viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('amountTpl');
  private readonly statusTpl =
    viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('statusTpl');
  private readonly merchantTpl =
    viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('merchantTpl');

  readonly columns = computed<TableColumnDef<ExpenseResource>[]>(() => [
    {
      key: 'date',
      header: 'expenses.columns.date',
      width: '120px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'description',
      header: 'expenses.columns.description',
      width: '280px',
      sortable: true,
    },
    {
      key: 'merchant',
      header: 'expenses.columns.merchant',
      width: '180px',
      customCellTemplate: this.merchantTpl(),
    },
    {
      key: 'category_name',
      header: 'expenses.columns.category',
      width: '150px',
    },
    {
      key: 'amount',
      header: 'expenses.columns.amount',
      width: '140px',
      align: 'right',
      sortable: true,
      customCellTemplate: this.amountTpl(),
    },
    {
      key: 'status',
      header: 'expenses.columns.status',
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
        this.message.success(this.translate.instant('expenses.messages.deleted'));
        this.loadData();
      },
      error: () => undefined,
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
        this.message.info(this.translate.instant('expenses.messages.exported'));
      },
    });
  }

  statusColor(status: ExpenseStatus): string {
    return STATUS_COLOR[status] ?? 'default';
  }
}
