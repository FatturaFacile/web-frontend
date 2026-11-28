import { Component, computed, inject, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CrisisLocale, TranslateService } from '@core';
import { downloadBlob, MoneyPipe, TranslatePipe } from '@shared';
import { CrisisMonitoringStore } from './crisis-monitoring.store';
import {
  CRISIS_LOCALES,
  formatRatio,
  formatSigned,
  indicatorSuffix,
  progressStatus,
  statusTone,
} from './crisis-monitoring.util';

/** Italy panel: the 7-indicator early warning matrix (CCII), Art. 25-novies creditor monitor and the CNC practical test. */
@Component({
  selector: 'app-cm-italy-panel',
  imports: [
    MoneyPipe,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzEmptyModule,
    NzProgressModule,
    NzTableModule,
    NzTagModule,
  ],
  styleUrl: './crisis-monitoring.scss',
  template: `
    @if (store.dashboard(); as dashboard) {
      <div class="cm-toolbar">
        <nz-tag [nzColor]="tone(dashboard.ccii.overall_status)" data-testid="cm-ccii-overall">
          {{ 'crisis.ccii.overall' | translate }}:
          {{ 'crisis.status.' + dashboard.ccii.overall_status | translate }}
        </nz-tag>
        @if (dashboard.ccii.ateco.sector_label_key; as sector) {
          <span>
            {{ 'crisis.ccii.sector' | translate }}: {{ dashboard.ccii.ateco.section }} -
            {{ sector | translate }}
          </span>
        }
        <span class="cm-toolbar-spacer"></span>
        <button nz-button data-testid="cm-open-cnc" (click)="cncOpen.set(true)">
          {{ 'crisis.cnc.open' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          [nzLoading]="store.downloading()"
          data-testid="cm-dossier"
          (click)="downloadDossier()"
        >
          {{ 'crisis.dossier.generate' | translate }}
        </button>
      </div>

      @if (dashboard.ccii.primary_triggers.length > 0) {
        <p class="cm-note" data-testid="cm-triggers">
          {{ 'crisis.ccii.triggers' | translate }}:
          @for (trigger of dashboard.ccii.primary_triggers; track trigger) {
            <nz-tag nzColor="error">{{ ('crisisApi.indicator.' + trigger) | translate }}</nz-tag>
          }
        </p>
      }

      <nz-card [nzTitle]="'crisis.ccii.matrix' | translate" data-testid="cm-matrix">
        <nz-table
          #matrix
          nzSize="small"
          [nzData]="dashboard.ccii.indicators"
          [nzShowPagination]="false"
        >
          <thead>
            <tr>
              <th>{{ 'crisis.ccii.col.indicator' | translate }}</th>
              <th class="cm-num">{{ 'crisis.ccii.col.actual' | translate }}</th>
              <th class="cm-num">{{ 'crisis.ccii.col.threshold' | translate }}</th>
              <th class="cm-num">{{ 'crisis.ccii.col.variance' | translate }}</th>
              <th>{{ 'crisis.ccii.col.status' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (indicator of matrix.data; track indicator.code) {
              <tr [attr.data-testid]="'cm-indicator-' + indicator.code">
                <td>
                  <strong>{{ indicator.label_key | translate }}</strong>
                  <div class="cm-note">{{ indicator.description_key | translate }}</div>
                </td>
                <td class="cm-num">
                  @if (indicator.actual === null) {
                    {{ 'crisis.common.notAvailable' | translate }}
                  } @else if (indicator.unit === 'amount') {
                    {{ indicator.actual | money: store.currency() }}
                  } @else {
                    {{ ratio(indicator.actual) }}{{ suffix(indicator.unit) }}
                  }
                </td>
                <td class="cm-num">
                  @if (indicator.threshold === null) {
                    {{ 'crisis.common.notAvailable' | translate }}
                  } @else {
                    {{ indicator.comparison === 'min' ? '≥' : '≤' }}
                    @if (indicator.unit === 'amount') {
                      {{ indicator.threshold | money: store.currency() }}
                    } @else {
                      {{ ratio(indicator.threshold) }}{{ suffix(indicator.unit) }}
                    }
                  }
                </td>
                <td class="cm-num">
                  @if (indicator.unit === 'amount' && indicator.variance !== null) {
                    {{ indicator.variance | money: store.currency() }}
                  } @else {
                    {{ signed(indicator.variance) }}
                  }
                </td>
                <td>
                  <nz-tag [nzColor]="tone(indicator.status)">
                    {{ 'crisis.status.' + indicator.status | translate }}
                  </nz-tag>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <h3 class="cm-section">{{ 'crisis.creditors.title' | translate }}</h3>
      <p class="cm-note">{{ 'crisis.creditors.hint' | translate }}</p>
      <div class="cm-card-grid" data-testid="cm-creditors">
        @for (creditor of dashboard.ccii.public_creditors; track creditor.code) {
          <nz-card [nzTitle]="creditor.label_key | translate" nzSize="small">
            <p class="cm-note">{{ creditor.description_key | translate }}</p>
            <nz-progress
              [nzPercent]="percent(creditor.progress_percent)"
              [nzStatus]="progress(creditor.status)"
              [nzFormat]="percentFormat"
            />
            <div class="cm-kv">
              <span>{{ 'crisis.creditors.measured' | translate }}</span>
              <span>{{ creditor.measured | money: store.currency() }}</span>
            </div>
            @if (creditor.limit !== null) {
              <div class="cm-kv">
                <span>{{ 'crisis.creditors.limit' | translate }}</span>
                <span>{{ creditor.limit | money: store.currency() }}</span>
              </div>
            }
            @if (creditor.overdue_days !== null) {
              <div class="cm-kv">
                <span>{{ 'crisis.creditors.overdueDays' | translate }}</span>
                <span>{{ creditor.overdue_days }}</span>
              </div>
            }
            <nz-tag [nzColor]="tone(creditor.status)">
              {{
                (creditor.breached ? 'crisis.creditors.breached' : 'crisis.creditors.withinLimit')
                  | translate
              }}
            </nz-tag>
          </nz-card>
        }
      </div>

      <nz-drawer
        [nzVisible]="cncOpen()"
        [nzWidth]="460"
        [nzTitle]="'crisis.cnc.title' | translate"
        (nzOnClose)="cncOpen.set(false)"
      >
        <ng-container *nzDrawerContent>
          <div data-testid="cm-cnc">
            <p class="cm-note">{{ 'crisis.cnc.hint' | translate }}</p>
            <div class="cm-kv">
              <span>{{ 'crisis.cnc.ratio' | translate }}</span>
              <strong>
                @if (dashboard.ccii.cnc.ratio === null) {
                  {{ 'crisis.common.notAvailable' | translate }}
                } @else {
                  {{ ratio(dashboard.ccii.cnc.ratio) }}
                }
              </strong>
            </div>
            <div class="cm-kv">
              <span>{{ 'crisis.cnc.debt' | translate }}</span>
              <span>{{ dashboard.ccii.cnc.debt_to_restructure | money: store.currency() }}</span>
            </div>
            <div class="cm-kv">
              <span>{{ 'crisis.cnc.freeCashFlow' | translate }}</span>
              <span>{{ dashboard.ccii.cnc.annual_free_cash_flow | money: store.currency() }}</span>
            </div>
            <div class="cm-kv">
              <span>{{ 'crisis.cnc.tier' | translate }}</span>
              <nz-tag [nzColor]="tone(dashboard.ccii.cnc.status)">
                {{ dashboard.ccii.cnc.tier_label_key | translate }}
              </nz-tag>
            </div>

            <h4 class="cm-section">{{ 'crisis.cnc.checklist' | translate }}</h4>
            <ul class="cm-checklist">
              @for (check of dashboard.ccii.cnc.checklist; track check.code) {
                <li [attr.data-testid]="'cm-check-' + check.code">
                  <nz-tag [nzColor]="checkColor(check.passed)">
                    {{ checkKey(check.passed) | translate }}
                  </nz-tag>
                  <span>{{ check.label_key | translate }}</span>
                </li>
              }
            </ul>
          </div>
        </ng-container>
      </nz-drawer>
    } @else {
      <nz-empty [nzNotFoundContent]="'crisis.empty' | translate" />
    }
  `,
})
export class CmItalyPanelComponent {
  protected readonly store = inject(CrisisMonitoringStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly cncOpen = signal(false);
  protected readonly ratio = formatRatio;
  protected readonly signed = formatSigned;
  protected readonly suffix = indicatorSuffix;
  protected readonly progress = progressStatus;
  protected readonly percentFormat = (percent: number): string => `${Math.round(percent)}%`;

  private readonly locale = computed<CrisisLocale>(() => {
    const language = this.i18n.currentLanguage();

    return (CRISIS_LOCALES as readonly string[]).includes(language)
      ? (language as CrisisLocale)
      : 'en';
  });

  protected tone(status: Parameters<typeof statusTone>[0]): string {
    return statusTone(status);
  }

  protected percent(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  protected checkColor(passed: boolean | null): string {
    return passed === null ? 'default' : passed ? 'success' : 'error';
  }

  protected checkKey(passed: boolean | null): string {
    return passed === null
      ? 'crisis.cnc.check.unknown'
      : passed
        ? 'crisis.cnc.check.passed'
        : 'crisis.cnc.check.failed';
  }

  protected async downloadDossier(): Promise<void> {
    const result = await this.store.downloadDossier(this.locale());

    if (result.ok && result.blob !== null) {
      downloadBlob(result.blob, result.filename);
    } else {
      this.message.error(this.i18n.translate(result.error ?? 'crisis.error.generic'));
    }
  }
}
