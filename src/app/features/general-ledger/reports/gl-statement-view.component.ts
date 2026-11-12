import { Component, computed, input } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { LedgerStatementReport, StatementSection } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';

interface SectionRow {
  key: string;
  section: StatementSection;
}

/** Renders a balance sheet or income statement report: sections, accounts, optional comparison, totals. */
@Component({
  selector: 'app-gl-statement-view',
  styleUrl: './gl-statement-view.component.scss',
  imports: [NzTableModule, NzTagModule, MoneyPipe, TranslatePipe],
  template: `
    @if (report(); as r) {
      <p>
        <nz-tag>{{ 'GL.REPORT_CURRENCY' | translate }}: {{ r.currency }}</nz-tag>
        @if (r.is_balanced === false) {
          <nz-tag nzColor="red">{{ 'GL.NOT_BALANCED' | translate }}</nz-tag>
        }
      </p>
      @for (row of rows(); track row.key) {
        <h4>{{ 'GL.SECTION_' + row.key.toUpperCase() | translate }}</h4>
        <nz-table nzSize="small" [nzData]="row.section.accounts" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'GL.COL_ACCOUNT' | translate }}</th>
              <th nzAlign="right">{{ 'GL.COL_AMOUNT' | translate }}</th>
              @if (hasComparison()) {
                <th nzAlign="right">{{ 'GL.COL_COMPARISON' | translate }}</th>
                <th nzAlign="right">{{ 'GL.COL_VARIANCE' | translate }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (account of row.section.accounts; track account.account_id) {
              <tr>
                <td>{{ account.account_code }} {{ account.account_name }}</td>
                <td nzAlign="right">{{ account.amount | money: r.currency }}</td>
                @if (hasComparison()) {
                  <td nzAlign="right">{{ account.comparison_amount | money: r.currency }}</td>
                  <td nzAlign="right">{{ account.variance | money: r.currency }}</td>
                }
              </tr>
            }
            <tr class="section-total">
              <td><strong>{{ 'GL.COL_TOTAL' | translate }}</strong></td>
              <td nzAlign="right"><strong>{{ row.section.total | money: r.currency }}</strong></td>
              @if (hasComparison()) {
                <td nzAlign="right">{{ row.section.comparison_total | money: r.currency }}</td>
                <td nzAlign="right">{{ row.section.variance | money: r.currency }}</td>
              }
            </tr>
          </tbody>
        </nz-table>
      }
      <h4>{{ 'GL.TOTALS' | translate }}</h4>
      <nz-table nzSize="small" [nzData]="totals()" [nzShowPagination]="false">
        <tbody>
          @for (total of totals(); track total.key) {
            <tr>
              <td>{{ 'GL.TOTALS_' + total.key.toUpperCase() | translate }}</td>
              <td nzAlign="right">{{ total.value | money: r.currency }}</td>
              @if (hasComparison()) {
                <td nzAlign="right">{{ total.comparison | money: r.currency }}</td>
              }
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class GlStatementViewComponent {
  readonly report = input<LedgerStatementReport | null>(null);

  protected readonly rows = computed<SectionRow[]>(() =>
    Object.entries(this.report()?.sections ?? {}).map(([key, section]) => ({ key, section })),
  );

  protected readonly hasComparison = computed(() => {
    const r = this.report();
    return !!r && (r.compare_as_of != null || r.compare_from != null || !!r.comparison_totals);
  });

  protected readonly totals = computed(() => {
    const r = this.report();
    const comparison = r?.comparison_totals ?? null;
    return Object.entries(r?.totals ?? {}).map(([key, value]) => ({
      key,
      value,
      comparison: comparison ? comparison[key] : null,
    }));
  });
}
