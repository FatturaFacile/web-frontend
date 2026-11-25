import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { LpLeverKey, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { LiquidityPlanningStore } from './liquidity-planning.store';
import { hasLevers, LP_LEVER_SPECS, LpLeverSpec } from './liquidity-planning.util';

/** What-if simulator: quick presets, a slider and a field for every lever, and the saved scenarios. */
@Component({
  selector: 'app-lp-what-if',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSliderModule,
    NzSwitchModule,
  ],
  styleUrl: './liquidity-planning.scss',
  template: `
    <h3 class="lp-h3">{{ 'lp.whatIf.title' | translate }}</h3>
    <p class="lp-note">{{ 'lp.whatIf.hint' | translate }}</p>

    <div class="lp-presets" data-testid="lp-presets">
      @for (preset of store.presets(); track preset.code) {
        <button
          nz-button
          nzSize="small"
          [attr.data-testid]="'lp-preset-' + preset.code"
          [title]="preset.description_key | translate"
          (click)="store.applyPreset(preset.code)"
        >
          {{ preset.name_key | translate }}
        </button>
      }
    </div>

    @if (store.scenarios().length > 0) {
      <nz-select
        class="lp-full"
        nzAllowClear
        [nzPlaceHolder]="'lp.whatIf.savedScenarios' | translate"
        [ngModel]="store.activeScenarioId()"
        (ngModelChange)="store.selectScenario($event)"
        data-testid="lp-scenario-select"
      >
        @for (scenario of store.scenarios(); track scenario.id) {
          <nz-option [nzValue]="scenario.id" [nzLabel]="scenario.name" />
        }
      </nz-select>
    }

    @for (spec of specs; track spec.key) {
      <div class="lp-lever">
        <label [for]="'lp-lever-' + spec.key">{{ 'lp.lever.' + spec.key | translate }}</label>
        <div class="lp-lever-controls">
          @if (spec.unit !== 'amount') {
            <nz-slider
              class="lp-lever-slider"
              [nzMin]="spec.min"
              [nzMax]="spec.max"
              [nzStep]="spec.step"
              [ngModel]="value(spec.key)"
              (ngModelChange)="store.setLever(spec.key, $event)"
            />
          }
          <nz-input-number
            [nzId]="'lp-lever-' + spec.key"
            [nzMin]="spec.min"
            [nzMax]="spec.max"
            [nzStep]="spec.step"
            [ngModel]="value(spec.key)"
            (ngModelChange)="store.setLever(spec.key, $event ?? undefined)"
          />
          <span class="lp-unit">{{ 'lp.unit.' + spec.unit | translate }}</span>
        </div>
      </div>
    }

    <div class="lp-lever">
      <label for="lp-financing-date">{{ 'lp.lever.additional_financing_date' | translate }}</label>
      <input
        id="lp-financing-date"
        nz-input
        type="date"
        [ngModel]="store.draftLevers().additional_financing_date ?? ''"
        (ngModelChange)="store.setLever('additional_financing_date', $event || undefined)"
      />
    </div>

    <div class="lp-actions">
      <button nz-button nzType="primary" data-testid="lp-apply" (click)="store.applyDraft()">
        {{ 'lp.whatIf.apply' | translate }}
      </button>
      <button nz-button data-testid="lp-reset" (click)="store.resetLevers()">
        {{ 'lp.whatIf.reset' | translate }}
      </button>
    </div>

    @if (canSave()) {
      <div class="lp-save">
        <input
          nz-input
          maxlength="120"
          [placeholder]="'lp.whatIf.scenarioName' | translate"
          [ngModel]="name()"
          (ngModelChange)="name.set($event)"
          data-testid="lp-scenario-name"
        />
        @if (store.activeScenario()) {
          <span class="lp-toggle">
            <nz-switch [ngModel]="overwrite()" (ngModelChange)="overwrite.set($event)" />
            {{ 'lp.whatIf.overwrite' | translate }}
          </span>
        }
        <button
          nz-button
          [nzLoading]="store.saving()"
          [disabled]="name().trim() === ''"
          data-testid="lp-save-scenario"
          (click)="save()"
        >
          {{ 'lp.whatIf.save' | translate }}
        </button>
        @if (store.activeScenario(); as active) {
          <button
            nz-button
            nzDanger
            nz-popconfirm
            [nzPopconfirmTitle]="'lp.whatIf.deleteConfirm' | translate"
            (nzOnConfirm)="remove(active.id)"
          >
            {{ 'lp.whatIf.delete' | translate }}
          </button>
        }
      </div>
    }
  `,
})
export class LpWhatIfComponent {
  protected readonly store = inject(LiquidityPlanningStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly specs: readonly LpLeverSpec[] = LP_LEVER_SPECS;
  protected readonly name = signal('');
  protected readonly overwrite = signal(false);

  protected value(key: LpLeverKey): number | null {
    const raw = this.store.draftLevers()[key];

    return raw === undefined || raw === '' ? null : Number(raw);
  }

  protected canSave(): boolean {
    return hasLevers(this.store.draftLevers());
  }

  protected async save(): Promise<void> {
    const outcome = await this.store.saveScenario(
      this.name().trim(),
      null,
      this.overwrite() && this.store.activeScenario() !== null,
    );

    if (outcome.ok) {
      this.name.set('');
      this.overwrite.set(false);
      this.message.success(this.i18n.translate('lp.whatIf.saved'));
    } else {
      this.message.error(this.i18n.translate(outcome.error ?? 'lp.error.generic'));
    }
  }

  protected async remove(id: string): Promise<void> {
    const outcome = await this.store.deleteScenario(id);

    if (outcome.ok) {
      this.message.success(this.i18n.translate('lp.whatIf.deleted'));
    } else {
      this.message.error(this.i18n.translate(outcome.error ?? 'lp.error.generic'));
    }
  }
}
