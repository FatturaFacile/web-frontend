import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@shared';
import { diffAuditValues } from '../audit-trail/audit-diff';

/**
 * Side-by-side view of the before and after values of an audit record: one row per field, the old value on the left
 * and the new one on the right, changed rows highlighted. Masked fields arrive masked from the API and stay masked.
 */
@Component({
  selector: 'app-audit-diff-viewer',
  imports: [TranslatePipe],
  styleUrl: './security-center.scss',
  template: `
    @if (rows().length === 0) {
      <p data-testid="diff-empty">{{ 'SECURITY_CENTER.AUDIT.DIFF_EMPTY' | translate }}</p>
    } @else {
      <table class="diff" data-testid="diff-table">
        <thead>
          <tr>
            <th scope="col">{{ 'SECURITY_CENTER.AUDIT.DIFF_FIELD' | translate }}</th>
            <th scope="col">{{ 'SECURITY_CENTER.AUDIT.DIFF_BEFORE' | translate }}</th>
            <th scope="col">{{ 'SECURITY_CENTER.AUDIT.DIFF_AFTER' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.field) {
            <tr [class]="'diff-row-' + row.kind" [attr.data-kind]="row.kind">
              <th scope="row" class="mono">{{ row.field }}</th>
              <td class="before mono">{{ row.before ?? '' }}</td>
              <td class="after mono">{{ row.after ?? '' }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class AuditDiffViewerComponent {
  readonly oldValues = input<Record<string, unknown> | null>(null);
  readonly newValues = input<Record<string, unknown> | null>(null);

  /** Every field of either side; unchanged ones are kept so the record can be read as a whole. */
  readonly rows = computed(() => diffAuditValues(this.oldValues(), this.newValues()));
}
