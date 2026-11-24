import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  BillingApiService,
  CoreDeliveryNote,
  FetchGridModel,
  I18nService,
  PermissionsService,
  SalesCycleApiService,
  SalesListFilterParams,
} from '@core';
import { BaseTableComponent, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { apiErrorText } from '../../cycle/shared/sales-api-helpers';
import { SalesLookupsService } from '../../cycle/shared/sales-lookups.service';
import { statusColor, statusKey, todayIso } from '../../cycle/shared/sales-status';

/** Deferred invoicing: one invoice for several delivery notes of a customer, or a run up to a date. */
@Component({
  selector: 'app-deferred-billing',
  styleUrl: './deferred-billing.component.scss',
  imports: [
    BaseTableComponent,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './deferred-billing.component.html',
})
export class DeferredBillingComponent implements OnInit {
  private readonly api = inject(BillingApiService);
  private readonly salesApi = inject(SalesCycleApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly lookups = inject(SalesLookupsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('invoicing'));
  protected readonly statusColor = statusColor;
  protected readonly statusKey = statusKey;

  /** Delivery notes that can still be billed (dispatched, not yet invoiced), paged and filtered by the server. */
  protected readonly grid = new FetchGridModel<CoreDeliveryNote, SalesListFilterParams>((query) =>
    this.salesApi.getDeliveryNotes({ ...query, billable: true }),
  );
  protected readonly selectedNotes = signal<CoreDeliveryNote[]>([]);
  protected readonly selectedIds = computed(() => new Set(this.selectedNotes().map((note) => note.id)));
  protected readonly saving = signal(false);
  protected dueDate = '';
  protected runUpTo = todayIso();
  protected runContactId: string | null = null;
  protected runDueDate = '';

  private readonly numberTpl = viewChild<TemplateRef<{ $implicit: CoreDeliveryNote; value: unknown }>>('numberTpl');
  private readonly customerTpl = viewChild<TemplateRef<{ $implicit: CoreDeliveryNote; value: unknown }>>('customerTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: CoreDeliveryNote; value: unknown }>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<CoreDeliveryNote>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'ddt_number', header: this.i18n.translate('SC.COMMON.NUMBER'), customCellTemplate: this.numberTpl() },
      { key: 'contact', serverKey: 'contact.name', valueGetter: (row) => this.lookups.contactName(row.contact_id, row.contact), header: this.i18n.translate('SC.COMMON.CUSTOMER'), customCellTemplate: this.customerTpl() },
      { key: 'date', header: this.i18n.translate('SC.COMMON.DATE') },
      { key: 'status', valueGetter: (row) => this.i18n.translate(this.statusKey(row.status)), valueLabel: (value) => this.i18n.translate(this.statusKey(value)), header: this.i18n.translate('SC.COMMON.STATUS'), customCellTemplate: this.statusTpl() },
    ];
  });

  ngOnInit(): void {
    this.lookups.load();
  }

  protected setSelection(notes: CoreDeliveryNote[]): void {
    this.selectedNotes.set(notes);
  }

  private reloadNotes(): void {
    this.selectedNotes.set([]);
    this.grid.reload();
  }

  protected createDeferred(): void {
    if (!this.selectedIds().size) {
      return;
    }
    this.saving.set(true);
    this.api
      .createDeferredInvoice({
        delivery_note_ids: [...this.selectedIds()],
        due_date: this.dueDate || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.success(this.i18n.translate('SC.BILLING.INVOICE_CREATED'));
          this.reloadNotes();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.message.error(apiErrorText(err));
        },
      });
  }

  protected runDeferred(): void {
    if (!this.runUpTo) {
      return;
    }
    this.saving.set(true);
    this.api
      .runDeferredBilling({
        up_to_date: this.runUpTo,
        contact_id: this.runContactId,
        due_date: this.runDueDate || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.success(this.i18n.translate('SC.DEFERRED.RUN_DONE'));
          this.reloadNotes();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.message.error(apiErrorText(err));
        },
      });
  }
}
