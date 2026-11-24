import type { Meta, StoryObj } from '@storybook/angular';
import { CardComponent } from './card.component';

const meta: Meta<CardComponent> = {
  title: 'Shared/Card',
  component: CardComponent,
  tags: ['autodocs'],
  args: { heading: 'Fatturato del mese' },
  render: (args) => ({
    props: args,
    template: `<app-card [heading]="heading"><p style="margin:0">€ 48.250,00, +12% rispetto al mese scorso.</p></app-card>`,
  }),
};
export default meta;
type Story = StoryObj<CardComponent>;

export const WithHeading: Story = {};
export const WithoutHeading: Story = { args: { heading: undefined } };
