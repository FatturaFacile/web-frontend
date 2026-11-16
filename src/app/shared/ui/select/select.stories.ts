import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { FormFieldComponent } from '../form-field/form-field.component';
import { SelectComponent } from './select.component';

const options = [
  { value: '22', label: 'IVA 22%' },
  { value: '10', label: 'IVA 10%' },
  { value: '4', label: 'IVA 4%' },
  { value: '0', label: 'Esente', disabled: true },
];

const meta: Meta<SelectComponent> = {
  title: 'Shared/Select',
  component: SelectComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [FormFieldComponent] })],
  args: { value: '', options, placeholder: 'Seleziona aliquota', disabled: false },
  render: (args) => ({
    props: args,
    template: `
      <app-form-field label="Aliquota">
        <app-select [value]="value" [options]="options" [placeholder]="placeholder" [disabled]="disabled" />
      </app-form-field>`,
  }),
};
export default meta;
type Story = StoryObj<SelectComponent>;

export const Default: Story = {};
export const Selected: Story = { args: { value: '22' } };
export const Disabled: Story = { args: { value: '22', disabled: true } };
export const WithError: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-form-field label="Aliquota" error="Seleziona un'aliquota." required>
        <app-select [value]="value" [options]="options" [placeholder]="placeholder" />
      </app-form-field>`,
  }),
};
