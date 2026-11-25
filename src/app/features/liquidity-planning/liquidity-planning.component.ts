import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { LpExportFormat, TranslateService } from '@core';
import { downloadBlob, PageHeaderComponent, TranslatePipe } from '@shared';
import { LiquidityPlanningStore } from './liquidity-planning.store';
import { LpAlertsComponent } from './lp-alerts.component';
import { LpCashChartComponent } from './lp-cash-chart.component';
import { LpIndicatorsComponent } from './lp-indicators.component';
import { LpKpiHeaderComponent } from './lp-kpi-header.component';
import { LpPlanningComponent } from './lp-planning.component';
import { LpWhatIfComponent } from './lp-what-if.component';

/** Cash flow forecasting and liquidity planning workspace (Mod 017): rolling forecast, what-if, crisis indicators, alerts. */
@Component({
  selector: 'app-liquidity-planning',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    LpAlertsComponent,
    LpCashChartComponent,
    LpIndicatorsComponent,
    LpKpiHeaderComponent,
    LpPlanningComponent,
    LpWhatIfComponent,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzSpinModule,
    NzTabsModule,
  ],
  styleUrl: './liquidity-planning.scss',
  template: `
    <app-page-header [title]="'lp.title' | translate" [subtitle]="'lp.subtitle' | translate" />

    <div class="lp-toolbar lp-no-print">
      <button
        nz-button
        [nzLoading]="store.loading()"
        data-testid="lp-refresh"
        (click)="store.refresh()"
      >
        {{ 'lp.refresh' | translate }}
      </button>
      <button
        nz-button
        [nzLoading]="store.exporting() === 'xlsx'"
        data-testid="lp-export-xlsx"
        (click)="download('xlsx')"
      >
        {{ 'lp.exportXlsx' | translate }}
      </button>
      <a nz-button nzType="primary" routerLink="report" data-testid="lp-open-report">
        {{ 'lp.openReport' | translate }}
      </a>
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.error(); as error) {
        <nz-alert
          nzType="error"
          nzShowIcon
          [nzMessage]="error | translate"
          data-testid="lp-error"
        />
      }

      <app-lp-kpi-header (showAlerts)="tab.set(2)" />

      <nz-tabs [nzSelectedIndex]="tab()" (nzSelectedIndexChange)="tab.set($event)">
        <nz-tab [nzTitle]="'lp.tab.forecast' | translate">
          <div class="lp-split">
            <nz-card class="lp-main"><app-lp-cash-chart /></nz-card>
            <nz-card class="lp-side"><app-lp-what-if /></nz-card>
          </div>
        </nz-tab>
        <nz-tab [nzTitle]="'lp.tab.indicators' | translate">
          <app-lp-indicators />
        </nz-tab>
        <nz-tab [nzTitle]="'lp.tab.alerts' | translate">
          <app-lp-alerts />
        </nz-tab>
        <nz-tab [nzTitle]="'lp.tab.planning' | translate">
          <app-lp-planning />
        </nz-tab>
      </nz-tabs>
    </nz-spin>
  `,
})
export class LiquidityPlanningComponent implements OnInit {
  protected readonly store = inject(LiquidityPlanningStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  protected readonly tab = signal(0);

  ngOnInit(): void {
    void this.store.init();
  }

  protected async download(format: LpExportFormat): Promise<void> {
    const result = await this.store.download(format);

    if (result.ok && result.blob !== null) {
      downloadBlob(result.blob, result.filename);
    } else {
      this.message.error(this.i18n.translate(result.error ?? 'lp.error.generic'));
    }
  }
}
