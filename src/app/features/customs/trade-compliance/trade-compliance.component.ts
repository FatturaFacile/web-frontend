import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  CUSTOMS_WORKFLOW_STAGES,
  CustomsApiService,
  CustomsDeclarationResource,
  CustomsDeclarationStatus,
  CustomsDirection,
  CustomsMissingEvvEntry,
  CustomsRegime,
  CustomsTradeComplianceDashboard,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { DeclarationDetailDrawerComponent } from './declaration-detail-drawer.component';
import { ImportBillsPanelComponent } from './import-bills-panel.component';
import {
  CUSTOMS_DECLARATION_STATUSES,
  CUSTOMS_DIRECTIONS,
  CUSTOMS_REGIMES,
  declarationStatusColor,
  isTransitOverdue,
  orderedCounts,
} from './trade-compliance.utils';

/**
 * "Foreign Trade & Customs": compliance dashboard (counters by direction / regime / status, overdue transit,
 * export declarations still missing the eVV proof), the declarations list with its detail drawer, and the
 * import customs bills.
 */
@Component({
  selector: 'app-trade-compliance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzBadgeModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzIconModule,
    NzListModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    DeclarationDetailDrawerComponent,
    ImportBillsPanelComponent,
  ],
  template: `
    <app-page-header
      [title]="'CUSTOMS_TRADE.TITLE' | translate"
      [subtitle]="'CUSTOMS_TRADE.SUBTITLE' | translate"
    >
      <button nz-button nzType="default" (click)="refresh()">
        <nz-icon nzType="reload" />
        {{ 'COMMON.REFRESH' | translate }}
      </button>
    </app-page-header>

    <section class="summary" [attr.aria-label]="'CUSTOMS_TRADE.SUMMARY' | translate">
      <nz-card class="summary-card" [nzLoading]="loadingDashboard()" [nzTitle]="'CUSTOMS_TRADE.BY_DIRECTION' | translate">
        @for (row of directionCounts(); track row.key) {
          <div class="count-row">
            <span>{{ 'CUSTOMS_TRADE.DIRECTION.' + row.key | translate }}</span>
            <strong>{{ row.count }}</strong>
          </div>
        }
      </nz-card>
      <nz-card class="summary-card" [nzLoading]="loadingDashboard()" [nzTitle]="'CUSTOMS_TRADE.BY_REGIME' | translate">
        @for (row of regimeCounts(); track row.key) {
          <div class="count-row">
            <span>{{ 'CUSTOMS_TRADE.REGIME.' + row.key | translate }}</span>
            <strong>{{ row.count }}</strong>
          </div>
        }
      </nz-card>
      <nz-card class="summary-card" [nzLoading]="loadingDashboard()" [nzTitle]="'CUSTOMS_TRADE.BY_STATUS' | translate">
        @for (row of statusCounts(); track row.key) {
          <div class="count-row">
            <span>{{ 'CUSTOMS_TRADE.STATUS.' + row.key | translate }}</span>
            <strong>{{ row.count }}</strong>
          </div>
        }
      </nz-card>
      <nz-card class="summary-card" [nzLoading]="loadingDashboard()" [nzTitle]="'FOREIGN_TRADE.STAGE.TITLE' | translate">
        @for (row of stageCounts(); track row.key) {
          <div class="count-row" [attr.data-testid]="'stage-' + row.key">
            <span>{{ 'FOREIGN_TRADE.STAGE.' + row.key.toUpperCase() | translate }}</span>
            <strong>{{ row.count }}</strong>
          </div>
        }
      </nz-card>
      <nz-card class="summary-card" [nzLoading]="loadingDashboard()">
        <nz-statistic
          [nzTitle]="'CUSTOMS_TRADE.TRANSIT_OVERDUE' | translate"
          [nzValue]="transitOverdue()"
          [nzValueStyle]="transitOverdue() > 0 ? { color: 'var(--color-danger, #cf1322)' } : {}"
        />
      </nz-card>
    </section>

    @if (dashboardFailed()) {
      <nz-alert
        class="block"
        nzType="error"
        nzShowIcon
        [nzMessage]="'CUSTOMS_TRADE.DASHBOARD_LOAD_FAILED' | translate"
      />
    }

    @if (missingEvv().length > 0) {
      <nz-alert
        class="block"
        nzType="warning"
        nzShowIcon
        [nzMessage]="alertMessage"
        [nzDescription]="alertDescription"
      />
      <ng-template #alertMessage>
        {{ 'CUSTOMS_TRADE.MISSING_EVV' | translate }}
        <nz-badge [nzCount]="missingEvv().length" [nzOverflowCount]="99" />
      </ng-template>
      <ng-template #alertDescription>
        <p>{{ 'CUSTOMS_TRADE.MISSING_EVV_HINT' | translate }}</p>
        <nz-list nzSize="small">
          @for (entry of missingEvv(); track entry.declaration_id) {
            <nz-list-item>
              <div class="evv-entry">
                <strong>{{ entry.trader_declaration_number }}</strong>
                <span class="mono">{{ entry.mrn || '-' }}</span>
                @for (invoice of entry.invoices; track invoice.id) {
                  <nz-tag>{{ invoice.invoice_number }}</nz-tag>
                }
              </div>
              <button nz-button nzSize="small" nzType="link" (click)="openDetail(entry.declaration_id)">
                {{ 'CUSTOMS_TRADE.OPEN_DETAIL' | translate }}
              </button>
            </nz-list-item>
          }
        </nz-list>
      </ng-template>
    }

    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'CUSTOMS_TRADE.TAB_DECLARATIONS' | translate">
          <div class="filter-bar">
            <nz-select
              class="filter"
              nzAllowClear
              [ngModel]="directionFilter()"
              (ngModelChange)="setDirection($event)"
              [nzPlaceHolder]="'CUSTOMS_TRADE.FILTER_DIRECTION' | translate"
            >
              @for (direction of directions; track direction) {
                <nz-option [nzValue]="direction" [nzLabel]="'CUSTOMS_TRADE.DIRECTION.' + direction | translate" />
              }
            </nz-select>
            <nz-select
              class="filter"
              nzAllowClear
              [ngModel]="regimeFilter()"
              (ngModelChange)="setRegime($event)"
              [nzPlaceHolder]="'CUSTOMS_TRADE.FILTER_REGIME' | translate"
            >
              @for (regime of regimes; track regime) {
                <nz-option [nzValue]="regime" [nzLabel]="'CUSTOMS_TRADE.REGIME.' + regime | translate" />
              }
            </nz-select>
            <nz-select
              class="filter"
              nzAllowClear
              [ngModel]="statusFilter()"
              (ngModelChange)="setStatus($event)"
              [nzPlaceHolder]="'CUSTOMS_TRADE.FILTER_STATUS' | translate"
            >
              @for (status of statuses; track status) {
                <nz-option [nzValue]="status" [nzLabel]="'CUSTOMS_TRADE.STATUS.' + status | translate" />
              }
            </nz-select>
          </div>

          <nz-table
            #declarationsTable
            nzSize="middle"
            [nzData]="visibleDeclarations()"
            [nzLoading]="loadingDeclarations()"
            [nzTotal]="totalDeclarations()"
            [nzPageIndex]="page()"
            [nzPageSize]="pageSize()"
            [nzFrontPagination]="false"
            (nzQueryParams)="onQueryParams($event)"
          >
            <thead>
              <tr>
                <th>{{ 'CUSTOMS.COLS.DECLARATION_NR' | translate }}</th>
                <th>{{ 'CUSTOMS.COLS.MRN' | translate }}</th>
                <th>{{ 'CUSTOMS_TRADE.COL_DIRECTION' | translate }}</th>
                <th>{{ 'CUSTOMS_TRADE.COL_REGIME' | translate }}</th>
                <th>{{ 'CUSTOMS.COLS.STATISTICAL_VALUE' | translate }}</th>
                <th>{{ 'CUSTOMS.COLS.STATUS' | translate }}</th>
                <th>{{ 'CUSTOMS_TRADE.COL_TRANSIT' | translate }}</th>
                <th>{{ 'COMMON.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (decl of declarationsTable.data; track decl.id) {
                <tr>
                  <td>
                    <strong>{{ decl.trader_declaration_number }}</strong>
                  </td>
                  <td class="mono">{{ decl.mrn || '-' }}</td>
                  <td>{{ 'CUSTOMS_TRADE.DIRECTION.' + decl.declaration_type | translate }}</td>
                  <td>
                    @if (decl.customs_regime) {
                      <nz-tag>{{ 'CUSTOMS_TRADE.REGIME.' + decl.customs_regime | translate }}</nz-tag>
                    }
                  </td>
                  <td>{{ decl.total_statistical_value | money: authStore.activeCurrency() }}</td>
                  <td>
                    <nz-tag [nzColor]="statusColor(decl.status)">{{ 'CUSTOMS_TRADE.STATUS.' + decl.status | translate }}</nz-tag>
                  </td>
                  <td>
                    @if (decl.transit_document_type && decl.transit_document_type !== 'none') {
                      <nz-tag [nzColor]="transitTagColor(decl)">{{ decl.transit_document_type }}</nz-tag>
                    }
                  </td>
                  <td>
                    <button nz-button nzType="link" nzSize="small" (click)="openDetail(decl.id)">
                      {{ 'CUSTOMS_TRADE.OPEN_DETAIL' | translate }}
                    </button>
                  </td>
                </tr>
              } @empty {
                @if (!loadingDeclarations()) {
                  <tr>
                    <td colspan="8"><nz-empty nzNotFoundImage="simple" /></td>
                  </tr>
                }
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'CUSTOMS_TRADE.TAB_IMPORT_BILLS' | translate">
          <app-import-bills-panel />
        </nz-tab>
      </nz-tabs>
    </nz-card>

    <app-declaration-detail-drawer
      [declarationId]="selectedId()"
      (closed)="selectedId.set(null)"
      (changed)="refresh()"
    />
  `,
  styles: `
    :host {
      display: block;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--space-4, 16px);
      margin-bottom: var(--space-4, 16px);
    }
    .count-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    .block {
      display: block;
      margin-bottom: var(--space-4, 16px);
    }
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3, 12px);
      margin-bottom: var(--space-4, 16px);
    }
    .filter {
      width: 200px;
    }
    .evv-entry {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2, 8px);
    }
    .mono {
      font-family: var(--font-mono, monospace);
    }
  `,
})
export class TradeComplianceComponent implements OnInit {
  private readonly api = inject(CustomsApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly authStore = inject(AuthStore);

  readonly directions = CUSTOMS_DIRECTIONS;
  readonly regimes = CUSTOMS_REGIMES;
  readonly statuses = CUSTOMS_DECLARATION_STATUSES;

  // --- Dashboard ---
  readonly loadingDashboard = signal(false);
  readonly dashboardFailed = signal(false);
  readonly dashboard = signal<CustomsTradeComplianceDashboard | null>(null);
  readonly directionCounts = computed(() => orderedCounts(this.dashboard()?.by_direction, this.directions));
  readonly regimeCounts = computed(() => orderedCounts(this.dashboard()?.by_regime, this.regimes));
  readonly statusCounts = computed(() => orderedCounts(this.dashboard()?.by_status, this.statuses));
  readonly stageCounts = computed(() => orderedCounts(this.dashboard()?.by_stage, CUSTOMS_WORKFLOW_STAGES));
  readonly transitOverdue = computed(() => this.dashboard()?.transit_overdue ?? 0);
  readonly missingEvv = computed<CustomsMissingEvvEntry[]>(() => this.dashboard()?.missing_evv ?? []);

  // --- Declarations ---
  readonly loadingDeclarations = signal(false);
  readonly declarations = signal<CustomsDeclarationResource[]>([]);
  readonly totalDeclarations = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly directionFilter = signal<CustomsDirection | null>(null);
  readonly regimeFilter = signal<CustomsRegime | null>(null);
  readonly statusFilter = signal<CustomsDeclarationStatus | null>(null);
  readonly selectedId = signal<string | null>(null);

  /** The API ignores the regime filter until it supports it, so the loaded page is narrowed here too. */
  readonly visibleDeclarations = computed(() => {
    const regime = this.regimeFilter();
    return regime ? this.declarations().filter((d) => d.customs_regime === regime) : this.declarations();
  });

  ngOnInit(): void {
    this.loadDashboard();
    this.loadDeclarations(1);
  }

  refresh(): void {
    this.loadDashboard();
    this.loadDeclarations(this.page());
  }

  loadDashboard(): void {
    this.loadingDashboard.set(true);
    this.dashboardFailed.set(false);
    this.api
      .getTradeComplianceDashboard()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.dashboard.set(res.data);
          this.loadingDashboard.set(false);
        },
        error: () => {
          this.dashboardFailed.set(true);
          this.loadingDashboard.set(false);
        },
      });
  }

  loadDeclarations(page: number): void {
    this.page.set(page);
    this.loadingDeclarations.set(true);
    this.api
      .getDeclarations({
        page,
        per_page: this.pageSize(),
        declaration_type: this.directionFilter() ?? undefined,
        customs_regime: this.regimeFilter() ?? undefined,
        status: this.statusFilter() ?? undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.declarations.set(res.data);
          this.totalDeclarations.set(res.meta?.total ?? res.data.length);
          this.loadingDeclarations.set(false);
        },
        error: () => this.loadingDeclarations.set(false),
      });
  }

  onQueryParams(params: NzTableQueryParams): void {
    this.pageSize.set(params.pageSize);
    this.loadDeclarations(params.pageIndex);
  }

  setDirection(value: CustomsDirection | null): void {
    this.directionFilter.set(value);
    this.loadDeclarations(1);
  }

  setRegime(value: CustomsRegime | null): void {
    this.regimeFilter.set(value);
    this.loadDeclarations(1);
  }

  setStatus(value: CustomsDeclarationStatus | null): void {
    this.statusFilter.set(value);
    this.loadDeclarations(1);
  }

  openDetail(id: string): void {
    this.selectedId.set(id);
  }

  statusColor(status: CustomsDeclarationStatus): string {
    return declarationStatusColor(status);
  }

  transitTagColor(decl: CustomsDeclarationResource): string {
    if (decl.transit_discharged_at) {
      return 'success';
    }
    return isTransitOverdue(decl.transit_deadline_on, decl.transit_discharged_at) ? 'error' : 'processing';
  }
}
