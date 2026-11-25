import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { PtrWelcomeSign } from '@core';
import { TranslatePipe } from '@shared';

/**
 * The VIP meet and greet sign of the airport arrivals hall: the guest name in very large type with the logo of the hotel or agency,
 * full screen so the driver can hold up the tablet. Escape or the close button leaves it.
 */
@Component({
  selector: 'app-ptr-welcome-sign',
  imports: [NzButtonModule, TranslatePipe],
  styleUrl: './passenger-transport.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div
      class="welcome-screen"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="'passengerTransport.section.welcomeSign' | translate"
    >
      <button #closeButton nz-button class="close" type="button" (click)="closed.emit()">
        {{ 'passengerTransport.action.close' | translate }}
      </button>
      @if (sign().logo_data_uri; as logo) {
        <img [src]="logo" [alt]="'passengerTransport.field.logo' | translate" />
      }
      <div class="greeting">{{ sign().greeting }}</div>
      <div class="guest">{{ sign().text }}</div>
    </div>
  `,
})
export class WelcomeSignComponent {
  readonly sign = input.required<PtrWelcomeSign>();
  readonly closed = output<void>();

  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');

  constructor() {
    afterNextRender(() => this.closeButton().nativeElement.focus());
  }
}
