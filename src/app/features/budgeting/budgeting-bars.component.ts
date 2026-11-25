import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@shared';
import { barWidth } from './budgeting.util';

/** One group of the chart: a label with the budget and the actual amount. */
export interface BarGroup {
  label: string;
  budget: string;
  actual: string;
  favorable: boolean;
}

/** Budget against actual as horizontal bars, one pair per group (no chart library needed). */
@Component({
  selector: 'app-budgeting-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TranslatePipe],
  styles: [
    `
      .bars { display: grid; gap: 10px; }
      .group-label { font-size: 13px; margin-bottom: 2px; }
      .bar-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
      .bar-track { flex: 1; background: var(--ff-color-border, #f0f0f0); border-radius: 3px; height: 10px; overflow: hidden; }
      .bar { height: 10px; border-radius: 3px; }
      .bar.budget { background: #8c8c8c; }
      .bar.favorable { background: var(--ff-color-success, #52c41a); }
      .bar.adverse { background: var(--ff-color-danger, #ff4d4f); }
      .bar-value { width: 110px; text-align: right; white-space: nowrap; }
      .legend-label { width: 56px; color: var(--text-secondary); }
    `,
  ],
  template: `
    <div class="bars" role="img" [attr.aria-label]="'BUDGETING_CONTROL.CHART_LABEL' | translate">
      @for (group of groups(); track group.label) {
        <div>
          <div class="group-label">{{ group.label }}</div>
          <div class="bar-row">
            <span class="legend-label">{{ 'BUDGETING.BUDGET' | translate }}</span>
            <span class="bar-track"><span class="bar budget" [style.width.%]="width(group.budget)" [style.display]="'block'"></span></span>
            <span class="bar-value">{{ group.budget | number: '1.0-0' }}</span>
          </div>
          <div class="bar-row">
            <span class="legend-label">{{ 'BUDGETING.ACTUAL' | translate }}</span>
            <span class="bar-track"><span class="bar" [class.favorable]="group.favorable" [class.adverse]="!group.favorable" [style.width.%]="width(group.actual)" [style.display]="'block'"></span></span>
            <span class="bar-value">{{ group.actual | number: '1.0-0' }}</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class BudgetingBarsComponent {
  readonly groups = input.required<BarGroup[]>();
  readonly max = computed(() => this.groups().reduce((largest, group) => Math.max(largest, Math.abs(Number(group.budget)), Math.abs(Number(group.actual))), 0));

  width(amount: string): number {
    return barWidth(amount, this.max());
  }
}
