import { Component, computed, input } from '@angular/core';
import { BiPivotResult } from '@core';
import { TranslatePipe } from '@shared';
import { formatBiValue } from './bi.util';

/**
 * A pivot table: the row dimensions down the left, the members of the column dimensions across the top, one cell per measure.
 * Totals are shown for the measures that can be added up; the others show a dash, never a wrong number.
 */
@Component({
  selector: 'app-bi-pivot-table',
  imports: [TranslatePipe],
  template: `
    @if (pivot(); as table) {
      <div class="bi-pivot-scroll">
        <table class="bi-pivot">
          <thead>
            @if (table.columns.length > 0 && table.column_dimensions.length > 0) {
              <tr>
                <th [attr.colspan]="table.row_dimensions.length" scope="col">{{ columnTitle() }}</th>
                @for (column of table.columns; track $index) {
                  <th [attr.colspan]="table.values.length" scope="colgroup">{{ memberLabel(column.members) }}</th>
                }
                <th [attr.colspan]="table.values.length" scope="colgroup">{{ 'BI.TOTAL' | translate }}</th>
              </tr>
            }
            <tr>
              @for (dimension of table.row_dimensions; track dimension.key) {
                <th scope="col">{{ dimension.label }}</th>
              }
              @for (column of table.columns; track $index) {
                @for (value of table.values; track value.key) {
                  <th scope="col" class="num">{{ value.label }}</th>
                }
              }
              @for (value of table.values; track value.key) {
                <th scope="col" class="num">{{ value.label }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of table.rows; track $index) {
              <tr>
                @for (member of row.members; track $index) {
                  <th scope="row">{{ member ?? '-' }}</th>
                }
                @for (column of table.columns; track $index; let columnIndex = $index) {
                  @for (value of table.values; track value.key) {
                    <td class="num">{{ cell(row.cells[columnIndex + ''], value.key, value.unit) }}</td>
                  }
                }
                @for (value of table.values; track value.key) {
                  <td class="num total">{{ total(row.totals[value.key], value.unit) }}</td>
                }
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <th [attr.colspan]="table.row_dimensions.length" scope="row">{{ 'BI.TOTAL' | translate }}</th>
              @for (column of table.columns; track $index; let columnIndex = $index) {
                @for (value of table.values; track value.key) {
                  <td class="num total">{{ total(table.column_totals[columnIndex + '']?.[value.key], value.unit) }}</td>
                }
              }
              @for (value of table.values; track value.key) {
                <td class="num total">{{ total(table.grand_totals[value.key], value.unit) }}</td>
              }
            </tr>
          </tfoot>
        </table>
      </div>
    }
  `,
  styles: `
    .bi-pivot-scroll { overflow: auto; max-height: 100%; }
    .bi-pivot { border-collapse: collapse; font-size: 13px; width: 100%; }
    .bi-pivot th, .bi-pivot td { border: 1px solid var(--ff-color-border); padding: 4px 8px; white-space: nowrap; text-align: left; }
    .bi-pivot thead th { background: var(--ff-color-surface-alt); }
    .bi-pivot .num { text-align: right; font-variant-numeric: tabular-nums; }
    .bi-pivot .total, .bi-pivot tfoot th { font-weight: 600; }
  `,
})
export class BiPivotTableComponent {
  readonly pivot = input<BiPivotResult | null>(null);

  readonly columnTitle = computed(() => this.pivot()?.column_dimensions.map((dimension) => dimension.label).join(' / ') ?? '');

  memberLabel(members: (string | null)[]): string {
    return members.map((member) => member ?? '-').join(' / ');
  }

  cell(values: Record<string, string | number | null> | undefined, key: string, unit: string | null): string {
    return values === undefined ? '' : formatBiValue(values[key], unit as never);
  }

  total(value: string | number | null | undefined, unit: string | null): string {
    return value === null || value === undefined ? '-' : formatBiValue(value, unit as never);
  }
}
