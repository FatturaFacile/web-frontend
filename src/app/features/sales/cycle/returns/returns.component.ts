import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  I18nService,
  PermissionsService,
  ReturnCondition,
  SalesCycleApiService,
  SalesReturn,
  SalesReturnItem,
} from '@core';
import { BaseTableComponent, PageHeaderComponent, TableColumnDef, TableQueryParams, TranslatePipe } from '@shared';
import { CycleReturnsFacade } from '../cycle.facades';
import { apiErrorText } from '../shared/sales-api-helpers';
import { SalesLookupsService } from '../shared/sales-lookups.service';
import { statusColor, statusKey } from '../shared/sales-status';
import { ReturnFormModalComponent } from './return-form-modal.component';

const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'received', 'credited', 'cancelled'];

interface ReceiveDraft {
  item: SalesReturnItem;
  quantity_received: string;
  condition: ReturnCondition;
  restock: boolean;
}

@Component({
  selector: 'app-cycle-returns',
  styleUrl: './returns.component.scss',
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    BaseTableComponent,
    PageHeaderComponent,
    TranslatePipe,
    ReturnFormModalComponent,
  ],
  providers: [CycleReturnsFacade],
  templateUrl: './returns.component.html',
})
export class CycleReturnsComponent {
  protected readonly facade = inject(CycleReturnsFacade);
  private readonly api = inject(SalesCycleApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(SalesLookupsService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('invoicing'));

  protected readonly statuses = RETURN_STATUSES;
  protected readonly statusColor = statusColor;
  protected readonly statusKey = statusKey;
  protected readonly selected = signal<SalesReturn | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly createOpen = signal(false);
  protected readonly rejectOpen = signal(false);
  protected readonly receiveOpen = signal(false);
  protected readonly working = signal(false);
  protected readonly receiveDrafts = signal<ReceiveDraft[]>([]);
  protected rejectReason = '';

  private readonly numberTpl = viewChild<TemplateRef<{ $implicit: SalesReturn; value: unknown }>>('numberTpl');
  private readonly customerTpl = viewChild<TemplateRef<{ $implicit: SalesReturn; value: unknown }>>('customerTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: SalesReturn; value: unknown }>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<SalesReturn>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'return_number', header: this.i18n.translate('SC.COMMON.NUMBER'), width: '150px', customCellTemplate: this.numberTpl() },
      { key: 'contact', header: this.i18n.translate('SC.COMMON.CUSTOMER'), customCellTemplate: this.customerTpl() },
      { key: 'date', header: this.i18n.translate('SC.COMMON.DATE'), width: '120px' },
      { key: 'reason', header: this.i18n.translate('SC.RETURNS.REASON') },
      { key: 'status', header: this.i18n.translate('SC.COMMON.STATUS'), width: '140px', customCellTemplate: this.statusTpl() },
    ];
  });

  constructor() {
    this.lookups.load();
  }

  protected onParamsChange(params: TableQueryParams): void {
    if (params.pageSize !== this.facade.pageSize()) {
      this.facade.setPageSize(params.pageSize);
    } else if (params.pageIndex !== this.facade.pageIndex()) {
      this.facade.setPage(params.pageIndex);
    }
  }

  protected view(row: SalesReturn): void {
    this.selected.set(row);
    this.drawerOpen.set(true);
    this.refresh(row.id);
  }

  private refresh(id: string): void {
    this.api.getReturn(id).subscribe({
      next: (res) => this.selected.set(res.data),
      error: (err: unknown) => this.message.error(apiErrorText(err)),
    });
  }

  protected onCreated(row: SalesReturn): void {
    this.facade.reload();
    this.view(row);
  }

  protected approve(row: SalesReturn): void {
    this.run(this.api.approveReturn(row.id), row, 'SC.RETURNS.APPROVED');
  }

  protected cancel(row: SalesReturn): void {
    this.run(this.api.cancelReturn(row.id), row, 'SC.RETURNS.CANCELLED');
  }

  protected credit(row: SalesReturn): void {
    this.run(this.api.creditReturn(row.id), row, 'SC.RETURNS.CREDITED');
  }

  protected openReject(): void {
    this.rejectReason = '';
    this.rejectOpen.set(true);
  }

  protected submitReject(row: SalesReturn): void {
    if (!this.rejectReason.trim()) {
      return;
    }
    this.run(this.api.rejectReturn(row.id, this.rejectReason.trim()), row, 'SC.RETURNS.REJECTED', () =>
      this.rejectOpen.set(false),
    );
  }

  protected openReceive(row: SalesReturn): void {
    this.receiveDrafts.set(
      (row.items ?? []).map((item) => ({
        item,
        quantity_received: '',
        condition: (item.condition ?? 'resellable') as ReturnCondition,
        restock: item.restock,
      })),
    );
    this.receiveOpen.set(true);
  }

  protected submitReceive(row: SalesReturn): void {
    const items = this.receiveDrafts()
      .filter((d) => d.quantity_received)
      .map((d) => ({
        id: d.item.id,
        quantity_received: d.quantity_received,
        condition: d.condition,
        restock: d.restock,
      }));
    this.run(this.api.receiveReturn(row.id, items.length ? { items } : {}), row, 'SC.RETURNS.RECEIVED', () =>
      this.receiveOpen.set(false),
    );
  }

  private run(
    request: Observable<ApiResponse<unknown>>,
    row: SalesReturn,
    successKey: string,
    done?: () => void,
  ): void {
    this.working.set(true);
    request.subscribe({
      next: () => {
        this.working.set(false);
        this.message.success(this.i18n.translate(successKey));
        this.facade.reload();
        this.refresh(row.id);
        done?.();
      },
      error: (err: unknown) => {
        this.working.set(false);
        const text = apiErrorText(err);
        if (text) {
          this.message.error(text);
        }
      },
    });
  }
}
