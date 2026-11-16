import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';

const meta: Meta<ButtonComponent> = {
  title: 'Shared/Button',
  component: ButtonComponent,
  tags: ['autodocs'],
  args: { variant: 'primary', type: 'button', disabled: false, loading: false, block: false },
  argTypes: { variant: { control: 'select', options: ['primary', 'secondary', 'danger', 'ghost'] } },
  render: (args) => ({
    props: args,
    template: `<app-button [variant]="variant" [type]="type" [disabled]="disabled" [loading]="loading" [block]="block">Emetti fattura</app-button>`,
  }),
};
export default meta;
type Story = StoryObj<ButtonComponent>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Danger: Story = { args: { variant: 'danger' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true } };
export const Block: Story = { args: { block: true } };
export const IconOnly: Story = {
  render: () => ({
    template: `<app-button variant="secondary" ariaLabel="Aggiungi riga"><i class="fa-solid fa-plus" aria-hidden="true"></i></app-button>`,
  }),
};
