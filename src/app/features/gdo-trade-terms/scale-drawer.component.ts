import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { startWith } from 'rxjs';
import {
  GDT_BASELINE_SOURCES,
  GDT_BASES,
  GDT_TIER_MODES,
  GDT_VOLUME_MODES,
  GdtBaselineSource,
  GdtBasis,
  GdtCategoryRef,
  GdtDeliveryPoint,
  GdtNamedRef,
  GdtScale,
  GdtScalePayload,
  GdtTierMode,
  GdtVolumeMode,
} from '@core';
import { TranslatePipe } from '@shared';
import { cleanTiers, emptyTier, GdtOutcome, tiersProblem } from './gdo-trade-terms.util';
import { ScopeFieldsComponent } from './scope-fields.component';

/** Editor of a tiered year-end rebate scale (PFA): mode, basis, baseline, scope and the brackets. */
@Component({
  selector: 'app-gdt-scale-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzInputModule,
    NzSelectModule,
    ReactiveFormsModule,
    ScopeFieldsComponent,
    TranslatePipe,
  ],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <nz-drawer
      nzPlacement="right"
      nzWidth="760"
      [nzVisible]="visible()"
      [nzTitle]="(scale() ? 'gdoTradeTerms.action.editScale' : 'gdoTradeTerms.action.newScale') | translate"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        <form [formGroup]="form" class="form" (ngSubmit)="submit()">
          @if (error(); as failure) {
            <nz-alert
              class="feedback"
              nzType="error"
              nzShowIcon
              [nzMessage]="(failure.errorKey ?? 'gdoTradeTerms.error.generic') | translate: failure.params"
              [nzDescription]="failure.detail ?? undefined"
            ></nz-alert>
          }
          @if (tierError(); as problem) {
            <nz-alert class="feedback" nzType="warning" nzShowIcon [nzMessage]="'gdoTradeTerms.error.' + problem | translate"></nz-alert>
          }

          <div class="form-grid">
            <label class="field" for="gdt-s-code">
              <span>{{ 'gdoTradeTerms.field.code' | translate }}</span>
              <input nz-input id="gdt-s-code" formControlName="code" maxlength="40" />
            </label>
            <label class="field" for="gdt-s-name">
              <span>{{ 'gdoTradeTerms.field.name' | translate }}</span>
              <input nz-input id="gdt-s-name" formControlName="name" maxlength="160" />
            </label>
            <label class="field" for="gdt-s-mode">
              <span>{{ 'gdoTradeTerms.field.tierMode' | translate }}</span>
              <nz-select nzId="gdt-s-mode" formControlName="tier_mode">
                @for (mode of tierModes; track mode) {
                  <nz-option [nzValue]="mode" [nzLabel]="'gdoTradeTerms.tierMode.' + mode | translate"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="gdt-s-basis">
              <span>{{ 'gdoTradeTerms.field.basis' | translate }}</span>
              <nz-select nzId="gdt-s-basis" formControlName="basis">
                @for (basis of bases; track basis) {
                  <nz-option [nzValue]="basis" [nzLabel]="'gdoTradeTerms.basis.' + basis | translate"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="gdt-s-volume">
              <span>{{ 'gdoTradeTerms.field.volumeMode' | translate }}</span>
              <nz-select nzId="gdt-s-volume" formControlName="volume_mode">
                @for (mode of volumeModes; track mode) {
                  <nz-option [nzValue]="mode" [nzLabel]="'gdoTradeTerms.volumeMode.' + mode | translate"></nz-option>
                }
              </nz-select>
            </label>
            @if (incremental()) {
              <label class="field" for="gdt-s-source">
                <span>{{ 'gdoTradeTerms.field.baselineSource' | translate }}</span>
                <nz-select nzId="gdt-s-source" formControlName="baseline_source">
                  @for (source of sources; track source) {
                    <nz-option [nzValue]="source" [nzLabel]="'gdoTradeTerms.baselineSource.' + source | translate"></nz-option>
                  }
                </nz-select>
              </label>
              @if (manualBaseline()) {
                <label class="field" for="gdt-s-baseline">
                  <span>{{ 'gdoTradeTerms.field.baselineValue' | translate }}</span>
                  <input nz-input id="gdt-s-baseline" type="number" step="0.01" min="0" formControlName="baseline_value" />
                </label>
              }
            }
            <label class="field" for="gdt-s-start">
              <span>{{ 'gdoTradeTerms.field.startsOn' | translate }}</span>
              <input nz-input id="gdt-s-start" type="date" formControlName="starts_on" />
            </label>
            <label class="field" for="gdt-s-end">
              <span>{{ 'gdoTradeTerms.field.endsOn' | translate }}</span>
              <input nz-input id="gdt-s-end" type="date" formControlName="ends_on" />
            </label>
          </div>
          <p class="muted">{{ 'gdoTradeTerms.hint.scaleWindow' | translate }}</p>
          <label nz-checkbox formControlName="is_active">{{ 'gdoTradeTerms.field.active' | translate }}</label>

          <div class="section-title">{{ 'gdoTradeTerms.section.scope' | translate }}</div>
          <app-gdt-scope-fields
            [group]="form"
            [categories]="categories()"
            [brands]="brands()"
            [points]="points()"
          ></app-gdt-scope-fields>

          <div class="section-title">{{ 'gdoTradeTerms.section.tiers' | translate }}</div>
          <p class="muted">
            {{ (form.controls.tier_mode.value === 'retroactive' ? 'gdoTradeTerms.hint.retroactive' : 'gdoTradeTerms.hint.progressive') | translate }}
          </p>
          <div formArrayName="tiers">
            @for (tier of tiers.controls; track tier; let index = $index) {
              <div class="tier-row" [formGroupName]="index">
                <label class="field" [attr.for]="'gdt-t-threshold-' + index">
                  <span>{{ 'gdoTradeTerms.field.threshold' | translate }}</span>
                  <input nz-input [id]="'gdt-t-threshold-' + index" type="number" step="0.01" min="0" formControlName="threshold" />
                </label>
                <label class="field" [attr.for]="'gdt-t-rate-' + index">
                  <span>{{ 'gdoTradeTerms.field.ratePercent' | translate }}</span>
                  <input nz-input [id]="'gdt-t-rate-' + index" type="number" step="0.01" min="0" max="100" formControlName="rate_percent" />
                </label>
                <label class="field" [attr.for]="'gdt-t-flat-' + index">
                  <span>{{ 'gdoTradeTerms.field.flatAmount' | translate }}</span>
                  <input nz-input [id]="'gdt-t-flat-' + index" type="number" step="0.01" min="0" formControlName="flat_amount" />
                </label>
                <label class="field" [attr.for]="'gdt-t-label-' + index">
                  <span>{{ 'gdoTradeTerms.field.label' | translate }}</span>
                  <input nz-input [id]="'gdt-t-label-' + index" maxlength="160" formControlName="label" />
                </label>
                <button nz-button nzDanger type="button" (click)="removeTier(index)">
                  {{ 'gdoTradeTerms.action.remove' | translate }}
                </button>
              </div>
            }
          </div>
          <div class="actions">
            <button nz-button type="button" (click)="addTier()">{{ 'gdoTradeTerms.action.addTier' | translate }}</button>
          </div>

          <label class="field" for="gdt-s-notes">
            <span>{{ 'gdoTradeTerms.field.notes' | translate }}</span>
            <textarea nz-input id="gdt-s-notes" rows="2" formControlName="notes"></textarea>
          </label>

          <div class="actions">
            <button nz-button nzType="primary" type="submit" [nzLoading]="saving()" [disabled]="form.invalid">
              {{ 'gdoTradeTerms.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="closed.emit()">{{ 'gdoTradeTerms.action.cancel' | translate }}</button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class ScaleDrawerComponent {
  private readonly fb = inject(FormBuilder);

  readonly visible = input(false);
  readonly scale = input<GdtScale | null>(null);
  readonly categories = input<readonly GdtCategoryRef[]>([]);
  readonly brands = input<readonly GdtNamedRef[]>([]);
  readonly points = input<readonly GdtDeliveryPoint[]>([]);
  readonly saving = input(false);
  readonly error = input<GdtOutcome | null>(null);
  readonly saved = output<GdtScalePayload>();
  readonly closed = output<void>();

  protected readonly tierModes = GDT_TIER_MODES;
  protected readonly bases = GDT_BASES;
  protected readonly volumeModes = GDT_VOLUME_MODES;
  protected readonly sources = GDT_BASELINE_SOURCES;

  protected readonly tiers = this.fb.array([this.tierGroup()]);

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    tier_mode: ['retroactive' as GdtTierMode, Validators.required],
    basis: ['turnover' as GdtBasis, Validators.required],
    volume_mode: ['total' as GdtVolumeMode, Validators.required],
    baseline_source: ['manual' as GdtBaselineSource],
    baseline_value: ['0'],
    starts_on: [''],
    ends_on: [''],
    is_active: [true],
    notes: [''],
    category_ids: [[] as string[]],
    brand_ids: [[] as string[]],
    product_ids: [[] as string[]],
    delivery_point_ids: [[] as string[]],
    tiers: this.tiers,
  });

  protected readonly incremental = computed(() => this.volumeModeValue() === 'incremental');
  protected readonly manualBaseline = computed(() => this.sourceValue() === 'manual');

  private readonly volumeModeValue = toSignal(this.form.controls.volume_mode.valueChanges.pipe(startWith(this.form.controls.volume_mode.value)), { initialValue: this.form.controls.volume_mode.value });
  private readonly sourceValue = toSignal(this.form.controls.baseline_source.valueChanges.pipe(startWith(this.form.controls.baseline_source.value)), { initialValue: this.form.controls.baseline_source.value });

  protected tierError(): string | null {
    return tiersProblem(this.tiers.getRawValue());
  }

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const scale = this.scale();
      this.tiers.clear();
      const tiers = scale?.tiers.length ? scale.tiers : [emptyTier()];
      for (const tier of tiers) {
        this.tiers.push(this.tierGroup(tier.threshold, tier.rate_percent, tier.flat_amount, tier.label));
      }
      this.form.patchValue({
        code: scale?.code ?? '',
        name: scale?.name ?? '',
        tier_mode: scale?.tier_mode ?? 'retroactive',
        basis: scale?.basis ?? 'turnover',
        volume_mode: scale?.volume_mode ?? 'total',
        baseline_source: scale?.baseline_source ?? 'manual',
        baseline_value: String(scale?.baseline_value ?? '0'),
        starts_on: scale?.starts_on ?? '',
        ends_on: scale?.ends_on ?? '',
        is_active: scale?.is_active ?? true,
        notes: scale?.notes ?? '',
        category_ids: scale?.category_ids ?? [],
        brand_ids: scale?.brand_ids ?? [],
        product_ids: scale?.product_ids ?? [],
        delivery_point_ids: scale?.delivery_point_ids ?? [],
      });
    });
  }

  protected addTier(): void {
    this.tiers.push(this.tierGroup());
  }

  protected removeTier(index: number): void {
    this.tiers.removeAt(index);
  }

  protected submit(): void {
    if (this.form.invalid || tiersProblem(this.tiers.getRawValue()) !== null) {
      return;
    }
    const value = this.form.getRawValue();
    this.saved.emit({
      code: value.code,
      name: value.name,
      tier_mode: value.tier_mode,
      basis: value.basis,
      volume_mode: value.volume_mode,
      baseline_source: value.baseline_source,
      baseline_value: value.baseline_value || '0',
      starts_on: value.starts_on || null,
      ends_on: value.ends_on || null,
      is_active: value.is_active,
      notes: value.notes || null,
      category_ids: value.category_ids,
      brand_ids: value.brand_ids,
      product_ids: value.product_ids,
      delivery_point_ids: value.delivery_point_ids,
      tiers: cleanTiers(value.tiers),
    });
  }

  private tierGroup(threshold: string | number = '', rate: string | number = '', flat: string | number | null = null, label: string | null = null) {
    return this.fb.nonNullable.group({
      threshold: [threshold, Validators.required],
      rate_percent: [rate, Validators.required],
      flat_amount: [flat as string | number | null],
      label: [label as string | null],
    });
  }
}

