import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { InventoryValuation } from '@core';
import { TranslatePipe } from '@shared';
import { valuationBreakdown } from '../../logistics.rules';
import { valuationBucketHintKey, valuationBucketKey, warehouseTypeKey } from '../../logistics.ui';

/**
 * Fiscal valuation summary: the four buckets of owned stock (on hand, in transit, at customers, at subcontractors) that
 * make up the balance-sheet value, kept visibly apart from the vendor consignment goods held on our premises.
 */
@Component({
  selector: 'app-valuation-summary',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    NzCardModule,
    NzProgressModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './valuation-summary.component.html',
  styles: `
    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .bucket {
      margin-bottom: 14px;
    }
    .bucket-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .hint {
      display: block;
      color: var(--ant-color-text-secondary, #8c8c8c);
      font-size: 12px;
    }
    .third-party {
      border-style: dashed;
    }
    .num {
      text-align: right;
    }
  `,
})
export class ValuationSummaryComponent {
  readonly valuation = input.required<InventoryValuation>();

  protected readonly breakdown = computed(() => valuationBreakdown(this.valuation()));
  protected readonly warehouses = computed(() => this.valuation().by_warehouse ?? []);

  protected readonly bucketKey = valuationBucketKey;
  protected readonly hintKey = valuationBucketHintKey;
  protected readonly typeKey = warehouseTypeKey;
}
