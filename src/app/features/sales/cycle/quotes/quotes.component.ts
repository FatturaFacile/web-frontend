import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CoreOrder,
  CoreQuote,
  I18nService,
  PermissionsService,
  SalesCycleApiService,
} from '@core';
import {
  BaseTableComponent,
  MoneyPipe,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TranslatePipe,
} from '@shared';
import { CycleQuotesFacade } from '../cycle.facades';
import { DeliveryNoteFormModalComponent, DeliveryNoteSource } from '../shared/delivery-note-form-modal.component';
import { DocumentFormModalComponent } from '../shared/document-form-modal.component';
import { DocumentLinesViewComponent } from '../shared/document-lines-view.component';
import { SalesLookupsService } from '../shared/sales-lookups.service';
import { apiErrorText } from '../shared/sales-api-helpers';
import { statusColor, statusKey } from '../shared/sales-status';
import { SignaturePadComponent } from '../shared/signature-pad.component';

const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted', 'superseded'];
const OPEN_STATUSES = ['draft', 'sent', 'accepted'];

@Component({
  selector: 'app-cycle-quotes',
  styleUrl: './quotes.component.scss',
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTagModule,
    BaseTableComponent,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    DeliveryNoteFormModalComponent,
    DocumentFormModalComponent,
    DocumentLinesViewComponent,
    SignaturePadComponent,
  ],
  providers: [CycleQuotesFacade],
  templateUrl: './quotes.component.html',
})
export class CycleQuotesComponent {
  protected readonly facade = inject(CycleQuotesFacade);
  private readonly api = inject(SalesCycleApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(SalesLookupsService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('invoicing'));

  protected readonly statuses = QUOTE_STATUSES;
  protected readonly statusColor = statusColor;
  protected readonly statusKey = statusKey;

  protected readonly selected = signal<CoreQuote | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<CoreQuote | null>(null);
  protected readonly ddtOpen = signal(false);
  protected readonly signOpen = signal(false);
  protected readonly working = signal(false);
  protected signedBy = '';
  protected signature: string | null = null;

  private readonly numberTpl = viewChild<TemplateRef<{ $implicit: CoreQuote; value: unknown }>>('numberTpl');
  private readonly customerTpl = viewChild<TemplateRef<{ $implicit: CoreQuote; value: unknown }>>('customerTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: CoreQuote; value: unknown }>>('statusTpl');
  private readonly totalTpl = viewChild<TemplateRef<{ $implicit: CoreQuote; value: unknown }>>('totalTpl');

  protected readonly columns = computed<TableColumnDef<CoreQuote>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'quote_number', header: this.i18n.translate('SC.COMMON.NUMBER'), width: '150px', customCellTemplate: this.numberTpl() },
      { key: 'contact', header: this.i18n.translate('SC.COMMON.CUSTOMER'), customCellTemplate: this.customerTpl() },
      { key: 'date', header: this.i18n.translate('SC.COMMON.DATE'), width: '120px' },
      { key: 'valid_until', header: this.i18n.translate('SC.QUOTES.VALID_UNTIL'), width: '120px' },
      { key: 'status', header: this.i18n.translate('SC.COMMON.STATUS'), width: '140px', customCellTemplate: this.statusTpl() },
      { key: 'total_gross', header: this.i18n.translate('SC.COMMON.TOTAL'), width: '140px', align: 'right', customCellTemplate: this.totalTpl() },
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

  protected isOpen(quote: CoreQuote): boolean {
    return OPEN_STATUSES.includes(quote.status);
  }

  protected view(quote: CoreQuote): void {
    this.selected.set(quote);
    this.drawerOpen.set(true);
    this.api.getQuote(quote.id).subscribe({
      next: (res) => this.selected.set(res.data),
      error: (err: unknown) => this.message.error(apiErrorText(err)),
    });
  }

  protected create(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected edit(quote: CoreQuote): void {
    this.editing.set(quote);
    this.formOpen.set(true);
  }

  protected onSaved(quote: CoreQuote | CoreOrder): void {
    this.message.success(this.i18n.translate('SC.COMMON.SAVED'));
    this.facade.reload();
    if (this.drawerOpen()) {
      this.view(quote as CoreQuote);
    }
  }

  protected ddtSource(quote: CoreQuote): DeliveryNoteSource {
    return { kind: 'quote', id: quote.id, items: quote.items ?? [] };
  }

  protected remove(quote: CoreQuote): void {
    this.run(this.api.deleteQuote(quote.id), 'SC.COMMON.DELETED', () => this.drawerOpen.set(false));
  }

  protected convert(quote: CoreQuote): void {
    this.run(this.api.convertQuoteToOrder(quote.id), 'SC.QUOTES.CONVERTED', () => this.drawerOpen.set(false));
  }

  protected revise(quote: CoreQuote): void {
    this.run(this.api.reviseQuote(quote.id), 'SC.QUOTES.REVISED', () => this.drawerOpen.set(false));
  }

  protected invoice(quote: CoreQuote): void {
    this.run(this.api.invoiceQuote(quote.id), 'SC.QUOTES.INVOICED', () => this.drawerOpen.set(false));
  }

  protected expireOverdue(): void {
    this.run(this.api.expireQuotes(), 'SC.QUOTES.EXPIRED_DONE');
  }

  protected openSignature(): void {
    this.signedBy = '';
    this.signature = null;
    this.signOpen.set(true);
  }

  protected submitSignature(quote: CoreQuote): void {
    if (!this.signedBy.trim() || !this.signature) {
      this.message.warning(this.i18n.translate('SC.QUOTES.SIGNATURE_REQUIRED'));
      return;
    }
    const payload = { signed_by: this.signedBy.trim(), signature_base64: this.signature };
    this.run(this.api.signQuote(quote.id, payload), 'SC.QUOTES.SIGNED', () => {
      this.signOpen.set(false);
      this.drawerOpen.set(false);
    });
  }

  private run(request: Observable<ApiResponse<unknown>>, successKey: string, done?: () => void): void {
    this.working.set(true);
    request.subscribe({
      next: () => {
        this.working.set(false);
        this.message.success(this.i18n.translate(successKey));
        this.facade.reload();
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
