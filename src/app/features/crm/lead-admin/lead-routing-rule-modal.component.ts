import { Component, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import {
  applyServerErrors,
  I18nService,
  LeadApiService,
  LeadRating,
  LeadRoutingConditions,
  LeadRoutingRule,
  LeadRoutingRulePayload,
  LeadRoutingStrategy,
  serverErrorMessage,
} from '@core';
import { LeadAssigneeSelectComponent } from '../leads/lead-assignee-select.component';
import { apiErrorMessage } from '../leads/lead-http.utils';

import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-lead-routing-rule-modal',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSwitchModule,
    TranslatePipe,
    LeadAssigneeSelectComponent,
  ],
  templateUrl: './lead-routing-rule-modal.component.html',
  styleUrl: './lead-admin.scss',
})
export class LeadRoutingRuleModalComponent {
  private readonly api = inject(LeadApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);

  readonly open = model(false);
  readonly rule = input<LeadRoutingRule | null>(null);
  /** Priority given to a new rule (appended after the existing ones). */
  readonly nextPriority = input(1);
  readonly saved = output<LeadRoutingRule>();

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly assigneeIds = signal<string[]>([]);

  readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    strategy: this.fb.control<LeadRoutingStrategy>('round_robin'),
    countries: this.fb.control<string[]>([]),
    regions: this.fb.control<string[]>([]),
    product_lines: this.fb.control<string[]>([]),
    employee_min: this.fb.control<number | null>(null),
    employee_max: this.fb.control<number | null>(null),
    ratings: this.fb.control<LeadRating[]>([]),
    is_default: this.fb.control(false),
    is_active: this.fb.control(true),
  });

  protected readonly ratingOptions = (['cold', 'warm', 'hot'] as const).map((r) => ({
    value: r,
    key: `CRM.LEADS.RATING.${r.toUpperCase()}`,
  }));

  constructor() {
    effect(() => {
      if (this.open()) {
        const rule = this.rule();
        untracked(() => this.reset(rule));
      }
    });
  }

  private reset(rule: LeadRoutingRule | null): void {
    const c = rule?.conditions ?? {};
    this.formError.set(null);
    this.form.reset({
      name: rule?.name ?? '',
      strategy: rule?.strategy ?? 'round_robin',
      countries: c.countries ?? [],
      regions: c.regions ?? [],
      product_lines: c.product_lines ?? [],
      employee_min: c.employee_min ?? null,
      employee_max: c.employee_max ?? null,
      ratings: c.ratings ?? [],
      is_default: rule?.is_default ?? false,
      is_active: rule?.is_active ?? true,
    });
    this.assigneeIds.set(rule?.assignee_user_ids ?? []);
  }

  protected fieldError(path: string): string | null {
    return serverErrorMessage(this.form, path);
  }

  buildPayload(): LeadRoutingRulePayload {
    const v = this.form.getRawValue();
    const conditions: LeadRoutingConditions = {};
    if (v.countries.length) conditions.countries = v.countries.map((x) => x.toUpperCase());
    if (v.regions.length) conditions.regions = v.regions;
    if (v.product_lines.length) conditions.product_lines = v.product_lines;
    if (v.employee_min !== null) conditions.employee_min = v.employee_min;
    if (v.employee_max !== null) conditions.employee_max = v.employee_max;
    if (v.ratings.length) conditions.ratings = v.ratings;
    return {
      name: v.name.trim(),
      priority: this.rule()?.priority ?? this.nextPriority(),
      conditions,
      strategy: v.strategy,
      assignee_user_ids: this.assigneeIds(),
      is_default: v.is_default,
      is_active: v.is_active,
    };
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsDirty();
      return;
    }
    if (!this.assigneeIds().length) {
      this.formError.set(this.i18n.translate('CRM.LEAD_ROUTING.ASSIGNEES_REQUIRED'));
      return;
    }
    if (this.saving()) {
      return;
    }
    const rule = this.rule();
    const payload = this.buildPayload();
    const call = rule
      ? this.api.updateRoutingRule(rule.id, payload)
      : this.api.createRoutingRule(payload);
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
