import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { HelpdeskSlaApiService, TicketEscalationLogEntry, TicketResource } from '@core';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { TranslatePipe } from '@shared';
import { SlaCountdownComponent } from './sla-countdown.component';
import { TARGET_LABEL_KEYS } from './sla-countdown';

const STATE_COLORS: Record<string, string> = {
  ok: 'success',
  warning: 'warning',
  breached: 'error',
  paused: 'default',
};
const STATE_KEYS: Record<string, string> = {
  ok: 'HELPDESK_SLA.STATE_OK',
  warning: 'HELPDESK_SLA.STATE_WARNING',
  breached: 'HELPDESK_SLA.STATE_BREACHED',
  paused: 'HELPDESK_SLA.STATE_PAUSED',
};
const ACTION_KEYS: Record<string, string> = {
  notify: 'HELPDESK_SLA.ACTION_NOTIFY',
  reassign_team: 'HELPDESK_SLA.ACTION_REASSIGN_TEAM',
  raise_priority: 'HELPDESK_SLA.ACTION_RAISE_PRIORITY',
};

/** SLA clock of a ticket (response and resolution targets, pause) and the timeline of the escalation steps that fired. */
@Component({
  selector: 'app-ticket-sla-panel',
  imports: [
    DatePipe,
    NzEmptyModule,
    NzTagModule,
    NzTimelineModule,
    SlaCountdownComponent,
    TranslatePipe,
  ],
  template: `
    <section class="sla-clock" [attr.aria-label]="'HELPDESK_SLA.CLOCK' | translate">
      <h4>{{ 'HELPDESK_SLA.CLOCK' | translate }}</h4>
      <div class="sla-row">
        <nz-tag [nzColor]="stateColor()" data-testid="sla-state">{{
          stateKey() | translate
        }}</nz-tag>
        @if (ticket().escalation_level > 0) {
          <nz-tag nzColor="volcano">{{
            'HELPDESK_SLA.ESCALATION_LEVEL' | translate: { level: ticket().escalation_level }
          }}</nz-tag>
        }
      </div>
      <div class="sla-row">
        <span class="sla-label">{{ targets.response | translate }}</span>
        @if (ticket().first_responded_at) {
          <nz-tag nzColor="success">{{
            'HELPDESK_SLA.DONE_AT'
              | translate: { date: (ticket().first_responded_at | date: 'dd/MM HH:mm') ?? '' }
          }}</nz-tag>
        } @else {
          <app-sla-countdown [dueAt]="ticket().response_due_at" [paused]="paused()" />
        }
      </div>
      <div class="sla-row">
        <span class="sla-label">{{ targets.resolution | translate }}</span>
        @if (ticket().resolved_at) {
          <nz-tag nzColor="success">{{
            'HELPDESK_SLA.DONE_AT'
              | translate: { date: (ticket().resolved_at | date: 'dd/MM HH:mm') ?? '' }
          }}</nz-tag>
        } @else {
          <app-sla-countdown [dueAt]="ticket().resolution_due_at" [paused]="paused()" />
        }
      </div>
    </section>

    <section [attr.aria-label]="'HELPDESK_SLA.ESCALATION_HISTORY' | translate">
      <h4>{{ 'HELPDESK_SLA.ESCALATION_HISTORY' | translate }}</h4>
      @if (entries().length === 0) {
        <nz-empty [nzNotFoundContent]="'HELPDESK_SLA.NO_ESCALATIONS' | translate" />
      } @else {
        <nz-timeline>
          @for (entry of entries(); track entry.id) {
            <nz-timeline-item [nzColor]="entry.action === 'notify' ? 'blue' : 'red'">
              <div class="sla-step">
                <strong>{{ actionKey(entry) | translate }}</strong>
                <span>
                  {{ targetKey(entry) | translate }} -
                  {{
                    'HELPDESK_SLA.STEP_THRESHOLD'
                      | translate
                        : { threshold: entry.threshold_percent, elapsed: entry.elapsed_percent }
                  }}
                </span>
              </div>
              @if (entry.outcome) {
                <div class="sla-meta">{{ entry.outcome }}</div>
              }
              <div class="sla-meta">{{ entry.fired_at | date: 'dd/MM/yyyy HH:mm' }}</div>
            </nz-timeline-item>
          }
        </nz-timeline>
      }
    </section>
  `,
  styles: `
    h4 {
      margin: 0 0 var(--space-2);
    }
    .sla-clock {
      margin-bottom: var(--space-4);
    }
    .sla-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
    }
    .sla-label {
      min-width: 130px;
      font-weight: 500;
    }
    .sla-step {
      display: flex;
      flex-direction: column;
    }
    .sla-meta {
      color: var(--text-muted);
      font-size: var(--font-size-xs);
    }
  `,
})
export class TicketSlaPanelComponent {
  private readonly api = inject(HelpdeskSlaApiService);

  readonly ticket = input.required<TicketResource>();

  protected readonly targets = TARGET_LABEL_KEYS;
  protected readonly entries = signal<TicketEscalationLogEntry[]>([]);

  constructor() {
    effect(() => {
      // The drawer hands over a new ticket object after every action, so the history is read again then too.
      const { id } = this.ticket();
      untracked(() => this.loadEscalations(id));
    });
  }

  protected paused(): boolean {
    return this.ticket().sla_state === 'paused';
  }

  protected stateColor(): string {
    return STATE_COLORS[this.ticket().sla_state] ?? 'default';
  }

  protected stateKey(): string {
    return STATE_KEYS[this.ticket().sla_state] ?? 'HELPDESK_SLA.STATE_OK';
  }

  protected actionKey(entry: TicketEscalationLogEntry): string {
    return ACTION_KEYS[entry.action] ?? ACTION_KEYS['notify'];
  }

  protected targetKey(entry: TicketEscalationLogEntry): string {
    return TARGET_LABEL_KEYS[entry.target];
  }

  private loadEscalations(id: string): void {
    this.api.getEscalations(id).subscribe({
      next: (res) => this.entries.set(res.data ?? []),
      error: () => this.entries.set([]),
    });
  }
}
