import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzInputModule } from 'ng-zorro-antd/input';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AuthStore,
  DELIVERY_NOTE_STATUSES,
  DELIVERY_NOTE_TYPES,
  DeliveryNoteResource,
  I18nService,
  LOGISTICS_PERMISSIONS,
  LogisticsApiService,
  TRANSPORT_REASONS,
  UnbilledGroup,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { DeliveryNoteFacade } from '../../services/delivery-note.facade';
import {
  DDT_STATUS_COLOR,
  ddtStatusKey,
  ddtTypeKey,
  INVOICEABLE,
  reasonKey,
  saveBlob,
} from '../../logistics.ui';

@Component({
  selector: 'app-delivery-notes',
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './delivery-notes.component.html',
  styleUrl: './delivery-notes.component.scss',
})
export class DeliveryNotesComponent {
  protected readonly facade = inject(DeliveryNoteFacade);
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(LogisticsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly perm = LOGISTICS_PERMISSIONS;
  protected readonly statusColor = DDT_STATUS_COLOR;
  protected readonly statusKey = ddtStatusKey;
  protected readonly typeKey = ddtTypeKey;

  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly busy = signal(false);

  /** PDF options chosen in the toolbar (hide prices on the printout, language of the document). */
  protected readonly hidePrices = signal(false);
  protected readonly pdfLang = signal<'it' | 'en' | 'de' | 'fr'>('it');

  protected readonly deliverTarget = signal<DeliveryNoteResource | null>(null);
  protected readonly signatureName = signal('');

  protected readonly groupsVisible = signal(false);
  protected readonly groups = signal<UnbilledGroup[]>([]);
  protected readonly sameMonth = signal(true);

  protected readonly statusOptions = computed(() =>
    DELIVERY_NOTE_STATUSES.map((value) => ({
      value,
      label: this.i18n.translate(ddtStatusKey(value)),
    })),
  );
  protected readonly typeOptions = computed(() =>
    DELIVERY_NOTE_TYPES.map((value) => ({ value, label: this.i18n.translate(ddtTypeKey(value)) })),
  );
  protected readonly reasonOptions = computed(() =>
    TRANSPORT_REASONS.map((value) => ({ value, label: this.i18n.translate(reasonKey(value)) })),
  );
  protected readonly langOptions = [
    { value: 'it', label: 'Italiano' },
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'fr', label: 'Français' },
  ];

  protected readonly selectedIds = computed(() => [...this.selected()]);
  protected readonly canBulkInvoice = computed(
    () => this.auth.can(LOGISTICS_PERMISSIONS.invoice) && this.selected().size > 0,
  );

  protected isInvoiceable(note: DeliveryNoteResource): boolean {
    return INVOICEABLE.includes(note.status) && note.contact_id !== null;
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected toggle(id: string, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  protected onDateRange(range: Date[]): void {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    this.facade.setFilter({
      date_from: range?.[0] ? iso(range[0]) : undefined,
      date_to: range?.[1] ? iso(range[1]) : undefined,
    });
  }

  protected edit(note: DeliveryNoteResource): void {
    void this.router.navigate(['/logistics/delivery-notes', note.id, 'edit']);
  }

  protected issue(note: DeliveryNoteResource): void {
    this.run(this.api.issue(note.id), 'LOGISTICS.DDT.MESSAGES.ISSUED');
  }

  protected dispatch(note: DeliveryNoteResource): void {
    this.run(this.api.dispatch(note.id), 'LOGISTICS.DDT.MESSAGES.DISPATCHED');
  }

  protected cancel(note: DeliveryNoteResource): void {
    this.run(this.api.cancel(note.id), 'LOGISTICS.DDT.MESSAGES.CANCELLED');
  }

  protected remove(note: DeliveryNoteResource): void {
    this.busy.set(true);
    this.api.deleteDeliveryNote(note.id).subscribe({
      next: () => this.done('LOGISTICS.DDT.MESSAGES.DELETED'),
      error: (err) => this.fail(err),
    });
  }

  protected openDeliver(note: DeliveryNoteResource): void {
    this.signatureName.set('');
    this.deliverTarget.set(note);
  }

  protected confirmDeliver(): void {
    const note = this.deliverTarget();
    if (!note) return;
    this.deliverTarget.set(null);
    this.run(
      this.api.deliver(note.id, this.signatureName() || undefined),
      'LOGISTICS.DDT.MESSAGES.DELIVERED',
    );
  }

  protected downloadPdf(note: DeliveryNoteResource): void {
    this.api
      .downloadPdf(note.id, { hide_prices: this.hidePrices(), lang: this.pdfLang() })
      .subscribe({
        next: (blob) => saveBlob(blob, `${note.ddt_number}.pdf`),
        error: (err) => this.fail(err),
      });
  }

  protected bulkInvoice(): void {
    this.busy.set(true);
    this.api.deferredInvoice(this.selectedIds(), this.sameMonth()).subscribe({
      next: (res) => {
        this.selected.set(new Set());
        this.done('LOGISTICS.DDT.MESSAGES.INVOICED', { number: res.data.invoice_number });
      },
      error: (err) => this.fail(err),
    });
  }

  protected openGroups(): void {
    this.api.unbilled().subscribe({
      next: (res) => {
        this.groups.set(res.data);
        this.groupsVisible.set(true);
      },
      error: (err) => this.fail(err),
    });
  }

  protected runGrouped(): void {
    this.busy.set(true);
    this.api.runDeferredInvoicing().subscribe({
      next: (res) => {
        this.groupsVisible.set(false);
        this.done('LOGISTICS.DDT.MESSAGES.GROUPED_INVOICED', { count: res.data.length });
      },
      error: (err) => this.fail(err),
    });
  }

  private run(call: Observable<ApiResponse<unknown>>, successKey: string): void {
    this.busy.set(true);
    call.subscribe({
      next: () => this.done(successKey),
      error: (err) => this.fail(err),
    });
  }

  private done(key: string, params?: Record<string, string | number>): void {
    this.busy.set(false);
    this.message.success(this.i18n.translate(key, params));
    this.facade.reload();
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const apiMessage = (err as { error?: { message?: string } })?.error?.message;
    this.message.error(apiMessage ?? this.i18n.translate('LOGISTICS.ERRORS.GENERIC'));
  }
}
