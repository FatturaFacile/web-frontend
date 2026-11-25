import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { LpExportFormat, TranslateService } from '@core';
import { downloadBlob, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { LiquidityPlanningStore } from './liquidity-planning.store';
import { capitalTone, dscrTone, ebaTone, pfnTone, tagColor } from './liquidity-planning.util';

/** Board and bank report aligned with the EBA guidelines on loan origination and monitoring: printable, PDF and Excel. */
@Component({
  selector: 'app-lp-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzSpinModule,
    NzTagModule,
  ],
  styleUrl: './liquidity-planning.scss',
  template: `
    <app-page-header
      [title]="'lp.report.title' | translate"
      [subtitle]="'lp.report.subtitle' | translate"
    />

    <div class="lp-toolbar lp-no-print">
      <a nz-button routerLink="..">{{ 'lp.report.back' | translate }}</a>
      <button nz-button nzType="primary" data-testid="lp-print" (click)="print()">
        {{ 'lp.report.print' | translate }}
      </button>
      <button
        nz-button
        [nzLoading]="store.exporting() === 'pdf'"
        data-testid="lp-pdf"
        (click)="download('pdf')"
      >
        {{ 'lp.report.pdf' | translate }}
      </button>
      <button
        nz-button
        [nzLoading]="store.exporting() === 'xlsx'"
        data-testid="lp-xlsx"
        (click)="download('xlsx')"
      >
        {{ 'lp.report.xlsx' | translate }}
      </button>
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.error(); as error) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate" />
      }

      @if (store.report(); as report) {
        <article class="lp-report" data-testid="lp-report">
          <header class="lp-report-head">
            <h2>{{ report.company.name }}</h2>
            <p>
              {{ 'lp.report.asOf' | translate: { date: report.as_of } }} ·
              {{ 'lp.report.generated' | translate: { date: report.generated_at } }} ·
              {{ 'lp.settings.jurisdictionValue.' + report.jurisdiction | translate }}
            </p>
            @if (store.isSimulating()) {
              <nz-tag nzColor="orange">{{ 'lp.report.simulated' | translate }}</nz-tag>
            }
          </header>

          <section>
            <h3>{{ 'lp.report.eba' | translate }}</h3>
            <ul class="lp-eba" data-testid="lp-eba">
              @for (section of report.eba.sections; track section.key) {
                <li>
                  <nz-tag [nzColor]="color(ebaToneOf(section.status))">
                    {{ 'lp.report.status.' + section.status | translate }}
                  </nz-tag>
                  <strong>{{ section.title_key | translate }}</strong>
                  <span>{{ section.summary_key | translate: section.params }}</span>
                </li>
              }
            </ul>
          </section>

          <section>
            <h3>{{ 'lp.report.projection' | translate }}</h3>
            <table class="lp-print-table">
              <thead>
                <tr>
                  <th>{{ 'lp.report.col.horizon' | translate }}</th>
                  <th class="lp-num">{{ 'lp.report.col.inflows' | translate }}</th>
                  <th class="lp-num">{{ 'lp.report.col.outflows' | translate }}</th>
                  <th class="lp-num">{{ 'lp.report.col.net' | translate }}</th>
                  <th class="lp-num">{{ 'lp.report.col.closing' | translate }}</th>
                  <th class="lp-num">{{ 'lp.report.col.lowest' | translate }}</th>
                  @if (store.isSimulating()) {
                    <th class="lp-num">{{ 'lp.report.col.scenarioClosing' | translate }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (horizon of report.overview.horizons; track horizon.days) {
                  <tr>
                    <td>{{ 'lp.chart.days' | translate: { days: horizon.days } }}</td>
                    <td class="lp-num">{{ horizon.baseline.inflows | money: report.currency }}</td>
                    <td class="lp-num">{{ horizon.baseline.outflows | money: report.currency }}</td>
                    <td class="lp-num">{{ horizon.baseline.net | money: report.currency }}</td>
                    <td class="lp-num">
                      {{ horizon.baseline.closing_balance | money: report.currency }}
                    </td>
                    <td class="lp-num">
                      {{ horizon.baseline.min_balance | money: report.currency }}
                    </td>
                    @if (store.isSimulating()) {
                      <td class="lp-num">
                        {{
                          horizon.scenario
                            ? (horizon.scenario.closing_balance | money: report.currency)
                            : ''
                        }}
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </section>

          <section>
            <h3>{{ 'lp.report.indicators' | translate }}</h3>
            @let ind = report.overview.indicators.baseline;
            <table class="lp-print-table">
              <tbody>
                <tr>
                  <th>{{ 'lp.dscr.title' | translate }}</th>
                  <td>
                    {{ ind.dscr.value ?? ('lp.common.notAvailable' | translate) }}
                    <nz-tag [nzColor]="color(dscrToneOf(ind.dscr.status))">{{
                      'lp.dscr.status.' + ind.dscr.status | translate
                    }}</nz-tag>
                  </td>
                  <td>
                    {{ 'lp.dscr.operatingCashFlow' | translate }}:
                    {{ ind.dscr.operating_cash_flow | money: report.currency }} /
                    {{ 'lp.dscr.debtService' | translate }}:
                    {{ ind.dscr.debt_service.total | money: report.currency }}
                  </td>
                </tr>
                <tr>
                  <th>{{ 'lp.capital.title' | translate }}</th>
                  <td>
                    <nz-tag [nzColor]="color(capitalToneOf(ind.capital.status))">{{
                      'lp.capital.status.' + ind.capital.status | translate
                    }}</nz-tag>
                  </td>
                  <td>
                    {{ 'lp.capital.netEquity' | translate }}:
                    {{ ind.capital.net_equity | money: report.currency }} /
                    {{ 'lp.capital.shareCapital' | translate }}:
                    {{ ind.capital.share_capital | money: report.currency }}
                  </td>
                </tr>
                <tr>
                  <th>{{ 'lp.pfn.title' | translate }}</th>
                  <td>
                    {{ ind.pfn.pfn_ebitda ?? ('lp.common.notAvailable' | translate) }}
                    <nz-tag [nzColor]="color(pfnToneOf(ind.pfn.status))">{{
                      'lp.pfn.status.' + ind.pfn.status | translate
                    }}</nz-tag>
                  </td>
                  <td>
                    {{ 'lp.pfn.pfn' | translate }}: {{ ind.pfn.pfn | money: report.currency }} /
                    {{ 'lp.pfn.ebitda' | translate }}: {{ ind.pfn.ebitda | money: report.currency }}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3>{{ 'lp.report.dscrBreakdown' | translate }}</h3>
            <table class="lp-print-table">
              <thead>
                <tr>
                  <th>{{ 'lp.dscr.col.date' | translate }}</th>
                  <th>{{ 'lp.dscr.col.kind' | translate }}</th>
                  <th>{{ 'lp.dscr.col.category' | translate }}</th>
                  <th class="lp-num">{{ 'lp.dscr.col.amount' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of ind.dscr.lines; track $index) {
                  <tr>
                    <td>{{ line.date }}</td>
                    <td>{{ 'lp.dscr.kind.' + line.kind | translate }}</td>
                    <td>
                      {{
                        line.label_key
                          ? (line.label_key | translate)
                          : (line.label ?? line.category)
                      }}
                    </td>
                    <td class="lp-num">{{ line.amount | money: report.currency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>

          @if (report.overview.alerts.length > 0) {
            <section>
              <h3>{{ 'lp.report.alerts' | translate }}</h3>
              <ul>
                @for (alert of report.overview.alerts; track alert.id) {
                  <li>
                    <nz-tag>{{ 'lp.alerts.severity.' + alert.severity | translate }}</nz-tag>
                    {{ alert.title_key | translate: alert.params }}
                  </li>
                }
              </ul>
            </section>
          }
        </article>
      }
    </nz-spin>
  `,
})
export class LpReportComponent implements OnInit {
  protected readonly store = inject(LiquidityPlanningStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly dscrToneOf = dscrTone;
  protected readonly pfnToneOf = pfnTone;
  protected readonly capitalToneOf = capitalTone;
  protected readonly ebaToneOf = ebaTone;
  protected readonly color = tagColor;

  ngOnInit(): void {
    void this.store.loadReport();
  }

  protected print(): void {
    window.print();
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
