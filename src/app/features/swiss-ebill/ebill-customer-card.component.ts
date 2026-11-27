import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  EBILL_LOOKUP_TYPES,
  EbillCustomerData,
  EbillLookupType,
  PermissionsService,
  TranslateService,
} from '@core';
import { TranslatePipe } from '@shared';
import { EbillBadgeComponent } from './ebill-badge.component';
import { CustomerEbillStore } from './customer-ebill.store';
import { EbillOutcome, SWISS_EBILL_MODULE } from './swiss-ebill.util';

/**
 * eBill card of a customer: enrollment badge, verification against the SIX / PostFinance participant directory, a free lookup by
 * UID, email, IBAN or participant id and the manual link of the matched participant.
 */
@Component({
  selector: 'app-ebill-customer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    EbillBadgeComponent,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    TranslatePipe,
  ],
  providers: [CustomerEbillStore],
  styleUrl: './swiss-ebill.scss',
  template: `
    <section class="panel">
      <h3>{{ 'swissEbill.section.customerCard' | translate }}</h3>
      @let current = store.customer();
      <div class="connection">
        <app-ebill-badge
          [participant]="current?.ebill_status ?? 'unknown'"
          [channel]="current?.ebill_channel_type"
        ></app-ebill-badge>
        @if (current?.ebill_recipient_id; as recipient) {
          <span>{{ 'swissEbill.field.recipientId' | translate }}: {{ recipient }}</span>
        }
        @if (current?.ebill_verified_at; as verified) {
          <span
            >{{ 'swissEbill.field.verifiedAt' | translate }}: {{ verified | date: 'short' }}</span
          >
        }
      </div>

      @if (current?.ebill_status === 'unknown') {
        <p class="hint">{{ 'swissEbill.empty.directory' | translate }}</p>
      }

      @if (canWrite) {
        <div class="actions">
          <button
            nz-button
            type="button"
            data-test="verify"
            [nzLoading]="store.working()"
            (click)="verify(false)"
          >
            {{ 'swissEbill.action.checkDirectory' | translate }}
          </button>
          <button
            nz-button
            type="button"
            data-test="force"
            [disabled]="store.working()"
            (click)="verify(true)"
          >
            {{ 'swissEbill.action.forceRefresh' | translate }}
          </button>
        </div>

        <div class="toolbar">
          <label class="field" for="eb-lookup-type">
            <span>{{ 'swissEbill.action.lookup' | translate }}</span>
            <nz-select nzId="eb-lookup-type" [(ngModel)]="lookupType">
              @for (type of lookupTypes; track type) {
                <nz-option
                  [nzValue]="type"
                  [nzLabel]="'swissEbill.lookupType.' + type | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="eb-lookup-value">
            <span>{{ 'swissEbill.field.lookupValue' | translate }}</span>
            <input nz-input id="eb-lookup-value" [(ngModel)]="lookupValue" />
          </label>
          <button
            nz-button
            type="button"
            data-test="lookup"
            [disabled]="lookupValue.trim() === '' || store.working()"
            (click)="lookup()"
          >
            {{ 'swissEbill.action.lookup' | translate }}
          </button>
        </div>
      }

      @if (store.participant(); as participant) {
        <nz-alert
          data-test="participant"
          nzType="success"
          nzShowIcon
          [nzMessage]="'swissEbill.section.matchedParticipant' | translate"
          [nzDescription]="matched"
        ></nz-alert>
        <ng-template #matched>
          <div>{{ participant.display_name }} · {{ participant.participant_id }}</div>
          <div>
            {{ 'swissEbill.participant.' + participant.status | translate }}
            @if (participant.channel_type) {
              · {{ 'swissEbill.channel.' + participant.channel_type | translate }}
            }
          </div>
          @if (canWrite) {
            <button
              nz-button
              nzSize="small"
              type="button"
              data-test="link"
              (click)="link(participant.participant_id)"
            >
              {{ 'swissEbill.action.link' | translate }}
            </button>
          }
        </ng-template>
      } @else if (store.looked()) {
        <nz-alert
          nzType="info"
          nzShowIcon
          [nzMessage]="'swissEbill.toast.participantNotFound' | translate"
        ></nz-alert>
      }
    </section>
  `,
})
export class EbillCustomerCardComponent {
  readonly customerId = input.required<string>();
  readonly customer = input<EbillCustomerData | null>(null);
  /** Emitted with the refreshed eBill columns after a verification or a link. */
  readonly updated = output<EbillCustomerData>();

  protected readonly store = inject(CustomerEbillStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  protected readonly canWrite = inject(PermissionsService).canWrite(SWISS_EBILL_MODULE);
  protected readonly lookupTypes = EBILL_LOOKUP_TYPES;
  protected lookupType: EbillLookupType = 'uid';
  protected lookupValue = '';

  constructor() {
    effect(() => {
      this.store.init(this.customer());
    });
  }

  protected async verify(force: boolean): Promise<void> {
    this.report(await this.store.sync(this.customerId(), force), 'swissEbill.toast.customerSynced');
  }

  protected async lookup(): Promise<void> {
    const outcome = await this.store.lookup({
      lookup_type: this.lookupType,
      lookup_value: this.lookupValue.trim(),
    });
    this.report(
      outcome,
      this.store.participant()
        ? 'swissEbill.toast.participantFound'
        : 'swissEbill.toast.participantNotFound',
    );
  }

  protected async link(participantId: string): Promise<void> {
    this.report(
      await this.store.link(this.customerId(), participantId),
      'swissEbill.toast.customerLinked',
    );
  }

  private report(outcome: EbillOutcome, successKey: string): void {
    if (outcome.ok) {
      this.message.success(this.i18n.instant(successKey));
      const customer = this.store.customer();
      if (customer) {
        this.updated.emit(customer);
      }
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'swissEbill.error.unknown'));
    }
  }
}
