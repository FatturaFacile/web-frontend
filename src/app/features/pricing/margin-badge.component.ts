import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { MarginStatus } from '@core';
import { TranslatePipe } from '@shared';
import { MARGIN_STATUS_COLORS } from './pricing.util';

/** Margin guardrail badge of a document line or total: green OK, amber WARNING, red BLOCKED. */
@Component({
  selector: 'app-margin-badge',
  imports: [DecimalPipe, NzTagModule, TranslatePipe],
  template: `
    <nz-tag
      [nzColor]="color()"
      [attr.data-status]="status()"
      [attr.aria-label]="'PRICING.MARGIN_' + status() | translate"
    >
      {{ 'PRICING.MARGIN_' + status() | translate }}
      @if (percent() !== null && percent() !== undefined) {
        <span class="margin-value">{{ numericPercent() | number: '1.0-2' }} %</span>
      }
    </nz-tag>
  `,
  styles: `
    .margin-value {
      margin-left: 4px;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class MarginBadgeComponent {
  readonly status = input.required<MarginStatus>();
  readonly percent = input<string | number | null>(null);

  readonly color = computed(() => MARGIN_STATUS_COLORS[this.status()]);
  readonly numericPercent = computed(() => Number(this.percent() ?? 0));
}
