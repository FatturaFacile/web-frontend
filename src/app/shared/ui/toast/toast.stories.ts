import { Component, inject } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from '../button/button.component';
import { ToastHostComponent } from './toast-host.component';
import { ToastService } from './toast.service';

/** Pulsanti che usano `ToastService`; gli errori restano finché non vengono chiusi (WCAG 2.2.1). */
@Component({
  selector: 'app-toast-playground',
  imports: [ButtonComponent, ToastHostComponent],
  template: `
    <app-toast-host />
    <div style="display: flex; gap: 8px; flex-wrap: wrap">
      <app-button (click)="toasts.success('Fattura salvata.')">Successo</app-button>
      <app-button variant="danger" (click)="toasts.error('Invio allo SDI non riuscito.')">
        Errore
      </app-button>
      <app-button variant="secondary" (click)="toasts.show('Sincronizzazione in corso…')">
        Info
      </app-button>
      <app-button
        variant="secondary"
        (click)="toasts.show('Scadenza tra 3 giorni.', { tone: 'warning' })"
      >
        Avviso
      </app-button>
    </div>
  `,
})
class ToastPlaygroundComponent {
  protected readonly toasts = inject(ToastService);
}

const meta: Meta<ToastPlaygroundComponent> = {
  title: 'Shared/Toast',
  component: ToastPlaygroundComponent,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<ToastPlaygroundComponent>;

export const Playground: Story = {};
