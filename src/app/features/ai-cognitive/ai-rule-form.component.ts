import { toSignal } from '@angular/core/rxjs-interop';
import { Component, computed, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AutomationRule, DataClassification } from './ai-cognitive.models';
import { policyOutcome } from './ai-cognitive.utils';

const CLASSIFICATIONS: DataClassification[] = ['public', 'internal', 'confidential_pii'];

/**
 * The zero-click policy of one workflow as a table row: switch the workflow on, allow automatic approval, and set the
 * confidence and the amount below which the layer may act without a person. The last column shows what the policy would do
 * with the sample result of the page, using the same rule the server applies.
 */
@Component({
  selector: 'app-ai-rule-form',
  host: { role: 'row', class: 'rule-row' },
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    NzButtonModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzTagModule,
  ],
  template: `
    <div role="cell">{{ 'AI_COG.WORKFLOW_' + rule().workflow.toUpperCase() | translate }}</div>
    <div role="cell">
      <nz-switch
        [formControl]="form.controls.is_enabled"
        [attr.aria-label]="'AI_COG.ENABLED' | translate"
      ></nz-switch>
    </div>
    <div role="cell">
      <nz-switch
        [formControl]="form.controls.auto_approve_enabled"
        [attr.aria-label]="'AI_COG.AUTO_APPROVE' | translate"
      ></nz-switch>
    </div>
    <div role="cell">
      <nz-input-number
        [formControl]="form.controls.auto_approve_min_confidence"
        [nzMin]="0.5"
        [nzMax]="1"
        [nzStep]="0.01"
        [nzPrecision]="2"
        [attr.aria-label]="'AI_COG.MIN_CONFIDENCE' | translate"
      ></nz-input-number>
    </div>
    <div role="cell">
      <nz-input-number
        [formControl]="form.controls.max_auto_amount"
        [nzMin]="0"
        [nzStep]="100"
        [attr.aria-label]="'AI_COG.MAX_AUTO_AMOUNT' | translate"
      ></nz-input-number>
    </div>
    <div role="cell">
      <nz-select
        [formControl]="form.controls.data_classification"
        [attr.aria-label]="'AI_COG.CLASSIFICATION' | translate"
      >
        @for (classification of classifications; track classification) {
          <nz-option
            [nzValue]="classification"
            [nzLabel]="'AI_COG.CLASS_' + classification.toUpperCase() | translate"
          ></nz-option>
        }
      </nz-select>
    </div>
    <div role="cell">
      <nz-tag [nzColor]="outcomeColor()" [attr.data-testid]="'outcome-' + rule().workflow">{{
        'AI_COG.OUTCOME_' + outcome().toUpperCase() | translate
      }}</nz-tag>
    </div>
    <div role="cell">
      <button
        nz-button
        nzSize="small"
        nzType="primary"
        type="button"
        [attr.data-testid]="'save-rule-' + rule().workflow"
        [nzLoading]="saving()"
        (click)="submit()"
      >
        {{ 'AI_COG.SAVE' | translate }}
      </button>
    </div>
  `,
})
export class AiRuleFormComponent {
  readonly rule = input.required<AutomationRule>();
  /** The sample result the outcome column judges. */
  readonly sampleConfidence = input(0.96);
  readonly sampleAmount = input<number | null>(800);
  readonly saving = input(false);
  readonly save = output<AutomationRule>();

  protected readonly classifications = CLASSIFICATIONS;
  private readonly builder = inject(FormBuilder).nonNullable;

  protected readonly form = this.builder.group({
    is_enabled: true,
    auto_approve_enabled: false,
    auto_approve_min_confidence: 0.95,
    max_auto_amount: null as number | null,
    data_classification: 'internal' as DataClassification,
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly outcome = computed(() => {
    const value = { ...this.form.getRawValue(), ...this.value() };

    return policyOutcome(
      {
        is_enabled: !!value.is_enabled,
        auto_approve_enabled: !!value.auto_approve_enabled,
        auto_approve_min_confidence: value.auto_approve_min_confidence ?? 0.95,
        max_auto_amount: value.max_auto_amount ?? null,
      },
      this.sampleConfidence(),
      this.sampleAmount(),
    );
  });

  protected readonly outcomeColor = computed(() =>
    this.outcome() === 'auto' ? 'green' : this.outcome() === 'review' ? 'blue' : 'default',
  );

  constructor() {
    effect(() => {
      const rule = this.rule();

      this.form.reset({
        is_enabled: rule.is_enabled,
        auto_approve_enabled: rule.auto_approve_enabled,
        auto_approve_min_confidence: rule.auto_approve_min_confidence,
        max_auto_amount: rule.max_auto_amount,
        data_classification: rule.data_classification,
      });
    });
  }

  protected submit(): void {
    const value = this.form.getRawValue();

    this.save.emit({
      ...this.rule(),
      is_enabled: value.is_enabled,
      auto_approve_enabled: value.auto_approve_enabled,
      auto_approve_min_confidence: value.auto_approve_min_confidence,
      max_auto_amount: value.max_auto_amount,
      data_classification: value.data_classification,
    });
  }
}
