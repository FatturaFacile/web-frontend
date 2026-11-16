import type { Meta, StoryObj } from '@storybook/angular';
import { DataTableComponent } from './data-table.component';

const columns = [
  { key: 'number', label: 'Numero' },
  { key: 'customer', label: 'Cliente' },
  { key: 'total', label: 'Totale', align: 'end' as const },
];
const rows = [
  { number: '2026/001', customer: 'Rossi S.r.l.', total: '1.220,00' },
  { number: '2026/002', customer: 'Bianchi & C.', total: '480,50' },
  { number: '2026/003', customer: 'Verdi SpA', total: '15.900,00' },
];

const meta: Meta<DataTableComponent> = {
  title: 'Shared/DataTable',
  component: DataTableComponent,
  tags: ['autodocs'],
  args: { caption: 'Ultime fatture emesse', captionHidden: false, columns, rows },
};
export default meta;
type Story = StoryObj<DataTableComponent>;

export const Default: Story = {};
export const HiddenCaption: Story = { args: { captionHidden: true } };
export const Empty: Story = {
  args: { rows: [] },
  render: (args) => ({
    props: args,
    template: `
      <app-data-table [caption]="caption" [columns]="columns" [rows]="rows">
        <p appDataTableEmpty style="margin:0">Nessuna fattura da mostrare.</p>
      </app-data-table>`,
  }),
};
