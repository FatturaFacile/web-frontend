import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PermissionCatalog } from '@core';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe } from '@shared';
import {
  buildRows,
  columnState,
  MatrixRow,
  permissionKey,
  rowState,
  toggleCell,
  toggleColumn,
  toggleRow,
  usedActions,
} from './role-matrix';

/**
 * Module × action permission matrix: one checkbox per permission key, a tri-state checkbox per row and per column, and
 * sticky headers so a long catalog stays readable. `selected` is the list of granted permission keys (two-way).
 */
@Component({
  selector: 'app-role-matrix',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NzCheckboxModule, NzTableModule, TranslatePipe],
  template: `
    <nz-table
      #table
      class="role-matrix"
      [nzData]="rows()"
      [nzFrontPagination]="false"
      [nzScroll]="{ y: '60vh' }"
      nzSize="small"
      nzTableLayout="fixed"
    >
      <thead>
        <tr>
          <th nzLeft nzWidth="220px">{{ 'IAM.MATRIX_RESOURCE' | translate }}</th>
          <th nzWidth="64px"></th>
          @for (action of actions(); track action) {
            <th class="action-col">
              <label [attr.for]="'role-matrix-col-' + action" [nzId]="'role-matrix-col-' + action"
                nz-checkbox
                [nzChecked]="column(action) === 'all'"
                [nzIndeterminate]="column(action) === 'some'"
                [nzDisabled]="readonly()"
                (nzCheckedChange)="onColumn(action)"
                [attr.data-testid]="'col-' + action"
              >
                {{ 'IAM.ACTION_' + action.toUpperCase() | translate }}
              </label>
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.module + row.resource) {
          <tr>
            <td nzLeft>
              <strong>{{ row.module }}</strong> · {{ row.resource }}
            </td>
            <td>
              <label [attr.for]="'role-matrix-row-' + row.module + '-' + row.resource" [nzId]="'role-matrix-row-' + row.module + '-' + row.resource"
                nz-checkbox
                [nzChecked]="state(row) === 'all'"
                [nzIndeterminate]="state(row) === 'some'"
                [nzDisabled]="readonly()"
                (nzCheckedChange)="onRow(row)"
                [attr.data-testid]="'row-' + row.module + '-' + row.resource"
              ></label>
            </td>
            @for (action of actions(); track action) {
              <td class="action-col">
                @if (row.actions.includes(action)) {
                  <label [attr.for]="'role-matrix-cell-' + row.module + '-' + row.resource + '-' + action" [nzId]="'role-matrix-cell-' + row.module + '-' + row.resource + '-' + action"
                    nz-checkbox
                    [nzChecked]="has(row, action)"
                    [nzDisabled]="readonly()"
                    (nzCheckedChange)="onCell(row, action)"
                    [attr.data-testid]="'cell-' + row.module + '-' + row.resource + '-' + action"
                  ></label>
                } @else {
                  <span aria-hidden="true">—</span>
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  styles: ['.action-col { text-align: center; } :host ::ng-deep .ant-table-thead > tr > th { position: sticky; top: 0; }'],
})
export class RoleMatrixComponent {
  readonly catalog = input.required<PermissionCatalog>();
  readonly selected = model<string[]>([]);
  readonly readonly = input(false);

  protected readonly rows = computed(() => buildRows(this.catalog()));
  protected readonly actions = computed(() => usedActions(this.rows()));
  private readonly selectedSet = computed(() => new Set(this.selected()));

  protected state = (row: MatrixRow) => rowState(row, this.selectedSet());
  protected column = (action: string) => columnState(this.rows(), action, this.selectedSet());
  protected has = (row: MatrixRow, action: string) => this.selectedSet().has(permissionKey(row, action));

  protected onCell(row: MatrixRow, action: string): void {
    this.selected.set([...toggleCell(this.selectedSet(), permissionKey(row, action))].sort());
  }

  protected onRow(row: MatrixRow): void {
    this.selected.set([...toggleRow(row, this.selectedSet())].sort());
  }

  protected onColumn(action: string): void {
    this.selected.set([...toggleColumn(this.rows(), action, this.selectedSet())].sort());
  }
}
