import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';

const meta: Meta<BadgeComponent> = {
  title: 'Shared/Badge',
  component: BadgeComponent,
  tags: ['autodocs'],
  args: { tone: 'neutral' },
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'primary', 'info', 'success', 'warning', 'danger'] },
  },
  render: (args) => ({ props: args, template: `<app-badge [tone]="tone">Bozza</app-badge>` }),
};
export default meta;
type Story = StoryObj<BadgeComponent>;

export const Neutral: Story = {};
export const AllTones: Story = {
  render: () => ({
    template: `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <app-badge tone="neutral">Bozza</app-badge>
        <app-badge tone="primary">Emessa</app-badge>
        <app-badge tone="info">In invio</app-badge>
        <app-badge tone="success">Pagata</app-badge>
        <app-badge tone="warning">In scadenza</app-badge>
        <app-badge tone="danger">Scartata</app-badge>
      </div>`,
  }),
};
