import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { TranslateService } from '@core';
import { KpiDashboardsStore } from './kpi-dashboards.store';
import { kpiTitleKey } from './kpi-dashboards.utils';

/**
 * The slide-over of the one-click drill-down: the breadcrumb of what was clicked, the documents behind it, a CSV export of every
 * row and the button that opens the target ERP module with the same filters applied.
 */
@Component({
  selector: 'app-kpi-drill-drawer',
  imports: [
    TranslatePipe,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzPaginationModule,
    NzSpinModule,
  ],
  styles: [
    `
      .crumbs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin: 0 0 12px;
        padding: 0;
        list-style: none;
        font-size: 13px;
        color: var(--ant-color-text-secondary, #595959);
      }
      .crumbs li + li::before {
        content: '›';
        margin-right: 4px;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      .scroll {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th,
      td {
        padding: 6px 8px;
        text-align: left;
        border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
        white-space: nowrap;
      }
    `,
  ],
  template: `
    <nz-drawer
      [nzVisible]="store.drillOpen()"
      nzPlacement="right"
      [nzWidth]="720"
      [nzTitle]="title()"
      (nzOnClose)="store.closeDrill()"
      data-testid="kpi-drill-drawer"
    >
      <ng-container *nzDrawerContent>
        @if (store.drill(); as drill) {
          <ol class="crumbs" aria-label="breadcrumb" data-testid="kpi-drill-breadcrumb">
            @for (crumb of drill.breadcrumb; track $index) {
              <li>{{ crumb }}</li>
            }
          </ol>

          <div class="actions">
            <button nz-button type="button" (click)="exportCsv()" data-testid="kpi-drill-export">
              {{ 'KPI_DASHBOARDS.DRILL_EXPORT' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              type="button"
              (click)="openFull()"
              data-testid="kpi-drill-open-full"
            >
              {{ 'KPI_DASHBOARDS.DRILL_OPEN_FULL' | translate }}
            </button>
          </div>

          <nz-spin [nzSpinning]="store.drillLoading()">
            @if (drill.rows.length === 0) {
              <nz-empty [nzNotFoundContent]="'KPI_DASHBOARDS.DRILL_EMPTY' | translate"></nz-empty>
            } @else {
              <div class="scroll">
                <table data-testid="kpi-drill-table">
                  <thead>
                    <tr>
                      @for (column of drill.columns; track column) {
                        <th scope="col">{{ column }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of drill.rows; track $index) {
                      <tr>
                        @for (column of drill.columns; track column) {
                          <td>{{ cell(row, column) }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <nz-pagination
                [nzPageIndex]="drill.pagination.page"
                [nzPageSize]="drill.pagination.per_page"
                [nzTotal]="drill.pagination.total"
                (nzPageIndexChange)="changePage($event)"
              ></nz-pagination>
            }
          </nz-spin>
        } @else if (store.drillFailed()) {
          <p role="alert">{{ 'KPI_DASHBOARDS.DRILL_ERROR' | translate }}</p>
        } @else {
          <nz-spin nzSimple></nz-spin>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class KpiDrillDrawerComponent {
  protected readonly store = inject(KpiDashboardsStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly title = computed(() => {
    const widget = this.store.drillWidget();
    this.i18n.currentLanguage();

    return widget === null
      ? this.i18n.translate('KPI_DASHBOARDS.DRILL_TITLE')
      : `${this.i18n.translate('KPI_DASHBOARDS.DRILL_TITLE')} · ${this.i18n.translate(kpiTitleKey(widget.kpi_code))}`;
  });

  protected cell(row: Record<string, unknown>, column: string): string {
    const value = row[column];

    return value === null || value === undefined ? '' : String(value);
  }

  protected changePage(page: number): void {
    this.store.loadDrill(page).subscribe();
  }

  protected exportCsv(): void {
    const download = this.store.exportDrill();

    download?.subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `kpi-${this.store.drillWidget()?.kpi_code ?? 'export'}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.message.error(this.i18n.translate('KPI_DASHBOARDS.DRILL_ERROR')),
    });
  }

  /** Opens the ERP module of the documents with the filters of the drill-down. */
  protected openFull(): void {
    const link = this.store.drill()?.deep_link;

    if (link === undefined) {
      return;
    }

    this.store.closeDrill();
    void this.router.navigate([link.route], { queryParams: link.query });
  }
}
