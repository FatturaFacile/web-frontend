import { Component, effect, inject, untracked } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { IcPackage, IcPackageFormat, IcStandard, PermissionsService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { IntercompanyContextStore } from './intercompany-context.store';
import { IntercompanyNotifier } from './intercompany-notifier.service';
import { IcStatementTab, IntercompanyStatementsStore } from './intercompany-statements.store';
import { enumKey, IC_MODULE, IC_STANDARDS } from './intercompany.util';

/** Consolidated statements under FER 30, IFRS 10 or OIC 17, the shareholdings and NCI schedules and the package of the run. */
@Component({
  selector: 'app-intercompany-statements',
  styleUrl: './intercompany.scss',
  providers: [IntercompanyStatementsStore],
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    @if (!ctx.runId()) {
      <nz-alert nzType="info" nzShowIcon [nzMessage]="'intercompany.run.noRun' | translate" />
    } @else {
      <div class="toolbar">
        <span id="ic-standard-label">{{ 'intercompany.statements.standard' | translate }}</span>
        <div role="group" aria-labelledby="ic-standard-label">
          @for (standard of standards; track standard) {
            <button
              nz-button
              type="button"
              [nzType]="store.standard() === standard ? 'primary' : 'default'"
              [attr.aria-pressed]="store.standard() === standard"
              (click)="changeStandard(standard)"
            >
              {{ enumKey('standard', standard) | translate }}
            </button>
          }
        </div>
      </div>

      @if (store.error(); as key) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="key | translate" class="section" />
      }

      @if (store.statements(); as statements) {
        <p class="muted">
          {{ statements.period_start }} - {{ statements.period_end }} ({{ statements.currency }})
        </p>
        <nz-tabs [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="selectTab($event)">
          <nz-tab [nzTitle]="'intercompany.statements.balanceSheet' | translate">
            @if (statements.balance_sheet; as sheet) {
              @for (section of sheet.sections; track section.code) {
                <h4>{{ section.label_key | translate }}</h4>
                <nz-table
                  #lines
                  nzSize="small"
                  [nzData]="section.lines"
                  [nzShowPagination]="false"
                  [nzScroll]="{ x: '640px' }"
                >
                  <thead>
                    <tr>
                      <th>{{ 'intercompany.statements.account' | translate }}</th>
                      <th class="num">{{ 'intercompany.statements.standalone' | translate }}</th>
                      <th class="num">{{ 'intercompany.statements.eliminations' | translate }}</th>
                      <th class="num">{{ 'intercompany.statements.consolidated' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of lines.data; track line.account_code) {
                      <tr>
                        <td>{{ line.account_code }} {{ line.account_name }}</td>
                        <td class="num">{{ line.standalone | money: statements.currency }}</td>
                        <td class="num">{{ line.eliminations | money: statements.currency }}</td>
                        <td class="num">{{ line.consolidated | money: statements.currency }}</td>
                      </tr>
                    }
                    <tr class="total-row">
                      <td>{{ 'intercompany.common.total' | translate }}</td>
                      <td></td>
                      <td></td>
                      <td class="num">{{ section.total | money: statements.currency }}</td>
                    </tr>
                  </tbody>
                </nz-table>
              }
            }
          </nz-tab>
          <nz-tab [nzTitle]="'intercompany.statements.incomeStatement' | translate">
            @if (statements.income_statement; as sheet) {
              @for (section of sheet.sections; track section.code) {
                <h4>{{ section.label_key | translate }}</h4>
                <nz-table
                  #lines
                  nzSize="small"
                  [nzData]="section.lines"
                  [nzShowPagination]="false"
                  [nzScroll]="{ x: '640px' }"
                >
                  <thead>
                    <tr>
                      <th>{{ 'intercompany.statements.account' | translate }}</th>
                      <th class="num">{{ 'intercompany.statements.standalone' | translate }}</th>
                      <th class="num">{{ 'intercompany.statements.eliminations' | translate }}</th>
                      <th class="num">{{ 'intercompany.statements.consolidated' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of lines.data; track line.account_code) {
                      <tr>
                        <td>{{ line.account_code }} {{ line.account_name }}</td>
                        <td class="num">{{ line.standalone | money: statements.currency }}</td>
                        <td class="num">{{ line.eliminations | money: statements.currency }}</td>
                        <td class="num">{{ line.consolidated | money: statements.currency }}</td>
                      </tr>
                    }
                    <tr class="total-row">
                      <td>{{ 'intercompany.common.total' | translate }}</td>
                      <td></td>
                      <td></td>
                      <td class="num">{{ section.total | money: statements.currency }}</td>
                    </tr>
                  </tbody>
                </nz-table>
              }
            }
          </nz-tab>
          <nz-tab [nzTitle]="'intercompany.statements.cashFlow' | translate">
            @if (statements.cash_flow; as flow) {
              <nz-table #flowLines nzSize="small" [nzData]="flow.lines" [nzShowPagination]="false">
                <thead>
                  <tr>
                    <th>{{ 'intercompany.statements.item' | translate }}</th>
                    <th class="num">{{ 'intercompany.statements.consolidated' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{{ 'intercompany.statements.openingCash' | translate }}</td>
                    <td class="num">{{ flow.opening_cash | money: statements.currency }}</td>
                  </tr>
                  @for (line of flowLines.data; track line.code) {
                    <tr>
                      <td>{{ line.label_key | translate }}</td>
                      <td class="num">{{ line.amount | money: statements.currency }}</td>
                    </tr>
                  }
                  <tr>
                    <td>{{ 'intercompany.statements.operating' | translate }}</td>
                    <td class="num">{{ flow.operating | money: statements.currency }}</td>
                  </tr>
                  <tr>
                    <td>{{ 'intercompany.statements.investing' | translate }}</td>
                    <td class="num">{{ flow.investing | money: statements.currency }}</td>
                  </tr>
                  <tr>
                    <td>{{ 'intercompany.statements.financing' | translate }}</td>
                    <td class="num">{{ flow.financing | money: statements.currency }}</td>
                  </tr>
                  <tr>
                    <td>{{ 'intercompany.statements.fxEffect' | translate }}</td>
                    <td class="num">{{ flow.fx_effect | money: statements.currency }}</td>
                  </tr>
                  <tr class="total-row">
                    <td>{{ 'intercompany.statements.netChange' | translate }}</td>
                    <td class="num">{{ flow.net_change | money: statements.currency }}</td>
                  </tr>
                  <tr class="total-row">
                    <td>{{ 'intercompany.statements.closingCash' | translate }}</td>
                    <td class="num">{{ flow.closing_cash | money: statements.currency }}</td>
                  </tr>
                </tbody>
              </nz-table>
            }
          </nz-tab>
        </nz-tabs>
        <p>
          {{ 'intercompany.statements.translationReserve' | translate }}:
          <strong>{{ statements.translation_reserve | money: statements.currency }}</strong>
          &nbsp;|&nbsp; {{ 'intercompany.statements.nciNetAssets' | translate }}:
          <strong>{{ statements.nci.net_assets | money: statements.currency }}</strong>
          &nbsp;|&nbsp; {{ 'intercompany.statements.nciProfit' | translate }}:
          <strong>{{ statements.nci.profit | money: statements.currency }}</strong>
        </p>
      }

      @if (store.shareholdings(); as holdings) {
        <nz-card [nzTitle]="'intercompany.statements.shareholdings' | translate" class="section">
          <nz-table
            #holdingRows
            nzSize="small"
            [nzData]="holdings.rows"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '760px' }"
          >
            <thead>
              <tr>
                <th>{{ 'intercompany.structure.entity' | translate }}</th>
                <th>{{ 'intercompany.structure.holder' | translate }}</th>
                <th class="num">{{ 'intercompany.statements.direct' | translate }} %</th>
                <th class="num">{{ 'intercompany.statements.effective' | translate }} %</th>
                <th class="num">{{ 'intercompany.statements.voting' | translate }} %</th>
                <th>{{ 'intercompany.structure.method' | translate }}</th>
                <th>{{ 'intercompany.structure.currency' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of holdingRows.data; track row.member_tenant_id) {
                <tr>
                  <td>{{ row.name }}</td>
                  <td>{{ row.holder_tenant_id ? ctx.memberName(row.holder_tenant_id) : '-' }}</td>
                  <td class="num">{{ row.direct_percentage }}</td>
                  <td class="num">{{ row.effective_percentage }}</td>
                  <td class="num">{{ row.voting_percentage }}</td>
                  <td>
                    {{ enumKey('consolidationMethod', row.consolidation_method) | translate }}
                  </td>
                  <td>{{ row.currency }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      }

      @if (store.nci(); as nci) {
        <nz-card [nzTitle]="'intercompany.statements.nciSchedule' | translate" class="section">
          <nz-table
            #nciRows
            nzSize="small"
            [nzData]="nci.rows"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '760px' }"
          >
            <thead>
              <tr>
                <th>{{ 'intercompany.structure.entity' | translate }}</th>
                <th class="num">{{ 'intercompany.structure.ownership' | translate }} %</th>
                <th class="num">NCI %</th>
                <th class="num">{{ 'intercompany.statements.nciOpening' | translate }}</th>
                <th class="num">{{ 'intercompany.statements.nciProfit' | translate }}</th>
                <th class="num">{{ 'intercompany.statements.nciNetAssets' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of nciRows.data; track row.member_tenant_id) {
                <tr>
                  <td>{{ row.name }}</td>
                  <td class="num">{{ row.ownership_percentage }}</td>
                  <td class="num">{{ row.nci_percentage }}</td>
                  <td class="num">{{ row.nci_opening | money: nci.currency }}</td>
                  <td class="num">{{ row.nci_profit | money: nci.currency }}</td>
                  <td class="num">{{ row.nci_net_assets | money: nci.currency }}</td>
                </tr>
              }
              <tr class="total-row">
                <td>{{ 'intercompany.common.total' | translate }}</td>
                <td></td>
                <td></td>
                <td></td>
                <td class="num">{{ nci.total_nci_profit | money: nci.currency }}</td>
                <td class="num">{{ nci.total_nci_net_assets | money: nci.currency }}</td>
              </tr>
            </tbody>
          </nz-table>
        </nz-card>
      }

      <nz-card [nzTitle]="'intercompany.package.title' | translate" class="section">
        <p class="muted">{{ 'intercompany.package.hint' | translate }}</p>
        @if (canWrite) {
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="store.generating()"
            (click)="generate()"
          >
            {{ 'intercompany.package.generate' | translate }}
          </button>
        }
        <nz-table #packages nzSize="small" [nzData]="store.packages()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'intercompany.statements.standard' | translate }}</th>
              <th>{{ 'intercompany.package.generatedAt' | translate }}</th>
              <th>{{ 'intercompany.package.sections' | translate }}</th>
              <th>{{ 'intercompany.package.checksum' | translate }}</th>
              <th>{{ 'intercompany.package.download' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (item of packages.data; track item.id) {
              <tr>
                <td>{{ enumKey('standard', item.standard) | translate }}</td>
                <td>{{ item.generated_at }}</td>
                <td>
                  @for (section of item.sections; track section) {
                    <nz-tag>{{ 'intercompany.package.section.' + section | translate }}</nz-tag>
                  }
                </td>
                <td>
                  <code>{{ item.checksum.slice(0, 12) }}</code>
                </td>
                <td>
                  @for (format of formats; track format) {
                    <button nz-button nzSize="small" type="button" (click)="download(item, format)">
                      {{ format.toUpperCase() }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
  `,
})
export class IntercompanyStatementsComponent {
  protected readonly ctx = inject(IntercompanyContextStore);
  protected readonly store = inject(IntercompanyStatementsStore);
  private readonly notifier = inject(IntercompanyNotifier);
  protected readonly canWrite = inject(PermissionsService).canWrite(IC_MODULE);

  protected readonly enumKey = enumKey;
  protected readonly standards: readonly IcStandard[] = IC_STANDARDS;
  protected readonly formats: readonly IcPackageFormat[] = ['xlsx', 'csv', 'json'];
  private readonly tabs: readonly IcStatementTab[] = [
    'balance_sheet',
    'income_statement',
    'cash_flow',
  ];

  constructor() {
    effect(() => {
      const runId = this.ctx.runId();
      if (runId !== null) {
        const standard = untracked(() => this.store.standard());
        untracked(() => void this.store.load(runId, standard));
      }
    });
  }

  protected tabIndex(): number {
    return this.tabs.indexOf(this.store.tab());
  }

  protected selectTab(index: number): void {
    this.store.selectTab(this.tabs[index] ?? 'balance_sheet');
  }

  protected changeStandard(standard: IcStandard): void {
    const runId = this.ctx.runId();
    if (runId !== null) {
      void this.store.loadStatements(runId, standard);
    }
  }

  protected async generate(): Promise<void> {
    const runId = this.ctx.runId();
    if (runId !== null) {
      this.notifier.report(await this.store.generate(runId), 'intercompany.package.generated');
    }
  }

  protected async download(item: IcPackage, format: IcPackageFormat): Promise<void> {
    const outcome = await this.store.download(item, format);
    if (!outcome.ok) {
      this.notifier.report(outcome);
    }
  }
}
