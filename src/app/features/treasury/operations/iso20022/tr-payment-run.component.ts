import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { BankingApiService } from '@core/api/banking-api.service';
import { ProcurementApiService } from '@core/api/procurement-api.service';
import { Pain001ExportResult, Pain001Scheme, Pain001Version } from '@core/models/iso20022.model';
import { SupplierInvoice } from '@core/models/procurement.model';
import { MoneyPipe, TranslatePipe, downloadBlob } from '@shared';

/** Supplier invoices the approval workflow still holds back: they cannot enter a payment file. */
const BLOCKED_APPROVALS = ['pending', 'in_approval', 'rejected', 'match_blocked'];

/**
 * Supplier payment run: choose due, approved supplier invoices and download the pain.001 credit transfer file
 * (pain.001.001.03 or .09), which the API validates against the ISO 20022 schema before it is handed out.
 */
@Component({
  selector: 'app-tr-payment-run',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'iso20022.run.title' | translate">
      <div class="controls">
        <label for="run-1">
          <span>{{ 'iso20022.run.scheme' | translate }}</span>
          <nz-select
            nzId="run-1"
            [ngModel]="scheme()"
            (ngModelChange)="scheme.set($event)"
            class="select"
            data-testid="scheme"
          >
            <nz-option nzValue="ch" nzLabel="Swiss (CH)" />
            <nz-option nzValue="it" nzLabel="SEPA (IT)" />
          </nz-select>
        </label>
        <label for="run-2">
          <span>{{ 'iso20022.run.version' | translate }}</span>
          <nz-select
            nzId="run-2"
            [ngModel]="version()"
            (ngModelChange)="version.set($event)"
            class="select"
            data-testid="version"
          >
            <nz-option nzValue="09" nzLabel="pain.001.001.09" />
            <nz-option nzValue="03" nzLabel="pain.001.001.03" />
          </nz-select>
        </label>
        <label>
          <span>{{ 'iso20022.run.executionDate' | translate }}</span>
          <input
            nz-input
            type="date"
            [ngModel]="executionDate()"
            (ngModelChange)="executionDate.set($event)"
            class="date"
          />
        </label>
      </div>

      <nz-table
        nzSize="small"
        [nzData]="invoices()"
        [nzLoading]="loading()"
        [nzShowPagination]="false"
        [nzPageSize]="500"
      >
        <thead>
          <tr>
            <th
              nzWidth="48px"
              [nzChecked]="allSelected()"
              [nzIndeterminate]="someSelected()"
              (nzCheckedChange)="toggleAll($event)"
              data-testid="select-all"
            ></th>
            <th>{{ 'iso20022.run.col.invoice' | translate }}</th>
            <th>{{ 'iso20022.run.col.supplier' | translate }}</th>
            <th>{{ 'iso20022.run.col.due' | translate }}</th>
            <th class="num">{{ 'iso20022.run.col.amount' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (invoice of invoices(); track invoice.id) {
            <tr data-testid="run-row">
              <td
                [nzChecked]="selected().has(invoice.id)"
                (nzCheckedChange)="toggle(invoice.id, $event)"
              ></td>
              <td>{{ invoice.invoice_number }}</td>
              <td>{{ invoice.supplier_name ?? '-' }}</td>
              <td>{{ invoice.due_date ?? invoice.date }}</td>
              <td class="num">{{ openAmount(invoice) | money: invoice.currency }}</td>
            </tr>
          }
        </tbody>
      </nz-table>

      <div class="footer">
        <strong data-testid="selection-total">
          {{ 'iso20022.run.selected' | translate }}: {{ selected().size }} ·
          {{ total() | money: currency() }}
        </strong>
        <button
          nz-button
          nzType="primary"
          [nzLoading]="exporting()"
          [disabled]="selected().size === 0 || mixedCurrencies()"
          (click)="generate()"
          data-testid="generate"
        >
          {{ 'iso20022.run.generate' | translate }}
        </button>
      </div>

      @if (mixedCurrencies()) {
        <nz-alert
          nzType="warning"
          nzShowIcon
          [nzMessage]="'iso20022.run.mixedCurrencies' | translate"
          data-testid="mixed-currencies"
        />
      }
      @if (error(); as key) {
        <nz-alert
          nzType="error"
          nzShowIcon
          [nzMessage]="key.startsWith('iso20022.') ? (key | translate) : key"
          data-testid="run-error"
        />
      }
      @if (result(); as r) {
        <nz-alert
          nzType="success"
          nzShowIcon
          [nzMessage]="('iso20022.run.success' | translate) + ' · ' + r.filename"
          data-testid="run-result"
        />
      }
    </nz-card>
  `,
  styles: `
    :host {
      display: block;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;

      label {
        display: grid;
        gap: 4px;
        font-size: 12px;
      }
    }
    .select {
      width: 180px;
    }
    .date {
      width: 170px;
    }
    .num {
      text-align: right;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 16px 0;
    }
  `,
})
export class TrPaymentRunComponent implements OnInit {
  private readonly procurement = inject(ProcurementApiService);
  private readonly banking = inject(BankingApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly scheme = signal<Pain001Scheme>('ch');
  protected readonly version = signal<Pain001Version>('09');
  protected readonly executionDate = signal<string>('');
  protected readonly invoices = signal<SupplierInvoice[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<Pain001ExportResult | null>(null);

  private readonly chosen = computed(() =>
    this.invoices().filter((invoice) => this.selected().has(invoice.id)),
  );
  protected readonly total = computed(
    () =>
      Math.round(this.chosen().reduce((sum, invoice) => sum + this.openAmount(invoice), 0) * 100) /
      100,
  );
  protected readonly currency = computed(() => this.chosen()[0]?.currency ?? 'CHF');
  protected readonly mixedCurrencies = computed(
    () => new Set(this.chosen().map((invoice) => invoice.currency)).size > 1,
  );
  protected readonly allSelected = computed(
    () => this.invoices().length > 0 && this.selected().size === this.invoices().length,
  );
  protected readonly someSelected = computed(() => this.selected().size > 0 && !this.allSelected());

  ngOnInit(): void {
    this.loading.set(true);
    this.procurement
      .getSupplierInvoices({ per_page: 200, payment_status: 'unpaid' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.invoices.set((res.data ?? []).filter((invoice) => this.payable(invoice)));
          this.loading.set(false);
        },
        error: () => {
          this.invoices.set([]);
          this.loading.set(false);
        },
      });
  }

  protected openAmount(invoice: SupplierInvoice): number {
    return Math.round((Number(invoice.total_amount) - Number(invoice.total_paid ?? 0)) * 100) / 100;
  }

  protected toggle(id: string, checked: boolean): void {
    const next = new Set(this.selected());

    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }

    this.selected.set(next);
  }

  protected toggleAll(checked: boolean): void {
    this.selected.set(checked ? new Set(this.invoices().map((invoice) => invoice.id)) : new Set());
  }

  protected generate(): void {
    const ids = [...this.selected()];

    if (ids.length === 0 || this.mixedCurrencies()) {
      return;
    }

    this.exporting.set(true);
    this.error.set(null);
    this.result.set(null);
    this.banking
      .exportPain001({
        invoice_ids: ids,
        version: this.version(),
        scheme: this.scheme(),
        execution_date: this.executionDate() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.exporting.set(false);
          this.result.set(res.data);
          downloadBlob(
            new Blob([res.data.xml_preview], { type: 'application/xml' }),
            res.data.filename,
          );
          this.selected.set(new Set());
          this.invoices.update((list) => list.filter((invoice) => !ids.includes(invoice.id)));
        },
        error: (err) => {
          this.exporting.set(false);
          const errors = err?.error?.errors as Record<string, string[]> | undefined;
          this.error.set(
            Object.values(errors ?? {}).flat()[0] ?? err?.error?.message ?? 'iso20022.run.failure',
          );
        },
      });
  }

  private payable(invoice: SupplierInvoice): boolean {
    return (
      invoice.document_type !== 'TD04' &&
      this.openAmount(invoice) > 0 &&
      !BLOCKED_APPROVALS.includes(String(invoice.approval_status ?? ''))
    );
  }
}
