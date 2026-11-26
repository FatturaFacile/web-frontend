import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { startWith } from 'rxjs';
import {
  GDT_CONTRIBUTION_MODES,
  GDT_DATE_BASES,
  GDT_FIXED_ACCRUALS,
  GDT_PROMOTION_TYPES,
  GdtCategoryRef,
  GdtContributionMode,
  GdtDateBasis,
  GdtDeliveryPoint,
  GdtFixedAccrual,
  GdtNamedRef,
  GdtPromotion,
  GdtPromotionPayload,
  GdtPromotionType,
} from '@core';
import { TranslatePipe } from '@shared';
import { GdtOutcome } from './gdo-trade-terms.util';
import { ScopeFieldsComponent } from './scope-fields.component';

/**
 * Editor of a trade promotion or contribution: type (flyer, sell-out, new store, listing, display, Ce.Di. logistics), the
 * date filter (order or delivery), the contribution (rate, per unit or fixed amount), a cap and the scope.
 */
@Component({
  selector: 'app-gdt-promotion-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzAlertModule, NzButtonModule, NzDrawerModule, NzInputModule, NzSelectModule, ReactiveFormsModule, ScopeFieldsComponent, TranslatePipe],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <nz-drawer
      nzPlacement="right"
      nzWidth="720"
      [nzVisible]="visible()"
      [nzTitle]="(promotion() ? 'gdoTradeTerms.action.editPromotion' : 'gdoTradeTerms.action.newPromotion') | translate"
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
              [nzDescription]="failure.detail ?? null"
            ></nz-alert>
          }

          <div class="form-grid">
            <label class="field" for="gdt-p-code">
              <span>{{ 'gdoTradeTerms.field.code' | translate }}</span>
              <input nz-input id="gdt-p-code" formControlName="code" maxlength="40" />
            </label>
            <label class="field" for="gdt-p-name">
              <span>{{ 'gdoTradeTerms.field.name' | translate }}</span>
              <input nz-input id="gdt-p-name" formControlName="name" maxlength="160" />
            </label>
            <label class="field" for="gdt-p-type">
              <span>{{ 'gdoTradeTerms.field.promotionType' | translate }}</span>
              <nz-select nzId="gdt-p-type" formControlName="promotion_type">
                @for (type of types; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="'gdoTradeTerms.promotionType.' + type | translate"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="gdt-p-basis">
              <span>{{ 'gdoTradeTerms.field.dateBasis' | translate }}</span>
              <nz-select nzId="gdt-p-basis" formControlName="date_basis">
                @for (basis of dateBases; track basis) {
                  <nz-option [nzValue]="basis" [nzLabel]="'gdoTradeTerms.dateBasis.' + basis | translate"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="gdt-p-start">
              <span>{{ 'gdoTradeTerms.field.startsOn' | translate }}</span>
              <input nz-input id="gdt-p-start" type="date" formControlName="starts_on" />
            </label>
            <label class="field" for="gdt-p-end">
              <span>{{ 'gdoTradeTerms.field.endsOn' | translate }}</span>
              <input nz-input id="gdt-p-end" type="date" formControlName="ends_on" />
            </label>
          </div>
          <p class="muted">{{ 'gdoTradeTerms.hint.treatment.' + treatment() | translate }}</p>

          <div class="section-title">{{ 'gdoTradeTerms.section.contribution' | translate }}</div>
          <div class="form-grid">
            <label class="field" for="gdt-p-mode">
              <span>{{ 'gdoTradeTerms.field.contributionMode' | translate }}</span>
              <nz-select nzId="gdt-p-mode" formControlName="contribution_mode">
                @for (mode of modes; track mode) {
                  <nz-option [nzValue]="mode" [nzLabel]="'gdoTradeTerms.contributionMode.' + mode | translate"></nz-option>
                }
              </nz-select>
            </label>
            @if (usesRate()) {
              <label class="field" for="gdt-p-rate">
                <span>{{ 'gdoTradeTerms.field.ratePercent' | translate }}</span>
                <input nz-input id="gdt-p-rate" type="number" step="0.01" min="0" max="100" formControlName="rate_percent" />
              </label>
            }
            @if (usesUnit()) {
              <label class="field" for="gdt-p-unit">
                <span>{{ 'gdoTradeTerms.field.unitAmount' | translate }}</span>
                <input nz-input id="gdt-p-unit" type="number" step="0.0001" min="0" formControlName="unit_amount" />
              </label>
            }
            @if (usesFixed()) {
              <label class="field" for="gdt-p-fixed">
                <span>{{ 'gdoTradeTerms.field.fixedAmount' | translate }}</span>
                <input nz-input id="gdt-p-fixed" type="number" step="0.01" min="0" formControlName="fixed_amount" />
              </label>
              <label class="field" for="gdt-p-accrual">
                <span>{{ 'gdoTradeTerms.field.fixedAccrual' | translate }}</span>
                <nz-select nzId="gdt-p-accrual" formControlName="fixed_accrual">
                  @for (accrual of accruals; track accrual) {
                    <nz-option [nzValue]="accrual" [nzLabel]="'gdoTradeTerms.fixedAccrual.' + accrual | translate"></nz-option>
                  }
                </nz-select>
              </label>
            }
            <label class="field" for="gdt-p-cap">
              <span>{{ 'gdoTradeTerms.field.capAmount' | translate }}</span>
              <input nz-input id="gdt-p-cap" type="number" step="0.01" min="0" formControlName="cap_amount" />
            </label>
          </div>

          <div class="section-title">{{ 'gdoTradeTerms.section.scope' | translate }}</div>
          <app-gdt-scope-fields [group]="form" [categories]="categories()" [brands]="brands()" [points]="points()"></app-gdt-scope-fields>

          <label class="field" for="gdt-p-notes">
            <span>{{ 'gdoTradeTerms.field.notes' | translate }}</span>
            <textarea nz-input id="gdt-p-notes" rows="2" formControlName="notes"></textarea>
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
export class PromotionDrawerComponent {
  private readonly fb = inject(FormBuilder);

  readonly visible = input(false);
  readonly promotion = input<GdtPromotion | null>(null);
  readonly categories = input<readonly GdtCategoryRef[]>([]);
  readonly brands = input<readonly GdtNamedRef[]>([]);
  readonly points = input<readonly GdtDeliveryPoint[]>([]);
  readonly saving = input(false);
  readonly error = input<GdtOutcome | null>(null);
  readonly saved = output<GdtPromotionPayload>();
  readonly closed = output<void>();

  protected readonly types = GDT_PROMOTION_TYPES;
  protected readonly dateBases = GDT_DATE_BASES;
  protected readonly modes = GDT_CONTRIBUTION_MODES;
  protected readonly accruals = GDT_FIXED_ACCRUALS;

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    promotion_type: ['sell_in_flyer' as GdtPromotionType, Validators.required],
    date_basis: ['order' as GdtDateBasis, Validators.required],
    starts_on: ['', Validators.required],
    ends_on: ['', Validators.required],
    contribution_mode: ['percent_of_sales' as GdtContributionMode, Validators.required],
    rate_percent: [null as string | number | null],
    unit_amount: [null as string | number | null],
    fixed_amount: [null as string | number | null],
    fixed_accrual: ['linear' as GdtFixedAccrual],
    cap_amount: [null as string | number | null],
    notes: [''],
    category_ids: [[] as string[]],
    brand_ids: [[] as string[]],
    product_ids: [[] as string[]],
    delivery_point_ids: [[] as string[]],
  });

  private readonly mode = toSignal(this.form.controls.contribution_mode.valueChanges.pipe(startWith(this.form.controls.contribution_mode.value)), {
    initialValue: this.form.controls.contribution_mode.value,
  });
  private readonly type = toSignal(this.form.controls.promotion_type.valueChanges.pipe(startWith(this.form.controls.promotion_type.value)), {
    initialValue: this.form.controls.promotion_type.value,
  });

  protected readonly usesRate = computed(() => this.mode() === 'percent_of_sales' || this.mode() === 'percent_of_sell_out');
  protected readonly usesUnit = computed(() => this.mode() === 'per_unit' || this.mode() === 'percent_of_sell_out');
  protected readonly usesFixed = computed(() => this.mode() === 'fixed_amount');
  /** The fiscal treatment of the type: a flyer is a price reduction (credit note), the rest pays a service of the retailer. */
  protected readonly treatment = computed(() => (this.type() === 'sell_in_flyer' ? 'creditNote' : 'promoInvoice'));

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const promotion = this.promotion();
      this.form.reset({
        code: promotion?.code ?? '',
        name: promotion?.name ?? '',
        promotion_type: promotion?.promotion_type ?? 'sell_in_flyer',
        date_basis: promotion?.date_basis ?? 'order',
        starts_on: promotion?.starts_on ?? '',
        ends_on: promotion?.ends_on ?? '',
        contribution_mode: promotion?.contribution_mode ?? 'percent_of_sales',
        rate_percent: promotion?.rate_percent ?? null,
        unit_amount: promotion?.unit_amount ?? null,
        fixed_amount: promotion?.fixed_amount ?? null,
        fixed_accrual: promotion?.fixed_accrual ?? 'linear',
        cap_amount: promotion?.cap_amount ?? null,
        notes: promotion?.notes ?? '',
        category_ids: promotion?.category_ids ?? [],
        brand_ids: promotion?.brand_ids ?? [],
        product_ids: promotion?.product_ids ?? [],
        delivery_point_ids: promotion?.delivery_point_ids ?? [],
      });
    });

    // A sell-out promotion is calculated on the sell-out the retailer reports; the other types on the sell-in.
    effect(() => {
      const type = this.type();
      const control = this.form.controls.contribution_mode;
      if (type === 'sell_out' && control.value !== 'percent_of_sell_out') {
        control.setValue('percent_of_sell_out');
      } else if (type !== 'sell_out' && control.value === 'percent_of_sell_out') {
        control.setValue('percent_of_sales');
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const blank = (amount: string | number | null): string | number | null => (amount === '' ? null : amount);
    this.saved.emit({
      code: value.code,
      name: value.name,
      promotion_type: value.promotion_type,
      date_basis: value.date_basis,
      starts_on: value.starts_on,
      ends_on: value.ends_on,
      contribution_mode: value.contribution_mode,
      rate_percent: this.usesRate() ? blank(value.rate_percent) : null,
      unit_amount: this.usesUnit() ? blank(value.unit_amount) : null,
      fixed_amount: this.usesFixed() ? blank(value.fixed_amount) : null,
      fixed_accrual: value.fixed_accrual,
      cap_amount: blank(value.cap_amount),
      notes: value.notes || null,
      category_ids: value.category_ids,
      brand_ids: value.brand_ids,
      product_ids: value.product_ids,
      delivery_point_ids: value.delivery_point_ids,
    });
  }
}
