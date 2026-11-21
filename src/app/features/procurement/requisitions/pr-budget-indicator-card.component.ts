import { Component, computed, input } from '@angular/core';
import { PrBudgetCheckSnapshot, PrCurrency } from '@domain/procurement/purchase-requisition.models';
import { MoneyPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';

/**
 * Displays real-time Cost Center budget availability, post-PR remaining balance,
 * utilization progress, and soft-warning or hard-block alerts.
 */
@Component({
  selector: 'app-pr-budget-indicator-card',
  imports: [
    MoneyPipe,
    TranslatePipe,
    NzAlertModule,
    NzCardModule,
    NzProgressModule,
    NzSpinModule,
    NzTagModule,
  ],
  templateUrl: './pr-budget-indicator-card.component.html',
  styleUrl: './pr-budget-indicator-card.component.scss',
})
export class PrBudgetIndicatorCardComponent {
  readonly preview = input<PrBudgetCheckSnapshot | null>(null);
  readonly loading = input<boolean>(false);
  readonly currency = input<PrCurrency>('EUR');
  readonly hasCostCenter = input<boolean>(false);
  readonly estimatedTotal = input<number>(0);
  readonly error = input<string | null>(null);

  readonly activeCurrency = computed(() => this.preview()?.currency || this.currency());

  readonly isHardBlock = computed(() => {
    const p = this.preview();
    return Boolean(p && (p.status === 'hard_block' || p.is_hard_blocked));
  });

  readonly isWarning = computed(() => {
    const p = this.preview();
    return Boolean(p && !this.isHardBlock() && (p.status === 'warning' || p.is_warning));
  });

  readonly progressPercent = computed(() => {
    const p = this.preview();
    if (!p || !Number.isFinite(p.utilization_percent)) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round(p.utilization_percent)));
  });

  readonly progressStatus = computed<'exception' | 'normal' | 'success'>(() => {
    if (this.isHardBlock()) {
      return 'exception';
    }
    if (this.isWarning()) {
      return 'normal';
    }
    return 'success';
  });

  readonly alertType = computed<'error' | 'warning' | 'success'>(() => {
    if (this.isHardBlock()) {
      return 'error';
    }
    if (this.isWarning()) {
      return 'warning';
    }
    return 'success';
  });

  readonly alertTitleKey = computed(() => {
    if (this.isHardBlock()) {
      return 'PR.BUDGET.ALERT_HARD_BLOCK_TITLE';
    }
    if (this.isWarning()) {
      return 'PR.BUDGET.ALERT_WARNING_TITLE';
    }
    return 'PR.BUDGET.ALERT_OK_TITLE';
  });

  readonly alertDescriptionKey = computed(() => {
    if (this.isHardBlock()) {
      return 'PR.BUDGET.ALERT_HARD_BLOCK_DESC';
    }
    if (this.isWarning()) {
      return 'PR.BUDGET.ALERT_WARNING_DESC';
    }
    return 'PR.BUDGET.ALERT_OK_DESC';
  });

  readonly statusTagColor = computed(() => {
    if (this.isHardBlock()) {
      return 'error';
    }
    if (this.isWarning()) {
      return 'warning';
    }
    return 'success';
  });

  readonly statusTagKey = computed(() => {
    if (this.isHardBlock()) {
      return 'PR.BUDGET.STATUS_HARD_BLOCK';
    }
    if (this.isWarning()) {
      return 'PR.BUDGET.STATUS_WARNING';
    }
    return 'PR.BUDGET.STATUS_OK';
  });
}
