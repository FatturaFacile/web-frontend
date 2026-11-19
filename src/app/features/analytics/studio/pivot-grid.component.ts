import { Component, computed, inject, input, signal } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { PivotCell, PivotResult, PivotRow, PivotValueColumn } from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { TranslatePipe } from '@shared';
import { TOKEN_BACKGROUND, TOKEN_BACKGROUND_DARK, TOKEN_TEXT } from './studio-keys';

const REGIONAL_LOCALE: Record<string, string> = { it: 'it-CH', de: 'de-CH', fr: 'fr-CH', en: 'en' };

/** One value column of the grid body: which header it belongs to (`null` for the total column) and which value. */
interface GridColumn {
  header: number | null;
  value: PivotValueColumn;
}

/**
 * The pivot matrix as a table: sticky headers, groups that collapse to their subtotal row, subtotals and grand totals
 * as marked rows, and the conditional formatting tokens of the API applied to the cells. Colors come from fixed
 * palettes (never from the API as CSS), and white text always sits on the dark shade of its background.
 */
@Component({
  selector: 'app-pivot-grid',
  imports: [NzButtonModule, NzIconModule, TranslatePipe],
  styleUrl: './pivot-grid.component.scss',
  template: `
    @if (result(); as data) {
      <div class="grid-tools">
        @if (collapsibleGroups().length > 0) {
          <button nz-button nzSize="small" type="button" (click)="collapseAll()">
            {{ 'ANALYTICS_STUDIO.COLLAPSE_ALL' | translate }}
          </button>
          <button nz-button nzSize="small" type="button" (click)="expandAll()">
            {{ 'ANALYTICS_STUDIO.EXPAND_ALL' | translate }}
          </button>
        }
        @if (data.meta.truncated) {
          <span class="truncated" role="status">{{
            'ANALYTICS_STUDIO.TRUNCATED' | translate
          }}</span>
        }
      </div>
      <div
        class="scroller"
        tabindex="0"
        [attr.aria-label]="'ANALYTICS_STUDIO.PIVOT_GRID' | translate"
      >
        <table class="pivot" data-testid="pivot-grid">
          <thead>
            <tr>
              @for (dimension of data.row_dimensions; track dimension.key) {
                <th scope="col" class="dim" [attr.rowspan]="data.column_headers.length > 0 ? 2 : 1">
                  {{ dimension.label }}
                </th>
              }
              @if (data.row_dimensions.length === 0) {
                <th scope="col" class="dim" [attr.rowspan]="data.column_headers.length > 0 ? 2 : 1">
                  {{ 'ANALYTICS_STUDIO.TOTAL' | translate }}
                </th>
              }
              @if (data.column_headers.length > 0) {
                @for (header of data.column_headers; track header.index) {
                  <th scope="colgroup" class="group" [attr.colspan]="data.values.length">
                    {{ header.label }}
                  </th>
                }
                @if (data.has_total_column) {
                  <th scope="colgroup" class="group total" [attr.colspan]="data.values.length">
                    {{ 'ANALYTICS_STUDIO.TOTAL' | translate }}
                  </th>
                }
              } @else {
                @for (value of data.values; track value.key) {
                  <th scope="col" class="num">{{ value.label }}</th>
                }
              }
            </tr>
            @if (data.column_headers.length > 0) {
              <tr>
                @for (column of columns(); track column.header + ':' + column.value.key) {
                  <th scope="col" class="num sub" [class.total]="column.header === null">
                    {{ column.value.label }}
                  </th>
                }
              </tr>
            }
          </thead>
          <tbody>
            @for (row of visibleRows(); track rowKey(row)) {
              <tr [class]="'row-' + row.type" [attr.data-row-type]="row.type">
                @if (data.row_dimensions.length === 0) {
                  <th scope="row" class="label">{{ 'ANALYTICS_STUDIO.TOTAL' | translate }}</th>
                } @else {
                  @for (
                    dimension of data.row_dimensions;
                    track dimension.key;
                    let position = $index
                  ) {
                    <th scope="row" class="label" [style.padding-left.px]="8 + position * 12">
                      @if (cellText(row, position); as text) {
                        @if (row.type === 'subtotal' && position === row.level - 1) {
                          <button
                            type="button"
                            class="toggle"
                            [attr.aria-expanded]="!isCollapsed(row)"
                            [attr.aria-label]="
                              ('ANALYTICS_STUDIO.TOGGLE_GROUP' | translate) + ' ' + text
                            "
                            (click)="toggle(row)"
                          >
                            <span
                              nz-icon
                              [nzType]="isCollapsed(row) ? 'right' : 'down'"
                              nzTheme="outline"
                            ></span>
                          </button>
                        }
                        {{ text }}
                      }
                      @if (row.type === 'subtotal' && position === row.level) {
                        <em>{{ 'ANALYTICS_STUDIO.SUBTOTAL' | translate }}</em>
                      }
                      @if (row.type === 'grand_total' && position === 0) {
                        <strong>{{ 'ANALYTICS_STUDIO.GRAND_TOTAL' | translate }}</strong>
                      }
                    </th>
                  }
                }
                @if (data.column_headers.length > 0) {
                  @for (column of columns(); track column.header + ':' + column.value.key) {
                    <td
                      class="num"
                      [class.total]="column.header === null"
                      [style.background]="background(cellFor(row, column), column.value.key)"
                      [style.color]="textColor(cellFor(row, column), column.value.key)"
                    >
                      {{ formatted(cellFor(row, column), column.value) }}
                    </td>
                  }
                } @else {
                  @for (value of data.values; track value.key) {
                    <td
                      class="num"
                      [style.background]="background(row.total, value.key)"
                      [style.color]="textColor(row.total, value.key)"
                    >
                      {{ formatted(row.total, value) }}
                    </td>
                  }
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class PivotGridComponent {
  private readonly i18n = inject(I18nService);

  readonly result = input.required<PivotResult | null>();

  /** Groups collapsed to their subtotal row, by the JSON of their key path. */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  protected readonly columns = computed<GridColumn[]>(() => {
    const data = this.result();
    if (data === null) {
      return [];
    }
    const grouped = data.column_headers.flatMap((header) =>
      data.values.map((value) => ({ header: header.index, value })),
    );

    return data.has_total_column
      ? [...grouped, ...data.values.map((value) => ({ header: null, value }))]
      : grouped;
  });

  /** The paths of the groups that have a subtotal row to collapse to. */
  protected readonly collapsibleGroups = computed(() =>
    (this.result()?.rows ?? [])
      .filter((row) => row.type === 'subtotal')
      .map((row) => JSON.stringify(row.keys)),
  );

  protected readonly visibleRows = computed<PivotRow[]>(() => {
    const hidden = this.collapsed();
    if (hidden.size === 0) {
      return this.result()?.rows ?? [];
    }
    const paths = [...hidden].map((path) => JSON.parse(path) as (string | null)[]);

    return (this.result()?.rows ?? []).filter(
      (row) =>
        !paths.some(
          (path) =>
            row.keys.length > path.length && path.every((part, index) => row.keys[index] === part),
        ),
    );
  });

  protected rowKey(row: PivotRow): string {
    return `${row.type}:${JSON.stringify(row.keys)}`;
  }

  protected cellText(row: PivotRow, position: number): string {
    if (row.type === 'grand_total' || position >= row.keys.length) {
      return '';
    }
    const key = row.keys[position];

    return key === null || key === '' ? '-' : key;
  }

  protected isCollapsed(row: PivotRow): boolean {
    return this.collapsed().has(JSON.stringify(row.keys));
  }

  toggle(row: PivotRow): void {
    const path = JSON.stringify(row.keys);
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  }

  collapseAll(): void {
    this.collapsed.set(new Set(this.collapsibleGroups()));
  }

  expandAll(): void {
    this.collapsed.set(new Set());
  }

  protected cellFor(row: PivotRow, column: GridColumn): PivotCell | null {
    return column.header === null ? row.total : (row.cells[column.header] ?? null);
  }

  protected formatted(cell: PivotCell | null, value: PivotValueColumn): string {
    const raw = cell?.values[value.key];
    if (raw === null || raw === undefined || raw === '') {
      return '';
    }
    const number = Number(raw);
    if (Number.isNaN(number)) {
      return String(raw);
    }
    const locale = REGIONAL_LOCALE[this.i18n.currentLanguage()] ?? 'en';
    const digits = value.format === 'integer' ? 0 : 2;
    const text = new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(number);

    return value.format === 'percentage' ? `${text} %` : text;
  }

  protected background(cell: PivotCell | null, key: string): string | null {
    const style = cell?.styles[key];
    if (style === undefined || style.background === 'none') {
      return null;
    }

    return (
      (style.text === 'white' ? TOKEN_BACKGROUND_DARK : TOKEN_BACKGROUND)[style.background] ?? null
    );
  }

  protected textColor(cell: PivotCell | null, key: string): string | null {
    const style = cell?.styles[key];

    return style === undefined || style.text === 'default'
      ? null
      : (TOKEN_TEXT[style.text] ?? null);
  }
}
