import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  BillingApiService,
  CoreDeliveryNote,
  I18nService,
  PermissionsService,
  SalesCycleApiService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from '../../cycle/shared/sales-api-helpers';
import { SalesLookupsService } from '../../cycle/shared/sales-lookups.service';
import { statusColor, statusKey, todayIso } from '../../cycle/shared/sales-status';

/** Deferred invoicing: one invoice for several delivery notes of a customer, or a run up to a date. */
@Component({
  selector: 'app-deferred-billing',
  styleUrl: './deferred-billing.component.scss',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
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

  protected readonly notes = signal<CoreDeliveryNote[]>([]);
  protected readonly selectedIds = signal<Set<string>>(new Set());
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected dueDate = '';
  protected runUpTo = todayIso();
  protected runContactId: string | null = null;
  protected runDueDate = '';

  /** Delivery notes that can still be billed (dispatched, not yet invoiced). */
  protected readonly billable = computed(() =>
    this.notes().filter((n) => n.status !== 'draft' && n.status !== 'invoiced'),
  );

  ngOnInit(): void {
    this.lookups.load();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.selectedIds.set(new Set());
    this.salesApi.getDeliveryNotes({ per_page: 100 }).subscribe({
      next: (res) => {
        this.notes.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  protected toggle(id: string, checked: boolean): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
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
          this.load();
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
          this.load();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.message.error(apiErrorText(err));
        },
      });
  }
}
