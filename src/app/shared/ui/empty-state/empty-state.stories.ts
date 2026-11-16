import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from '../button/button.component';
import { EmptyStateComponent } from './empty-state.component';

const meta: Meta<EmptyStateComponent> = {
  title: 'Shared/EmptyState',
  component: EmptyStateComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [ButtonComponent] })],
  args: {
    heading: 'Nessuna fattura',
    description: 'Non hai ancora emesso fatture. Creane una per iniziare.',
    icon: 'fa-file-invoice',
  },
  render: (args) => ({
    props: args,
    template: `
      <app-empty-state [heading]="heading" [description]="description" [icon]="icon">
        <app-button>Nuova fattura</app-button>
      </app-empty-state>`,
  }),
};
export default meta;
type Story = StoryObj<EmptyStateComponent>;

export const WithAction: Story = {};
export const WithoutAction: Story = {
  render: (args) => ({
    props: args,
    template: `<app-empty-state [heading]="heading" [description]="description" [icon]="icon" />`,
  }),
};
export const HeadingOnly: Story = { args: { description: undefined, icon: undefined } };
