import { Component, computed, input, signal } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { SfJurisdiction, SfLine } from '@core';
import { TranslatePipe } from '@shared';
import { formatAmount, isStrong, statementRows } from './statutory-financials.util';

/**
 * A statement (balance sheet, income statement or cash flow) as an indented table built from its flat lines: level
 * indentation, bold totals, current and comparative columns, rounding lines highlighted with a tag.
 */
@Component({
  selector: 'app-sf-statement-table',
  imports: [NzTableModule, NzTagModule, TranslatePipe],
  styleUrl: './statutory-financials.scss',
  template: `
    <nz-table
      class="statement-table"
      nzSize="small"
      [nzData]="rows()"
      [nzFrontPagination]="false"
      [nzShowPagination]="false"
      [nzScroll]="{ x: '520px' }"
    >
      <caption class="visually-hidden">
        {{
          caption()
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ 'statutoryFinancials.statement.line' | translate }}</th>
          <th scope="col" class="num">{{ currentLabel() }}</th>
          @if (showComparative()) {
            <th scope="col" class="num">{{ comparativeLabel() }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.line.code) {
          <tr [class.rounding-row]="row.line.is_rounding">
            <th scope="row" [class.strong]="strong(row.line)">
              <span class="line-label" [style.padding-left.px]="row.depth * 20">
                @if (row.hasChildren) {
                  <button
                    type="button"
                    class="toggle"
                    [attr.aria-expanded]="!collapsed().has(row.line.code)"
                    [attr.aria-label]="
                      ('statutoryFinancials.action.toggleLine' | translate) + ' ' + row.line.label
                    "
                    (click)="toggle(row.line.code)"
                  >
                    {{ collapsed().has(row.line.code) ? '+' : '-' }}
                  </button>
                } @else {
                  <span class="toggle-placeholder" aria-hidden="true"></span>
                }
                <span>{{ row.line.label }}</span>
                @if (row.line.is_rounding) {
                  <nz-tag nzColor="gold">{{
                    'statutoryFinancials.statement.roundingTag' | translate
                  }}</nz-tag>
                }
              </span>
            </th>
            <td class="num" [class.strong]="strong(row.line)">{{ amount(row.line.amount) }}</td>
            @if (showComparative()) {
              <td class="num" [class.strong]="strong(row.line)">
                {{ amount(row.line.comparative_amount) }}
              </td>
            }
          </tr>
        } @empty {
          <tr>
            <td [attr.colspan]="showComparative() ? 3 : 2">
              {{ 'statutoryFinancials.empty.lines' | translate }}
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class StatementTableComponent {
  readonly lines = input.required<readonly SfLine[]>();
  readonly jurisdiction = input<SfJurisdiction>('IT');
  /** Fraction digits: 0 for a dossier rounded to whole units, 2 for exact cents. */
  readonly scale = input<number>(2);
  readonly showComparative = input<boolean>(true);
  readonly caption = input<string>('');
  readonly currentLabel = input<string>('');
  readonly comparativeLabel = input<string>('');

  protected readonly collapsed = signal<ReadonlySet<string>>(new Set<string>());
  protected readonly rows = computed(() => statementRows(this.lines(), this.collapsed()));
  protected readonly strong = isStrong;

  protected amount(value: string | null): string {
    return formatAmount(value, this.jurisdiction(), this.scale());
  }

  protected toggle(code: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (!next.delete(code)) {
        next.add(code);
      }
      return next;
    });
  }
}
