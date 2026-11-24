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
  FetchGridModel,
  TranslateService,
} from '@core';
import { BaseTableComponent, IconActionDirective, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { ExpenseFormDrawerComponent } from './expense-form-drawer.component';

// Labels come from the expenses.statuses.* translations
const STATUS_COLOR: Record<ExpenseStatus, string> = {
  draft: 'default',
  submitted: 'processing',
  approved: 'success',
  rejected: 'error',
};

@Component({
  selector: 'app-expenses',
  styleUrl: './expenses.component.scss',
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
    IconActionDirective,
    TranslatePipe,
  ],
  templateUrl: './expenses.component.html',
})
export class ExpensesComponent implements OnInit {
  protected readonly api = inject(ExpensesApiService);
  protected readonly message = inject(NzMessageService);
  protected readonly translate = inject(TranslateService);
  protected readonly grid = new FetchGridModel<ExpenseResource, ExpenseFilterParams>((query) =>
    this.api.listExpenses(query),
  );
  protected readonly items = this.grid.items;
  protected readonly drawerOpen = signal(false);
  protected readonly selectedExpense = signal<ExpenseResource | null>(null);
  protected readonly isExporting = signal(false);

  protected readonly filterStatuses: readonly ExpenseStatus[] = [
    'draft',
    'submitted',
    'approved',
    'rejected',
  ];

  protected readonly totalAmount = computed(() => {
    return this.items().reduce((acc, curr) => acc + (Number(curr.amount_gross) || 0), 0);
  });

  /** Expenses still waiting for a decision, over the whole dataset (the status value list of the grid). */
  protected readonly pendingCount = signal(0);

  private readonly dateTpl =
    viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('dateTpl');
  private readonly amountTpl =
    viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('amountTpl');
  private readonly statusTpl =
    viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('statusTpl');
  private readonly categoryTpl =
    viewChild<TemplateRef<{ $implicit: ExpenseResource; value: unknown }>>('categoryTpl');
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
      key: 'notes',
      header: 'expenses.columns.description',
      width: '280px',
      sortable: true,
    },
    {
      key: 'merchant_name',
      header: 'expenses.columns.merchant',
      width: '180px',
      customCellTemplate: this.merchantTpl(),
    },
    {
      key: 'category',
      serverKey: 'category_label',
      valueGetter: (row) => row.category?.name ?? '-',
      customCellTemplate: this.categoryTpl(),
      header: 'expenses.columns.category',
      width: '150px',
    },
    {
      key: 'amount_gross',
      header: 'expenses.columns.amount',
      width: '140px',
      align: 'right',
      sortable: true,
      customCellTemplate: this.amountTpl(),
    },
    {
      key: 'status',
      valueGetter: (row) => this.translate.instant('expenses.statuses.' + row.status),
      valueLabel: (value) => this.translate.instant('expenses.statuses.' + value),
      header: 'expenses.columns.status',
      width: '140px',
      customCellTemplate: this.statusTpl(),
    },
  ]);

  ngOnInit(): void {
    this.refreshPendingCount();
  }

  /** Reloads the list after a change made by the drawer or a deletion. */
  loadData(): void {
    this.grid.reload();
    this.refreshPendingCount();
  }

  private refreshPendingCount(): void {
    this.grid.loadValues('status').subscribe((values) => {
      this.pendingCount.set(
        values
          .filter((entry) => entry.value === 'submitted' || entry.value === 'draft')
          .reduce((sum, entry) => sum + entry.count, 0),
      );
    });
  }

  onSearchChange(search: string): void {
    this.grid.setFilter({ search: search || undefined });
    this.refreshPendingCount();
  }

  onStatusFilterChange(status: string | null): void {
    this.grid.setFilter({ status: status || undefined });
    this.refreshPendingCount();
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
