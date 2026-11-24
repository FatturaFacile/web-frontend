import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { FormFieldComponent } from '../form-field/form-field.component';
import { InputComponent } from './input.component';

const meta: Meta<InputComponent> = {
  title: 'Shared/Input',
  component: InputComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [FormFieldComponent] })],
  args: { value: '', type: 'text', placeholder: 'Ragione sociale', disabled: false },
  argTypes: {
    type: { control: 'select', options: ['text', 'email', 'password', 'search', 'tel', 'url', 'number'] },
  },
  render: (args) => ({
    props: args,
    template: `
      <app-form-field label="Ragione sociale">
        <app-input [value]="value" [type]="type" [placeholder]="placeholder" [disabled]="disabled" />
      </app-form-field>`,
  }),
};
export default meta;
type Story = StoryObj<InputComponent>;

export const Default: Story = {};
export const Filled: Story = { args: { value: 'Rossi S.r.l.' } };
export const Email: Story = { args: { type: 'email', placeholder: 'nome@azienda.it' } };
export const Disabled: Story = { args: { value: 'Non modificabile', disabled: true } };
export const WithError: Story = {
  render: () => ({
    template: `
      <app-form-field label="Email" error="Inserisci un indirizzo email valido." required>
        <app-input type="email" value="non-una-email" />
      </app-form-field>`,
  }),
};
export const StandaloneWithAriaLabel: Story = {
  render: () => ({
    template: `<app-input type="search" placeholder="Cerca" ariaLabel="Cerca fatture" />`,
  }),
};
