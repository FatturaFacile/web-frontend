import { Component, computed, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { TaxPreviewResult } from '@core';
import { TranslatePipe } from '@shared';

/**
 * Italian totals breakdown rendered exclusively from `POST /tax/preview` (issue #286).
 * Every amount is the backend decimal string, only formatted here: no fiscal arithmetic.
 */
@Component({
  selector: 'app-invoice-totals-breakdown',
  imports: [CurrencyPipe, DecimalPipe, NzAlertModule, NzSpinModule, TranslatePipe],
  templateUrl: './invoice-totals-breakdown.component.html',
  styleUrl: './invoice-totals-breakdown.component.scss',
})
export class InvoiceTotalsBreakdownComponent {
  readonly result = input<TaxPreviewResult | null>(null);
  readonly currency = input('EUR');
  /** True while a newer preview is pending: the shown figures are stale. */
  readonly loading = input(false);
  /** Message of the last failed preview; the previous result stays visible. */
  readonly error = input<string | null>(null);

  protected readonly totals = computed(() => this.result()?.totals ?? null);
  protected readonly hasFund = computed(() => !!this.result()?.fund);
  protected readonly hasWithholding = computed(() => !!this.result()?.withholding);
  protected readonly hasEnasarco = computed(() => !!this.result()?.enasarco);
  protected readonly stampApplied = computed(() => !!this.result()?.stamp_duty.applied);
}
