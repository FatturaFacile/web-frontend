import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ConsolidationGroup, GeneralLedgerConsolidationApiService, IntercompanyReconciliation } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlConsolidationPeriodStore } from './gl-consolidation-period.store';

/** Intercompany reconciliation of a fiscal period: the mapped accounts of two entities against each other. */
@Component({
  selector: 'app-gl-consolidation-reconciliation',
  styleUrl: './gl-consolidation.scss',
  imports: [FormsModule, NzButtonModule, NzSelectModule, NzTableModule, NzTagModule, GlErrorAlertComponent, MoneyPipe, TranslatePipe],
  template: `
    <app-gl-error-alert [error]="error()" />
    <div class="toolbar">
      <label for="cons-rec-period">{{ 'GL.PERIOD' | translate }}</label>
      <nz-select id="cons-rec-period" class="select-md" nzShowSearch [(ngModel)]="periodId" [nzPlaceHolder]="'GL.PERIOD' | translate">
        @for (period of periods.periods(); track period.id) {
          <nz-option [nzValue]="period.id" [nzLabel]="period.label" />
        }
      </nz-select>
      <button nz-button nzType="primary" type="button" [disabled]="!periodId || loading()" [nzLoading]="loading()" (click)="run()">
        {{ 'GL.CONS_RECONCILE' | translate }}
      </button>
    </div>

    @if (report(); as result) {
      <p class="muted">
        {{ 'GL.CONS_RECONCILIATION_SUMMARY' | translate }}: {{ result.summary.pairs }} /
        {{ result.summary.pairs_with_difference }}
      </p>
      <nz-table #table nzSize="small" [nzData]="result.rows" [nzShowPagination]="false" [nzScroll]="{ x: '900px' }">
        <thead>
          <tr>
            <th>{{ 'GL.CONS_MAPPING_TYPE' | translate }}</th>
            <th>{{ 'GL.CONS_ENTITY_A' | translate }}</th>
            <th class="num">{{ 'GL.CONS_AMOUNT_A' | translate }}</th>
            <th>{{ 'GL.CONS_ENTITY_B' | translate }}</th>
            <th class="num">{{ 'GL.CONS_AMOUNT_B' | translate }}</th>
            <th class="num">{{ 'GL.CONS_DIFFERENCE' | translate }}</th>
            <th class="num">{{ 'GL.CONS_TOLERANCE' | translate }}</th>
            <th>{{ 'GL.STATUS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track $index) {
            <tr>
              <td>{{ 'GL.CONS_MAPPING_' + row.mapping_type.toUpperCase() | translate }}</td>
              <td>{{ row.entity_a.name }} - {{ row.entity_a.account_code }}</td>
              <td class="num">{{ row.entity_a.group_amount | money: result.currency }}</td>
              <td>{{ row.entity_b.name }} - {{ row.entity_b.account_code }}</td>
              <td class="num">{{ row.entity_b.group_amount | money: result.currency }}</td>
              <td class="num">{{ row.difference | money: result.currency }}</td>
              <td class="num">{{ row.tolerance | money: result.currency }}</td>
              <td>
                <nz-tag [nzColor]="row.has_difference ? 'red' : 'green'">{{ 'GL.CONS_STATUS_' + row.status.toUpperCase() | translate }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class GlConsolidationReconciliationComponent implements OnInit {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  protected readonly periods = inject(GlConsolidationPeriodStore);

  readonly group = input.required<ConsolidationGroup>();

  protected periodId: string | null = null;
  protected readonly report = signal<IntercompanyReconciliation | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<unknown>(null);

  ngOnInit(): void {
    this.periods.load();
  }

  protected run(): void {
    if (!this.periodId) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.getIntercompanyReconciliation(this.group().id, this.periodId).subscribe({
      next: (res) => {
        this.report.set(res.data ?? null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err);
        this.loading.set(false);
      },
    });
  }
}
