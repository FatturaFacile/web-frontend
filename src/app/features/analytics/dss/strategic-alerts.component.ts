import { Component, inject, input, output } from '@angular/core';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DrillTarget, ExecutiveAlert } from './dss.models';
import { alertDrillTarget } from './dss.utils';

const SEVERITY_COLOR = { CRITICAL: 'error', WARNING: 'warning', INFO: 'processing' } as const;

/** Prioritized anomaly cards (critical first) with a one-click drill-down to the records behind each alert. */
@Component({
  selector: 'app-strategic-alerts',
  styleUrl: './dss.scss',
  imports: [TranslatePipe, NzButtonModule, NzEmptyModule, NzTagModule],
  template: `
    <div class="alert-list" data-testid="alert-feed">
      @for (alert of alerts(); track $index) {
        <article
          class="alert-card"
          [class]="alert.severity.toLowerCase()"
          [attr.data-testid]="'alert-' + alert.code"
        >
          <nz-tag [nzColor]="color(alert)" data-testid="alert-severity">
            {{ 'EXEC_DSS.SEVERITY_' + alert.severity | translate }}
          </nz-tag>
          <div class="body">
            <strong>{{ 'EXEC_DSS.ALERT_' + alert.code.toUpperCase() | translate }}</strong>
            <div class="muted">{{ detail(alert) }}</div>
          </div>
          <button nz-button nzSize="small" data-testid="alert-inspect" (click)="inspect(alert)">
            {{ 'EXEC_DSS.INSPECT' | translate }}
          </button>
        </article>
      } @empty {
        <nz-empty
          data-testid="no-alerts"
          [nzNotFoundContent]="'EXEC_DSS.NO_ALERTS' | translate"
        ></nz-empty>
      }
    </div>
  `,
})
export class StrategicAlertsComponent {
  private readonly i18n = inject(TranslateService);

  readonly alerts = input.required<readonly ExecutiveAlert[]>();
  /** The user wants the records behind an alert. */
  readonly drill = output<DrillTarget>();

  protected color(alert: ExecutiveAlert): string {
    return SEVERITY_COLOR[alert.severity];
  }

  /** The offending value against its threshold, and the customer when the alert names one. */
  protected detail(alert: ExecutiveAlert): string {
    const label = alert.context['label'];
    const base = this.i18n.instant('EXEC_DSS.ALERT_DETAIL', {
      value: alert.value.toLocaleString(this.i18n.currentLanguage(), { maximumFractionDigits: 2 }),
      threshold: alert.threshold.toLocaleString(this.i18n.currentLanguage(), {
        maximumFractionDigits: 2,
      }),
    });

    return typeof label === 'string' && label !== '' ? `${label} · ${base}` : base;
  }

  protected inspect(alert: ExecutiveAlert): void {
    const target = alertDrillTarget(
      alert,
      this.i18n.instant(`EXEC_DSS.ALERT_${alert.code.toUpperCase()}`),
    );

    if (target !== null) {
      this.drill.emit(target);
    }
  }
}
