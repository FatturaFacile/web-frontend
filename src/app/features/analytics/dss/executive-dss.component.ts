import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { catchError, EMPTY } from 'rxjs';
import { BalancedScorecardComponent } from './balanced-scorecard.component';
import { DrillDownDrawerComponent } from './drill-down-drawer.component';
import { DssFilterBarComponent } from './dss-filter-bar.component';
import { BoardPackFormat, DrillMetric, DrillTarget } from './dss.models';
import { boardPackLocale, downloadFile } from './dss.utils';
import { ExecutiveDssStore } from './executive-dss.store';
import { ProfitabilityExplorerComponent } from './profitability-explorer.component';
import { StrategicAlertsComponent } from './strategic-alerts.component';
import { VarianceBridgeComponent } from './variance-bridge.component';
import { WhatIfSimulatorComponent } from './what-if-simulator.component';

/**
 * Executive DSS command center (`/analytics/executive-dss`): the global strategic filter, the Balanced Scorecard with the
 * strategic alerts, the variance bridge, the profitability matrix with the Whale Curve, the what-if simulator and the
 * drill-down. The filter lives in the URL, so a view can be shared or bookmarked.
 */
@Component({
  selector: 'app-executive-dss',
  styleUrl: './dss.scss',
  imports: [
    TranslatePipe,
    PageHeaderComponent,
    NzAlertModule,
    NzButtonModule,
    NzSpinModule,
    DssFilterBarComponent,
    BalancedScorecardComponent,
    StrategicAlertsComponent,
    VarianceBridgeComponent,
    ProfitabilityExplorerComponent,
    WhatIfSimulatorComponent,
    DrillDownDrawerComponent,
  ],
  template: `
    <app-page-header
      [title]="'EXEC_DSS.TITLE' | translate"
      [subtitle]="'EXEC_DSS.SUBTITLE' | translate"
    ></app-page-header>

    <app-dss-filter-bar (exportPack)="exportPack($event)"></app-dss-filter-bar>

    @if (store.failed()) {
      <nz-alert
        nzType="error"
        nzShowIcon
        data-testid="load-error"
        [nzMessage]="'EXEC_DSS.LOAD_ERROR' | translate"
        [nzAction]="retry"
      ></nz-alert>
      <ng-template #retry>
        <button nz-button nzSize="small" data-testid="retry" (click)="reload()">
          {{ 'EXEC_DSS.RETRY' | translate }}
        </button>
      </ng-template>
    }

    @if (store.budgetMissing()) {
      <nz-alert
        nzType="warning"
        nzShowIcon
        data-testid="budget-banner"
        [nzMessage]="'EXEC_DSS.BUDGET_MISSING' | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <div class="toolbar">
        <button nz-button data-testid="open-what-if" (click)="whatIfOpen.set(true)">
          {{ 'EXEC_DSS.WHATIF_OPEN' | translate }}
        </button>
      </div>

      <app-balanced-scorecard
        [kpis]="store.kpis()"
        [currency]="store.currency()"
        (drill)="drill($event)"
      ></app-balanced-scorecard>

      <h3 class="section-title">
        {{ 'EXEC_DSS.ALERTS_TITLE' | translate }}
      </h3>
      <app-strategic-alerts
        [alerts]="store.alerts()"
        (drill)="openTarget($event)"
      ></app-strategic-alerts>

      <h3 class="section-title">{{ 'EXEC_DSS.EXPLORERS' | translate }}</h3>
      <div class="explorers">
        <app-variance-bridge
          [bridge]="store.bridge()"
          [currency]="store.currency()"
          (drill)="drill($event)"
        ></app-variance-bridge>
        <app-profitability-explorer
          [matrix]="store.matrix()"
          [dimension]="store.dimension()"
          [currency]="store.currency()"
          [loading]="store.matrixLoading()"
          (dimensionChange)="store.setDimension($event)"
          (drill)="openTarget($event)"
        ></app-profitability-explorer>
      </div>
    </nz-spin>

    <app-what-if-simulator [(open)]="whatIfOpen"></app-what-if-simulator>
    <app-drill-down-drawer></app-drill-down-drawer>
  `,
})
export class ExecutiveDssComponent {
  protected readonly store = inject(ExecutiveDssStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly whatIfOpen = signal(false);

  constructor() {
    // The URL wins on arrival (a shared link), then the store drives the URL.
    this.store.applyQueryParams(this.route.snapshot.queryParams);
    this.store.connect();

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.store.applyQueryParams(params));

    effect(() => {
      const params = this.store.queryParams();

      untracked(() => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: params,
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  protected reload(): void {
    this.store
      .reload()
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected drill(event: { metric: DrillMetric; label: string }): void {
    this.openTarget({ metric: event.metric, entityType: null, entityId: null, label: event.label });
  }

  protected openTarget(target: DrillTarget): void {
    this.store
      .openDrill(target)
      .pipe(
        catchError(() => {
          this.message.error(this.i18n.instant('EXEC_DSS.DRILL_ERROR'));

          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected exportPack(format: BoardPackFormat): void {
    const filter = this.store.filters();

    this.store
      .exportBoardPack(
        format,
        boardPackLocale(this.i18n.currentLanguage(), filter.reportingCurrency),
      )
      .pipe(
        catchError(() => {
          this.message.error(this.i18n.instant('EXEC_DSS.EXPORT_ERROR'));

          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((blob) => {
        downloadFile(
          blob,
          `board-pack-${this.store.overview()?.meta.period.to ?? 'export'}-${filter.reportingCurrency.toLowerCase()}.${format}`,
        );
        this.message.success(this.i18n.instant('EXEC_DSS.EXPORT_DONE'));
      });
  }
}
