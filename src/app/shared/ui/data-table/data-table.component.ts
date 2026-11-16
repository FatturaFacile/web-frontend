import { Component, computed, input } from '@angular/core';

export interface DataTableColumn {
  readonly key: string;
  /** The column heading (already translated). */
  readonly label: string;
  /** Numbers and amounts align to the end. */
  readonly align?: 'start' | 'end';
}

export type DataTableRow = Readonly<Record<string, string | number | null | undefined>>;

/**
 * A semantic, read-only table: a caption names it for screen readers, headers have `scope="col"`, and the row height
 * follows the UI density. Use the NG-ZORRO table for sorting, selection and virtual scrolling; this wrapper is for
 * compact summaries and for places that need no more than a native table.
 */
@Component({
  selector: 'app-data-table',
  template: `
    <div class="scroller" [attr.tabindex]="0" role="region" [attr.aria-label]="caption()">
      <table class="table">
        <caption [class.ff-visually-hidden]="captionHidden()">
          {{
            caption()
          }}
        </caption>
        <thead>
          <tr>
            @for (column of columns(); track column.key) {
              <th scope="col" [class.end]="column.align === 'end'">{{ column.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track $index) {
            <tr>
              @for (column of columns(); track column.key) {
                <td [class.end]="column.align === 'end'">{{ cell(row, column.key) }}</td>
              }
            </tr>
          } @empty {
            <tr>
              <td class="empty" [attr.colspan]="columnCount()">
                <ng-content select="[appDataTableEmpty]" />
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .scroller {
      overflow-x: auto;
      border: 1px solid var(--ff-color-border);
      border-radius: var(--ff-radius-lg);
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      background: var(--ff-color-surface);
      color: var(--ff-color-text);
      font-size: var(--ff-density-font-size);
    }

    caption {
      padding: var(--ff-space-3) var(--ff-density-gap);
      color: var(--ff-color-text-secondary);
      font-weight: 600;
      text-align: start;
    }

    th,
    td {
      height: var(--ff-density-row-height);
      padding: 0 var(--ff-density-gap);
      border-bottom: 1px solid var(--ff-color-border-subtle);
      text-align: start;
    }

    th {
      background: var(--ff-color-surface-alt);
      color: var(--ff-color-text-secondary);
      font-size: var(--ff-font-size-xs);
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .end {
      text-align: end;
      font-variant-numeric: tabular-nums;
    }

    tbody tr:hover td {
      background: var(--ff-color-hover);
    }

    .empty {
      height: auto;
      text-align: center;
    }
  `,
})
export class DataTableComponent {
  /** Names the table; required for screen readers. */
  readonly caption = input.required<string>();
  readonly captionHidden = input(false);
  readonly columns = input.required<readonly DataTableColumn[]>();
  readonly rows = input.required<readonly DataTableRow[]>();

  protected readonly columnCount = computed(() => this.columns().length);

  protected cell(row: DataTableRow, key: string): string {
    const value = row[key];
    return value === null || value === undefined ? '' : String(value);
  }
}
