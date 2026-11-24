import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { RebateProgress } from '@core';
import { TranslatePipe } from '@shared';
import { describeBonusProgress, describeTierProgress } from './rebates.util';

/** Live position of an agreement: spend, current and next tier, the distance to it, the fixed bonus and the contributions. */
@Component({
  selector: 'app-rebates-progress-card',
  styleUrl: './rebates.scss',
  imports: [DecimalPipe, TranslatePipe, NzCardModule, NzProgressModule, NzTableModule],
  template: `
    @let data = progress();
    <nz-card class="main-card" [nzTitle]="'SUPPLIER_REBATES.PROGRESS' | translate">
      <div class="kpi-grid">
        <div class="kpi">
          <span class="kpi-label">{{ 'SUPPLIER_REBATES.QUALIFYING_SPEND' | translate }}</span>
          <span class="kpi-value">{{ data.qualifying_volume | number: '1.2-2' }} {{ data.currency }}</span>
          <span class="muted">{{ 'SUPPLIER_REBATES.AS_OF' | translate }} {{ data.as_of }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">{{ 'SUPPLIER_REBATES.EARNED_REBATE' | translate }}</span>
          <span class="kpi-value">{{ data.earned_rebate | number: '1.2-2' }} {{ data.currency }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">{{ 'SUPPLIER_REBATES.ACCRUED_REBATE' | translate }}</span>
          <span class="kpi-value">{{ data.accrued_rebate | number: '1.2-2' }} {{ data.currency }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">{{ 'SUPPLIER_REBATES.SETTLED_REBATE' | translate }}</span>
          <span class="kpi-value">{{ data.settled_rebate | number: '1.2-2' }} {{ data.currency }}</span>
        </div>
      </div>

      @if (tierView(); as tier) {
        <div class="bar-block">
          <div class="bar-head">
            <span>
              {{ 'SUPPLIER_REBATES.CURRENT_TIER' | translate }}:
              @if (tier.currentRate !== null) {
                {{ tier.currentRate | number: '1.2-4' }}%
              } @else {
                {{ 'SUPPLIER_REBATES.NO_TIER' | translate }}
              }
            </span>
            <span>
              {{ 'SUPPLIER_REBATES.NEXT_TIER' | translate }}:
              @if (tier.state === 'top_tier') {
                {{ 'SUPPLIER_REBATES.TOP_TIER' | translate }}
              } @else {
                {{ tier.nextThreshold | number: '1.2-2' }} ({{ tier.nextRate | number: '1.2-4' }}%)
              }
            </span>
          </div>
          <nz-progress [nzPercent]="tier.percent" nzSize="small" [nzStatus]="tier.state === 'top_tier' ? 'success' : 'active'"></nz-progress>
          @if (tier.distance !== null) {
            <div class="bar-head">
              <span>{{ 'SUPPLIER_REBATES.DISTANCE_TO_NEXT' | translate }}: {{ tier.distance | number: '1.2-2' }} {{ data.currency }}</span>
              @if (tier.projectedGain !== null) {
                <span>{{ 'SUPPLIER_REBATES.PROJECTED_GAIN' | translate }}: +{{ tier.projectedGain | number: '1.2-2' }} {{ data.currency }}</span>
              }
            </div>
          }
        </div>
      }

      @if (bonusView(); as bonus) {
        <div class="bar-block">
          <div class="bar-head">
            <span>{{ 'SUPPLIER_REBATES.BONUS_TARGET' | translate }}: {{ data.bonus?.target | number: '1.2-2' }} {{ data.currency }}</span>
            <span>{{ 'SUPPLIER_REBATES.BONUS_AMOUNT' | translate }}: {{ bonus.bonus | number: '1.2-2' }} {{ data.currency }}</span>
          </div>
          <nz-progress [nzPercent]="bonus.percent" nzSize="small" [nzStatus]="bonus.reached ? 'success' : 'active'"></nz-progress>
          <div class="bar-head">
            @if (bonus.reached) {
              <span>{{ 'SUPPLIER_REBATES.TARGET_REACHED' | translate }}</span>
            } @else {
              <span>{{ 'SUPPLIER_REBATES.DISTANCE_TO_TARGET' | translate }}: {{ bonus.distance | number: '1.2-2' }} {{ data.currency }}</span>
            }
          </div>
        </div>
      }

      <div class="kpi-grid">
        <div class="kpi">
          <span class="kpi-label">{{ 'SUPPLIER_REBATES.CONTRIB_PLANNED' | translate }}</span>
          <span class="kpi-value">{{ data.contributions.planned | number: '1.2-2' }} {{ data.currency }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">{{ 'SUPPLIER_REBATES.CONTRIB_ACCRUED' | translate }}</span>
          <span class="kpi-value">{{ data.contributions.accrued | number: '1.2-2' }} {{ data.currency }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">{{ 'SUPPLIER_REBATES.CONTRIB_SETTLED' | translate }}</span>
          <span class="kpi-value">{{ data.contributions.settled | number: '1.2-2' }} {{ data.currency }}</span>
        </div>
      </div>

      @if (data.tiers.length > 0) {
        <nz-table [nzData]="data.tiers" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th class="num">{{ 'SUPPLIER_REBATES.THRESHOLD_FROM' | translate }}</th>
              <th class="num">{{ 'SUPPLIER_REBATES.THRESHOLD_TO' | translate }}</th>
              <th class="num">{{ 'SUPPLIER_REBATES.RATE_PERCENT' | translate }}</th>
              <th class="num">{{ 'SUPPLIER_REBATES.FLAT_AMOUNT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of data.tiers; track row.threshold_amount) {
              <tr>
                <td class="num">{{ row.threshold_amount | number: '1.2-2' }}</td>
                <td class="num">
                  @if (row.max_threshold !== null) {
                    {{ row.max_threshold | number: '1.2-2' }}
                  } @else {
                    {{ 'SUPPLIER_REBATES.OPEN_ENDED' | translate }}
                  }
                </td>
                <td class="num">{{ row.rate_percent | number: '1.2-4' }}</td>
                <td class="num">{{ row.flat_amount !== null ? (row.flat_amount | number: '1.2-2') : '' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-card>
  `,
})
export class RebatesProgressCardComponent {
  readonly progress = input.required<RebateProgress>();

  readonly tierView = computed(() => describeTierProgress(this.progress().tier));
  readonly bonusView = computed(() => describeBonusProgress(this.progress().bonus));
}
