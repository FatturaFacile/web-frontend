import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  BillingApiService,
  I18nService,
  InvoiceApiService,
  InvoiceResource,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  createLineGroup,
  DocumentLinesEditorComponent,
  LineGroup,
  linesToPayload,
} from '../../cycle/shared/document-lines-editor.component';
import { apiErrorText } from '../../cycle/shared/sales-api-helpers';
import { SalesLookupsService } from '../../cycle/shared/sales-lookups.service';
import { todayIso } from '../../cycle/shared/sales-status';

/** Debit note on an issued invoice (additional charges: interest, expenses, price adjustments). */
@Component({
  selector: 'app-debit-note',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    DocumentLinesEditorComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './debit-note.component.html',
  styleUrl: '../../cycle/shared/cycle-page.scss',
})
export class DebitNoteComponent implements OnInit {
  private readonly api = inject(BillingApiService);
  private readonly invoiceApi = inject(InvoiceApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly permissions = inject(PermissionsService);
  protected readonly lookups = inject(SalesLookupsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('invoicing'));

  protected readonly invoices = signal<InvoiceResource[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly lines: FormArray<LineGroup> = this.fb.array([createLineGroup(this.fb)]);
  protected readonly form = this.fb.group({
    original_invoice_id: ['', Validators.required],
    date: [todayIso()],
    due_date: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.lookups.load();
    this.invoiceApi.list({ page: 1, per_page: 100 }).subscribe({
      next: (res) => this.invoices.set((res.data ?? []).filter((i) => i.status !== 'draft')),
      error: () => this.invoices.set([]),
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.lines.invalid) {
      this.form.markAllAsTouched();
      this.lines.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this.api
      .createDebitNote({
        original_invoice_id: v.original_invoice_id,
        date: v.date || null,
        due_date: v.due_date || null,
        notes: v.notes || null,
        items: linesToPayload(this.lines).map((l) => ({
          product_id: l.product_id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          discount_percentage: l.discount_percentage,
        })),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.success(this.i18n.translate('SC.DEBIT.CREATED'));
          this.form.reset({ original_invoice_id: '', date: todayIso(), due_date: '', notes: '' });
          this.lines.clear();
          this.lines.push(createLineGroup(this.fb));
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(apiErrorText(err));
        },
      });
  }
}
