import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { ACTION_ICONS } from './action-icon';
import { IconActionDirective } from './icon-action.directive';

const names = Object.keys(ACTION_ICONS);

const meta: Meta = {
  title: 'Shared/IconAction',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [NzButtonModule, IconActionDirective] })],
  args: { action: 'save' },
  argTypes: { action: { control: 'select', options: names } },
  render: (args) => ({
    props: args,
    template: `<button nz-button nzType="primary" [appIconAction]="action"></button>`,
  }),
};
export default meta;
type Story = StoryObj;

export const Single: Story = {};
export const AllActions: Story = {
  render: () => ({
    props: { names },
    template: `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        @for (n of names; track n) {
          <button nz-button [appIconAction]="n"></button>
        }
      </div>`,
  }),
};
