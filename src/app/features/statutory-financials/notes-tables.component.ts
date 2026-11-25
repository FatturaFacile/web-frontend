import { Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { SfMaturityBuckets, SfNotesTableName, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import {
  emptyNotesRow,
  isDecimal,
  MATURITY_BUCKETS,
  MATURITY_GROUPS,
  MaturityBucket,
  MaturityGroup,
  NOTES_TABLE_COLUMNS,
  removeRow,
  updateRow,
} from './statutory-financials.util';

type Row = Record<string, unknown>;

/** An editable table of the notes: one input per cell, rows added and removed where the table allows it. */
@Component({
  selector: 'app-sf-notes-rows-table',
  imports: [
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
  ],
  styleUrl: './statutory-financials.scss',
  template: `
    <nz-table
      nzSize="small"
      [nzData]="rows()"
      [nzFrontPagination]="false"
      [nzShowPagination]="false"
      [nzScroll]="{ x: scrollWidth() }"
    >
      <caption class="visually-hidden">
        {{
          'statutoryFinancials.notes.table.' + name() | translate
        }}
      </caption>
      <thead>
        <tr>
          @for (column of columns(); track column.field) {
            <th scope="col" [class.num]="column.type === 'decimal'">
              {{ 'statutoryFinancials.notes.col.' + column.field | translate }}
            </th>
          }
          @if (addable()) {
            <th scope="col">
              <span class="visually-hidden">{{
                'statutoryFinancials.field.actions' | translate
              }}</span>
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track $index; let i = $index) {
          <tr>
            @for (column of columns(); track column.field) {
              <td [class.num]="column.type === 'decimal'">
                @if (readOnly()) {
                  {{
                    column.type === 'select'
                      ? ('statutoryFinancials.notes.value.' + text(row, column.field) | translate)
                      : text(row, column.field)
                  }}
                } @else if (column.type === 'select') {
                  <nz-select
                    class="cell-input"
                    [nzOptions]="column.selectOptions"
                    [ngModel]="text(row, column.field)"
                    [attr.aria-label]="label(column.field, i)"
                    (ngModelChange)="edit(i, column.field, $event)"
                  ></nz-select>
                } @else {
                  <input
                    nz-input
                    class="cell-input"
                    nzSize="small"
                    [attr.inputmode]="column.type === 'decimal' ? 'decimal' : 'text'"
                    [attr.aria-label]="label(column.field, i)"
                    [attr.aria-invalid]="column.type === 'decimal' && !valid(row, column.field)"
                    [nzStatus]="
                      column.type === 'decimal' && !valid(row, column.field) ? 'error' : ''
                    "
                    [ngModel]="text(row, column.field)"
                    (ngModelChange)="edit(i, column.field, $event)"
                  />
                }
              </td>
            }
            @if (addable()) {
              <td>
                @if (!readOnly()) {
                  <button nz-button nzSize="small" nzDanger type="button" (click)="remove(i)">
                    {{ 'statutoryFinancials.action.removeRow' | translate }}
                  </button>
                }
              </td>
            }
          </tr>
        } @empty {
          <tr>
            <td [attr.colspan]="columns().length + (addable() ? 1 : 0)">
              {{ 'statutoryFinancials.empty.rows' | translate }}
            </td>
          </tr>
        }
      </tbody>
      @if (totals(); as sums) {
        <tfoot>
          <tr>
            @for (column of columns(); track column.field; let first = $first) {
              <td [class.num]="column.type === 'decimal'">
                @if (first) {
                  <strong>{{ 'statutoryFinancials.notes.totals' | translate }}</strong>
                } @else if (sums[column.field] !== undefined) {
                  <strong>{{ sums[column.field] }}</strong>
                }
              </td>
            }
            @if (addable()) {
              <td></td>
            }
          </tr>
        </tfoot>
      }
    </nz-table>
    @if (addable() && !readOnly()) {
      <div class="actions">
        <button nz-button type="button" (click)="add()">
          {{ 'statutoryFinancials.action.addRow' | translate }}
        </button>
      </div>
    }
  `,
})
export class NotesRowsTableComponent {
  private readonly i18n = inject(TranslateService);

  readonly name = input.required<SfNotesTableName>();
  readonly rows = input.required<readonly Row[]>();
  readonly totals = input<Record<string, unknown> | null>(null);
  readonly addable = input<boolean>(false);
  readonly readOnly = input<boolean>(false);
  /** The rows after an edit, an added row or a removed row. */
  readonly rowsChange = output<Row[]>();

  protected readonly columns = computed(() =>
    (NOTES_TABLE_COLUMNS[this.name()] ?? []).map((column) => ({
      ...column,
      selectOptions: (column.options ?? []).map((value) => ({
        label: this.i18n.instant('statutoryFinancials.notes.value.' + value),
        value,
      })),
    })),
  );
  protected readonly scrollWidth = computed(
    () => `${Math.max(480, this.columns().length * 130)}px`,
  );

  protected text(row: Row, field: string): string {
    const value = row[field];
    return value === null || value === undefined ? '' : String(value);
  }

  protected valid(row: Row, field: string): boolean {
    return isDecimal(this.text(row, field));
  }

  protected label(field: string, index: number): string {
    return `${field} #${index + 1}`;
  }

  protected edit(index: number, field: string, value: string): void {
    this.rowsChange.emit(updateRow<Row>(this.rows(), index, field, value));
  }

  protected add(): void {
    this.rowsChange.emit([...this.rows(), emptyNotesRow(this.name())]);
  }

  protected remove(index: number): void {
    this.rowsChange.emit(removeRow<Row>(this.rows(), index));
  }
}

export interface MaturityEdit {
  group: MaturityGroup;
  bucket: MaturityBucket;
  value: string;
}

/** The maturity of receivables and payables (within 1 year, 1 to 5 years, beyond 5 years, secured). */
@Component({
  selector: 'app-sf-notes-maturity',
  imports: [FormsModule, NzInputModule, NzTableModule, TranslatePipe],
  styleUrl: './statutory-financials.scss',
  template: `
    <nz-table
      nzSize="small"
      [nzData]="groups"
      [nzFrontPagination]="false"
      [nzShowPagination]="false"
      [nzScroll]="{ x: '640px' }"
    >
      <caption class="visually-hidden">
        {{
          'statutoryFinancials.notes.table.maturity' | translate
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ 'statutoryFinancials.notes.col.group' | translate }}</th>
          @for (bucket of buckets; track bucket) {
            <th scope="col" class="num">
              {{ 'statutoryFinancials.notes.col.' + bucket | translate }}
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (group of groups; track group) {
          <tr>
            <th scope="row">{{ 'statutoryFinancials.notes.maturity.' + group | translate }}</th>
            @for (bucket of buckets; track bucket) {
              <td class="num">
                @if (readOnly()) {
                  {{ value(group, bucket) }}
                } @else {
                  <input
                    nz-input
                    class="cell-input"
                    nzSize="small"
                    inputmode="decimal"
                    [attr.aria-label]="
                      ('statutoryFinancials.notes.maturity.' + group | translate) +
                      ' / ' +
                      ('statutoryFinancials.notes.col.' + bucket | translate)
                    "
                    [attr.aria-invalid]="!valid(group, bucket)"
                    [nzStatus]="valid(group, bucket) ? '' : 'error'"
                    [ngModel]="value(group, bucket)"
                    (ngModelChange)="changed.emit({ group, bucket, value: $event })"
                  />
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class NotesMaturityComponent {
  readonly table = input<Record<string, unknown> | null>(null);
  readonly readOnly = input<boolean>(false);
  readonly changed = output<MaturityEdit>();

  protected readonly groups = MATURITY_GROUPS;
  protected readonly buckets = MATURITY_BUCKETS;

  protected value(group: MaturityGroup, bucket: MaturityBucket): string {
    const buckets = this.table()?.[group] as Partial<SfMaturityBuckets> | undefined;
    const value = buckets?.[bucket];
    return value === undefined || value === null ? '' : String(value);
  }

  protected valid(group: MaturityGroup, bucket: MaturityBucket): boolean {
    return isDecimal(this.value(group, bucket));
  }
}
