import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import {
  applyServerErrors,
  I18nService,
  LEAD_ACTIVITY_EVENT_TYPES,
  LEAD_SCORING_OPERATORS,
  LeadActivityEventType,
  LeadApiService,
  LeadScoringCategory,
  LeadScoringOperator,
  LeadScoringRule,
  LeadScoringRulePayload,
  serverErrorMessage,
} from '@core';
import { apiErrorMessage } from '../leads/lead-i18n';

/** Rule values are typed as JSON when possible ("10", "[\"IT\",\"CH\"]"), plain strings otherwise. */
import { TranslatePipe } from '@shared';

export function parseRuleValue(raw: string): unknown {
  const text = raw.trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function formatRuleValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function targetValidator(group: AbstractControl): ValidationErrors | null {
  const category = group.get('category')?.value as LeadScoringCategory;
  if (category === 'behavioral') {
    return group.get('event_type')?.value ? null : { eventTypeRequired: true };
  }
  return String(group.get('field')?.value ?? '').trim() ? null : { fieldRequired: true };
}

@Component({
  selector: 'app-lead-scoring-rule-modal',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSwitchModule,
    TranslatePipe,
  ],
  templateUrl: './lead-scoring-rule-modal.component.html',
  styleUrl: './lead-admin.scss',
})
export class LeadScoringRuleModalComponent {
  private readonly api = inject(LeadApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);

  readonly open = model(false);
  readonly rule = input<LeadScoringRule | null>(null);
  readonly saved = output<LeadScoringRule>();

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      code: this.fb.control('', [Validators.required, Validators.maxLength(64)]),
      name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
      category: this.fb.control<LeadScoringCategory>('demographic'),
      field: this.fb.control(''),
      event_type: this.fb.control<LeadActivityEventType | null>(null),
      operator: this.fb.control<LeadScoringOperator>('eq'),
      value: this.fb.control(''),
      points: this.fb.control(10, [Validators.required]),
      max_applications: this.fb.control<number | null>(null),
      decay_days: this.fb.control<number | null>(null),
      is_active: this.fb.control(true),
    },
    { validators: [targetValidator] },
  );

  readonly category = signal<LeadScoringCategory>('demographic');

  protected readonly operatorOptions = computed(() => {
    this.i18n.currentLanguage();
    return LEAD_SCORING_OPERATORS.map((o) => ({
      value: o,
      label: this.i18n.translate(`CRM.LEAD_SCORING.OPERATORS.${o.toUpperCase()}`),
    }));
  });

  protected readonly eventTypeOptions = computed(() => {
    this.i18n.currentLanguage();
    return LEAD_ACTIVITY_EVENT_TYPES.map((t) => ({
      value: t,
      label: this.i18n.translate(`CRM.LEADS.EVENTS.TYPES.${t.toUpperCase()}`),
    }));
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        const rule = this.rule();
        untracked(() => this.reset(rule));
      }
    });
    this.form.controls.category.valueChanges.subscribe((c) => this.category.set(c));
  }

  private reset(rule: LeadScoringRule | null): void {
    this.formError.set(null);
    this.form.reset({
      code: rule?.code ?? '',
      name: rule?.name ?? '',
      category: rule?.category ?? 'demographic',
      field: rule?.field ?? '',
      event_type: rule?.event_type ?? null,
      operator: rule?.operator ?? 'eq',
      value: formatRuleValue(rule?.value),
      points: rule?.points ?? 10,
      max_applications: rule?.max_applications ?? null,
      decay_days: rule?.decay_days ?? null,
      is_active: rule?.is_active ?? true,
    });
    this.category.set(rule?.category ?? 'demographic');
  }

  protected fieldError(path: string): string | null {
    return serverErrorMessage(this.form, path);
  }

  buildPayload(): LeadScoringRulePayload {
    const v = this.form.getRawValue();
    const behavioral = v.category === 'behavioral';
    return {
      code: v.code.trim(),
      name: v.name.trim(),
      category: v.category,
      field: behavioral ? null : v.field.trim(),
      event_type: behavioral ? v.event_type : null,
      operator: v.operator,
      value: parseRuleValue(v.value),
      points: v.points,
      max_applications: v.max_applications,
      decay_days: behavioral ? v.decay_days : null,
      is_active: v.is_active,
    };
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsDirty();
      this.formError.set(
        this.form.hasError('eventTypeRequired') || this.form.hasError('fieldRequired')
          ? this.i18n.translate('CRM.LEAD_SCORING.RULES.TARGET_REQUIRED')
          : null,
      );
      return;
    }
    if (this.saving()) {
      return;
    }
    const rule = this.rule();
    const payload = this.buildPayload();
    const call = rule
      ? this.api.updateScoringRule(rule.id, payload)
      : this.api.createScoringRule(payload);
    this.saving.set(true);
    this.formError.set(null);
    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.open.set(false);
        this.saved.emit(saved);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form, err);
        this.formError.set(unmapped.join(' ') || apiErrorMessage(err));
      },
    });
  }
}
