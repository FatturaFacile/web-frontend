import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { gaugeArc, num, oeeBand, ratioPercent } from './command-center.utils';
import { ManufacturingFacadeService } from './manufacturing.facade';

interface GaugeRow {
  id: string;
  code: string;
  oee: number | null;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  band: 'good' | 'warn' | 'bad' | 'none';
  arc: string;
}

/**
 * Plant control tower: OEE gauges per work centre, the MTO/MTS/ATO pipeline, the machine status matrix (polled), the
 * bottlenecks, MRP exceptions and the WIP valuation against standard cost.
 */
@Component({
  selector: 'app-control-tower',
  providers: [ManufacturingFacadeService],
  imports: [
    DecimalPipe,
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputNumberModule,
    NzSwitchModule,
    NzTagModule,
  ],
  styles: `
    .toolbar { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 16px }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px }
    .gauges { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px }
    .gauge { text-align: center }
    .gauge svg { width: 140px; height: 84px }
    .track { fill: none; stroke: var(--ant-color-border, #d9d9d9); stroke-width: 12; stroke-linecap: round }
    .arc { fill: none; stroke-width: 12; stroke-linecap: round }
    .good .arc { stroke: #237804 } .warn .arc { stroke: #ad6800 } .bad .arc { stroke: #a8071a } .none .arc { stroke: #595959 }
    .value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums }
    .sub { font-size: 12px; color: var(--ant-color-text-secondary, #595959) }
    .pipeline { display: flex; gap: 8px; align-items: stretch }
    .stage { flex: 1; padding: 12px; border: 1px solid var(--ant-color-border, #d9d9d9); border-radius: 8px; text-align: center }
    .stage strong { display: block; font-size: 28px; font-variant-numeric: tabular-nums }
    .bar { height: 6px; border-radius: 3px; background: #0958d9; margin-top: 8px }
    table { width: 100%; border-collapse: collapse }
    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0) }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums }
    .state-RUNNING { color: #237804 } .state-SETUP { color: #0958d9 } .state-IDLE { color: #595959 }
    .state-FAULT { color: #a8071a; font-weight: 600 } .state-MAINTENANCE { color: #ad6800; font-weight: 600 }
    .wip svg { width: 100%; height: 120px }
    .over { color: #a8071a } .under { color: #237804 }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap }
  `,
  template: `
    <app-page-header
      [title]="'MFG_CC.TOWER_TITLE' | translate"
      [subtitle]="'MFG_CC.TOWER_SUBTITLE' | translate"
    ></app-page-header>

    <div class="toolbar">
      <label for="cc-window">{{ 'MFG_CC.WINDOW_DAYS' | translate }}</label>
      <nz-input-number
        id="cc-window"
        [nzMin]="1"
        [nzMax]="365"
        [ngModel]="facade.windowDays()"
        (ngModelChange)="windowChanged($event)"
      ></nz-input-number>
      <label for="cc-live">{{ 'MFG_CC.LIVE_UPDATE' | translate }}</label>
      <nz-switch id="cc-live" [ngModel]="facade.live()" (ngModelChange)="toggleLive($event)"></nz-switch>
      <button nz-button type="button" data-testid="refresh" [nzLoading]="facade.cockpitLoading()" (click)="refresh()">
        {{ 'MFG_CC.REFRESH' | translate }}
      </button>
      <span class="sub" aria-live="polite">
        @switch (facade.connection()) {
          @case ('sse') {
            {{ 'MFG_CC.CONNECTION_SSE' | translate }}
          }
          @case ('polling') {
            {{ 'MFG_CC.POLLING_EVERY' | translate: { seconds: facade.pollMs() / 1000 } }}
          }
          @default {
            {{ 'MFG_CC.POLLING_OFF' | translate }}
          }
        }
      </span>
    </div>

    @if (facade.cockpitError(); as error) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="'MFG_CC.LOAD_ERROR' | translate" [nzDescription]="error"></nz-alert>
    }

    @if (facade.cockpit(); as cockpit) {
      @if (facade.staleGateways().length > 0) {
        <nz-alert
          nzType="warning"
          nzShowIcon
          style="margin-bottom: 16px"
          [nzMessage]="'MFG_CC.STALE_GATEWAYS' | translate: { count: facade.staleGateways().length }"
        ></nz-alert>
      }

      <div class="grid">
        <nz-card [nzTitle]="'MFG_CC.PIPELINE' | translate">
          <div class="pipeline" role="list">
            @for (stage of facade.pipeline(); track stage.strategy) {
              <div class="stage" role="listitem">
                <span>{{ 'MFG_CC.STRATEGY_' + stage.strategy | translate }}</span>
                <strong>{{ stage.count }}</strong>
                <span class="sub">{{ stage.share | number: '1.0-1' }}%</span>
                <div class="bar" [style.width.%]="stage.share" aria-hidden="true"></div>
              </div>
            }
          </div>
          <p class="sub">{{ 'MFG_CC.OPEN_ORDERS' | translate: { count: cockpit.orders.open } }}</p>
        </nz-card>

        <nz-card [nzTitle]="'MFG_CC.MACHINE_MATRIX' | translate">
          <table>
            <caption class="sr-only">{{ 'MFG_CC.MACHINE_MATRIX' | translate }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ 'MFG_CC.STATE' | translate }}</th>
                <th scope="col" class="num">{{ 'MFG_CC.MACHINES' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of facade.machineMatrix(); track row.state) {
                <tr>
                  <th scope="row" [class]="'state-' + row.state">{{ 'MFG_CC.MACHINE_' + row.state | translate }}</th>
                  <td class="num">{{ row.count }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (facade.machineAlerts().length > 0) {
            <h4>{{ 'MFG_CC.ALERTS' | translate }}</h4>
            <ul>
              @for (alert of facade.machineAlerts(); track alert.machine_id) {
                <li [class]="'state-' + alert.state">
                  {{ alert.machine_code }} — {{ 'MFG_CC.MACHINE_' + alert.state | translate }}
                  @if (alert.since) {
                    <span class="sub">({{ alert.since }})</span>
                  }
                </li>
              }
            </ul>
          }
        </nz-card>

        <nz-card [nzTitle]="'MFG_CC.WIP_VS_STANDARD' | translate">
          @if (facade.wip(); as wip) {
            <div class="wip">
              <svg viewBox="0 0 300 120" role="img" [attr.aria-label]="'MFG_CC.WIP_CHART_LABEL' | translate: wipLabel()">
                <rect x="10" y="14" height="34" fill="#0958d9" [attr.width]="(wip.valuation / wip.max) * 270"></rect>
                <rect x="10" y="68" height="34" fill="#722ed1" [attr.width]="(wip.standard / wip.max) * 270"></rect>
              </svg>
              <table>
                <tbody>
                  <tr><th scope="row">{{ 'MFG_CC.WIP_VALUATION' | translate }}</th><td class="num">{{ wip.valuation | number: '1.2-2' }}</td></tr>
                  <tr><th scope="row">{{ 'MFG_CC.STANDARD_COST' | translate }}</th><td class="num">{{ wip.standard | number: '1.2-2' }}</td></tr>
                  <tr>
                    <th scope="row">{{ 'MFG_CC.VARIANCE' | translate }}</th>
                    <td class="num" [class.over]="wip.variance > 0" [class.under]="wip.variance < 0">{{ wip.variance | number: '1.2-2' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          }
        </nz-card>

        <nz-card [nzTitle]="'MFG_CC.BOTTLENECKS' | translate">
          @if (facade.bottlenecks().length === 0) {
            <nz-empty [nzNotFoundContent]="'MFG_CC.NO_BOTTLENECKS' | translate"></nz-empty>
          } @else {
            <table>
              <caption class="sr-only">{{ 'MFG_CC.BOTTLENECKS' | translate }}</caption>
              <thead>
                <tr>
                  <th scope="col">{{ 'MFG_CC.WORK_CENTER' | translate }}</th>
                  <th scope="col" class="num">{{ 'MFG_CC.UTILIZATION' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (b of facade.bottlenecks(); track b.work_center_id) {
                  <tr>
                    <th scope="row">{{ b.work_center_code }}</th>
                    <td class="num">{{ b.utilization_percent | number: '1.0-1' }}%</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </nz-card>

        <nz-card [nzTitle]="'MFG_CC.MRP_EXCEPTIONS' | translate">
          <p>{{ 'MFG_CC.SHORTAGES_COUNT' | translate: { count: cockpit.mrp_exceptions.shortages } }}</p>
          @if (cockpit.mrp_exceptions.items.length > 0) {
            <table>
              <caption class="sr-only">{{ 'MFG_CC.MRP_EXCEPTIONS' | translate }}</caption>
              <thead>
                <tr>
                  <th scope="col">{{ 'MFG_CC.REQUIRED_DATE' | translate }}</th>
                  <th scope="col" class="num">{{ 'MFG_CC.NET_SHORTAGE' | translate }}</th>
                  <th scope="col">{{ 'MFG_CC.ACTION' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (item of cockpit.mrp_exceptions.items; track $index) {
                  <tr>
                    <td>{{ item.required_date }}</td>
                    <td class="num">{{ item.net_shortage }}</td>
                    <td>{{ item.recommended_action }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </nz-card>

        <nz-card [nzTitle]="'MFG_CC.KPIS' | translate">
          <table>
            <tbody>
              <tr><th scope="row">{{ 'MFG_CC.ORDERS_COMPLETED' | translate }}</th><td class="num">{{ cockpit.kpis.orders.completed }}</td></tr>
              <tr><th scope="row">{{ 'MFG_CC.ON_TIME' | translate }}</th><td class="num">{{ cockpit.kpis.orders.on_time_percent ?? '–' }}%</td></tr>
              <tr><th scope="row">{{ 'MFG_CC.LEAD_TIME_DAYS' | translate }}</th><td class="num">{{ cockpit.kpis.orders.average_lead_time_days ?? '–' }}</td></tr>
              <tr><th scope="row">{{ 'MFG_CC.SCRAP_RATE' | translate }}</th><td class="num">{{ cockpit.kpis.quality.scrap_rate_percent ?? '–' }}%</td></tr>
              <tr><th scope="row">{{ 'MFG_CC.CLOSED_VARIANCE' | translate }}</th><td class="num">{{ cockpit.kpis.variances.total }}</td></tr>
            </tbody>
          </table>
        </nz-card>
      </div>

      <nz-card style="margin-top: 16px" [nzTitle]="'MFG_CC.OEE' | translate">
        @if (gauges().length === 0) {
          <nz-empty [nzNotFoundContent]="'MFG_CC.NO_OEE' | translate"></nz-empty>
        } @else {
          <div class="gauges">
            @for (g of gauges(); track g.id) {
              <div class="gauge" [class]="g.band">
                <svg viewBox="0 0 140 84" role="img" [attr.aria-label]="'MFG_CC.OEE_GAUGE_LABEL' | translate: { code: g.code, value: g.oee === null ? '–' : g.oee }">
                  <path class="track" d="M 16 70 A 54 54 0 0 1 124 70"></path>
                  <path class="arc" [attr.d]="g.arc"></path>
                  <text x="70" y="66" text-anchor="middle" class="value" fill="currentColor">{{ g.oee === null ? '–' : g.oee + '%' }}</text>
                </svg>
                <div>
                  <strong>{{ g.code }}</strong>
                </div>
                <div class="sub">
                  A {{ g.availability ?? '–' }}% · P {{ g.performance ?? '–' }}% · Q {{ g.quality ?? '–' }}%
                </div>
              </div>
            }
          </div>
        }
      </nz-card>
    } @else if (!facade.cockpitLoading() && !facade.cockpitError()) {
      <nz-empty [nzNotFoundContent]="'MFG_CC.NO_DATA' | translate"></nz-empty>
    }
  `,
})
export class ControlTowerComponent implements OnInit {
  protected readonly facade = inject(ManufacturingFacadeService);

  protected readonly wipLabel = computed(() => ({
    wip: (this.facade.wip()?.valuation ?? 0).toFixed(2),
    standard: (this.facade.wip()?.standard ?? 0).toFixed(2),
  }));

  protected readonly gauges = computed<GaugeRow[]>(() =>
    this.facade.oee().map((row) => {
      const oee = ratioPercent(row.oee);
      return {
        id: row.work_center_id,
        code: row.work_center_code,
        oee,
        availability: ratioPercent(row.availability),
        performance: ratioPercent(row.performance),
        quality: ratioPercent(row.quality),
        band: oeeBand(oee),
        arc: gaugeArc(num(oee)),
      };
    }),
  );

  ngOnInit(): void {
    this.facade.loadGateways();
    this.facade.startLive();
  }

  protected refresh(): void {
    this.facade.refreshCockpit().subscribe({ error: () => undefined });
  }

  protected windowChanged(days: number | null): void {
    this.facade.setWindowDays(days ?? 30);
    this.refresh();
  }

  protected toggleLive(on: boolean): void {
    if (on) {
      this.facade.startLive();
    } else {
      this.facade.stopLive();
    }
  }
}
