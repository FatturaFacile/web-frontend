import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AGC_ACCRUAL_BASES, AGC_RATE_TYPES, AgcRule, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import {
  AgcOutcome,
  DEFAULT_RULE_FORM,
  emptyTierRow,
  isRuleFormValid,
  RuleFormValue,
  rulePayloadOf,
  ruleFormOf,
  tierRowsOf,
  TierRow,
  tiersAreValid,
} from './agent-commissions.util';
import { NamedOption, RulesStore } from './rules.store';

/**
 * Create or edit a commission rule: the dimensions it applies to (agent, product line, customer, zone), the rate or
 * the fixed amount, the progressive tiers of a percentage rule, the priority and the validity.
 */
@Component({
  selector: 'app-rule-form-drawer',
  imports: [
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="640"
      [nzTitle]="
        (editing() ? 'agentCommissions.action.edit' : 'agentCommissions.action.new') | translate
      "
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        @if (error(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure.errorKey ?? '' | translate"
            [nzDescription]="failure.detail ?? ''"
          ></nz-alert>
        }

        <p class="hint">{{ 'agentCommissions.rules.precedenceHint' | translate }}</p>

        <div class="grid">
          <label class="field wide" for="agc-rule-name">
            <span>{{ 'agentCommissions.field.name' | translate }}</span>
            <input
              nz-input
              id="agc-rule-name"
              maxlength="160"
              [ngModel]="form().name"
              (ngModelChange)="patch({ name: $event })"
            />
          </label>

          <label class="field" for="agc-rule-agent">
            <span>{{ 'agentCommissions.field.agent' | translate }}</span>
            <nz-select
              nzId="agc-rule-agent"
              nzAllowClear
              [nzPlaceHolder]="'agentCommissions.rules.generalRule' | translate"
              [ngModel]="form().agent_profile_id"
              (ngModelChange)="patch({ agent_profile_id: $event ?? null })"
            >
              @for (option of store.agentOptions(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.name"></nz-option>
              }
            </nz-select>
          </label>

          <label class="field" for="agc-rule-category">
            <span>{{ 'agentCommissions.field.productCategory' | translate }}</span>
            <nz-select
              nzId="agc-rule-category"
              nzAllowClear
              nzShowSearch
              [nzPlaceHolder]="'agentCommissions.rules.anyValue' | translate"
              [ngModel]="form().product_category_id"
              (ngModelChange)="patch({ product_category_id: $event ?? null })"
            >
              @for (category of store.categories(); track category.id) {
                <nz-option [nzValue]="category.id" [nzLabel]="category.name"></nz-option>
              }
            </nz-select>
          </label>

          <label class="field" for="agc-rule-customer">
            <span>{{ 'agentCommissions.field.customer' | translate }}</span>
            <nz-select
              nzId="agc-rule-customer"
              nzAllowClear
              nzShowSearch
              nzServerSearch
              [nzPlaceHolder]="'agentCommissions.rules.anyValue' | translate"
              [ngModel]="form().customer_id"
              (ngModelChange)="patch({ customer_id: $event ?? null })"
              (nzOnSearch)="store.searchCustomers($event)"
            >
              @for (option of customerChoices(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.name"></nz-option>
              }
            </nz-select>
          </label>

          <label class="field" for="agc-rule-zone">
            <span>{{ 'agentCommissions.field.zone' | translate }}</span>
            <nz-select
              nzId="agc-rule-zone"
              nzAllowClear
              [nzPlaceHolder]="'agentCommissions.rules.anyValue' | translate"
              [ngModel]="form().zone_id"
              (ngModelChange)="patch({ zone_id: $event ?? null })"
            >
              @for (zone of store.zones(); track zone.id) {
                <nz-option [nzValue]="zone.id" [nzLabel]="zone.code + ' ' + zone.name"></nz-option>
              }
            </nz-select>
          </label>

          <label class="field" for="agc-rule-rate-type">
            <span>{{ 'agentCommissions.field.rateType' | translate }}</span>
            <nz-select
              nzId="agc-rule-rate-type"
              [ngModel]="form().rate_type"
              (ngModelChange)="patch({ rate_type: $event })"
            >
              @for (type of rateTypes; track type) {
                <nz-option
                  [nzValue]="type"
                  [nzLabel]="'agentCommissions.rateType.' + type | translate"
                ></nz-option>
              }
            </nz-select>
          </label>

          @if (fixed()) {
            <label class="field" for="agc-rule-fixed">
              <span>{{ 'agentCommissions.field.fixedAmount' | translate }}</span>
              <nz-input-number
                nzId="agc-rule-fixed"
                [nzMin]="0"
                [nzStep]="1"
                [ngModel]="form().fixed_amount"
                (ngModelChange)="patch({ fixed_amount: $event })"
              ></nz-input-number>
            </label>
          } @else if (tiers().length === 0) {
            <label class="field" for="agc-rule-rate">
              <span>{{ 'agentCommissions.field.rate' | translate }}</span>
              <nz-input-number
                nzId="agc-rule-rate"
                [nzMin]="0"
                [nzMax]="100"
                [nzStep]="0.5"
                [ngModel]="form().rate"
                (ngModelChange)="patch({ rate: $event })"
              ></nz-input-number>
            </label>
          }

          <label class="field" for="agc-rule-accrual">
            <span>{{ 'agentCommissions.field.accrualBasis' | translate }}</span>
            <nz-select
              nzId="agc-rule-accrual"
              nzAllowClear
              [nzPlaceHolder]="'agentCommissions.rules.anyValue' | translate"
              [ngModel]="form().accrual_basis"
              (ngModelChange)="patch({ accrual_basis: $event ?? null })"
            >
              @for (basis of accrualBases; track basis) {
                <nz-option
                  [nzValue]="basis"
                  [nzLabel]="'agentCommissions.accrualBasis.' + basis | translate"
                ></nz-option>
              }
            </nz-select>
          </label>

          <label class="field" for="agc-rule-priority">
            <span>{{ 'agentCommissions.field.priority' | translate }}</span>
            <nz-input-number
              nzId="agc-rule-priority"
              [nzMin]="1"
              [nzMax]="100000"
              [nzStep]="1"
              [ngModel]="form().priority"
              (ngModelChange)="patch({ priority: $event ?? 100 })"
            ></nz-input-number>
          </label>

          <label class="field" for="agc-rule-from">
            <span>{{ 'agentCommissions.field.validFrom' | translate }}</span>
            <input
              nz-input
              id="agc-rule-from"
              type="date"
              [ngModel]="form().valid_from"
              (ngModelChange)="patch({ valid_from: $event })"
            />
          </label>

          <label class="field" for="agc-rule-to">
            <span>{{ 'agentCommissions.field.validTo' | translate }}</span>
            <input
              nz-input
              id="agc-rule-to"
              type="date"
              [ngModel]="form().valid_to"
              (ngModelChange)="patch({ valid_to: $event })"
            />
          </label>

          <div class="checks wide">
            <label
              for="agc-rule-active"
              nzId="agc-rule-active"
              nz-checkbox
              [ngModel]="form().is_active"
              (ngModelChange)="patch({ is_active: $event })"
              >{{ 'agentCommissions.field.active' | translate }}</label
            >
          </div>
        </div>

        @if (!fixed()) {
          <section class="tiers" [attr.aria-label]="'agentCommissions.field.tiers' | translate">
            <h4>{{ 'agentCommissions.field.tiers' | translate }}</h4>
            <p class="hint">{{ 'agentCommissions.rules.tiersHint' | translate }}</p>
            @for (tier of tiers(); track $index) {
              <div class="tier-row">
                <label class="field" [attr.for]="'agc-tier-from-' + $index">
                  <span>{{ 'agentCommissions.field.thresholdFrom' | translate }}</span>
                  <nz-input-number
                    [nzId]="'agc-tier-from-' + $index"
                    [nzMin]="0"
                    [ngModel]="tier.from"
                    (ngModelChange)="patchTier($index, { from: $event })"
                  ></nz-input-number>
                </label>
                <label class="field" [attr.for]="'agc-tier-to-' + $index">
                  <span>{{ 'agentCommissions.field.thresholdTo' | translate }}</span>
                  <nz-input-number
                    [nzId]="'agc-tier-to-' + $index"
                    [nzMin]="0"
                    [ngModel]="tier.to"
                    (ngModelChange)="patchTier($index, { to: $event })"
                  ></nz-input-number>
                </label>
                <label class="field" [attr.for]="'agc-tier-rate-' + $index">
                  <span>{{ 'agentCommissions.field.rate' | translate }}</span>
                  <nz-input-number
                    [nzId]="'agc-tier-rate-' + $index"
                    [nzMin]="0"
                    [nzMax]="100"
                    [nzStep]="0.5"
                    [ngModel]="tier.rate"
                    (ngModelChange)="patchTier($index, { rate: $event })"
                  ></nz-input-number>
                </label>
                <button
                  nz-button
                  nzDanger
                  nzSize="small"
                  type="button"
                  (click)="removeTier($index)"
                >
                  {{ 'agentCommissions.action.removeTier' | translate }}
                </button>
              </div>
            }
            @if (tiers().length > 0 && !tiersValid()) {
              <nz-alert
                nzType="warning"
                nzShowIcon
                [nzMessage]="'agentCommissions.error.invalid_tiers' | translate"
              ></nz-alert>
            }
            <button nz-button type="button" (click)="addTier()">
              {{ 'agentCommissions.action.addTier' | translate }}
            </button>
          </section>
        }

        <div class="footer">
          <button nz-button type="button" (click)="closed.emit()">
            {{ 'agentCommissions.action.cancel' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="store.saving()"
            [disabled]="!valid()"
            (click)="save()"
          >
            {{ 'agentCommissions.action.save' | translate }}
          </button>
        </div>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .wide {
      grid-column: 1 / -1;
    }

    .hint {
      margin: 0 0 12px;
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .feedback {
      margin-bottom: 16px;
    }

    .tiers {
      margin-top: 24px;
    }

    .tier-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
      align-items: end;
      gap: 12px;
      margin-bottom: 12px;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
    }
  `,
})
export class RuleFormDrawerComponent {
  readonly store = inject(RulesStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly visible = input.required<boolean>();
  /** The rule to edit; null creates a new one. */
  readonly rule = input<AgcRule | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly rateTypes = AGC_RATE_TYPES;
  readonly accrualBases = AGC_ACCRUAL_BASES;

  readonly form = signal<RuleFormValue>({ ...DEFAULT_RULE_FORM });
  readonly tiers = signal<TierRow[]>([]);
  readonly error = signal<AgcOutcome | null>(null);

  readonly editing = computed(() => this.rule() !== null);
  readonly fixed = computed(() => this.form().rate_type === 'fixed');
  readonly tiersValid = computed(() => tiersAreValid(this.tiers()));
  readonly valid = computed(() => isRuleFormValid(this.form(), this.fixed() ? [] : this.tiers()));

  /** The customers the search found, plus the one already picked (so its name shows before any search). */
  readonly customerChoices = computed<NamedOption[]>(() => {
    const options = [...this.store.customerOptions()];
    const picked = this.form().customer_id;
    if (picked && !options.some((option) => option.id === picked)) {
      options.unshift({ id: picked, name: this.store.customerNames().get(picked) ?? picked });
    }
    return options;
  });

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const rule = this.rule();
      untracked(() => {
        this.error.set(null);
        this.form.set(rule ? ruleFormOf(rule) : { ...DEFAULT_RULE_FORM });
        this.tiers.set(rule ? tierRowsOf(rule.tiers) : []);
      });
    });
  }

  patch(change: Partial<RuleFormValue>): void {
    this.form.update((current) => ({ ...current, ...change }));
  }

  addTier(): void {
    const rows = this.tiers();
    this.tiers.set([...rows, emptyTierRow(rows[rows.length - 1])]);
  }

  removeTier(index: number): void {
    this.tiers.update((rows) => rows.filter((_, position) => position !== index));
  }

  patchTier(index: number, change: Partial<TierRow>): void {
    this.tiers.update((rows) =>
      rows.map((row, position) => (position === index ? { ...row, ...change } : row)),
    );
  }

  async save(): Promise<void> {
    if (!this.valid()) {
      return;
    }
    this.error.set(null);
    const outcome = await this.store.save(
      this.rule()?.id ?? null,
      rulePayloadOf(this.form(), this.fixed() ? [] : this.tiers()),
    );
    if (outcome.ok) {
      this.message.success(this.translate.instant('agentCommissions.message.saved'));
      this.saved.emit();
    } else {
      this.error.set(outcome);
    }
  }
}
