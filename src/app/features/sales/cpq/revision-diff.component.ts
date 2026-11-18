import { Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CpqApiService, CpqDiffChange, CpqRevisionDiff, CpqRevisionSummary } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';

/**
 * Revision history (Rev 0, 1, 2...) as a timeline, and the side-by-side comparison of any two revisions: lines added,
 * removed and modified, and the effect on totals and margin.
 */
@Component({
  selector: 'app-cpq-revision-diff',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    NzTimelineModule,
    TranslatePipe,
  ],
  template: `
    <h3>{{ 'CPQ.REVISIONS.TITLE' | translate }}</h3>
    <nz-spin [nzSpinning]="loading()">
      <nz-timeline data-test="timeline">
        @for (rev of revisions(); track rev.id) {
          <nz-timeline-item [nzColor]="rev.is_current_revision ? 'green' : 'gray'">
            <strong>Rev {{ rev.revision_number }}</strong> · {{ rev.quote_number }}
            <nz-tag [nzColor]="rev.is_current_revision ? 'green' : 'default'">
              {{ (rev.is_current_revision ? 'CPQ.REVISIONS.CURRENT' : 'CPQ.REVISIONS.SUPERSEDED') | translate }}
            </nz-tag>
            <div>{{ rev.total_net }}</div>
            @if (rev.revision_notes) {
              <div class="notes">{{ rev.revision_notes }}</div>
            }
          </nz-timeline-item>
        }
      </nz-timeline>

      @if (revisions().length > 1) {
        <h3>{{ 'CPQ.REVISIONS.COMPARE' | translate }}</h3>
        <form [formGroup]="form" (ngSubmit)="compare()" class="compare">
          <label for="diff-from">{{ 'CPQ.REVISIONS.FROM' | translate }}</label>
          <nz-select id="diff-from" formControlName="from">
            @for (rev of revisions(); track rev.id) {
              <nz-option [nzValue]="rev.id" [nzLabel]="'Rev ' + rev.revision_number" />
            }
          </nz-select>
          <label for="diff-to">{{ 'CPQ.REVISIONS.TO' | translate }}</label>
          <nz-select id="diff-to" formControlName="to">
            @for (rev of revisions(); track rev.id) {
              <nz-option [nzValue]="rev.id" [nzLabel]="'Rev ' + rev.revision_number" />
            }
          </nz-select>
          <button nz-button nzType="primary" type="submit" data-test="compare" [disabled]="!canCompare()">
            {{ 'CPQ.REVISIONS.COMPARE' | translate }}
          </button>
        </form>
      }

      @if (diff(); as d) {
        <div data-test="diff">
          @if (isEmpty(d)) {
            <nz-alert nzType="info" nzShowIcon [nzMessage]="'CPQ.REVISIONS.NO_CHANGES' | translate" />
          }
          @if (d.items.added.length > 0) {
            <h4>{{ 'CPQ.REVISIONS.ADDED' | translate }}</h4>
            <nz-table #added [nzData]="d.items.added" nzSize="small" [nzShowPagination]="false" data-test="added">
              <tbody>
                @for (line of added.data; track $index) {
                  <tr>
                    <td>{{ line.description }}</td>
                    <td>{{ line.quantity }}</td>
                    <td>{{ line.line_total }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
          @if (d.items.removed.length > 0) {
            <h4>{{ 'CPQ.REVISIONS.REMOVED' | translate }}</h4>
            <nz-table #removed [nzData]="d.items.removed" nzSize="small" [nzShowPagination]="false" data-test="removed">
              <tbody>
                @for (line of removed.data; track $index) {
                  <tr>
                    <td>{{ line.description }}</td>
                    <td>{{ line.quantity }}</td>
                    <td>{{ line.line_total }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
          @if (d.items.modified.length > 0) {
            <h4>{{ 'CPQ.REVISIONS.MODIFIED' | translate }}</h4>
            <nz-table #modified [nzData]="d.items.modified" nzSize="small" [nzShowPagination]="false" data-test="modified">
              <tbody>
                @for (line of modified.data; track $index) {
                  <tr>
                    <td>{{ line.description }}</td>
                    <td>
                      @for (field of fields(line.changes); track field) {
                        <div>{{ field }}: {{ show(line.changes[field].from) }} → {{ show(line.changes[field].to) }}</div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
          <h4>{{ 'CPQ.REVISIONS.TOTALS_IMPACT' | translate }}</h4>
          <nz-table #totals [nzData]="totalRows(d)" nzSize="small" [nzShowPagination]="false" data-test="totals">
            <tbody>
              @for (row of totals.data; track row.name) {
                <tr>
                  <td>{{ row.name }}</td>
                  <td>{{ row.from ?? '-' }}</td>
                  <td>{{ row.to ?? '-' }}</td>
                  <td>{{ row.delta ?? '-' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </div>
      }
    </nz-spin>
  `,
  styles: `
    .compare {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .notes {
      opacity: 0.75;
    }
  `,
})
export class CpqRevisionDiffComponent {
  private readonly api = inject(CpqApiService);
  private readonly fb = inject(FormBuilder);

  readonly quoteId = input.required<string>();

  protected readonly loading = signal(false);
  protected readonly revisions = signal<CpqRevisionSummary[]>([]);
  protected readonly diff = signal<CpqRevisionDiff | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    from: this.fb.nonNullable.control(''),
    to: this.fb.nonNullable.control(''),
  });

  constructor() {
    effect(() => this.load(this.quoteId()));
  }

  protected canCompare(): boolean {
    const { from, to } = this.form.getRawValue();

    return from !== '' && to !== '' && from !== to;
  }

  protected compare(): void {
    if (!this.canCompare()) {
      return;
    }

    const { from, to } = this.form.getRawValue();
    this.loading.set(true);
    this.api.diff(from, to).subscribe({
      next: (res) => {
        this.diff.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected isEmpty(diff: CpqRevisionDiff): boolean {
    return diff.items.added.length + diff.items.removed.length + diff.items.modified.length === 0;
  }

  protected fields(changes: Record<string, CpqDiffChange>): string[] {
    return Object.keys(changes);
  }

  protected show(value: CpqDiffChange['from']): string {
    if (value === null) {
      return '-';
    }

    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  protected totalRows(diff: CpqRevisionDiff): { name: string; from: string | null; to: string | null; delta: string | null }[] {
    return Object.entries(diff.totals).map(([name, total]) => ({ name, ...total }));
  }

  private load(quoteId: string): void {
    this.loading.set(true);
    this.diff.set(null);
    this.api.getRevisions(quoteId).subscribe({
      next: (res) => {
        const revisions = res.data;
        this.revisions.set(revisions);
        const current = revisions.find((rev) => rev.id === quoteId) ?? revisions[revisions.length - 1];
        const previous = revisions[revisions.indexOf(current) - 1];
        this.form.setValue({ from: previous?.id ?? '', to: current?.id ?? '' });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
