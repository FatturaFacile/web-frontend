import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { EbillChannelType, EbillParticipantStatus, EbillTransmissionStatus } from '@core';
import { TranslatePipe } from '@shared';
import { badgeColor, badgeKey, statusColor } from './swiss-ebill.util';

/**
 * Compact eBill tag: either the enrollment of a customer (`participant` + `channel`) or the transmission status of an invoice (`status`).
 * Renders nothing for an invoice that was never sent via eBill.
 */
@Component({
  selector: 'app-ebill-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzTagModule, TranslatePipe],
  template: `
    @if (status(); as s) {
      <nz-tag [nzColor]="statusTag()" data-test="ebill-status">
        {{ 'swissEbill.status.' + s | translate }}
      </nz-tag>
    } @else if (showParticipant()) {
      <nz-tag [nzColor]="participantTag()" data-test="ebill-badge">
        {{ 'swissEbill.badge.' + key() | translate }}
      </nz-tag>
    }
  `,
})
export class EbillBadgeComponent {
  /** Transmission status of an invoice. */
  readonly status = input<EbillTransmissionStatus | null | undefined>(null);
  /** Enrollment of a customer. */
  readonly participant = input<EbillParticipantStatus | null | undefined>(undefined);
  readonly channel = input<EbillChannelType | null | undefined>(null);

  protected readonly showParticipant = computed(() => this.participant() !== undefined);
  protected readonly statusTag = computed(() => statusColor(this.status()));
  protected readonly participantTag = computed(() => badgeColor(this.participant()));
  protected readonly key = computed(() => badgeKey(this.participant(), this.channel()));
}
