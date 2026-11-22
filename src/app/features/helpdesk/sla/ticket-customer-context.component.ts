import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CustomerContract, HelpdeskSlaApiService, TicketCustomerContext } from '@core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@shared';

/** 360 degree side panel of the customer of a ticket: contracts with their remaining hours, assets, open invoices, recent tickets. */
@Component({
  selector: 'app-ticket-customer-context',
  imports: [
    DatePipe,
    DecimalPipe,
    NzAlertModule,
    NzProgressModule,
    NzSpinModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <aside [attr.aria-label]="'HELPDESK_SLA.CUSTOMER_360' | translate">
      <h4>{{ 'HELPDESK_SLA.CUSTOMER_360' | translate }}</h4>
      <nz-spin [nzSpinning]="loading()">
        @if (failed()) {
          <nz-alert
            nzType="warning"
            nzShowIcon
            [nzMessage]="'HELPDESK_SLA.CONTEXT_ERROR' | translate"
          />
        } @else if (context(); as ctx) {
          <h5>{{ 'HELPDESK_SLA.CONTRACTS' | translate }}</h5>
          @for (contract of ctx.contracts; track contract.id) {
            <div class="ctx-item" data-testid="ctx-contract">
              <strong>{{ contract.name }}</strong>
              @if (contract.kind === 'prepaid_hours') {
                <nz-progress
                  [nzPercent]="usedPercent(contract)"
                  nzSize="small"
                  [nzStatus]="usedPercent(contract) >= 100 ? 'exception' : 'normal'"
                />
                <span class="ctx-muted">
                  {{
                    'HELPDESK_SLA.HOURS_LEFT'
                      | translate
                        : {
                            remaining: (contract.remaining_hours | number: '1.0-2') ?? '0',
                            included: (contract.included_hours | number: '1.0-2') ?? '0',
                          }
                  }}
                </span>
              } @else {
                <nz-tag>{{ 'HELPDESK_SLA.FLAT_RATE' | translate }}</nz-tag>
              }
              @if (contract.end_date) {
                <span class="ctx-muted">{{
                  'HELPDESK_SLA.VALID_UNTIL'
                    | translate: { date: (contract.end_date | date: 'dd/MM/yyyy') ?? '' }
                }}</span>
              }
            </div>
          } @empty {
            <span class="ctx-muted">{{ 'HELPDESK_SLA.NO_CONTRACTS' | translate }}</span>
          }

          <h5>{{ 'HELPDESK_SLA.ASSETS' | translate }}</h5>
          @for (asset of ctx.assets; track asset.id) {
            <div class="ctx-item" data-testid="ctx-asset">
              <strong>{{ asset.serial_number || asset.id.substring(0, 8) }}</strong>
              @if (asset.warranty_expiry_date) {
                <span class="ctx-muted">{{
                  'HELPDESK_SLA.WARRANTY_UNTIL'
                    | translate: { date: (asset.warranty_expiry_date | date: 'dd/MM/yyyy') ?? '' }
                }}</span>
              }
            </div>
          } @empty {
            <span class="ctx-muted">{{ 'HELPDESK_SLA.NO_ASSETS' | translate }}</span>
          }

          <h5>{{ 'HELPDESK_SLA.OPEN_INVOICES' | translate }}</h5>
          <div class="ctx-item" data-testid="ctx-invoices">
            {{
              'HELPDESK_SLA.INVOICES_SUMMARY'
                | translate
                  : {
                      count: ctx.open_invoices.count,
                      total: (ctx.open_invoices.total_gross | number: '1.2-2') ?? '0',
                    }
            }}
            @if (ctx.open_invoices.overdue_count > 0) {
              <nz-tag nzColor="error">{{
                'HELPDESK_SLA.INVOICES_OVERDUE'
                  | translate: { count: ctx.open_invoices.overdue_count }
              }}</nz-tag>
            }
          </div>

          <h5>{{ 'HELPDESK_SLA.RECENT_TICKETS' | translate }}</h5>
          @for (recent of ctx.recent_tickets; track recent.id) {
            <div class="ctx-item" data-testid="ctx-ticket">
              <strong>#{{ recent.ticket_number }}</strong> {{ recent.subject }}
              <div>
                <nz-tag>{{ recent.status }}</nz-tag>
                <span class="ctx-muted">{{ recent.created_at | date: 'dd/MM/yyyy' }}</span>
              </div>
            </div>
          } @empty {
            <span class="ctx-muted">{{ 'HELPDESK_SLA.NO_RECENT_TICKETS' | translate }}</span>
          }
        }
      </nz-spin>
    </aside>
  `,
  styles: `
    h4 {
      margin: 0 0 var(--space-3);
    }
    h5 {
      margin: var(--space-3) 0 var(--space-1);
      color: var(--text-muted);
      font-size: var(--font-size-xs);
      text-transform: uppercase;
    }
    .ctx-item {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin-bottom: var(--space-2);
      font-size: var(--font-size-sm);
    }
    .ctx-muted {
      color: var(--text-muted);
      font-size: var(--font-size-xs);
    }
  `,
})
export class TicketCustomerContextComponent {
  private readonly api = inject(HelpdeskSlaApiService);

  readonly ticketId = input.required<string>();
  /** Bumped by the parent after an action that changes the hours of a contract (time logged). */
  readonly refreshToken = input(0);
  readonly loaded = output<TicketCustomerContext>();

  protected readonly context = signal<TicketCustomerContext | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    effect(() => {
      const id = this.ticketId();
      this.refreshToken();
      untracked(() => this.load(id));
    });
  }

  protected usedPercent(contract: CustomerContract): number {
    const included = contract.included_hours ?? 0;
    return included > 0
      ? Math.min(100, Math.round(((contract.consumed_hours ?? 0) / included) * 100))
      : 0;
  }

  private load(id: string): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.getCustomerContext(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.context.set(res.data);
        this.loaded.emit(res.data);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }
}
