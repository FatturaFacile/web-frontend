import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { LpAlertStatus, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { LiquidityPlanningStore, LpOutcome } from './liquidity-planning.store';
import { LP_ALERT_STATUSES, severityTone, tagColor } from './liquidity-planning.util';

type Filter = 'all' | LpAlertStatus;

/** Alert center: the early-warning alerts of the plan with their history, acknowledgement and resolution. */
@Component({
  selector: 'app-lp-alerts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    NzButtonModule,
    NzEmptyModule,
    NzSegmentedModule,
    NzTableModule,
    NzTagModule,
  ],
  styleUrl: './liquidity-planning.scss',
  template: `
    <div class="lp-toolbar">
      <nz-segmented
        [nzOptions]="filterOptions()"
        [ngModel]="filter()"
        (ngModelChange)="filter.set($event)"
        data-testid="lp-alert-filter"
      />
      <button
        nz-button
        nzType="primary"
        [nzLoading]="store.saving()"
        data-testid="lp-evaluate"
        (click)="evaluate()"
      >
        {{ 'lp.alerts.evaluate' | translate }}
      </button>
    </div>

    @if (visible().length === 0) {
      <nz-empty [nzNotFoundContent]="'lp.alerts.empty' | translate" />
    } @else {
      <nz-table
        #alertTable
        nzSize="small"
        [nzData]="visible()"
        [nzShowPagination]="false"
        data-testid="lp-alert-table"
      >
        <thead>
          <tr>
            <th>{{ 'lp.alerts.col.severity' | translate }}</th>
            <th>{{ 'lp.alerts.col.alert' | translate }}</th>
            <th>{{ 'lp.alerts.col.detected' | translate }}</th>
            <th>{{ 'lp.alerts.col.status' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (alert of alertTable.data; track alert.id) {
            <tr>
              <td>
                <nz-tag [nzColor]="color(toneOf(alert.severity))">
                  {{ 'lp.alerts.severity.' + alert.severity | translate }}
                </nz-tag>
              </td>
              <td>
                <strong>{{ alert.title_key | translate: alert.params }}</strong>
                <div class="lp-note">{{ alert.message_key | translate: alert.params }}</div>
              </td>
              <td>{{ alert.detected_at }}</td>
              <td>{{ 'lp.alerts.status.' + alert.status | translate }}</td>
              <td class="lp-actions">
                @if (alert.status === 'open') {
                  <button
                    nz-button
                    nzSize="small"
                    (click)="act(store.acknowledgeAlert(alert.id), 'lp.alerts.acknowledged')"
                  >
                    {{ 'lp.alerts.acknowledge' | translate }}
                  </button>
                }
                @if (alert.status !== 'resolved') {
                  <button
                    nz-button
                    nzSize="small"
                    (click)="act(store.resolveAlert(alert.id), 'lp.alerts.resolved')"
                  >
                    {{ 'lp.alerts.resolve' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class LpAlertsComponent {
  protected readonly store = inject(LiquidityPlanningStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly filterOptions = computed(() => [
    { value: 'all', label: this.i18n.translate('lp.alerts.filter.all') },
    ...LP_ALERT_STATUSES.map((status) => ({
      value: status,
      label: this.i18n.translate(`lp.alerts.status.${status}`),
    })),
  ]);
  protected readonly filter = signal<Filter>('all');
  protected readonly toneOf = severityTone;
  protected readonly color = tagColor;

  protected readonly visible = computed(() => {
    const filter = this.filter();

    return this.store.alerts().filter((alert) => filter === 'all' || alert.status === filter);
  });

  protected evaluate(): Promise<void> {
    return this.act(this.store.evaluateAlerts(), 'lp.alerts.evaluated');
  }

  protected async act(pending: Promise<LpOutcome>, successKey: string): Promise<void> {
    const outcome = await pending;

    if (outcome.ok) {
      this.message.success(this.i18n.translate(successKey));
    } else {
      this.message.error(this.i18n.translate(outcome.error ?? 'lp.error.generic'));
    }
  }
}
