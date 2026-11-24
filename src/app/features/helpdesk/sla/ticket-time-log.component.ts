import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  BillingStatus,
  HelpdeskSlaApiService,
  I18nService,
  SettingsApiService,
  TicketResource,
  TicketTimeEntry,
  UserResource,
} from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@shared';

export const BILLING_KEYS: Record<BillingStatus, string> = {
  contract_deducted: 'HELPDESK_SLA.BILLING_CONTRACT_DEDUCTED',
  partially_deducted: 'HELPDESK_SLA.BILLING_PARTIALLY_DEDUCTED',
  billable_pending: 'HELPDESK_SLA.BILLING_BILLABLE_PENDING',
  non_billable: 'HELPDESK_SLA.BILLING_NON_BILLABLE',
};

const BILLING_COLORS: Record<BillingStatus, string> = {
  contract_deducted: 'success',
  partially_deducted: 'warning',
  billable_pending: 'blue',
  non_billable: 'default',
};

/** Time worked on a ticket: the entries logged so far and a quick drawer that shows how the contract absorbed a new one. */
@Component({
  selector: 'app-ticket-time-log',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <section [attr.aria-label]="'HELPDESK_SLA.TIME_LOG' | translate">
      <div class="time-head">
        <h4>{{ 'HELPDESK_SLA.TIME_LOG' | translate }}</h4>
        <button
          nz-button
          nzSize="small"
          nzType="primary"
          type="button"
          data-testid="open-time-log"
          (click)="drawerOpen.set(true)"
        >
          {{ 'HELPDESK_SLA.LOG_TIME' | translate }}
        </button>
      </div>
      @for (entry of entries(); track entry.id) {
        <div class="time-entry">
          <span>{{ entry.hours | number: '1.2-2' }} h</span>
          <nz-tag [nzColor]="colorOf(entry.billing_status)">{{
            keyOf(entry.billing_status) | translate
          }}</nz-tag>
        </div>
      } @empty {
        <span class="time-muted">{{ 'HELPDESK_SLA.NO_TIME' | translate }}</span>
      }
    </section>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzTitle]="'HELPDESK_SLA.LOG_TIME' | translate"
      [nzWidth]="420"
      (nzOnClose)="closeDrawer()"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="time-minutes">{{
              'HELPDESK_SLA.MINUTES' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-input-number
                id="time-minutes"
                formControlName="minutes"
                [nzMin]="1"
                [nzMax]="1440"
                [nzStep]="15"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="time-technician">{{
              'HELPDESK_SLA.TECHNICIAN' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select
                id="time-technician"
                formControlName="technician_id"
                nzAllowClear
                nzShowSearch
              >
                @for (user of users(); track user.id) {
                  <nz-option [nzValue]="user.id" [nzLabel]="user.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="time-description">{{
              'HELPDESK_SLA.DESCRIPTION' | translate
            }}</nz-form-label>
            <nz-form-control>
              <textarea
                nz-input
                id="time-description"
                rows="3"
                formControlName="description"
                maxlength="1000"
              ></textarea>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control>
              <label for="ticket-time-log-is-billable" nzId="ticket-time-log-is-billable" nz-checkbox formControlName="is_billable">{{
                'HELPDESK_SLA.BILLABLE' | translate
              }}</label>
            </nz-form-control>
          </nz-form-item>
          <button
            nz-button
            nzType="primary"
            type="submit"
            [nzLoading]="busy()"
            [disabled]="form.invalid"
          >
            {{ 'HELPDESK_SLA.SAVE_TIME' | translate }}
          </button>
        </form>

        @if (result(); as entry) {
          <div class="time-result" data-testid="time-result" role="status">
            <nz-tag [nzColor]="colorOf(entry.billing_status)">{{
              keyOf(entry.billing_status) | translate
            }}</nz-tag>
            <dl>
              <dt>{{ 'HELPDESK_SLA.CONTRACT_HOURS' | translate }}</dt>
              <dd>{{ entry.contract_hours | number: '1.2-2' }} h</dd>
              <dt>{{ 'HELPDESK_SLA.BILLABLE_HOURS' | translate }}</dt>
              <dd>{{ entry.billable_hours | number: '1.2-2' }} h</dd>
              @if (entry.total_charge !== null && entry.billable_hours > 0) {
                <dt>{{ 'HELPDESK_SLA.TOTAL_CHARGE' | translate }}</dt>
                <dd>{{ entry.total_charge | number: '1.2-2' }}</dd>
              }
            </dl>
          </div>
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    h4 {
      margin: 0;
    }
    .time-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-2);
    }
    .time-entry {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-1);
    }
    .time-muted {
      color: var(--text-muted);
    }
    .time-result {
      margin-top: var(--space-4);
      padding: var(--space-3);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
    }
    dl {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-1);
      margin: var(--space-2) 0 0;
    }
    dd {
      margin: 0;
      text-align: right;
    }
  `,
})
export class TicketTimeLogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(HelpdeskSlaApiService);
  private readonly settings = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly ticket = input.required<TicketResource>();
  /** Emitted after time was logged: the contract hours of the customer changed. */
  readonly logged = output<TicketTimeEntry>();

  protected readonly drawerOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly entries = signal<TicketTimeEntry[]>([]);
  protected readonly users = signal<UserResource[]>([]);
  /** Outcome of the entry just logged: how much the contract absorbed and what stays billable. */
  protected readonly result = signal<TicketTimeEntry | null>(null);

  protected readonly form = this.fb.group({
    minutes: this.fb.control(30, [Validators.required, Validators.min(1), Validators.max(1440)]),
    technician_id: this.fb.control<string | null>(null),
    description: this.fb.control('', [Validators.maxLength(1000)]),
    is_billable: this.fb.control(true),
  });

  constructor() {
    effect(() => {
      const { id } = this.ticket();
      untracked(() => this.loadEntries(id));
    });
    this.settings
      .getTenantUsers()
      .subscribe({ next: (res) => this.users.set(res.data ?? []), error: () => undefined });
  }

  protected keyOf(status: BillingStatus): string {
    return BILLING_KEYS[status];
  }

  protected colorOf(status: BillingStatus): string {
    return BILLING_COLORS[status];
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
    this.result.set(null);
  }

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    this.busy.set(true);
    this.api
      .logTime(this.ticket().id, {
        minutes: value.minutes,
        technician_id: value.technician_id || undefined,
        description: value.description.trim() || undefined,
        is_billable: value.is_billable,
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.result.set(res.data);
          this.entries.update((list) => [...list, res.data]);
          this.logged.emit(res.data);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.message.error(messageOf(err) || this.i18n.translate('HELPDESK_SLA.TIME_ERROR'));
        },
      });
  }

  private loadEntries(id: string): void {
    this.api.getTimeEntries(id).subscribe({
      next: (res) => this.entries.set(res.data ?? []),
      error: () => this.entries.set([]),
    });
  }
}

/** The message of a Laravel error body, when there is one. */
export function messageOf(err: unknown): string {
  if (
    err instanceof Object &&
    'error' in err &&
    err.error instanceof Object &&
    'message' in err.error
  ) {
    return String(err.error.message);
  }
  return '';
}
