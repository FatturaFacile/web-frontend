import type { Meta, StoryObj } from '@storybook/angular';
import { AlertComponent } from './alert.component';

const meta: Meta<AlertComponent> = {
  title: 'Shared/Alert',
  component: AlertComponent,
  tags: ['autodocs'],
  args: { tone: 'info', heading: 'Informazione' },
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'primary', 'info', 'success', 'warning', 'danger'] },
  },
  render: (args) => ({
    props: args,
    template: `<app-alert [tone]="tone" [heading]="heading">La fattura verrà inviata allo SDI entro la giornata.</app-alert>`,
  }),
};
export default meta;
type Story = StoryObj<AlertComponent>;

export const Info: Story = {};
export const Success: Story = { args: { tone: 'success', heading: 'Fattura inviata' } };
export const Warning: Story = { args: { tone: 'warning', heading: 'Scadenza vicina' } };
export const Danger: Story = { args: { tone: 'danger', heading: 'Invio non riuscito' } };
export const WithoutHeading: Story = { args: { heading: undefined } };
