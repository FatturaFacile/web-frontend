import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  CONSENT_CHANNELS,
  CONSENT_PURPOSES,
  CONSENT_SOURCES,
  ClientApiService,
  ConsentChannel,
  ConsentPurpose,
  ConsentRecord,
  ContactConsentSource,
} from '@core';
import { TranslatePipe } from '@shared';

/**
 * GDPR (Italy) / nLPD (Switzerland) consents of a customer: the effective state per channel and purpose, the full
 * ledger, and a form to record a grant or a withdrawal. Records are append-only: nothing is edited in place.
 */
@Component({
  selector: 'app-customer-360-consents',
  imports: [DatePipe, ReactiveFormsModule, NzButtonModule, NzSelectModule, NzTagModule, TranslatePipe],
  template: `
    <p>
      <nz-tag nzColor="blue">{{ regime().toUpperCase() }}</nz-tag>
      @if (restricted()) {
        <nz-tag nzColor="orange">{{ 'CRM.CUSTOMER360.PROCESSING_RESTRICTED' | translate }}</nz-tag>
      }
    </p>

    @for (consent of effective(); track consent.channel + consent.purpose) {
      <div class="row">
        <strong>
          {{ 'CRM.CUSTOMER360.CONSENT_CHANNEL_' + consent.channel.toUpperCase() | translate }} ·
          {{ 'CRM.CUSTOMER360.CONSENT_PURPOSE_' + consent.purpose.toUpperCase() | translate }}
        </strong>
        <nz-tag [nzColor]="consent.status === 'granted' ? 'green' : 'red'">
          {{ 'CRM.CUSTOMER360.CONSENT_' + consent.status.toUpperCase() | translate }}
        </nz-tag>
        <span>{{ consent.captured_at | date: 'short' }}</span>
      </div>
    }

    <form [formGroup]="form" (ngSubmit)="record()" class="add">
      <nz-select formControlName="channel" [attr.aria-label]="'CRM.CUSTOMER360.CONSENT_CHANNEL' | translate">
        @for (c of channels; track c) {
          <nz-option [nzValue]="c" [nzLabel]="'CRM.CUSTOMER360.CONSENT_CHANNEL_' + c.toUpperCase() | translate" />
        }
      </nz-select>
      <nz-select formControlName="purpose" [attr.aria-label]="'CRM.CUSTOMER360.CONSENT_PURPOSE' | translate">
        @for (p of purposes; track p) {
          <nz-option [nzValue]="p" [nzLabel]="'CRM.CUSTOMER360.CONSENT_PURPOSE_' + p.toUpperCase() | translate" />
        }
      </nz-select>
      <nz-select formControlName="source" [attr.aria-label]="'CRM.CUSTOMER360.CONSENT_SOURCE' | translate">
        @for (s of sources; track s) {
          <nz-option [nzValue]="s" [nzLabel]="'CRM.CUSTOMER360.CONSENT_SOURCE_' + s.toUpperCase() | translate" />
        }
      </nz-select>
      <button nz-button nzType="primary" type="button" [nzLoading]="saving()" (click)="record('granted')">
        {{ 'CRM.CUSTOMER360.CONSENT_GRANT' | translate }}
      </button>
      <button nz-button nzDanger type="button" [nzLoading]="saving()" (click)="record('withdrawn')">
        {{ 'CRM.CUSTOMER360.CONSENT_WITHDRAW' | translate }}
      </button>
    </form>

    @if (history().length > 1) {
      <h4>{{ 'CRM.CUSTOMER360.CONSENT_HISTORY' | translate }}</h4>
      @for (entry of history(); track $index) {
        <div class="row">
          <span>{{ entry.captured_at | date: 'short' }}</span>
          <span>{{ entry.channel }} / {{ entry.purpose }}</span>
          <nz-tag>{{ entry.status }}</nz-tag>
          <span>{{ entry.source }}</span>
        </div>
      }
    }
  `,
  styles: `
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 4px 0;
    }
    .add {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
  `,
})
export class Customer360ConsentsComponent implements OnInit {
  private readonly api = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly contactId = input.required<string>();
  /** `gdpr` or `nlpd`, as decided by the API from the country of the customer. */
  readonly regime = input('gdpr');
  readonly restricted = input(false);

  protected readonly channels = CONSENT_CHANNELS;
  protected readonly purposes = CONSENT_PURPOSES;
  protected readonly sources = CONSENT_SOURCES;
  protected readonly effective = signal<ConsentRecord[]>([]);
  protected readonly history = signal<ConsentRecord[]>([]);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    channel: this.fb.control<ConsentChannel>('email', Validators.required),
    purpose: this.fb.control<ConsentPurpose>('marketing', Validators.required),
    source: this.fb.control<ContactConsentSource>('phone', Validators.required),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .consents(this.contactId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ledger) => {
          this.effective.set(ledger.effective);
          this.history.set(ledger.history);
        },
        error: () => {
          this.effective.set([]);
          this.history.set([]);
        },
      });
  }

  protected record(status: 'granted' | 'withdrawn' = 'granted'): void {
    this.saving.set(true);
    this.api.recordConsent({ contact_id: this.contactId(), ...this.form.getRawValue(), status }).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        applyServerErrors(this.form, err).forEach((m) => this.message.error(m));
      },
    });
  }
}
