import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HelpdeskSlaApiService, I18nService, TicketResource } from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { TranslatePipe } from '@shared';
import { messageOf } from './ticket-time-log.component';

/** One-click hand-off of a ticket to field service (work order) or to a warranty RMA, each behind a confirm dialog. */
@Component({
  selector: 'app-ticket-handoff',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzInputModule,
    NzModalModule,
    TranslatePipe,
  ],
  template: `
    <div class="handoff">
      <button
        nz-button
        type="button"
        [disabled]="!available()"
        data-testid="escalate-field-service"
        (click)="confirmFieldService()"
      >
        {{ 'HELPDESK_SLA.ESCALATE_FIELD_SERVICE' | translate }}
      </button>
      <button
        nz-button
        type="button"
        [disabled]="!available()"
        data-testid="escalate-rma"
        (click)="rmaOpen.set(true)"
      >
        {{ 'HELPDESK_SLA.ESCALATE_RMA' | translate }}
      </button>
    </div>

    <nz-modal
      [nzVisible]="rmaOpen()"
      [nzTitle]="'HELPDESK_SLA.ESCALATE_RMA' | translate"
      [nzOkText]="'HELPDESK_SLA.CONFIRM' | translate"
      [nzCancelText]="'HELPDESK_SLA.CANCEL' | translate"
      [nzOkLoading]="busy()"
      (nzOnOk)="escalateRma()"
      (nzOnCancel)="rmaOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <p>{{ 'HELPDESK_SLA.RMA_CONFIRM' | translate }}</p>
        <label class="handoff-label" for="rma-serial">{{
          'HELPDESK_SLA.SERIAL_NUMBER' | translate
        }}</label>
        <input
          nz-input
          id="rma-serial"
          [ngModel]="serialNumber()"
          (ngModelChange)="serialNumber.set($event)"
          maxlength="100"
        />
        <label class="handoff-label" for="rma-symptom">{{
          'HELPDESK_SLA.REPORTED_SYMPTOM' | translate
        }}</label>
        <textarea
          nz-input
          id="rma-symptom"
          rows="3"
          [ngModel]="symptom()"
          (ngModelChange)="symptom.set($event)"
        ></textarea>
        <label for="ticket-handoff-field" nzId="ticket-handoff-field"
          nz-checkbox
          class="handoff-label"
          [ngModel]="goodwill()"
          (ngModelChange)="goodwill.set($event)"
        >
          {{ 'HELPDESK_SLA.GOODWILL' | translate }}
        </label>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .handoff {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .handoff-label {
      display: block;
      margin: var(--space-3) 0 var(--space-1);
      font-weight: 500;
    }
  `,
})
export class TicketHandoffComponent {
  private readonly api = inject(HelpdeskSlaApiService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly ticket = input.required<TicketResource>();
  /** Emitted when a work order or an RMA now exists for the ticket. */
  readonly handedOff = output<'field_service' | 'rma'>();

  protected readonly busy = signal(false);
  protected readonly rmaOpen = signal(false);
  protected readonly serialNumber = signal('');
  protected readonly symptom = signal('');
  protected readonly goodwill = signal(false);

  /** A closed or merged ticket cannot be handed off: the API answers 422, so the buttons are off up front. */
  protected readonly available = computed(
    () => this.ticket().status !== 'closed' && !this.ticket().merged_into_ticket_id,
  );

  protected confirmFieldService(): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('HELPDESK_SLA.ESCALATE_FIELD_SERVICE'),
      nzContent: this.i18n.translate('HELPDESK_SLA.FIELD_SERVICE_CONFIRM'),
      nzOkText: this.i18n.translate('HELPDESK_SLA.CONFIRM'),
      nzCancelText: this.i18n.translate('HELPDESK_SLA.CANCEL'),
      nzOnOk: () => this.escalateFieldService(),
    });
  }

  protected escalateFieldService(): void {
    this.busy.set(true);
    this.api.escalateToFieldService(this.ticket().id).subscribe({
      next: (result) => {
        this.busy.set(false);
        if (result.created) {
          this.message.success(this.i18n.translate('HELPDESK_SLA.FIELD_SERVICE_CREATED'));
        } else {
          this.message.info(this.i18n.translate('HELPDESK_SLA.ALREADY_HANDED_OFF'));
        }
        this.handedOff.emit('field_service');
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected escalateRma(): void {
    this.busy.set(true);
    this.api
      .escalateToRma(this.ticket().id, {
        serial_number: this.serialNumber().trim() || undefined,
        reported_symptom: this.symptom().trim() || undefined,
        goodwill: this.goodwill() || undefined,
      })
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.rmaOpen.set(false);
          if (result.created) {
            this.message.success(
              this.i18n.translate('HELPDESK_SLA.RMA_CREATED', {
                token: result.meta?.tracking_token ?? '',
              }),
            );
          } else {
            this.message.info(this.i18n.translate('HELPDESK_SLA.ALREADY_HANDED_OFF'));
          }
          this.handedOff.emit('rma');
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  /** 422 means the ticket cannot be handed off (closed, merged, or an RMA without a unit): the API says why. */
  private fail(err: unknown): void {
    this.busy.set(false);
    const unprocessable = err instanceof HttpErrorResponse && err.status === 422;
    const detail = messageOf(err);
    this.message.error(
      unprocessable && detail
        ? detail
        : this.i18n.translate(
            unprocessable ? 'HELPDESK_SLA.HANDOFF_REFUSED' : 'HELPDESK_SLA.HANDOFF_ERROR',
          ),
    );
  }
}
