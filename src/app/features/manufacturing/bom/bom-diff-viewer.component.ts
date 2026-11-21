import { Component, computed, input, linkedSignal } from '@angular/core';
import { BomDiffResult } from '@core';
import { TranslatePipe } from '@shared';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DiffRow, diffRows } from './bom.utils';

export type DiffLayout = 'unified' | 'side-by-side';

const KIND_KEYS: Record<DiffRow['kind'], string> = {
  added: 'MFG_BOM.DIFF_ADDED',
  removed: 'MFG_BOM.DIFF_REMOVED',
  modified: 'MFG_BOM.DIFF_MODIFIED',
};

const FIELD_KEYS: Record<string, string> = {
  quantity_per: 'MFG_BOM.COL_QUANTITY_PER',
  scrap_percentage: 'MFG_BOM.COL_SCRAP',
  yield_percentage: 'MFG_BOM.COL_YIELD',
  fixed_scrap_quantity: 'MFG_BOM.COL_FIXED_WASTE',
  is_phantom: 'MFG_BOM.PHANTOM',
  issue_method: 'MFG_BOM.COL_ISSUE_METHOD',
  operation_sequence: 'MFG_BOM.COL_OPERATION',
  sequence: 'MFG_BOM.COL_SEQUENCE',
  substitute_item_ids: 'MFG_BOM.COL_SUBSTITUTES',
};

/**
 * Revision diff viewer for the `diff_payload` of an engineering change (or the diff of two BOMs): added, removed and modified
 * components with the from/to value of every changed field, as a unified list or side by side (before | after).
 */
@Component({
  selector: 'app-bom-diff-viewer',
  imports: [TranslatePipe, NzButtonModule, NzEmptyModule, NzTagModule],
  styles: `
    .bar { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 12px }
    table { width: 100%; border-collapse: collapse }
    th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0); vertical-align: top }
    .added td { background: rgb(82 196 26 / 12%) }
    .removed td { background: rgb(255 77 79 / 12%) }
    .modified td { background: rgb(250 173 20 / 12%) }
    .from { text-decoration: line-through; opacity: .75 }
    .to { font-weight: 600 }
  `,
  template: `
    @if (rows().length === 0) {
      <nz-empty [nzNotFoundContent]="'MFG_BOM.DIFF_EMPTY' | translate"></nz-empty>
    } @else {
      <div class="bar">
        <div role="group" [attr.aria-label]="'MFG_BOM.DIFF_LAYOUT' | translate">
          <button nz-button type="button" [nzType]="layout() === 'unified' ? 'primary' : 'default'" [attr.aria-pressed]="layout() === 'unified'" (click)="layout.set('unified')">{{ 'MFG_BOM.DIFF_UNIFIED' | translate }}</button>
          <button nz-button type="button" [nzType]="layout() === 'side-by-side' ? 'primary' : 'default'" [attr.aria-pressed]="layout() === 'side-by-side'" (click)="layout.set('side-by-side')">{{ 'MFG_BOM.DIFF_SIDE_BY_SIDE' | translate }}</button>
        </div>
        <span data-testid="diff-counts">
          <nz-tag nzColor="green">{{ 'MFG_BOM.DIFF_ADDED' | translate }}: {{ counts().added }}</nz-tag>
          <nz-tag nzColor="red">{{ 'MFG_BOM.DIFF_REMOVED' | translate }}: {{ counts().removed }}</nz-tag>
          <nz-tag nzColor="gold">{{ 'MFG_BOM.DIFF_MODIFIED' | translate }}: {{ counts().modified }}</nz-tag>
        </span>
      </div>

      @if (layout() === 'unified') {
        <table data-testid="diff-unified">
          <thead>
            <tr>
              <th scope="col">{{ 'MFG_BOM.DIFF_CHANGE' | translate }}</th>
              <th scope="col">{{ 'MFG_BOM.COL_COMPONENT' | translate }}</th>
              <th scope="col">{{ 'MFG_BOM.DIFF_FIELD' | translate }}</th>
              <th scope="col">{{ 'MFG_BOM.DIFF_CHANGE_VALUE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr [class]="row.kind" data-testid="diff-row">
                <td>{{ kindKey(row) | translate }}</td>
                <td>{{ row.code }}</td>
                <td>{{ row.field ? (fieldKey(row.field) | translate) : '' }}</td>
                <td>
                  @if (row.from !== null) { <span class="from">{{ row.from }}</span> }
                  @if (row.from !== null && row.to !== null) { → }
                  @if (row.to !== null) { <span class="to">{{ row.to }}</span> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <table data-testid="diff-side-by-side">
          <thead>
            <tr>
              <th scope="col">{{ 'MFG_BOM.COL_COMPONENT' | translate }}</th>
              <th scope="col">{{ 'MFG_BOM.DIFF_FIELD' | translate }}</th>
              <th scope="col">{{ 'MFG_BOM.DIFF_BEFORE' | translate }}</th>
              <th scope="col">{{ 'MFG_BOM.DIFF_AFTER' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr [class]="row.kind" data-testid="diff-row">
                <td>{{ row.code }}</td>
                <td>{{ row.field ? (fieldKey(row.field) | translate) : (kindKey(row) | translate) }}</td>
                <td>{{ row.from ?? '' }}</td>
                <td>{{ row.to ?? '' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    }
  `,
})
export class BomDiffViewerComponent {
  readonly diff = input<BomDiffResult | null | undefined>(null);
  readonly initialLayout = input<DiffLayout>('unified');

  protected readonly layout = linkedSignal<DiffLayout>(() => this.initialLayout());
  protected readonly rows = computed(() => diffRows(this.diff()));
  protected readonly counts = computed(() => {
    const rows = this.rows();
    const diff = this.diff();

    return {
      added: diff?.added?.length ?? 0,
      removed: diff?.removed?.length ?? 0,
      modified: new Set(rows.filter((row) => row.kind === 'modified').map((row) => row.code)).size,
    };
  });

  protected kindKey(row: DiffRow): string {
    return KIND_KEYS[row.kind];
  }

  /** Known fields have a translated label; an unknown field of a future backend version shows its own key. */
  protected fieldKey(field: string): string {
    return FIELD_KEYS[field] ?? field;
  }
}
