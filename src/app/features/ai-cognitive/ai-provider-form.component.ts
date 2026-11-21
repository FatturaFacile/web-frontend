import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DataClassification,
  ProviderForm,
  ProviderSetting,
  SupportedProvider,
} from './ai-cognitive.models';

const CLASSIFICATIONS: DataClassification[] = ['public', 'internal', 'confidential_pii'];

/**
 * One provider card: local Ollama (zero egress) or a hosted provider on the company's own key. The key is write-only: the
 * field stays empty, a stored key is shown as a tag, and an empty field keeps it. A hosted provider is switched on here but
 * only runs once the company allowed external AI providers.
 */
@Component({
  selector: 'app-ai-provider-form',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzTagModule,
  ],
  template: `
    <nz-card
      nzSize="small"
      [nzTitle]="'AI_COG.PROVIDER_' + provider().provider.toUpperCase() | translate"
      [attr.data-testid]="'provider-' + provider().provider"
    >
      <nz-tag [nzColor]="provider().is_local ? 'green' : 'blue'">{{
        (provider().is_local ? 'AI_COG.LOCAL_PRIVACY' : 'AI_COG.HOSTED_BYOK') | translate
      }}</nz-tag>
      @if (!provider().is_local && !externalAllowed()) {
        <nz-tag nzColor="orange" data-testid="blocked-tag">{{
          'AI_COG.EXTERNAL_NOT_ALLOWED' | translate
        }}</nz-tag>
      }

      <form [formGroup]="form" class="form-grid" (ngSubmit)="submit()">
        <div class="row">
          <label [for]="id('enabled')">{{ 'AI_COG.ENABLED' | translate }}</label>
          <nz-switch [nzId]="id('enabled')" formControlName="is_enabled"></nz-switch>
        </div>
        <div class="row">
          <label [for]="id('default')">{{ 'AI_COG.DEFAULT_PROVIDER' | translate }}</label>
          <nz-switch [nzId]="id('default')" formControlName="is_default"></nz-switch>
        </div>
        @if (provider().provider === 'ollama' || provider().provider === 'azure_openai') {
          <div class="row">
            <label [for]="id('endpoint')">{{ 'AI_COG.ENDPOINT' | translate }}</label>
            <input nz-input [id]="id('endpoint')" formControlName="endpoint" />
          </div>
        }
        <div class="row">
          <label [for]="id('model')">{{ 'AI_COG.MODEL' | translate }}</label>
          <input nz-input [id]="id('model')" formControlName="model" />
        </div>
        <div class="row">
          <label [for]="id('light')">{{ 'AI_COG.LIGHT_MODEL' | translate }}</label>
          <input nz-input [id]="id('light')" formControlName="light_model" />
        </div>
        <div class="row">
          <label [for]="id('embedding')">{{ 'AI_COG.EMBEDDING_MODEL' | translate }}</label>
          <input nz-input [id]="id('embedding')" formControlName="embedding_model" />
        </div>
        @if (provider().provider === 'azure_openai') {
          <div class="row">
            <label [for]="id('deployment')">{{ 'AI_COG.AZURE_DEPLOYMENT' | translate }}</label>
            <input nz-input [id]="id('deployment')" formControlName="deployment" />
          </div>
          <div class="row">
            <label [for]="id('api-version')">{{ 'AI_COG.AZURE_API_VERSION' | translate }}</label>
            <input nz-input [id]="id('api-version')" formControlName="api_version" />
          </div>
        }
        @if (!provider().is_local) {
          <div class="row">
            <label [for]="id('key')">{{ 'AI_COG.API_KEY' | translate }}</label>
            <div>
              <input
                nz-input
                type="password"
                autocomplete="off"
                [id]="id('key')"
                formControlName="api_key"
                [attr.placeholder]="
                  (setting()?.has_api_key ? 'AI_COG.KEY_STORED' : 'AI_COG.KEY_NONE') | translate
                "
              />
              @if (setting()?.has_api_key) {
                <nz-tag nzColor="green" data-testid="key-stored">{{
                  'AI_COG.KEY_STORED' | translate
                }}</nz-tag>
              }
            </div>
          </div>
        }
        <div class="row">
          <label [for]="id('classification')">{{ 'AI_COG.MAX_CLASSIFICATION' | translate }}</label>
          <nz-select [nzId]="id('classification')" formControlName="max_data_classification">
            @for (classification of classifications; track classification) {
              <nz-option
                [nzValue]="classification"
                [nzLabel]="'AI_COG.CLASS_' + classification.toUpperCase() | translate"
              ></nz-option>
            }
          </nz-select>
        </div>
        @if (!provider().is_local) {
          <div class="row">
            <label [for]="id('masking')">{{ 'AI_COG.PII_MASKING' | translate }}</label>
            <nz-switch [nzId]="id('masking')" formControlName="pii_masking_enabled"></nz-switch>
          </div>
        }
        <div class="row">
          <label [for]="id('budget')">{{ 'AI_COG.MONTHLY_TOKEN_BUDGET' | translate }}</label>
          <nz-input-number
            [nzId]="id('budget')"
            formControlName="monthly_token_budget"
            [nzMin]="0"
            [nzStep]="10000"
          ></nz-input-number>
        </div>
        <div class="row">
          <label [for]="id('rate')">{{ 'AI_COG.RATE_LIMIT' | translate }}</label>
          <nz-input-number
            [nzId]="id('rate')"
            formControlName="rate_limit_per_minute"
            [nzMin]="1"
          ></nz-input-number>
        </div>
        <button
          nz-button
          nzType="primary"
          type="submit"
          [attr.data-testid]="'save-provider-' + provider().provider"
          [nzLoading]="saving()"
        >
          {{ 'AI_COG.SAVE' | translate }}
        </button>
      </form>
    </nz-card>
  `,
})
export class AiProviderFormComponent {
  readonly provider = input.required<SupportedProvider>();
  readonly setting = input<ProviderSetting | null>(null);
  readonly externalAllowed = input(false);
  readonly saving = input(false);
  readonly save = output<ProviderForm>();

  protected readonly classifications = CLASSIFICATIONS;
  private readonly builder = inject(FormBuilder).nonNullable;

  protected readonly form = this.builder.group({
    is_enabled: false,
    is_default: false,
    endpoint: '',
    model: '',
    light_model: '',
    embedding_model: '',
    deployment: '',
    api_version: '',
    api_key: '',
    max_data_classification: 'internal' as DataClassification,
    pii_masking_enabled: true,
    monthly_token_budget: null as number | null,
    rate_limit_per_minute: null as number | null,
  });

  constructor() {
    // The form shows what the server holds: the saved setting, or the defaults of the provider before it is set up.
    effect(() => {
      const provider = this.provider();
      const saved = this.setting();

      this.form.reset({
        is_enabled: saved?.is_enabled ?? false,
        is_default: saved?.is_default ?? false,
        endpoint: saved?.endpoint ?? '',
        model: saved?.model ?? '',
        light_model: saved?.light_model ?? '',
        embedding_model: saved?.embedding_model ?? '',
        deployment: String(saved?.extra['deployment'] ?? ''),
        api_version: String(saved?.extra['api_version'] ?? ''),
        api_key: '',
        max_data_classification:
          saved?.max_data_classification ?? (provider.is_local ? 'confidential_pii' : 'internal'),
        pii_masking_enabled: saved?.pii_masking_enabled ?? true,
        monthly_token_budget: saved?.monthly_token_budget ?? null,
        rate_limit_per_minute: saved?.rate_limit_per_minute ?? null,
      });
    });
  }

  protected id(name: string): string {
    return `ai-${this.provider().provider}-${name}`;
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    const blank = (text: string): string | null => (text.trim() === '' ? null : text.trim());
    const extra: Record<string, string> = {};

    if (this.provider().provider === 'azure_openai') {
      for (const [key, text] of [
        ['deployment', value.deployment],
        ['api_version', value.api_version],
      ] as const) {
        if (blank(text) !== null) {
          extra[key] = text.trim();
        }
      }
    }

    this.save.emit({
      is_enabled: value.is_enabled,
      is_default: value.is_default,
      endpoint: blank(value.endpoint),
      model: blank(value.model),
      light_model: blank(value.light_model),
      embedding_model: blank(value.embedding_model),
      api_key: blank(value.api_key),
      extra,
      max_data_classification: value.max_data_classification,
      pii_masking_enabled: this.provider().is_local ? false : value.pii_masking_enabled,
      monthly_token_budget: value.monthly_token_budget,
      rate_limit_per_minute: value.rate_limit_per_minute,
    });
  }
}
