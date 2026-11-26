import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import {
  GDT_TIER_MODES,
  GDT_VOLUME_MODES,
  GdtScaleProgress,
  GdtTierMode,
  GdtVolumeMode,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { cleanTiers, GdtOutcome, num, percentText, tiersProblem } from './gdo-trade-terms.util';
import { SimulatorStore } from './simulator.store';

/**
 * Bracket simulator: the rebate of a list of volumes under the retroactive and the progressive reading of the same brackets,
 * for total volume or growth over a baseline, and the cliff every threshold creates. Nothing is saved.
 */
@Component({
  selector: 'app-gdt-simulator-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [SimulatorStore],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <form [formGroup]="form" class="form" (ngSubmit)="run()">
      <div class="form-grid">
        <label class="field" for="gdt-sim-mode">
          <span>{{ 'gdoTradeTerms.field.tierMode' | translate }}</span>
          <nz-select nzId="gdt-sim-mode" formControlName="tier_mode">
            @for (mode of tierModes; track mode) {
              <nz-option [nzValue]="mode" [nzLabel]="'gdoTradeTerms.tierMode.' + mode | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="gdt-sim-volume-mode">
          <span>{{ 'gdoTradeTerms.field.volumeMode' | translate }}</span>
          <nz-select nzId="gdt-sim-volume-mode" formControlName="volume_mode">
            @for (mode of volumeModes; track mode) {
              <nz-option [nzValue]="mode" [nzLabel]="'gdoTradeTerms.volumeMode.' + mode | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="gdt-sim-baseline">
          <span>{{ 'gdoTradeTerms.field.baselineValue' | translate }}</span>
          <input nz-input id="gdt-sim-baseline" type="number" step="0.01" min="0" formControlName="baseline_value" />
        </label>
        <label class="field" for="gdt-sim-volumes">
          <span>{{ 'gdoTradeTerms.field.volumes' | translate }}</span>
          <input nz-input id="gdt-sim-volumes" formControlName="volumes" />
        </label>
      </div>
      <p class="muted">{{ 'gdoTradeTerms.hint.simulatorVolumes' | translate }}</p>

      <div formArrayName="tiers">
        @for (tier of tiers.controls; track tier; let index = $index) {
          <div class="tier-row" [formGroupName]="index">
            <label class="field" [attr.for]="'gdt-sim-threshold-' + index">
              <span>{{ 'gdoTradeTerms.field.threshold' | translate }}</span>
              <input nz-input [id]="'gdt-sim-threshold-' + index" type="number" step="0.01" min="0" formControlName="threshold" />
            </label>
            <label class="field" [attr.for]="'gdt-sim-rate-' + index">
              <span>{{ 'gdoTradeTerms.field.ratePercent' | translate }}</span>
              <input nz-input [id]="'gdt-sim-rate-' + index" type="number" step="0.01" min="0" max="100" formControlName="rate_percent" />
            </label>
            <label class="field" [attr.for]="'gdt-sim-flat-' + index">
              <span>{{ 'gdoTradeTerms.field.flatAmount' | translate }}</span>
              <input nz-input [id]="'gdt-sim-flat-' + index" type="number" step="0.01" min="0" formControlName="flat_amount" />
            </label>
            <span></span>
            <button nz-button nzDanger type="button" (click)="removeTier(index)">{{ 'gdoTradeTerms.action.remove' | translate }}</button>
          </div>
        }
      </div>
      <div class="actions">
        <button nz-button type="button" (click)="addTier()">{{ 'gdoTradeTerms.action.addTier' | translate }}</button>
        <button nz-button nzType="primary" type="submit" [nzLoading]="store.loading()" [disabled]="form.invalid">
          {{ 'gdoTradeTerms.action.simulate' | translate }}
        </button>
      </div>
    </form>

    @if (error(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="(failure.errorKey ?? 'gdoTradeTerms.error.generic') | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.result(); as result) {
        <nz-table #table nzSize="small" [nzData]="result.rows" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.volume' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.qualifying' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.tierMode.retroactive' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.tierMode.progressive' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.effectivePercent' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.volume) {
              <tr>
                <td class="num">{{ row.volume | money: currency() }}</td>
                <td class="num">{{ row.qualifying | money: currency() }}</td>
                <td class="num">
                  {{ row.retroactive.rebate | money: currency() }}
                  @if (row.retroactive.tier) {
                    <small class="muted">{{ 'gdoTradeTerms.field.tier' | translate }} {{ row.retroactive.tier }}</small>
                  }
                </td>
                <td class="num">
                  {{ row.progressive.rebate | money: currency() }}
                  @if (row.progressive.tier) {
                    <small class="muted">{{ 'gdoTradeTerms.field.tier' | translate }} {{ row.progressive.tier }}</small>
                  }
                </td>
                <td class="num">{{ pct(row.effective_percent) }}</td>
              </tr>
            }
          </tbody>
        </nz-table>

        <div class="section-title">{{ 'gdoTradeTerms.section.cliffs' | translate }}</div>
        <nz-table #cliffs nzSize="small" [nzData]="result.cliffs" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.threshold' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.rebateBelow' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.rebateAt' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.jump' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (cliff of cliffs.data; track cliff.threshold) {
              <tr>
                <td class="num">{{ cliff.threshold | money: currency() }}</td>
                <td class="num">{{ cliff.rebate_below | money: currency() }}</td>
                <td class="num">{{ cliff.rebate_at | money: currency() }}</td>
                <td class="num">{{ cliff.jump | money: currency() }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4"><nz-empty></nz-empty></td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-spin>
  `,
})
export class SimulatorPanelComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly store = inject(SimulatorStore);

  /** A scale of a contract to start from (its brackets, mode and baseline); the simulator never changes it. */
  readonly scale = input<GdtScaleProgress | null>(null);
  readonly currency = input('EUR');

  protected readonly tierModes = GDT_TIER_MODES;
  protected readonly volumeModes = GDT_VOLUME_MODES;
  protected readonly error = signal<GdtOutcome | null>(null);

  protected readonly tiers = this.fb.array([this.tierGroup('10000', '1', null), this.tierGroup('50000', '2', null), this.tierGroup('100000', '3', null)]);

  protected readonly form = this.fb.nonNullable.group({
    tier_mode: ['retroactive' as GdtTierMode, Validators.required],
    volume_mode: ['total' as GdtVolumeMode, Validators.required],
    baseline_value: ['0'],
    volumes: ['5000, 10000, 25000, 50000, 75000, 100000, 150000', Validators.required],
    tiers: this.tiers,
  });

  protected pct = percentText;

  constructor() {
    effect(() => {
      const scale = this.scale();
      if (scale === null) {
        return;
      }
      this.tiers.clear();
      for (const tier of scale.tiers) {
        this.tiers.push(this.tierGroup(tier.threshold, tier.rate_percent, tier.flat_amount));
      }
      this.form.patchValue({
        tier_mode: scale.tier_mode,
        volume_mode: scale.volume_mode,
        baseline_value: scale.projection.baseline,
        volumes: this.suggestedVolumes(scale),
      });
      this.store.clear();
    });
  }

  protected addTier(): void {
    this.tiers.push(this.tierGroup('', '', null));
  }

  protected removeTier(index: number): void {
    this.tiers.removeAt(index);
  }

  protected async run(): Promise<void> {
    const value = this.form.getRawValue();
    const problem = tiersProblem(value.tiers.map((tier) => ({ ...tier, label: null })));
    const volumes = value.volumes
      .split(/[\s,;]+/)
      .filter((part) => part !== '' && Number.isFinite(Number(part)))
      .map((part) => String(Number(part)));
    if (problem !== null || volumes.length === 0) {
      this.error.set({ ok: false, errorKey: `gdoTradeTerms.error.${problem ?? 'volumes_required'}`, detail: null, params: {}, errors: {} });
      return;
    }
    this.error.set(null);
    const outcome = await this.store.simulate({
      tier_mode: value.tier_mode,
      volume_mode: value.volume_mode,
      baseline_value: value.baseline_value || '0',
      tiers: cleanTiers(value.tiers.map((tier) => ({ ...tier, label: null }))).map((tier) => ({
        threshold: tier.threshold,
        rate_percent: tier.rate_percent,
        flat_amount: tier.flat_amount,
      })),
      volumes,
    });
    if (!outcome.ok) {
      this.error.set(outcome);
    }
  }

  /** Volumes around the brackets of a scale: half the first threshold, every threshold, and 25% above the last. */
  private suggestedVolumes(scale: GdtScaleProgress): string {
    const thresholds = scale.tiers.map((tier) => num(tier.threshold)).filter((value) => value > 0);
    if (thresholds.length === 0) {
      return '';
    }
    const points = [Math.round(thresholds[0] / 2), ...thresholds, Math.round(thresholds[thresholds.length - 1] * 1.25)];
    return [...new Set(points)].join(', ');
  }

  private tierGroup(threshold: string | number, rate: string | number, flat: string | number | null) {
    return this.fb.nonNullable.group({
      threshold: [threshold, Validators.required],
      rate_percent: [rate, Validators.required],
      flat_amount: [flat as string | number | null],
    });
  }
}
