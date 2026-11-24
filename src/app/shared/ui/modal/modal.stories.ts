import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from '../button/button.component';
import { ModalComponent } from './modal.component';

const meta: Meta<ModalComponent> = {
  title: 'Shared/Modal',
  component: ModalComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [ButtonComponent] })],
  argTypes: { placement: { control: 'select', options: ['center', 'end'] } },
  args: { open: true, heading: 'Elimina fattura', placement: 'center' },
  render: (args) => ({
    props: args,
    template: `
      <app-modal [(open)]="open" [heading]="heading" [placement]="placement">
        <p>La fattura 2026/001 verrà eliminata definitivamente. L'operazione non può essere annullata.</p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <app-button variant="secondary" (click)="open = false">Annulla</app-button>
          <app-button variant="danger" (click)="open = false">Elimina</app-button>
        </div>
      </app-modal>`,
  }),
};
export default meta;
type Story = StoryObj<ModalComponent>;

export const Center: Story = {};
export const Drawer: Story = { args: { placement: 'end', heading: 'Dettaglio fattura' } };
