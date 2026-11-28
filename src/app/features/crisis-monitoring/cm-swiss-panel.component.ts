import { Component, inject, input } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { MoneyPipe, TranslatePipe } from '@shared';
import { CmRangruecktrittComponent } from './cm-rangruecktritt.component';
import { CrisisMonitoringStore } from './crisis-monitoring.store';
import { formatRatio, monthLabel, progressStatus, statusTone } from './crisis-monitoring.util';

/** Switzerland panel: Art. 725 liquidity plan, Art. 725a capital loss, Art. 725b over-indebtedness and the Rangruecktritt manager. */
@Component({
  selector: 'app-cm-swiss-panel',
  imports: [
    MoneyPipe,
    TranslatePipe,
    CmRangruecktrittComponent,
    NzCardModule,
    NzEmptyModule,
    NzProgressModule,
    NzTableModule,
    NzTagModule,
  ],
  styleUrl: './crisis-monitoring.scss',
  template: `
    @if (store.dashboard(); as dashboard) {
      @let swiss = dashboard.swiss;
      <div class="cm-toolbar">
        <nz-tag [nzColor]="tone(swiss.overall_status)" data-testid="cm-swiss-overall">
          {{ 'crisis.swiss.overall' | translate }}:
          {{ 'crisis.status.' + swiss.overall_status | translate }}
        </nz-tag>
      </div>

      <div class="cm-card-grid">
        <nz-card data-testid="cm-art725" [nzTitle]="'crisis.swiss.art725.title' | translate">
          <nz-tag [nzColor]="tone(swiss.art725.status)">
            {{ 'crisis.status.' + swiss.art725.status | translate }}
          </nz-tag>
          <p class="cm-note">{{ 'crisis.swiss.art725.hint' | translate }}</p>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725.openingCash' | translate }}</span>
            <span>{{ swiss.art725.opening_cash | money: store.currency() }}</span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725.creditLines' | translate }}</span>
            <span>{{ swiss.art725.committed_credit_lines | money: store.currency() }}</span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725.minCash' | translate }}</span>
            <span>
              {{ swiss.art725.min_cumulative_cash | money: store.currency() }}
              @if (swiss.art725.min_month; as month) {
                ({{ month3(month) }})
              }
            </span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725.coverage6' | translate }}</span>
            <span>{{ coverage(swiss.art725.coverage_6m) }}</span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725.coverage12' | translate }}</span>
            <span>{{ coverage(swiss.art725.coverage_12m) }}</span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725.runway' | translate }}</span>
            <span>
              @if (swiss.art725.runway_months === null) {
                {{ 'crisis.swiss.art725.runwayUnlimited' | translate }}
              } @else {
                {{
                  'crisis.swiss.art725.runwayMonths'
                    | translate: { months: swiss.art725.runway_months }
                }}
              }
            </span>
          </div>
          @if (swiss.art725.first_negative_month; as negative) {
            <nz-tag nzColor="error" data-testid="cm-negative-month">
              {{ 'crisis.swiss.art725.negativeFrom' | translate: { month: month3(negative) } }}
            </nz-tag>
          }

          @if (swiss.art725.plan.length > 0) {
            <nz-table
              #plan
              nzSize="small"
              [nzData]="swiss.art725.plan"
              [nzShowPagination]="false"
              [nzScroll]="{ x: '420px' }"
            >
              <thead>
                <tr>
                  <th>{{ 'crisis.swiss.art725.col.month' | translate }}</th>
                  <th class="cm-num">{{ 'crisis.swiss.art725.col.net' | translate }}</th>
                  <th class="cm-num">{{ 'crisis.swiss.art725.col.closing' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of plan.data; track row.month) {
                  <tr>
                    <td>{{ month3(row.month) }}</td>
                    <td class="cm-num">{{ row.net | money: store.currency() }}</td>
                    <td class="cm-num" [class.cm-negative]="isNegative(row.closing_cash)">
                      {{ row.closing_cash | money: store.currency() }}
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </nz-card>

        <nz-card data-testid="cm-art725a" [nzTitle]="'crisis.swiss.art725a.title' | translate">
          <nz-tag [nzColor]="tone(swiss.art725a.status)">
            {{ 'crisis.status.' + swiss.art725a.status | translate }}
          </nz-tag>
          <p class="cm-note">{{ 'crisis.swiss.art725a.hint' | translate }}</p>
          @if (!swiss.art725a.configured) {
            <nz-tag nzColor="warning" data-testid="cm-capital-unconfigured">
              {{ 'crisis.swiss.art725a.notConfigured' | translate }}
            </nz-tag>
          }
          <nz-progress
            [nzPercent]="clampPercent(swiss.art725a.meter_percent)"
            [nzStatus]="progress(swiss.art725a.status)"
            [nzFormat]="percentFormat"
          />
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725a.netAssets' | translate }}</span>
            <span>{{ swiss.art725a.net_assets | money: store.currency() }}</span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725a.shareCapital' | translate }}</span>
            <span>{{ swiss.art725a.share_capital | money: store.currency() }}</span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725a.reserves' | translate }}</span>
            <span>{{ swiss.art725a.statutory_reserves | money: store.currency() }}</span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725a.protected' | translate }}</span>
            <span>{{ swiss.art725a.protected_capital | money: store.currency() }}</span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725a.required' | translate }}</span>
            <span>{{ swiss.art725a.required_net_assets | money: store.currency() }}</span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725a.coverage' | translate }}</span>
            <strong>{{ coverage(swiss.art725a.coverage_ratio) }}</strong>
          </div>
          @if (swiss.art725a.capital_loss) {
            <nz-tag nzColor="error" data-testid="cm-capital-loss">
              {{ 'crisis.swiss.art725a.capitalLoss' | translate }}
            </nz-tag>
          }
        </nz-card>

        <nz-card data-testid="cm-art725b" [nzTitle]="'crisis.swiss.art725b.title' | translate">
          <nz-tag [nzColor]="tone(swiss.art725b.status)">
            {{ 'crisis.status.' + swiss.art725b.status | translate }}
          </nz-tag>
          <p class="cm-note">{{ 'crisis.swiss.art725b.hint' | translate }}</p>
          <p class="cm-note">
            {{ 'crisis.swiss.art725b.basis' | translate }}:
            <strong>{{ 'crisis.basis.' + swiss.art725b.basis | translate }}</strong>
          </p>
          <table class="cm-compare">
            <thead>
              <tr>
                <th></th>
                <th class="cm-num">{{ 'crisis.basis.going_concern' | translate }}</th>
                <th class="cm-num">{{ 'crisis.basis.liquidation' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ 'crisis.swiss.art725b.assets' | translate }}</td>
                <td class="cm-num">
                  {{ swiss.art725b.going_concern.assets | money: store.currency() }}
                </td>
                <td class="cm-num">
                  {{ swiss.art725b.liquidation.assets | money: store.currency() }}
                </td>
              </tr>
              <tr>
                <td>{{ 'crisis.swiss.art725b.liabilities' | translate }}</td>
                <td class="cm-num">
                  {{ swiss.art725b.going_concern.liabilities | money: store.currency() }}
                </td>
                <td class="cm-num">
                  {{ swiss.art725b.liquidation.liabilities | money: store.currency() }}
                </td>
              </tr>
              <tr>
                <td>{{ 'crisis.swiss.art725b.net' | translate }}</td>
                <td class="cm-num" [class.cm-negative]="swiss.art725b.going_concern.overindebted">
                  {{ swiss.art725b.going_concern.net | money: store.currency() }}
                </td>
                <td class="cm-num" [class.cm-negative]="swiss.art725b.liquidation.overindebted">
                  {{ swiss.art725b.liquidation.net | money: store.currency() }}
                </td>
              </tr>
            </tbody>
          </table>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725b.shortfall' | translate }}</span>
            <span>{{ swiss.art725b.shortfall | money: store.currency() }}</span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725b.subordinated' | translate }}</span>
            <span>{{ swiss.art725b.subordinated_covered | money: store.currency() }}</span>
          </div>
          <div class="cm-kv">
            <span>{{ 'crisis.swiss.art725b.remaining' | translate }}</span>
            <strong>{{ swiss.art725b.remaining_shortfall | money: store.currency() }}</strong>
          </div>
          @if (swiss.art725b.court_notification_required) {
            <nz-tag nzColor="error" data-testid="cm-court-notification">
              {{ 'crisis.swiss.art725b.courtRequired' | translate }}
            </nz-tag>
          } @else if (swiss.art725b.overindebted) {
            <nz-tag nzColor="warning">
              {{ 'crisis.swiss.art725b.overindebted' | translate }}
            </nz-tag>
          }
        </nz-card>
      </div>

      <h3 class="cm-section">{{ 'crisis.loans.section' | translate }}</h3>
      <app-cm-rangruecktritt [canWrite]="canWrite()" />
    } @else {
      <nz-empty [nzNotFoundContent]="'crisis.empty' | translate" />
    }
  `,
})
export class CmSwissPanelComponent {
  protected readonly store = inject(CrisisMonitoringStore);
  readonly canWrite = input(true);

  protected readonly progress = progressStatus;
  protected readonly month3 = monthLabel;
  protected readonly percentFormat = (percent: number): string => `${Math.round(percent)}%`;

  protected tone(status: Parameters<typeof statusTone>[0]): string {
    return statusTone(status);
  }

  protected coverage(value: string | null): string {
    return value === null ? '-' : formatRatio(value);
  }

  protected clampPercent(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  protected isNegative(value: string): boolean {
    return Number.parseFloat(value) < 0;
  }
}
