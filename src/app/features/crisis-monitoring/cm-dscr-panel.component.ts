import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CrisisApproach, CrisisHorizon, TranslateService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { CmChartComponent } from './cm-chart.component';
import { CrisisMonitoringStore } from './crisis-monitoring.store';
import {
  buildGaugeOption,
  buildTimelineOption,
  CRISIS_APPROACHES,
  CRISIS_HORIZONS,
  statusTone,
} from './crisis-monitoring.util';

/** DSCR speedometer with horizon and approach selectors, and the 12-month rolling cash flow and debt service chart. */
@Component({
  selector: 'app-cm-dscr-panel',
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    CmChartComponent,
    NzCardModule,
    NzEmptyModule,
    NzSegmentedModule,
    NzTagModule,
  ],
  styleUrl: './crisis-monitoring.scss',
  template: `
    <div class="cm-toolbar">
      <nz-segmented
        [nzOptions]="horizonOptions()"
        [ngModel]="store.horizon()"
        (ngModelChange)="store.setHorizon($event)"
        data-testid="cm-horizon"
      />
      <nz-segmented
        [nzOptions]="approachOptions()"
        [ngModel]="store.approach()"
        (ngModelChange)="store.setApproach($event)"
        data-testid="cm-approach"
      />
    </div>

    <div class="cm-split">
      <nz-card [nzTitle]="'crisis.dscr.title' | translate" data-testid="cm-gauge-card">
        @if (gauge(); as option) {
          <app-cm-chart
            class="cm-gauge"
            [option]="option"
            [label]="'crisis.dscr.aria' | translate"
          />
          @if (store.selectedDscr(); as dscr) {
            <div class="cm-gauge-meta">
              <nz-tag [nzColor]="tone()" data-testid="cm-dscr-status">
                {{ 'crisis.status.' + dscr.status | translate }}
              </nz-tag>
              @if (!dscr.applicable) {
                <span data-testid="cm-dscr-na">{{ 'crisis.dscr.notApplicable' | translate }}</span>
              }
              <span>{{ dscr.label_key | translate }}</span>
              <span>
                {{ 'crisis.dscr.numerator' | translate }}:
                {{ dscr.numerator | money: store.currency() }}
              </span>
              <span>
                {{ 'crisis.dscr.denominator' | translate }}:
                {{ dscr.denominator | money: store.currency() }}
              </span>
              <span class="cm-note">{{ 'crisis.dscr.bands' | translate }}</span>
            </div>
          }
        } @else {
          <nz-empty [nzNotFoundContent]="'crisis.empty' | translate" />
        }
      </nz-card>

      <nz-card [nzTitle]="'crisis.timeline.title' | translate" data-testid="cm-timeline-card">
        @if (timelineOption(); as option) {
          <app-cm-chart [option]="option" [label]="'crisis.timeline.aria' | translate" />
        } @else {
          <nz-empty [nzNotFoundContent]="'crisis.empty' | translate" />
        }
      </nz-card>
    </div>
  `,
})
export class CmDscrPanelComponent {
  protected readonly store = inject(CrisisMonitoringStore);
  private readonly i18n = inject(TranslateService);

  protected readonly horizonOptions = computed(() =>
    CRISIS_HORIZONS.map((value: CrisisHorizon) => ({
      value,
      label: this.i18n.translate('crisis.dscr.horizon.' + value),
    })),
  );
  protected readonly approachOptions = computed(() =>
    CRISIS_APPROACHES.map((value: CrisisApproach) => ({
      value,
      label: this.i18n.translate('crisis.dscr.approach.' + value),
    })),
  );

  protected readonly tone = computed(() => {
    const dscr = this.store.selectedDscr();

    return dscr === null ? 'default' : statusTone(dscr.status);
  });

  protected readonly gauge = computed(() => {
    if (this.store.dashboard() === null) {
      return null;
    }

    return buildGaugeOption(
      this.store.selectedDscr(),
      this.store.bands(),
      this.i18n.translate('crisis.common.notAvailable'),
    );
  });

  protected readonly timelineOption = computed(() => {
    const rows = this.store.timeline();

    if (rows.length === 0) {
      return null;
    }

    return buildTimelineOption({
      rows,
      approach: this.store.approach(),
      currency: this.store.currency(),
      labels: {
        inflows: this.i18n.translate('crisis.timeline.inflows'),
        outflows: this.i18n.translate('crisis.timeline.outflows'),
        debtService: this.i18n.translate('crisis.timeline.debtService'),
        cumulativeCash: this.i18n.translate('crisis.timeline.cumulativeCash'),
        dscr: this.i18n.translate('crisis.timeline.dscr'),
      },
    });
  });
}
