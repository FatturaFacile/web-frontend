import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PortalAreaApiService } from '@core/api/portal-area-api.service';
import { PortalInvoice, PortalTicket, PortalTicketKind } from '@core/models/portal-area.models';
import { TranslatePipe } from '@shared';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** `/portal/support`: open an inquiry, an invoice dispute or a defective-goods report, and follow the requests sent. */
@Component({
  selector: 'app-portal-support',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'PORTAL_AREA.NEW_REQUEST' | translate">
      @if (sent()) {
        <nz-alert
          nzType="success"
          nzShowIcon
          class="gap"
          [nzMessage]="'PORTAL_AREA.REQUEST_SENT' | translate"
        />
      }
      @if (failed()) {
        <nz-alert nzType="error" nzShowIcon class="gap" [nzMessage]="failed() ?? '' | translate" />
      }
      <form [formGroup]="form" (submit)="submit($event)" novalidate class="form">
        <label for="kind">{{ 'PORTAL_AREA.KIND' | translate }}</label>
        <nz-select id="kind" formControlName="kind">
          <nz-option nzValue="inquiry" [nzLabel]="'PORTAL_AREA.KIND_INQUIRY' | translate" />
          <nz-option nzValue="invoice_dispute" [nzLabel]="'PORTAL_AREA.KIND_DISPUTE' | translate" />
          <nz-option nzValue="defective_goods" [nzLabel]="'PORTAL_AREA.KIND_DEFECT' | translate" />
        </nz-select>

        <label for="invoice">{{ 'PORTAL_AREA.LINKED_DOCUMENT' | translate }}</label>
        <nz-select id="invoice" formControlName="invoice_id" nzAllowClear>
          @for (invoice of invoices(); track invoice.id) {
            <nz-option [nzValue]="invoice.id" [nzLabel]="invoice.invoice_number" />
          }
        </nz-select>

        <label for="subject">{{ 'PORTAL_AREA.SUBJECT' | translate }}</label>
        <input nz-input id="subject" maxlength="200" formControlName="subject" />

        <label for="description">{{ 'PORTAL_AREA.DESCRIPTION' | translate }}</label>
        <textarea
          nz-input
          id="description"
          rows="5"
          maxlength="5000"
          formControlName="description"
        ></textarea>

        <label for="files">{{ 'PORTAL_AREA.ATTACHMENTS' | translate }}</label>
        <input
          id="files"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.xlsx,.docx"
          (change)="pickFiles($event)"
        />

        <button
          nz-button
          nzType="primary"
          type="submit"
          [nzLoading]="sending()"
          [disabled]="form.invalid"
        >
          {{ 'PORTAL_AREA.SEND' | translate }}
        </button>
      </form>
    </nz-card>

    <nz-card [nzTitle]="'PORTAL_AREA.MY_REQUESTS' | translate" class="list">
      @for (ticket of tickets(); track ticket.id) {
        <p>
          <strong>{{ ticket.ticket_number }}</strong> · {{ ticket.subject }}
          <nz-tag>{{ ticket.status }}</nz-tag>
          <span class="muted">{{ ticket.created_at | date: 'medium' }}</span>
        </p>
      } @empty {
        <p class="muted">{{ 'PORTAL_AREA.NO_DATA' | translate }}</p>
      }
    </nz-card>
  `,
  styles: `
    .form {
      display: grid;
      gap: 8px;
      max-width: 640px;
    }
    .gap {
      display: block;
      margin-bottom: 12px;
    }
    .list {
      margin-top: 16px;
      display: block;
    }
    .muted {
      opacity: 0.6;
      margin-left: 8px;
    }
  `,
})
export class PortalSupportComponent implements OnInit {
  private readonly api = inject(PortalAreaApiService);

  protected readonly tickets = signal<readonly PortalTicket[]>([]);
  protected readonly invoices = signal<readonly PortalInvoice[]>([]);
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly failed = signal<string | null>(null);

  protected readonly form = new FormGroup({
    kind: new FormControl<PortalTicketKind>('inquiry', { nonNullable: true }),
    invoice_id: new FormControl<string | null>(null),
    subject: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(5000)],
    }),
  });

  private files: File[] = [];

  ngOnInit(): void {
    this.reload();
    this.api
      .invoices()
      .subscribe({ next: (response) => this.invoices.set(response.data), error: () => undefined });
  }

  protected pickFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    this.files = chosen.slice(0, MAX_FILES).filter((file) => file.size <= MAX_FILE_BYTES);
    if (this.files.length !== chosen.length) {
      input.value = '';
      this.files = [];
      this.failed.set('PORTAL_AREA.ATTACHMENTS');
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.form.invalid || this.sending()) {
      return;
    }
    const value = this.form.getRawValue();
    this.sending.set(true);
    this.sent.set(false);
    this.failed.set(null);

    this.api
      .createTicket({
        kind: value.kind,
        subject: value.subject.trim(),
        description: value.description.trim(),
        invoice_id: value.invoice_id ?? undefined,
        attachments: this.files,
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.sent.set(true);
          this.form.reset({ kind: 'inquiry', invoice_id: null, subject: '', description: '' });
          this.files = [];
          this.reload();
        },
        error: (error: unknown) => {
          this.sending.set(false);
          const message =
            error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
              ? error.error.message
              : 'PORTAL_AREA.LOADING_ERROR';
          this.failed.set(message);
        },
      });
  }

  private reload(): void {
    this.api
      .tickets()
      .subscribe({ next: (response) => this.tickets.set(response.data), error: () => undefined });
  }
}
