import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PermissionsService, SF_CASH_FLOW_METHODS, SfStandard, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  allowedIncomeMethods,
  buildDossierPayload,
  draftFromDossier,
  emptyDraft,
  formatAmount,
  isLocked,
  jurisdictionOf,
  routeDossierId,
  SfDossierDraft,
  SfOutcome,
  STATUTORY_FINANCIALS_MODULE,
  WizardProblem,
  wizardProblem,
} from './statutory-financials.util';
import { WizardStore } from './wizard.store';
import { WorkspaceStore } from './workspace.store';

/**
 * Creation and configuration of a dossier in four steps: fiscal years, accounting standard and methods, the dimensional
 * threshold check, and the options (share capital, profit allocation, hidden reserves of the Swiss standards). The dossier
 * is created at the end of step 2 so the check can run on it; the same form edits the settings of an editable dossier.
 */
@Component({
  selector: 'app-sf-dossier-wizard',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzStepsModule,
    NzSwitchModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [WizardStore],
  styleUrl: './statutory-financials.scss',
  template: `
    @if (!editing()) {
      <app-page-header
        [title]="'statutoryFinancials.wizard.createTitle' | translate"
      ></app-page-header>
    }

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (failure(); as outcome) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="
          outcome.errorKey ?? 'statutoryFinancials.error.generic' | translate: outcome.params
        "
        [nzDescription]="outcome.detail"
        (nzOnClose)="failure.set(null)"
      ></nz-alert>
    }
    @if (readOnly()) {
      <nz-alert
        class="feedback"
        nzType="info"
        nzShowIcon
        [nzMessage]="'statutoryFinancials.wizard.readOnly' | translate"
      ></nz-alert>
    }
    @if (problem(); as key) {
      <nz-alert
        class="feedback"
        nzType="warning"
        nzShowIcon
        role="alert"
        [nzMessage]="'statutoryFinancials.problem.' + key | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading() || store.saving() || store.checking()">
      <nz-card class="main-card">
        <nz-steps class="steps-bar" nzSize="small" [nzCurrent]="step()">
          @for (name of stepNames; track name) {
            <nz-step [nzTitle]="'statutoryFinancials.wizard.step.' + name | translate"></nz-step>
          }
        </nz-steps>

        @switch (step()) {
          @case (0) {
            <div class="form-grid">
              <label class="field field-wide" for="sf-title">
                <span>{{ 'statutoryFinancials.field.title' | translate }}</span>
                <input
                  nz-input
                  id="sf-title"
                  maxlength="150"
                  [disabled]="readOnly()"
                  [ngModel]="draft().title"
                  (ngModelChange)="patch({ title: $event })"
                />
                <small class="muted">{{ 'statutoryFinancials.hint.title' | translate }}</small>
              </label>
              <label class="field" for="sf-fiscal-year">
                <span>{{ 'statutoryFinancials.field.fiscalYear' | translate }} *</span>
                <nz-select
                  nzId="sf-fiscal-year"
                  [disabled]="readOnly()"
                  [ngModel]="draft().fiscal_year_id"
                  (ngModelChange)="patch({ fiscal_year_id: $event })"
                >
                  @for (year of store.fiscalYears(); track year.id) {
                    <nz-option [nzValue]="year.id" [nzLabel]="year.year_code"></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="sf-comparative-year">
                <span>{{ 'statutoryFinancials.field.comparativeYear' | translate }}</span>
                <nz-select
                  nzId="sf-comparative-year"
                  nzAllowClear
                  [disabled]="readOnly()"
                  [nzPlaceHolder]="'statutoryFinancials.hint.noComparative' | translate"
                  [ngModel]="draft().comparative_prior_year_id"
                  (ngModelChange)="patch({ comparative_prior_year_id: $event ?? null })"
                >
                  @for (year of store.fiscalYears(); track year.id) {
                    <nz-option
                      [nzValue]="year.id"
                      [nzLabel]="year.year_code"
                      [nzDisabled]="year.id === draft().fiscal_year_id"
                    ></nz-option>
                  }
                </nz-select>
              </label>
            </div>
          }
          @case (1) {
            <div
              class="standard-cards"
              role="radiogroup"
              [attr.aria-label]="'statutoryFinancials.field.standard' | translate"
            >
              @for (standard of store.standards(); track standard.value) {
                <button
                  type="button"
                  class="standard-card"
                  role="radio"
                  [attr.aria-checked]="draft().accounting_standard === standard.value"
                  [disabled]="readOnly()"
                  (click)="chooseStandard(standard.value)"
                >
                  <strong>{{ standard.label }}</strong>
                  <nz-tag [nzColor]="standard.jurisdiction === 'CH' ? 'red' : 'blue'">{{
                    standard.jurisdiction
                  }}</nz-tag>
                  <span class="muted">{{ standard.description }}</span>
                  <span class="legal">{{ standard.legal_reference }}</span>
                </button>
              }
            </div>

            <div class="form-grid">
              <div class="field">
                <span id="sf-rounding-label">{{
                  'statutoryFinancials.field.roundingMode' | translate
                }}</span>
                <nz-radio-group
                  aria-labelledby="sf-rounding-label"
                  [disabled]="readOnly()"
                  [ngModel]="draft().rounding_to_unit_mode"
                  (ngModelChange)="patch({ rounding_to_unit_mode: $event })"
                >
                  @for (mode of store.roundingModes(); track mode.value) {
                    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                    <label nz-radio [nzValue]="mode.value">
                      {{ 'statutoryFinancials.roundingMode.' + mode.value | translate }}
                    </label>
                  }
                </nz-radio-group>
              </div>
              <div class="field">
                <span id="sf-method-label">{{
                  'statutoryFinancials.field.incomeStatementMethod' | translate
                }}</span>
                <nz-radio-group
                  aria-labelledby="sf-method-label"
                  [disabled]="readOnly()"
                  [ngModel]="draft().income_statement_method"
                  (ngModelChange)="patch({ income_statement_method: $event })"
                >
                  @for (method of incomeMethods(); track method) {
                    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                    <label nz-radio [nzValue]="method">
                      {{ 'statutoryFinancials.incomeMethod.' + method | translate }}
                    </label>
                  }
                </nz-radio-group>
              </div>
              <div class="field">
                <span id="sf-cashflow-label">{{
                  'statutoryFinancials.field.cashFlowMethod' | translate
                }}</span>
                <nz-radio-group
                  aria-labelledby="sf-cashflow-label"
                  [disabled]="readOnly()"
                  [ngModel]="draft().cash_flow_method"
                  (ngModelChange)="patch({ cash_flow_method: $event })"
                >
                  @for (method of cashFlowMethods; track method) {
                    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                    <label nz-radio [nzValue]="method">
                      {{ 'statutoryFinancials.cashFlowMethod.' + method | translate }}
                    </label>
                  }
                </nz-radio-group>
              </div>
            </div>

            @if (draft().income_statement_method === 'cost_of_sales') {
              <h3 class="section-title">
                {{ 'statutoryFinancials.section.cogsAllocation' | translate }}
              </h3>
              <p class="muted">{{ 'statutoryFinancials.hint.cogsAllocation' | translate }}</p>
              <div class="form-grid">
                <label class="field" for="sf-cogs-personnel">
                  <span>{{ 'statutoryFinancials.field.cogsPersonnel' | translate }}</span>
                  <nz-input-number
                    nzId="sf-cogs-personnel"
                    [nzMin]="0"
                    [nzMax]="100"
                    [nzStep]="1"
                    [disabled]="readOnly()"
                    [ngModel]="draft().cogs_personnel"
                    (ngModelChange)="patch({ cogs_personnel: $event })"
                  ></nz-input-number>
                </label>
                <label class="field" for="sf-cogs-other">
                  <span>{{ 'statutoryFinancials.field.cogsOtherOpex' | translate }}</span>
                  <nz-input-number
                    nzId="sf-cogs-other"
                    [nzMin]="0"
                    [nzMax]="100"
                    [nzStep]="1"
                    [disabled]="readOnly()"
                    [ngModel]="draft().cogs_other_opex"
                    (ngModelChange)="patch({ cogs_other_opex: $event })"
                  ></nz-input-number>
                </label>
                <label class="field" for="sf-cogs-depr">
                  <span>{{ 'statutoryFinancials.field.cogsDepr' | translate }}</span>
                  <nz-input-number
                    nzId="sf-cogs-depr"
                    [nzMin]="0"
                    [nzMax]="100"
                    [nzStep]="1"
                    [disabled]="readOnly()"
                    [ngModel]="draft().cogs_depr"
                    (ngModelChange)="patch({ cogs_depr: $event })"
                  ></nz-input-number>
                </label>
              </div>
            }
          }
          @case (2) {
            @if (store.eligibility(); as check) {
              <nz-alert
                class="feedback"
                nzShowIcon
                [nzType]="check.chosen_allowed ? 'success' : 'warning'"
                [nzMessage]="check.message.title"
                [nzDescription]="check.message.body"
              ></nz-alert>

              <nz-descriptions nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 2, xl: 3 }">
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.eligibility.recommended' | translate"
                >
                  {{ 'statutoryFinancials.standard.' + check.recommended_standard | translate }}
                </nz-descriptions-item>
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.eligibility.totalAssets' | translate"
                >
                  {{ amount(check.metrics.total_assets) }}
                  <small class="muted"
                    >{{ 'statutoryFinancials.eligibility.limit' | translate }}
                    {{ amount(check.limits.assets_limit) }}</small
                  >
                </nz-descriptions-item>
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.eligibility.revenue' | translate"
                >
                  {{ amount(check.metrics.revenue) }}
                  <small class="muted"
                    >{{ 'statutoryFinancials.eligibility.limit' | translate }}
                    {{ amount(check.limits.revenue_limit) }}</small
                  >
                </nz-descriptions-item>
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.eligibility.employees' | translate"
                >
                  {{ check.metrics.average_employees }}
                  <small class="muted"
                    >{{ 'statutoryFinancials.eligibility.limit' | translate }}
                    {{ check.limits.employees_limit }}</small
                  >
                </nz-descriptions-item>
              </nz-descriptions>

              @if (check.exceeded.length > 0) {
                <h3 class="section-title">
                  {{ 'statutoryFinancials.eligibility.exceeded' | translate }}
                </h3>
                @for (criterion of check.exceeded; track criterion) {
                  <nz-tag nzColor="orange">{{
                    'statutoryFinancials.eligibility.criterion.' + criterion | translate
                  }}</nz-tag>
                }
              }
              @for (warning of check.warnings; track warning.code) {
                <nz-alert
                  class="feedback"
                  nzType="warning"
                  nzShowIcon
                  [nzMessage]="warning.message"
                ></nz-alert>
              }
              @if (check.required_statements.length > 0) {
                <h3 class="section-title">
                  {{ 'statutoryFinancials.eligibility.required' | translate }}
                </h3>
                @for (statement of check.required_statements; track statement) {
                  <nz-tag>{{ 'statutoryFinancials.statement.' + statement | translate }}</nz-tag>
                }
              }
              @if (
                !check.chosen_allowed || check.recommended_standard !== draft().accounting_standard
              ) {
                <div class="actions">
                  <button
                    nz-button
                    nzType="primary"
                    type="button"
                    [disabled]="readOnly() || store.saving()"
                    (click)="switchToRecommended()"
                  >
                    {{ 'statutoryFinancials.action.switchToRecommended' | translate }}
                  </button>
                </div>
              }
            } @else {
              <p>{{ 'statutoryFinancials.eligibility.pending' | translate }}</p>
            }
          }
          @case (3) {
            <div class="form-grid">
              <label class="field" for="sf-share-capital">
                <span>{{ 'statutoryFinancials.field.shareCapital' | translate }}</span>
                <nz-input-number
                  nzId="sf-share-capital"
                  [nzMin]="0"
                  [nzStep]="1000"
                  [nzPrecision]="2"
                  [disabled]="readOnly()"
                  [ngModel]="draft().share_capital"
                  (ngModelChange)="patch({ share_capital: $event })"
                ></nz-input-number>
              </label>
            </div>

            <h3 class="section-title">
              {{ 'statutoryFinancials.section.profitAllocation' | translate }}
            </h3>
            <p class="muted">{{ 'statutoryFinancials.hint.profitAllocation' | translate }}</p>
            <div class="form-grid">
              <label class="field" for="sf-dividends">
                <span>{{ 'statutoryFinancials.field.dividends' | translate }}</span>
                <nz-input-number
                  nzId="sf-dividends"
                  [nzMin]="0"
                  [nzPrecision]="2"
                  [disabled]="readOnly()"
                  [ngModel]="draft().dividends"
                  (ngModelChange)="patch({ dividends: $event })"
                ></nz-input-number>
              </label>
              <label class="field" for="sf-other-reserves">
                <span>{{ 'statutoryFinancials.field.otherReserves' | translate }}</span>
                <nz-input-number
                  nzId="sf-other-reserves"
                  [nzMin]="0"
                  [nzPrecision]="2"
                  [disabled]="readOnly()"
                  [ngModel]="draft().other_reserves"
                  (ngModelChange)="patch({ other_reserves: $event })"
                ></nz-input-number>
              </label>
              <label class="field" for="sf-carried-forward">
                <span>{{ 'statutoryFinancials.field.carriedForward' | translate }}</span>
                <nz-input-number
                  nzId="sf-carried-forward"
                  [nzPrecision]="2"
                  [disabled]="readOnly()"
                  [ngModel]="draft().carried_forward"
                  (ngModelChange)="patch({ carried_forward: $event })"
                ></nz-input-number>
              </label>
            </div>

            @if (swiss()) {
              <h3 class="section-title">
                {{ 'statutoryFinancials.section.hiddenReserves' | translate }}
              </h3>
              <p class="muted">{{ 'statutoryFinancials.hint.hiddenReserves' | translate }}</p>
              <div class="field">
                <span id="sf-hidden-enabled-label">{{
                  'statutoryFinancials.field.hiddenEnabled' | translate
                }}</span>
                <nz-switch
                  aria-labelledby="sf-hidden-enabled-label"
                  [disabled]="readOnly()"
                  [ngModel]="draft().hidden_enabled"
                  (ngModelChange)="patch({ hidden_enabled: $event })"
                ></nz-switch>
              </div>
              @if (draft().hidden_enabled) {
                <div class="form-grid">
                  <label class="field" for="sf-hidden-tax">
                    <span>{{ 'statutoryFinancials.field.taxRatePercent' | translate }}</span>
                    <nz-input-number
                      nzId="sf-hidden-tax"
                      [nzMin]="0"
                      [nzMax]="100"
                      [nzPrecision]="2"
                      [disabled]="readOnly()"
                      [ngModel]="draft().hidden_tax_rate_percent"
                      (ngModelChange)="patch({ hidden_tax_rate_percent: $event })"
                    ></nz-input-number>
                  </label>
                  <label class="field" for="sf-hidden-created">
                    <span>{{ 'statutoryFinancials.field.reservesCreated' | translate }}</span>
                    <nz-input-number
                      nzId="sf-hidden-created"
                      [nzMin]="0"
                      [nzPrecision]="2"
                      [disabled]="readOnly()"
                      [ngModel]="draft().hidden_reserves_created"
                      (ngModelChange)="patch({ hidden_reserves_created: $event })"
                    ></nz-input-number>
                  </label>
                  <label class="field" for="sf-hidden-released">
                    <span>{{ 'statutoryFinancials.field.reservesReleased' | translate }}</span>
                    <nz-input-number
                      nzId="sf-hidden-released"
                      [nzMin]="0"
                      [nzPrecision]="2"
                      [disabled]="readOnly()"
                      [ngModel]="draft().hidden_reserves_released"
                      (ngModelChange)="patch({ hidden_reserves_released: $event })"
                    ></nz-input-number>
                  </label>
                </div>
                <h4 class="section-title">
                  {{ 'statutoryFinancials.section.hiddenItems' | translate }}
                </h4>
                @for (item of draft().hidden_items; track $index; let i = $index) {
                  <div class="item-row">
                    <label class="field" [attr.for]="'sf-hidden-label-' + i">
                      <span>{{ 'statutoryFinancials.field.itemLabel' | translate }}</span>
                      <input
                        nz-input
                        [id]="'sf-hidden-label-' + i"
                        [disabled]="readOnly()"
                        [ngModel]="item.label"
                        (ngModelChange)="patchItem(i, { label: $event })"
                      />
                    </label>
                    <label class="field" [attr.for]="'sf-hidden-book-' + i">
                      <span>{{ 'statutoryFinancials.field.bookValue' | translate }}</span>
                      <nz-input-number
                        [nzId]="'sf-hidden-book-' + i"
                        [nzPrecision]="2"
                        [disabled]="readOnly()"
                        [ngModel]="item.book_value"
                        (ngModelChange)="patchItem(i, { book_value: $event })"
                      ></nz-input-number>
                    </label>
                    <label class="field" [attr.for]="'sf-hidden-fer-' + i">
                      <span>{{ 'statutoryFinancials.field.ferValue' | translate }}</span>
                      <nz-input-number
                        [nzId]="'sf-hidden-fer-' + i"
                        [nzPrecision]="2"
                        [disabled]="readOnly()"
                        [ngModel]="item.fer_value"
                        (ngModelChange)="patchItem(i, { fer_value: $event })"
                      ></nz-input-number>
                    </label>
                    <button
                      nz-button
                      nzDanger
                      type="button"
                      [disabled]="readOnly()"
                      [attr.aria-label]="'statutoryFinancials.action.removeRow' | translate"
                      (click)="removeItem(i)"
                    >
                      {{ 'statutoryFinancials.action.removeRow' | translate }}
                    </button>
                  </div>
                }
                <button nz-button type="button" [disabled]="readOnly()" (click)="addItem()">
                  {{ 'statutoryFinancials.action.addRow' | translate }}
                </button>
              }
            }
          }
        }

        <div class="actions">
          @if (step() > 0) {
            <button nz-button type="button" (click)="previous()">
              {{ 'statutoryFinancials.action.previous' | translate }}
            </button>
          }
          @if (step() < 3) {
            <button
              nz-button
              nzType="primary"
              type="button"
              [disabled]="store.saving()"
              (click)="next()"
            >
              {{ 'statutoryFinancials.action.next' | translate }}
            </button>
          } @else {
            <button
              nz-button
              nzType="primary"
              type="button"
              [disabled]="readOnly() || store.saving() || !canWrite()"
              (click)="finish()"
            >
              {{
                (editing()
                  ? 'statutoryFinancials.action.save'
                  : 'statutoryFinancials.action.createDossier'
                ) | translate
              }}
            </button>
          }
          @if (!editing()) {
            <a nz-button routerLink="/statutory-financials">{{
              'statutoryFinancials.action.cancel' | translate
            }}</a>
          }
        </div>
      </nz-card>
    </nz-spin>
  `,
})
export class DossierWizardComponent implements OnInit {
  protected readonly store = inject(WizardStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly workspace = inject(WorkspaceStore, { optional: true });

  protected readonly stepNames = ['years', 'standard', 'eligibility', 'options'] as const;
  protected readonly cashFlowMethods = SF_CASH_FLOW_METHODS;

  protected readonly step = signal(0);
  protected readonly draft = signal<SfDossierDraft>(emptyDraft());
  protected readonly problem = signal<WizardProblem>(null);
  protected readonly failure = signal<SfOutcome | null>(null);
  protected readonly editing = signal(false);

  protected readonly readOnly = computed(
    () => !this.canWrite() || isLocked(this.store.existing()?.status),
  );
  protected readonly swiss = computed(
    () => jurisdictionOf(this.draft().accounting_standard) === 'CH',
  );
  protected readonly standardLookup = computed(() =>
    this.store.standards().find((standard) => standard.value === this.draft().accounting_standard),
  );
  protected readonly incomeMethods = computed(() => allowedIncomeMethods(this.standardLookup()));

  async ngOnInit(): Promise<void> {
    const id = routeDossierId(this.route);
    this.editing.set(id !== null);
    await this.store.init(id, this.i18n.currentLanguage());
    const existing = this.store.existing();
    if (existing) {
      this.draft.set(draftFromDossier(existing));
    }
  }

  protected canWrite(): boolean {
    return this.permissions.canWrite(STATUTORY_FINANCIALS_MODULE);
  }

  protected patch(patch: Partial<SfDossierDraft>): void {
    this.problem.set(null);
    this.draft.update((draft) => ({ ...draft, ...patch }));
  }

  /** Picks a standard; the income statement method falls back to one the standard allows. */
  protected chooseStandard(standard: SfStandard): void {
    const lookup = this.store.standards().find((entry) => entry.value === standard);
    const allowed = allowedIncomeMethods(lookup);
    const method = allowed.includes(this.draft().income_statement_method)
      ? this.draft().income_statement_method
      : (allowed[0] ?? 'total_cost');
    this.patch({ accounting_standard: standard, income_statement_method: method });
  }

  protected addItem(): void {
    this.patch({
      hidden_items: [
        ...this.draft().hidden_items,
        { label: '', book_value: null, fer_value: null },
      ],
    });
  }

  protected patchItem(index: number, patch: Partial<SfDossierDraft['hidden_items'][number]>): void {
    this.patch({
      hidden_items: this.draft().hidden_items.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    });
  }

  protected removeItem(index: number): void {
    this.patch({
      hidden_items: this.draft().hidden_items.filter((_, position) => position !== index),
    });
  }

  protected amount(value: string | number | null | undefined): string {
    return formatAmount(value, jurisdictionOf(this.draft().accounting_standard), 2);
  }

  protected previous(): void {
    this.problem.set(null);
    this.step.update((step) => Math.max(0, step - 1));
  }

  /** Validates the step; the end of step 2 saves the dossier and runs the threshold check on it. */
  protected async next(): Promise<void> {
    const current = this.step();
    const problem = wizardProblem(current, this.draft());
    this.problem.set(problem);
    if (problem !== null) {
      return;
    }
    if (current === 1 && !this.readOnly()) {
      const saved = await this.store.save(buildDossierPayload(this.draft()));
      if (!saved.ok) {
        this.failure.set(saved);
        return;
      }
      this.failure.set(null);
    }
    if (current === 1) {
      const checked = await this.store.checkEligibility(
        this.draft().accounting_standard ?? undefined,
      );
      this.failure.set(checked.ok ? null : checked);
    }
    this.step.set(current + 1);
  }

  protected async switchToRecommended(): Promise<void> {
    const outcome = await this.store.switchToRecommended();
    this.failure.set(outcome.ok ? null : outcome);
    const recommended = this.store.dossier()?.accounting_standard;
    if (outcome.ok && recommended) {
      this.chooseStandard(recommended);
    }
  }

  protected async finish(): Promise<void> {
    const problem = wizardProblem(3, this.draft());
    this.problem.set(problem);
    if (problem !== null) {
      return;
    }
    const outcome = await this.store.save(buildDossierPayload(this.draft()));
    this.failure.set(outcome.ok ? null : outcome);
    if (!outcome.ok) {
      return;
    }
    this.message.success(this.i18n.instant('statutoryFinancials.message.saved'));
    if (this.editing()) {
      await this.workspace?.refresh();
      return;
    }
    const created = this.store.dossier();
    if (created) {
      void this.router.navigate(['/statutory-financials', created.id]);
    }
  }
}
