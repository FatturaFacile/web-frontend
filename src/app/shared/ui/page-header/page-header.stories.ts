import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { PageHeaderComponent } from './page-header.component';

const meta: Meta<PageHeaderComponent> = {
  title: 'Shared/PageHeader',
  component: PageHeaderComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [NzButtonModule] })],
  args: { title: 'Fatture di vendita', subtitle: 'Emesse e in attesa di invio allo SDI' },
};
export default meta;
type Story = StoryObj<PageHeaderComponent>;

export const TitleOnly: Story = { args: { subtitle: undefined } };

export const WithSubtitle: Story = {};

export const WithActions: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-page-header [title]="title" [subtitle]="subtitle">
        <div header-actions>
          <button nz-button nzType="default">Esporta</button>
          <button nz-button nzType="primary">Nuova fattura</button>
        </div>
      </app-page-header>`,
  }),
};
