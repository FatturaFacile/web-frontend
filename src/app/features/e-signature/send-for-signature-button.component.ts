import { Component, computed, inject, input } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { EsigSignableType, PermissionsService, SignatureRequestService } from '@core';
import { TranslatePipe } from '@shared';
import { ESIG_MODULE } from './e-signature.util';

/**
 * "Send for signature" button for the detail pages of quotes, purchase orders, employment contracts and documents. It opens
 * the wizard mounted in the shell; it is hidden for users who cannot start a signature.
 */
@Component({
  selector: 'app-send-for-signature-button',
  imports: [NzButtonModule, TranslatePipe],
  template: `
    @if (allowed()) {
      <button
        nz-button
        type="button"
        data-test="send-for-signature"
        [disabled]="disabled()"
        (click)="open()"
      >
        {{ 'signatures.action.sendForSignature' | translate }}
      </button>
    }
  `,
})
export class SendForSignatureButtonComponent {
  readonly signableType = input.required<EsigSignableType>();
  readonly signableId = input.required<string | null>();
  readonly label = input<string | null>(null);
  readonly amount = input<string | null>(null);
  readonly currency = input<string | null>(null);
  readonly disabled = input(false);

  private readonly permissions = inject(PermissionsService);
  private readonly requests = inject(SignatureRequestService);

  protected readonly allowed = computed(() => this.permissions.canWrite(ESIG_MODULE));

  protected open(): void {
    const id = this.signableId();
    if (id === null) {
      return;
    }
    this.requests.open({
      signableType: this.signableType(),
      signableId: id,
      label: this.label(),
      amount: this.amount(),
      currency: this.currency(),
    });
  }
}
