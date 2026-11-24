import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { InputComponent } from '../input/input.component';
import { FormFieldComponent } from './form-field.component';

const meta: Meta<FormFieldComponent> = {
  title: 'Shared/FormField',
  component: FormFieldComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [InputComponent] })],
  args: { label: 'Partita IVA', hint: '11 cifre, senza prefisso IT', error: null, required: false },
  render: (args) => ({
    props: args,
    template: `
      <app-form-field [label]="label" [hint]="hint" [error]="error" [required]="required">
        <app-input inputmode="numeric" />
      </app-form-field>`,
  }),
};
export default meta;
type Story = StoryObj<FormFieldComponent>;

export const WithHint: Story = {};
export const Required: Story = { args: { required: true } };
export const WithError: Story = {
  args: { required: true, error: 'La partita IVA deve avere 11 cifre.' },
};
export const LabelOnly: Story = { args: { hint: undefined } };
