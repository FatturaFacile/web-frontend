import { Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, of, switchMap, tap } from 'rxjs';
import {
  AuthApiService,
  PasswordCheckResult,
  PasswordPolicyRules,
  PasswordRuleCode,
  PasswordRuleResult,
} from '@core';
import { TranslatePipe } from '@shared';
import { PASSWORD_MIN_LENGTH, passwordStrength } from '../../password-rules';

/** Pause after the last keystroke before the password is sent to the API for a check. */
export const PASSWORD_CHECK_DEBOUNCE_MS = 300;

/** Rules the checklist shows before the API has answered (the API sends the applicable ones with the policy). */
const DEFAULT_RULES: readonly PasswordRuleCode[] = ['min_length', 'mixed_case', 'numbers', 'symbols'];

const PROGRESS_COLORS: readonly string[] = ['#d9d9d9', '#ff4d4f', '#faad14', '#52c41a', '#237804'];

/**
 * Live strength meter and policy checklist of a candidate password. The password is checked by the API (debounced, the
 * latest keystroke wins) so the rules shown are the ones that will be enforced for the tenant (length, mixed case,
 * numbers, symbols, reuse, known data breaches). Without an answer (offline, throttled) a minimal local estimate of
 * the strength keeps the meter alive; the server still has the last word on submit.
 */
@Component({
  selector: 'app-password-strength',
  imports: [NzIconModule, NzProgressModule, TranslatePipe],
  template: `
    <div class="meter" role="status" aria-live="polite">
      <nz-progress
        [nzPercent]="percent()"
        [nzShowInfo]="false"
        [nzStrokeColor]="color()"
        nzSize="small"
        aria-hidden="true"
      />
      @if (strength() > 0) {
        <small class="label" data-testid="strength-label">
          {{ 'security.password.strength.label' | translate }}: {{ 'security.password.strength.' + strength() | translate }}
        </small>
      }
    </div>

    <ul class="rules" [attr.aria-label]="'security.password.rules.title' | translate">
      @for (rule of rules(); track rule.code) {
        <li [class.passed]="rule.passed" [class.failed]="rule.pending === false && !rule.passed" [attr.data-rule]="rule.code">
          <nz-icon [nzType]="icon(rule)" aria-hidden="true" />
          <span>{{ 'security.password.rules.' + rule.code | translate: ruleParams() }}</span>
        </li>
      }
      @if (checking()) {
        <li class="checking" data-testid="checking">{{ 'security.password.rules.checking' | translate }}</li>
      }
    </ul>
  `,
  styles: `
    :host { display: block; margin-top: 4px; }
    .label { color: var(--text-secondary); }
    .rules { margin: 8px 0 0; padding: 0; list-style: none; font-size: var(--font-size-sm, 13px); }
    .rules li { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); }
    .rules li.passed { color: var(--success-color, #52c41a); }
    .rules li.failed { color: var(--error-color, #ff4d4f); }
    .rules li.checking { color: var(--text-secondary); font-style: italic; }
  `,
})
export class PasswordStrengthComponent implements OnInit {
  private readonly api = inject(AuthApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly password = input.required<string>();
  /** Account the password is for: lets the API refuse the reuse of a recent password and passwords built from the address. */
  readonly email = input<string | null>(null);
  readonly tenantId = input<string | null>(null);

  /** Latest check of the API, or `null` while the password is empty or the check is unavailable. */
  readonly checked = output<PasswordCheckResult | null>();

  protected readonly result = signal<PasswordCheckResult | null>(null);
  protected readonly policy = signal<PasswordPolicyRules | null>(null);
  protected readonly checking = signal(false);
  protected readonly offline = signal(false);

  /** Strength 0-4 of the API, or the local estimate while the API cannot answer. */
  protected readonly strength = computed(() => {
    const password = this.password();
    if (!password) {
      return 0;
    }
    const result = this.result();
    return result && !this.offline() ? result.strength : passwordStrength(password);
  });

  /** Placeholders of the rule texts: `{min}` characters and the last `{count}` passwords. */
  protected readonly ruleParams = computed(() => ({
    min: this.policy()?.min_length ?? PASSWORD_MIN_LENGTH,
    count: this.policy()?.history_count ?? 0,
  }));

  protected readonly percent = computed(() => this.strength() * 25);
  protected readonly color = computed(() => PROGRESS_COLORS[this.strength()] ?? PROGRESS_COLORS[0]);

  protected readonly rules = computed<ChecklistRule[]>(() => {
    const result = this.result();
    if (result && this.password() && !this.offline()) {
      return result.rules.map((rule: PasswordRuleResult) => ({ code: rule.code, passed: rule.passed, pending: false }));
    }
    const codes = this.policy()?.rules ?? DEFAULT_RULES;
    return codes.map((code) => ({ code, passed: false, pending: true }));
  });

  ngOnInit(): void {
    this.loadPolicy();
  }

  constructor() {
    toObservable(this.password)
      .pipe(
        debounceTime(PASSWORD_CHECK_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((password) => {
          if (!password) {
            this.result.set(null);
            this.offline.set(false);
            this.checking.set(false);
            this.checked.emit(null);
            return EMPTY;
          }
          this.checking.set(true);
          return this.api
            .checkPassword({ password, email: this.email() || null, tenant_id: this.tenantId() })
            .pipe(
              tap((res) => {
                this.result.set(res.data);
                this.offline.set(false);
                this.checking.set(false);
                this.checked.emit(res.data);
              }),
              catchError(() => {
                // Throttled or unreachable: keep the meter with a local estimate and let the server decide on submit.
                this.result.set(null);
                this.offline.set(true);
                this.checking.set(false);
                this.checked.emit(null);
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected icon(rule: ChecklistRule): string {
    return rule.pending ? 'minus-circle' : rule.passed ? 'check-circle' : 'close-circle';
  }

  private loadPolicy(): void {
    this.api.getPasswordPolicyRules(this.tenantId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.policy.set(res.data),
      // The checklist falls back to the default rules.
      error: () => undefined,
    });
  }
}

interface ChecklistRule {
  code: PasswordRuleCode;
  passed: boolean;
  /** True before the API judged the password: the rule is shown as a neutral requirement. */
  pending: boolean;
}
