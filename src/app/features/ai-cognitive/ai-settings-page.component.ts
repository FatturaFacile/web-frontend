import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AiProviderFormComponent } from './ai-provider-form.component';
import { AiRuleFormComponent } from './ai-rule-form.component';
import { AiSettingsStore } from './ai-settings.store';
import { AiProvider, AutomationRule, ProviderForm } from './ai-cognitive.models';

/**
 * AI governance and provider settings (`/settings/ai`): the provider of the company (local Ollama or its own key at OpenAI,
 * Anthropic, Gemini or Azure OpenAI), the PII masking and the highest data classification each provider may receive, the
 * monthly token budget, the zero-click policy of every workflow, and the usage of the month with the audit chain check.
 */
@Component({
  selector: 'app-ai-settings-page',
  styleUrl: './ai-cognitive.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputNumberModule,
    NzSpinModule,
    NzStatisticModule,
    NzTagModule,
    AiProviderFormComponent,
    AiRuleFormComponent,
  ],
  template: `
    <app-page-header
      [title]="'AI_COG.SETTINGS_TITLE' | translate"
      [subtitle]="'AI_COG.SETTINGS_SUBTITLE' | translate"
    ></app-page-header>

    <nz-spin [nzSpinning]="store.loading()">
      @if (!store.externalAllowed()) {
        <nz-alert
          nzType="info"
          nzShowIcon
          data-testid="external-alert"
          [nzMessage]="'AI_COG.EXTERNAL_OFF_TITLE' | translate"
          [nzDescription]="'AI_COG.EXTERNAL_OFF_TEXT' | translate"
        ></nz-alert>
      }
      @if (store.blockedProviders().length > 0) {
        <nz-alert
          nzType="warning"
          nzShowIcon
          data-testid="blocked-alert"
          [nzMessage]="'AI_COG.BLOCKED_PROVIDERS' | translate"
        ></nz-alert>
      }

      <h3>{{ 'AI_COG.PROVIDERS' | translate }}</h3>
      <div class="settings-grid" data-testid="providers">
        @for (provider of store.providers(); track provider.provider) {
          <app-ai-provider-form
            [provider]="provider"
            [setting]="store.providerSetting(provider.provider)"
            [externalAllowed]="store.externalAllowed()"
            [saving]="store.savingKey() === provider.provider"
            (save)="saveProvider(provider.provider, $event)"
          ></app-ai-provider-form>
        }
      </div>

      <h3>{{ 'AI_COG.AUTOMATION_RULES' | translate }}</h3>
      <nz-card nzSize="small">
        <p class="muted">{{ 'AI_COG.AUTOMATION_HELP' | translate }}</p>
        <div class="form-grid">
          <div class="row">
            <label for="ai-sample-confidence">{{ 'AI_COG.SAMPLE_CONFIDENCE' | translate }}</label>
            <nz-input-number
              nzId="ai-sample-confidence"
              data-testid="sample-confidence"
              [ngModel]="sampleConfidence()"
              (ngModelChange)="sampleConfidence.set($event ?? 0)"
              [nzMin]="0"
              [nzMax]="1"
              [nzStep]="0.01"
              [nzPrecision]="2"
            ></nz-input-number>
          </div>
          <div class="row">
            <label for="ai-sample-amount">{{ 'AI_COG.SAMPLE_AMOUNT' | translate }}</label>
            <nz-input-number
              nzId="ai-sample-amount"
              data-testid="sample-amount"
              [ngModel]="sampleAmount()"
              (ngModelChange)="sampleAmount.set($event)"
              [nzMin]="0"
            ></nz-input-number>
          </div>
        </div>
        <div
          class="rule-grid"
          role="table"
          data-testid="rules"
          [attr.aria-label]="'AI_COG.AUTOMATION_RULES' | translate"
        >
          <div class="rule-row rule-head" role="row">
            <div role="columnheader">{{ 'AI_COG.WORKFLOW' | translate }}</div>
            <div role="columnheader">{{ 'AI_COG.ENABLED' | translate }}</div>
            <div role="columnheader">{{ 'AI_COG.AUTO_APPROVE' | translate }}</div>
            <div role="columnheader">{{ 'AI_COG.MIN_CONFIDENCE' | translate }}</div>
            <div role="columnheader">{{ 'AI_COG.MAX_AUTO_AMOUNT' | translate }}</div>
            <div role="columnheader">{{ 'AI_COG.CLASSIFICATION' | translate }}</div>
            <div role="columnheader">{{ 'AI_COG.SAMPLE_OUTCOME' | translate }}</div>
            <div role="columnheader"></div>
          </div>
          @for (rule of store.rules(); track rule.workflow) {
            <app-ai-rule-form
              [rule]="rule"
              [sampleConfidence]="sampleConfidence()"
              [sampleAmount]="sampleAmount()"
              [saving]="store.savingKey() === rule.workflow"
              (save)="saveRule($event)"
            ></app-ai-rule-form>
          }
        </div>
      </nz-card>

      <h3>{{ 'AI_COG.USAGE' | translate }}</h3>
      <nz-card nzSize="small" data-testid="usage">
        @if (store.usage(); as usage) {
          <div class="stat-row">
            <nz-statistic
              [nzTitle]="'AI_COG.TOTAL_TOKENS' | translate"
              [nzValue]="(usage.usage.total_tokens | number: '1.0-0') ?? ''"
            ></nz-statistic>
            <nz-statistic
              [nzTitle]="'AI_COG.TOTAL_COST' | translate"
              [nzValue]="(usage.usage.total_cost_usd | number: '1.2-4') ?? ''"
              nzSuffix="USD"
            ></nz-statistic>
          </div>
          <ul>
            @for (row of usage.usage.by_provider; track row.provider) {
              <li>
                {{ row.provider }}: {{ row.calls }} {{ 'AI_COG.CALLS' | translate }},
                {{ row.total_tokens | number: '1.0-0' }} {{ 'AI_COG.TOKENS' | translate }},
                {{ row.failures }} {{ 'AI_COG.FAILURES' | translate }}
              </li>
            }
          </ul>
          @if (usage.chain; as chain) {
            <nz-tag data-testid="chain-result" [nzColor]="chain.valid ? 'green' : 'red'"
              >{{ (chain.valid ? 'AI_COG.CHAIN_VALID' : 'AI_COG.CHAIN_BROKEN') | translate }} ({{
                chain.checked
              }})</nz-tag
            >
          }
        }
        <button
          nz-button
          type="button"
          data-testid="verify-chain"
          [nzLoading]="verifying()"
          (click)="verifyChain()"
        >
          {{ 'AI_COG.VERIFY_CHAIN' | translate }}
        </button>
      </nz-card>
    </nz-spin>
  `,
})
export class AiSettingsPageComponent implements OnInit {
  protected readonly store = inject(AiSettingsStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly sampleConfidence = signal(0.96);
  protected readonly sampleAmount = signal<number | null>(800);
  protected readonly verifying = signal(false);

  ngOnInit(): void {
    this.store.load().subscribe({ error: () => undefined });
    this.store.loadUsage().subscribe({ error: () => undefined });
  }

  protected saveProvider(provider: AiProvider, form: ProviderForm): void {
    this.store.saveProvider(provider, form).subscribe({
      next: () => this.message.success(this.i18n.instant('AI_COG.SAVED')),
      error: () => undefined,
    });
  }

  protected saveRule(rule: AutomationRule): void {
    this.store.saveRule(rule).subscribe({
      next: () => this.message.success(this.i18n.instant('AI_COG.SAVED')),
      error: () => undefined,
    });
  }

  protected verifyChain(): void {
    this.verifying.set(true);
    this.store.loadUsage(true).subscribe({
      next: () => this.verifying.set(false),
      error: () => this.verifying.set(false),
    });
  }
}
