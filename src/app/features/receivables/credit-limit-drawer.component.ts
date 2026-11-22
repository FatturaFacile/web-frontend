import { Component, computed, effect, input, model, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ArCreditLimit, ArCreditLimitPayload, ArCreditLimitUpdate, AR_REACTION_POLICIES } from '@core';
import { TranslatePipe } from '@shared';
import {
  draftFromLimit,
  LimitDraft,
  LimitErrors,
  LimitField,
  limitPayload,
  limitUpdate,
  validateLimitDraft,
} from './limit-form';
import { fromIsoDate, toIsoDate, todayIso } from './receivables.util';

/** What the form hands over: the limit to edit (or `null` to create) and the body to send. */
export interface LimitSubmit {
  id: string | null;
  payload: ArCreditLimitPayload | ArCreditLimitUpdate;
}

/**
 * Credit limit form (create and edit): granted and insured limit, insurer, policy and coverage, overdue tolerance, the
 * reaction policy and the validity dates. It only collects and validates; the page sends it.
 */
@Component({
  selector: 'app-credit-limit-drawer',
  styleUrl: './receivables.scss',
  imports: [
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzInputModule,
    NzSelectModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      nzPlacement="right"
      [nzWidth]="640"
      [nzTitle]="(limit() ? 'AR.EDIT_LIMIT' : 'AR.NEW_LIMIT') | translate"
      [nzFooter]="footer"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (serverMessage(); as message) {
          <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="message"></nz-alert>
        }

        <div class="form-grid">
          <div class="field">
            <label for="cl-granted">{{ 'AR.GRANTED_LIMIT' | translate }}</label>
            <input
              nz-input
              id="cl-granted"
              inputmode="decimal"
              [ngModel]="draft().granted_limit"
              (ngModelChange)="set('granted_limit', $event)"
            />
            @if (error('granted_limit'); as text) {
              <span class="error" role="alert">{{ text | translate }}</span>
            }
          </div>

          <div class="field">
            <label for="cl-currency">{{ 'AR.CURRENCY' | translate }}</label>
            <input
              nz-input
              id="cl-currency"
              maxlength="3"
              [ngModel]="draft().currency"
              (ngModelChange)="set('currency', $event)"
            />
            @if (error('currency'); as text) {
              <span class="error" role="alert">{{ text | translate }}</span>
            }
          </div>

          <div class="field">
            <label for="cl-insured">{{ 'AR.INSURED_LIMIT' | translate }}</label>
            <input
              nz-input
              id="cl-insured"
              inputmode="decimal"
              [ngModel]="draft().insured_limit"
              (ngModelChange)="set('insured_limit', $event)"
            />
            @if (error('insured_limit'); as text) {
              <span class="error" role="alert">{{ text | translate }}</span>
            }
          </div>

          <div class="field">
            <label for="cl-coverage">{{ 'AR.COVERAGE_PERCENTAGE' | translate }}</label>
            <input
              nz-input
              id="cl-coverage"
              inputmode="decimal"
              [ngModel]="draft().coverage_percentage"
              (ngModelChange)="set('coverage_percentage', $event)"
            />
            @if (error('coverage_percentage'); as text) {
              <span class="error" role="alert">{{ text | translate }}</span>
            }
          </div>

          <div class="field">
            <label for="cl-insurer">{{ 'AR.INSURER' | translate }}</label>
            <input
              nz-input
              id="cl-insurer"
              [ngModel]="draft().insurer_name"
              (ngModelChange)="set('insurer_name', $event)"
            />
            @if (error('insurer_name'); as text) {
              <span class="error" role="alert">{{ text | translate }}</span>
            }
          </div>

          <div class="field">
            <label for="cl-policy">{{ 'AR.POLICY_NUMBER' | translate }}</label>
            <input
              nz-input
              id="cl-policy"
              [ngModel]="draft().policy_number"
              (ngModelChange)="set('policy_number', $event)"
            />
          </div>

          <div class="field">
            <label for="cl-days">{{ 'AR.MAX_OVERDUE_DAYS' | translate }}</label>
            <input
              nz-input
              id="cl-days"
              inputmode="numeric"
              [ngModel]="draft().max_overdue_days"
              (ngModelChange)="set('max_overdue_days', $event)"
            />
            @if (error('max_overdue_days'); as text) {
              <span class="error" role="alert">{{ text | translate }}</span>
            }
          </div>

          <div class="field">
            <label for="cl-tolerance">{{ 'AR.OVERDUE_TOLERANCE' | translate }}</label>
            <input
              nz-input
              id="cl-tolerance"
              inputmode="decimal"
              [ngModel]="draft().overdue_tolerance_amount"
              (ngModelChange)="set('overdue_tolerance_amount', $event)"
            />
            @if (error('overdue_tolerance_amount'); as text) {
              <span class="error" role="alert">{{ text | translate }}</span>
            }
          </div>

          <div class="field wide">
            <label for="cl-policy-reaction">{{ 'AR.REACTION_POLICY' | translate }}</label>
            <nz-select
              nzId="cl-policy-reaction"
              style="width: 100%"
              [ngModel]="draft().reaction_policy"
              (ngModelChange)="set('reaction_policy', $event)"
            >
              @for (policy of policies; track policy) {
                <nz-option
                  [nzValue]="policy"
                  [nzLabel]="'AR.POLICY_' + policy.toUpperCase() | translate"
                ></nz-option>
              }
            </nz-select>
          </div>

          <div class="field">
            <label for="cl-from">{{ 'AR.VALID_FROM' | translate }}</label>
            <nz-date-picker
              nzId="cl-from"
              style="width: 100%"
              [ngModel]="date(draft().valid_from)"
              (ngModelChange)="set('valid_from', iso($event))"
            ></nz-date-picker>
            @if (error('valid_from'); as text) {
              <span class="error" role="alert">{{ text | translate }}</span>
            }
          </div>

          <div class="field">
            <label for="cl-to">{{ 'AR.VALID_TO' | translate }}</label>
            <nz-date-picker
              nzId="cl-to"
              style="width: 100%"
              [ngModel]="date(draft().valid_to)"
              (ngModelChange)="set('valid_to', iso($event))"
            ></nz-date-picker>
            @if (error('valid_to'); as text) {
              <span class="error" role="alert">{{ text | translate }}</span>
            }
          </div>

          <div class="field wide">
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label nz-checkbox [ngModel]="draft().is_active" (ngModelChange)="set('is_active', $event)">{{
              'AR.LIMIT_ACTIVE' | translate
            }}</label>
          </div>

          <div class="field wide">
            <label for="cl-notes">{{ 'AR.NOTES' | translate }}</label>
            <textarea
              nz-input
              id="cl-notes"
              rows="3"
              [ngModel]="draft().notes"
              (ngModelChange)="set('notes', $event)"
            ></textarea>
          </div>
        </div>
      </ng-container>
    </nz-drawer>

    <ng-template #footer>
      <div class="drawer-footer">
        <span></span>
        <span>
          <button nz-button type="button" (click)="open.set(false)">{{ 'AR.CANCEL' | translate }}</button>
          <button nz-button nzType="primary" type="button" [nzLoading]="saving()" (click)="submit()">
            {{ 'AR.SAVE' | translate }}
          </button>
        </span>
      </div>
    </ng-template>
  `,
})
export class CreditLimitDrawerComponent {
  readonly open = model(false);
  /** The limit to edit; `null` creates one. */
  readonly limit = input<ArCreditLimit | null>(null);
  readonly customerId = input.required<string>();
  /** Default currency of a new limit. */
  readonly currency = input('EUR');
  readonly saving = input(false);
  /** Field errors of a refused save (the 422 of the API), by field name. */
  readonly serverErrors = input<Record<string, string[]>>({});
  /** Message of a refused save that has no field to show it on. */
  readonly serverMessage = input<string | null>(null);

  readonly submitted = output<LimitSubmit>();

  readonly policies = AR_REACTION_POLICIES;
  readonly draft = signal<LimitDraft>(draftFromLimit(null, 'EUR', todayIso()));
  /** Shown only after the first submit attempt, so an empty new form is not red. */
  readonly showErrors = signal(false);
  readonly errors = computed<LimitErrors>(() => validateLimitDraft(this.draft()));

  constructor() {
    effect(() => {
      // Only the opening restarts the form.
      if (this.open()) {
        untracked(() => {
          this.draft.set(draftFromLimit(this.limit(), this.currency(), todayIso()));
          this.showErrors.set(false);
        });
      }
    });
  }

  set<K extends LimitField>(field: K, value: LimitDraft[K] | null): void {
    this.draft.update((draft) => ({ ...draft, [field]: value ?? (typeof draft[field] === 'boolean' ? false : '') }));
  }

  /** The translation key, or the first message of the API, of a field. */
  error(field: LimitField): string | null {
    if (this.showErrors() && this.errors()[field]) {
      return this.errors()[field] ?? null;
    }
    return this.serverErrors()[field]?.[0] ?? null;
  }

  date(value: string): Date | null {
    return fromIsoDate(value);
  }

  iso(value: Date | null): string {
    return toIsoDate(value) ?? '';
  }

  submit(): void {
    this.showErrors.set(true);
    if (Object.keys(this.errors()).length > 0) {
      return;
    }
    const existing = this.limit();
    this.submitted.emit(
      existing
        ? { id: existing.id, payload: limitUpdate(this.draft()) }
        : { id: null, payload: limitPayload(this.draft(), this.customerId()) },
    );
  }
}
