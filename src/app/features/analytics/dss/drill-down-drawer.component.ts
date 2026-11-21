import { Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { catchError, EMPTY } from 'rxjs';
import { DrillDownRecord } from './dss.models';
import { formatAmount } from './dss.utils';
import { DRILL_PAGE_SIZE, ExecutiveDssStore } from './executive-dss.store';

/**
 * Contextual drill-down: the underlying aggregated ledger records of a KPI, bridge bar, matrix row or alert, paginated, with
 * the link to the source document and to the report builder (Issue #215) and KPI dashboards (Mod 090) that continue the analysis.
 */
@Component({
  selector: 'app-drill-down-drawer',
  styleUrl: './dss.scss',
  imports: [
    RouterLink,
    TranslatePipe,
    NzButtonModule,
    NzDrawerModule,
    NzPaginationModule,
    NzSpinModule,
    NzTableModule,
  ],
  template: `
    <nz-drawer
      nzPlacement="right"
      [nzWidth]="780"
      [nzVisible]="store.drillTarget() !== null"
      [nzTitle]="title()"
      (nzOnClose)="store.closeDrill()"
    >
      <ng-container *nzDrawerContent>
        <div data-testid="drill-down">
          <nz-spin [nzSpinning]="store.drillLoading()">
            @if (store.drill(); as drill) {
              <p class="muted" data-testid="drill-total">
                {{ 'EXEC_DSS.DRILL_TOTAL' | translate }}:
                <strong>{{ money(drill.total_amount) }}</strong> · {{ drill.pagination.total }}
                {{ 'EXEC_DSS.DRILL_RECORDS' | translate }}
              </p>
              <nz-table
                nzSize="small"
                [nzData]="drill.data"
                [nzShowPagination]="false"
                [nzFrontPagination]="false"
              >
                <thead>
                  <tr>
                    <th>{{ 'EXEC_DSS.DRILL_DATE' | translate }}</th>
                    <th>{{ 'EXEC_DSS.DRILL_ACCOUNT' | translate }}</th>
                    <th>{{ 'EXEC_DSS.DRILL_COUNTERPARTY' | translate }}</th>
                    <th class="right">{{ 'EXEC_DSS.DRILL_AMOUNT' | translate }}</th>
                    <th>{{ 'EXEC_DSS.DRILL_SOURCE' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (record of drill.data; track record.id) {
                    <tr [attr.data-testid]="'drill-row-' + record.id">
                      <td>{{ record.posting_date }}</td>
                      <td>{{ record.account_code }}</td>
                      <td>{{ record.counterparty?.name ?? '–' }}</td>
                      <td class="right">{{ recordAmount(record) }}</td>
                      <td>
                        <a [routerLink]="sourceRoute(record)" data-testid="drill-source-link">{{
                          'EXEC_DSS.DRILL_OPEN_SOURCE' | translate
                        }}</a>
                      </td>
                    </tr>
                  }
                </tbody>
              </nz-table>
              <nz-pagination
                data-testid="drill-pagination"
                [nzPageIndex]="store.drillPage()"
                [nzPageSize]="pageSize"
                [nzTotal]="drill.pagination.total"
                [nzHideOnSinglePage]="true"
                (nzPageIndexChange)="goTo($event)"
              ></nz-pagination>
              <div class="toolbar">
                <a nz-button routerLink="/analytics/reports" data-testid="link-report-builder">{{
                  'EXEC_DSS.DRILL_REPORT_BUILDER' | translate
                }}</a>
                <a
                  nz-button
                  routerLink="/business-intelligence"
                  data-testid="link-kpi-dashboards"
                  >{{ 'EXEC_DSS.DRILL_KPI_DASHBOARDS' | translate }}</a
                >
              </div>
            }
          </nz-spin>
        </div>
      </ng-container>
    </nz-drawer>
  `,
})
export class DrillDownDrawerComponent {
  protected readonly store = inject(ExecutiveDssStore);
  private readonly i18n = inject(TranslateService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSize = DRILL_PAGE_SIZE;
  protected readonly title = computed(() => {
    const target = this.store.drillTarget();

    return target === null
      ? ''
      : `${target.label} · ${this.i18n.instant(`EXEC_DSS.METRIC_${target.metric.toUpperCase()}`)}`;
  });

  protected money(value: number): string {
    return formatAmount(value, this.store.currency(), this.i18n.currentLanguage());
  }

  protected recordAmount(record: DrillDownRecord): string {
    return record.amount_reporting === null ? '–' : this.money(record.amount_reporting);
  }

  /** The page of the source document in the app: ledger entries open in the journals of the general ledger. */
  protected sourceRoute(record: DrillDownRecord): string {
    return record.source.type === 'journal_entry' ? '/general-ledger/journals' : '/analytics';
  }

  protected goTo(page: number): void {
    this.store
      .loadDrillPage(page)
      .pipe(
        catchError(() => {
          this.message.error(this.i18n.instant('EXEC_DSS.DRILL_ERROR'));

          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
