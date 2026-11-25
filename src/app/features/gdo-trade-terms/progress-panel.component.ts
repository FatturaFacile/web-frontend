import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GdtProgress, GdtScaleProgress } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { barValue, num, percentText, promotionStatusColor } from './gdo-trade-terms.util';

/**
 * Where a contract stands: for every rebate scale the volume reached, the tier, the year-end projection from the run rate of
 * the elapsed period, the gap to the next bracket and the daily volume it takes; for every promotion what it has earned.
 */
@Component({
  selector: 'app-gdt-progress-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, NzButtonModule, NzCardModule, NzEmptyModule, NzProgressModule, NzSpinModule, NzTableModule, NzTagModule, TranslatePipe],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <nz-spin [nzSpinning]="loading()">
      @if (progress(); as data) {
        <div class="stats-grid">
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.earnedToDate' | translate }}</small>
            <strong>{{ data.totals.earned_total | money: data.currency }}</strong>
          </nz-card>
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.projectedRebate' | translate }}</small>
            <strong>{{ data.totals.projected_scales | money: data.currency }}</strong>
          </nz-card>
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.accrued' | translate }}</small>
            <strong>{{ data.totals.accrued_total | money: data.currency }}</strong>
          </nz-card>
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.onInvoiceDiscount' | translate }}</small>
            <strong>{{ pct(data.effective_on_invoice_discount_percent) }}</strong>
          </nz-card>
        </div>

        @for (scale of data.scales; track scale.id) {
          <nz-card class="main-card" [nzTitle]="scale.code + ' · ' + scale.name">
            <div class="actions">
              <nz-tag>{{ 'gdoTradeTerms.tierMode.' + scale.tier_mode | translate }}</nz-tag>
              <nz-tag>{{ 'gdoTradeTerms.basis.' + scale.basis | translate }}</nz-tag>
              <nz-tag>{{ 'gdoTradeTerms.volumeMode.' + scale.volume_mode | translate }}</nz-tag>
              @if (!scale.is_active) {
                <nz-tag nzColor="default">{{ 'gdoTradeTerms.field.inactive' | translate }}</nz-tag>
              }
              <button nz-button nzSize="small" type="button" (click)="simulate.emit(scale)">
                {{ 'gdoTradeTerms.action.simulateScale' | translate }}
              </button>
            </div>

            <div class="stats-grid">
              <div>
                <small class="muted">{{ 'gdoTradeTerms.field.volumeToDate' | translate }}</small>
                <strong>{{ vol(scale.projection.volume_to_date, scale.basis, data.currency) }}</strong>
              </div>
              <div>
                <small class="muted">{{ 'gdoTradeTerms.field.projectedVolume' | translate }}</small>
                <strong>{{ vol(scale.projection.projected_volume, scale.basis, data.currency) }}</strong>
              </div>
              <div>
                <small class="muted">{{ 'gdoTradeTerms.field.earnedToDate' | translate }}</small>
                <strong>{{ scale.earned_to_date | money: data.currency }}</strong>
              </div>
              <div>
                <small class="muted">{{ 'gdoTradeTerms.field.projectedRebate' | translate }}</small>
                <strong>{{ scale.projection.projected_rebate | money: data.currency }}</strong>
              </div>
              <div>
                <small class="muted">{{ 'gdoTradeTerms.field.effectivePercent' | translate }}</small>
                <strong>{{ pct(scale.projection.projected_effective_percent) }}</strong>
              </div>
              <div>
                <small class="muted">{{ 'gdoTradeTerms.field.timeProgress' | translate }}</small>
                <strong>{{ pct(scale.projection.time_progress_percent) }}</strong>
              </div>
            </div>

            <div class="field">
              <span>{{ 'gdoTradeTerms.field.attainment' | translate }}</span>
              <nz-progress [nzPercent]="bar(scale.projection.attainment_percent)" [nzStatus]="reaches(scale) ? 'success' : 'active'"></nz-progress>
              @if (scale.projection.next_tier; as next) {
                <small class="muted">
                  {{ 'gdoTradeTerms.field.nextTier' | translate }} {{ next.position }}:
                  {{ vol(next.threshold, scale.basis, data.currency) }} ({{ pct(next.rate_percent) }}) ·
                  {{ 'gdoTradeTerms.field.gapToNext' | translate }}:
                  {{ vol(scale.projection.gap_to_next, scale.basis, data.currency) }}
                  @if (scale.projection.required_daily_volume) {
                    · {{ 'gdoTradeTerms.field.requiredDaily' | translate }}:
                    {{ vol(scale.projection.required_daily_volume, scale.basis, data.currency) }}
                  }
                </small>
              } @else {
                <small class="muted">{{ 'gdoTradeTerms.hint.topTier' | translate }}</small>
              }
            </div>

            <nz-table #tiers nzSize="small" [nzData]="scale.tiers" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'gdoTradeTerms.field.tier' | translate }}</th>
                  <th scope="col" class="num">{{ 'gdoTradeTerms.field.threshold' | translate }}</th>
                  <th scope="col" class="num">{{ 'gdoTradeTerms.field.ratePercent' | translate }}</th>
                  <th scope="col" class="num">{{ 'gdoTradeTerms.field.flatAmount' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (tier of tiers.data; track tier.threshold; let index = $index) {
                  <tr>
                    <td>
                      {{ index + 1 }}
                      @if (scale.projection.tier_to_date === index + 1) {
                        <nz-tag nzColor="green">{{ 'gdoTradeTerms.field.reachedNow' | translate }}</nz-tag>
                      } @else if (scale.projection.projected_tier === index + 1) {
                        <nz-tag nzColor="blue">{{ 'gdoTradeTerms.field.projectedHere' | translate }}</nz-tag>
                      }
                    </td>
                    <td class="num">{{ vol(tier.threshold, scale.basis, data.currency) }}</td>
                    <td class="num">{{ pct(tier.rate_percent) }}</td>
                    <td class="num">{{ tier.flat_amount ? (tier.flat_amount | money: data.currency) : '' }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>
        } @empty {
          <nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.scales' | translate"></nz-empty>
        }

        @if (data.promotions.length > 0) {
          <nz-card class="main-card" [nzTitle]="'gdoTradeTerms.section.promotions' | translate">
            <nz-table #promos nzSize="small" [nzData]="data.promotions" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'gdoTradeTerms.field.promotion' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.promotionType' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.period' | translate }}</th>
                  <th scope="col" class="num">{{ 'gdoTradeTerms.field.earnedToDate' | translate }}</th>
                  <th scope="col" class="num">{{ 'gdoTradeTerms.field.accrued' | translate }}</th>
                  <th scope="col">{{ 'gdoTradeTerms.field.status' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (promotion of promos.data; track promotion.id) {
                  <tr>
                    <th scope="row">
                      {{ promotion.code }}
                      <small class="muted">{{ promotion.name }}</small>
                    </th>
                    <td>{{ 'gdoTradeTerms.promotionType.' + promotion.promotion_type | translate }}</td>
                    <td>{{ promotion.starts_on }} – {{ promotion.ends_on }}</td>
                    <td class="num">{{ promotion.earned_to_date | money: data.currency }}</td>
                    <td class="num">{{ promotion.accrued | money: data.currency }}</td>
                    <td>
                      <nz-tag [nzColor]="color(promotion.status)">{{ 'gdoTradeTerms.promotionStatus.' + promotion.status | translate }}</nz-tag>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>
        }
      } @else {
        <nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.progress' | translate"></nz-empty>
      }
    </nz-spin>
  `,
})
export class ProgressPanelComponent {
  readonly progress = input<GdtProgress | null>(null);
  readonly loading = input(false);
  /** Asks the page to open the simulator on the brackets of a scale. */
  readonly simulate = output<GdtScaleProgress>();

  protected pct = percentText;
  protected bar = barValue;

  /** A volume in the basis of the scale: an amount for turnover, a plain number for quantity. */
  protected vol(value: string | number | null, basis: string, currency: string): string {
    if (value === null || value === '') {
      return '';
    }
    const options: Intl.NumberFormatOptions = basis === 'turnover' ? { style: 'currency', currency } : { maximumFractionDigits: 2 };
    return new Intl.NumberFormat(undefined, options).format(num(value));
  }
  protected color = promotionStatusColor;

  protected reaches(scale: GdtScaleProgress): boolean {
    return scale.projection.next_tier === null;
  }
}
