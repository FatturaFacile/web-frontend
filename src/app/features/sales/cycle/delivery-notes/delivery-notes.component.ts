import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import { ApiResponse, CoreDeliveryNote, I18nService, PermissionsService, SalesCycleApiService } from '@core';
import { BaseTableComponent, PageHeaderComponent, TableColumnDef, TableQueryParams, TranslatePipe } from '@shared';
import { CycleDeliveryNotesFacade } from '../cycle.facades';
import { DocumentLinesViewComponent } from '../shared/document-lines-view.component';
import { apiErrorText } from '../shared/sales-api-helpers';
import { SalesLookupsService } from '../shared/sales-lookups.service';
import { statusColor, statusKey } from '../shared/sales-status';

const DDT_STATUSES = ['draft', 'issued', 'dispatched', 'delivered', 'invoiced'];

@Component({
  selector: 'app-cycle-delivery-notes',
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzIconModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTagModule,
    BaseTableComponent,
    PageHeaderComponent,
    TranslatePipe,
    DocumentLinesViewComponent,
  ],
  providers: [CycleDeliveryNotesFacade],
  templateUrl: './delivery-notes.component.html',
  styleUrl: '../shared/cycle-page.scss',
})
export class CycleDeliveryNotesComponent {
  protected readonly facade = inject(CycleDeliveryNotesFacade);
  private readonly api = inject(SalesCycleApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(SalesLookupsService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('invoicing'));

  protected readonly statuses = DDT_STATUSES;
  protected readonly statusColor = statusColor;
  protected readonly statusKey = statusKey;
  protected readonly selected = signal<CoreDeliveryNote | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly working = signal(false);

  private readonly numberTpl = viewChild<TemplateRef<{ $implicit: CoreDeliveryNote; value: unknown }>>('numberTpl');
  private readonly customerTpl = viewChild<TemplateRef<{ $implicit: CoreDeliveryNote; value: unknown }>>('customerTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: CoreDeliveryNote; value: unknown }>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<CoreDeliveryNote>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'ddt_number', header: this.i18n.translate('SC.COMMON.NUMBER'), width: '150px', customCellTemplate: this.numberTpl() },
      { key: 'contact', header: this.i18n.translate('SC.COMMON.CUSTOMER'), customCellTemplate: this.customerTpl() },
      { key: 'date', header: this.i18n.translate('SC.COMMON.DATE'), width: '120px' },
      { key: 'status', header: this.i18n.translate('SC.COMMON.STATUS'), width: '140px', customCellTemplate: this.statusTpl() },
      { key: 'tracking_number', header: this.i18n.translate('SC.DDT.TRACKING'), width: '180px' },
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

  protected view(note: CoreDeliveryNote): void {
    this.selected.set(note);
    this.drawerOpen.set(true);
    this.api.getDeliveryNote(note.id).subscribe({
      next: (res) => this.selected.set(res.data),
      error: (err: unknown) => this.message.error(apiErrorText(err)),
    });
  }

  protected canInvoice(note: CoreDeliveryNote): boolean {
    return note.status !== 'draft' && note.status !== 'invoiced';
  }

  protected invoice(note: CoreDeliveryNote): void {
    this.run(this.api.invoiceDeliveryNote(note.id), 'SC.BILLING.INVOICE_CREATED', false);
  }

  protected remove(note: CoreDeliveryNote): void {
    this.run(this.api.deleteDeliveryNote(note.id), 'SC.COMMON.DELETED', true);
  }

  private run(request: Observable<ApiResponse<unknown>>, successKey: string, close: boolean): void {
    this.working.set(true);
    request.subscribe({
      next: () => {
        this.working.set(false);
        this.message.success(this.i18n.translate(successKey));
        this.facade.reload();
        if (close) {
          this.drawerOpen.set(false);
        } else if (this.selected()) {
          this.view(this.selected() as CoreDeliveryNote);
        }
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
