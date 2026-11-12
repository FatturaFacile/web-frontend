import { Component, computed, inject, input, model, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  BulkTicketAction,
  BulkTicketOutcome,
  BulkTicketRequest,
  HelpdeskApiService,
  I18nService,
  Macro,
  TicketApiService,
  TicketPriority,
  TicketStatus,
} from '@core';
import { TranslatePipe } from '@shared';

const ACTIONS: readonly BulkTicketAction[] = ['status', 'priority', 'assign', 'add_tags', 'remove_tags', 'macro'];
const STATUSES: readonly TicketStatus[] = ['new', 'open', 'pending_customer', 'on_hold', 'resolved', 'closed'];
const PRIORITIES: readonly TicketPriority[] = ['low', 'medium', 'high', 'critical'];

/** Applies one action to the selected tickets and reports what worked for each of them. */
@Component({
  selector: 'app-ticket-bulk-modal',
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzInputModule, NzModalModule, NzSelectModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'TICKET_BULK.TITLE' | translate"
      [nzFooter]="footer"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <p>{{ 'TICKET_BULK.SELECTED' | translate: { count: ticketIds().length } }}</p>
        <label class="tb-label" for="tb-action">{{ 'TICKET_BULK.ACTION' | translate }}</label>
        <nz-select nzId="tb-action" class="tb-full" [ngModel]="action()" (ngModelChange)="action.set($event)">
          @for (item of actions; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'TICKET_BULK.ACTION_' + item | translate" />
          }
        </nz-select>

        @switch (action()) {
          @case ('status') {
            <label class="tb-label" for="tb-status">{{ 'COMMON.STATUS' | translate }}</label>
            <nz-select nzId="tb-status" class="tb-full" [ngModel]="status()" (ngModelChange)="status.set($event)">
              @for (item of statuses; track item) {
                <nz-option [nzValue]="item" [nzLabel]="item" />
              }
            </nz-select>
          }
          @case ('priority') {
            <label class="tb-label" for="tb-priority">{{ 'TICKET_BULK.PRIORITY' | translate }}</label>
            <nz-select nzId="tb-priority" class="tb-full" [ngModel]="priority()" (ngModelChange)="priority.set($event)">
              @for (item of priorities; track item) {
                <nz-option [nzValue]="item" [nzLabel]="item" />
              }
            </nz-select>
          }
          @case ('assign') {
            <label class="tb-label" for="tb-team">{{ 'TICKET_BULK.TEAM_ID' | translate }}</label>
            <input nz-input id="tb-team" [ngModel]="teamId()" (ngModelChange)="teamId.set($event)" />
            <label class="tb-label" for="tb-tech">{{ 'TICKET_BULK.TECHNICIAN_ID' | translate }}</label>
            <input nz-input id="tb-tech" [ngModel]="technicianId()" (ngModelChange)="technicianId.set($event)" />
          }
          @case ('macro') {
            <label class="tb-label" for="tb-macro">{{ 'TICKET_BULK.MACRO' | translate }}</label>
            <nz-select nzId="tb-macro" class="tb-full" [ngModel]="macroId()" (ngModelChange)="macroId.set($event)">
              @for (macro of macros(); track macro.id) {
                <nz-option [nzValue]="macro.id" [nzLabel]="macro.name" />
              }
            </nz-select>
          }
          @default {
            <label class="tb-label" for="tb-tags">{{ 'TICKET_BULK.TAGS' | translate }}</label>
            <nz-select nzId="tb-tags" class="tb-full" nzMode="tags" [nzTokenSeparators]="[',']" [ngModel]="tags()" (ngModelChange)="tags.set($event)" />
          }
        }

        @if (outcomes().length > 0) {
          <nz-alert
            class="tb-result"
            [nzType]="failed() === 0 ? 'success' : 'warning'"
            nzShowIcon
            [nzMessage]="'TICKET_BULK.RESULT' | translate: { ok: succeeded(), failed: failed() }"
          />
          @for (outcome of failedOutcomes(); track outcome.ticket_id) {
            <p class="tb-error">{{ outcome.ticket_id }}: {{ outcome.error }}</p>
          }
        }
      </ng-container>
      <ng-template #footer>
        <button nz-button type="button" (click)="open.set(false)">{{ 'TICKET_BULK.CLOSE' | translate }}</button>
        <button nz-button nzType="primary" type="button" [nzLoading]="saving()" [disabled]="!valid()" (click)="apply()">
          {{ 'TICKET_BULK.APPLY' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class TicketBulkModalComponent implements OnInit {
  private readonly tickets = inject(TicketApiService);
  private readonly helpdesk = inject(HelpdeskApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly open = model.required<boolean>();
  readonly ticketIds = input.required<string[]>();
  readonly done = output<void>();

  protected readonly actions = ACTIONS;
  protected readonly statuses = STATUSES;
  protected readonly priorities = PRIORITIES;
  protected readonly macros = signal<Macro[]>([]);

  protected readonly action = signal<BulkTicketAction>('status');
  protected readonly status = signal<TicketStatus | null>(null);
  protected readonly priority = signal<TicketPriority | null>(null);
  protected readonly teamId = signal('');
  protected readonly technicianId = signal('');
  protected readonly macroId = signal<string | null>(null);
  protected readonly tags = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly outcomes = signal<BulkTicketOutcome[]>([]);
  protected readonly succeeded = signal(0);
  protected readonly failed = signal(0);

  protected readonly failedOutcomes = computed(() => this.outcomes().filter((outcome) => !outcome.ok));
  protected readonly valid = computed(() => {
    if (this.ticketIds().length === 0) {
      return false;
    }
    switch (this.action()) {
      case 'status':
        return this.status() !== null;
      case 'priority':
        return this.priority() !== null;
      case 'assign':
        return this.teamId().trim() !== '' || this.technicianId().trim() !== '';
      case 'macro':
        return this.macroId() !== null;
      default:
        return this.tags().length > 0;
    }
  });

  ngOnInit(): void {
    this.helpdesk.getMacros().subscribe({ next: (res) => this.macros.set(res.data ?? []), error: () => undefined });
  }

  protected apply(): void {
    const payload: BulkTicketRequest = { ticket_ids: this.ticketIds(), action: this.action() };
    switch (this.action()) {
      case 'status':
        payload.status = this.status();
        break;
      case 'priority':
        payload.priority = this.priority();
        break;
      case 'assign':
        payload.assigned_team_id = this.teamId().trim() || null;
        payload.assigned_technician_id = this.technicianId().trim() || null;
        break;
      case 'macro':
        payload.macro_id = this.macroId();
        break;
      default:
        payload.tags = this.tags();
    }
    this.saving.set(true);
    this.tickets.bulkUpdate(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.outcomes.set(res.data);
        this.succeeded.set(res.meta.succeeded);
        this.failed.set(res.meta.failed);
        this.done.emit();
      },
      error: () => {
        this.saving.set(false);
        this.message.error(this.i18n.translate('TICKET_BULK.FAILED'));
      },
    });
  }
}
