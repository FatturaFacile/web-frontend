import { Component, inject } from '@angular/core';
import { SignatureRequestService } from '@core/services/signature-request.service';
import { SendForSignatureDrawerComponent } from './send-for-signature-drawer.component';

/** Mounted once in the application shell: shows the send-for-signature wizard for whatever page asked for it. */
@Component({
  selector: 'app-signature-request-host',
  imports: [SendForSignatureDrawerComponent],
  template: `
    @if (service.request(); as request) {
      @defer (when service.request() !== null) {
        <app-send-for-signature-drawer
          [open]="true"
          [signableType]="request.signableType"
          [signableId]="request.signableId"
          [documentLabel]="request.label"
          [amount]="request.amount"
          [currency]="request.currency"
          (closed)="service.close()"
          (created)="onCreated()"
        ></app-send-for-signature-drawer>
      }
    }
  `,
})
export class SignatureRequestHostComponent {
  protected readonly service = inject(SignatureRequestService);

  protected onCreated(): void {
    this.service.notifyCreated();
    this.service.close();
  }
}
