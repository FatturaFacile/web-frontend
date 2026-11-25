import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CpqEvalCharacteristic,
  CpqEvalStep,
  CpqViolation,
  I18nService,
  PermissionsService,
} from '@core';
import { downloadBlob, PageHeaderComponent, RadioControlDirective, TranslatePipe } from '@shared';
import {
  CPQ_MODULE,
  formatMoney,
  numberOrNull,
  severityAlert,
  trimNumber,
  violationKey,
  violationParams,
} from './cpq-format';
import { CpqConfigureStore } from './cpq-configure.store';
import { CpqProposalDrawerComponent } from './cpq-proposal-drawer.component';
import { CpqVisualPreviewComponent } from './cpq-visual-preview.component';

/** A value list with up to this many options is shown as radio buttons, a longer one as a select. */
const RADIO_LIMIT = 4;

/**
 * Guided technical-commercial configuration (Mod 230): step by step, with live validation, the options that a rule
 * blocks greyed out with the explanation, the items a rule adds automatically, the live cost, price, margin and lead
 * time, the layered preview, the resolved super-BOM and routing, the confirmation (new or reused part number) and the proposal.
 */
@Component({
  selector: 'app-cpq-configure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CpqConfigureStore],
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
    NzSelectModule,
    NzSliderModule,
    NzSpinModule,
    NzStatisticModule,
    NzStepsModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    RadioControlDirective,
    TranslatePipe,
    CpqProposalDrawerComponent,
    CpqVisualPreviewComponent,
  ],
  template: `
    <app-page-header
      [title]="'CPQ_CONFIGURATOR.CONFIGURE.TITLE' | translate"
      [subtitle]="'CPQ_CONFIGURATOR.CONFIGURE.SUBTITLE' | translate"
    >
      <div class="header-actions">
        <a nz-button routerLink="/cpq-configurator">{{ 'CPQ_CONFIGURATOR.BACK' | translate }}</a>
      </div>
    </app-page-header>

    @if (store.failure(); as failure) {
      <nz-alert
        class="gap"
        nzType="error"
        nzShowIcon
        [nzMessage]="
          failure.key
            ? (failure.key | translate)
            : (failure.detail ?? ('CPQ_CONFIGURATOR.ERR.GENERIC' | translate))
        "
      ></nz-alert>
    }

    @if (!store.modelId()) {
      <nz-card [nzTitle]="'CPQ_CONFIGURATOR.CONFIGURE.CHOOSE_MODEL' | translate">
        <nz-spin [nzSpinning]="store.loadingModels()">
          @if (store.models().length === 0 && !store.loadingModels()) {
            <nz-empty
              [nzNotFoundContent]="'CPQ_CONFIGURATOR.NO_PUBLISHED_MODELS' | translate"
            ></nz-empty>
          }
          <div class="models">
            @for (model of store.models(); track model.id) {
              <nz-card
                nzHoverable
                nzSize="small"
                [nzTitle]="model.display"
                (click)="choose(model.id)"
                (keydown.enter)="choose(model.id)"
                tabindex="0"
                role="button"
              >
                <nz-tag>{{ model.code }}</nz-tag>
                <p>{{ model.description?.[lang()] ?? model.description?.['en'] ?? '' }}</p>
              </nz-card>
            }
          </div>
        </nz-spin>
      </nz-card>
    } @else if (store.evaluation(); as evaluation) {
      <div class="layout">
        <div class="main">
          <nz-steps
            [nzCurrent]="store.activeStep()"
            (nzIndexChange)="store.setStep($event)"
            nzSize="small"
            nzType="navigation"
          >
            @for (step of store.steps(); track step.code) {
              <nz-step
                [nzTitle]="step.title ?? ('CPQ_CONFIGURATOR.STEP_DEFAULT' | translate)"
                [nzDescription]="step.description ?? ''"
                [nzStatus]="stepStatus(step)"
              ></nz-step>
            }
          </nz-steps>

          <nz-spin [nzSpinning]="store.evaluating()">
            <nz-card class="gap">
              @for (violation of store.errors(); track $index) {
                <nz-alert
                  class="gap"
                  nzType="error"
                  nzShowIcon
                  [nzMessage]="violationText(violation)"
                ></nz-alert>
              }
              @for (violation of store.notices(); track $index) {
                <nz-alert
                  class="gap"
                  [nzType]="alertType(violation)"
                  nzShowIcon
                  [nzMessage]="violationText(violation)"
                ></nz-alert>
              }
              @for (entry of evaluation.auto_included; track entry.characteristic) {
                <nz-alert
                  class="gap"
                  nzType="info"
                  nzShowIcon
                  [nzMessage]="entry.characteristic_label + ': ' + (entry.value_label ?? '')"
                  [nzDescription]="entry.message"
                ></nz-alert>
              }

              @for (characteristic of store.stepCharacteristics(); track characteristic.code) {
                <nz-form-item>
                  <nz-form-label
                    [nzFor]="'cpq-' + characteristic.code"
                    [nzRequired]="characteristic.required && characteristic.type !== 'boolean'"
                  >
                    {{ characteristic.label }}
                    @if (characteristic.unit) {
                      <span class="unit">({{ characteristic.unit }})</span>
                    }
                    @if (characteristic.forced) {
                      <nz-tag nzColor="gold">{{
                        'CPQ_CONFIGURATOR.AUTO_INCLUDED' | translate
                      }}</nz-tag>
                    }
                  </nz-form-label>
                  <nz-form-control [nzExtra]="characteristic.help ?? ''">
                    @switch (characteristic.type) {
                      @case ('list') {
                        @if (characteristic.options.length <= radioLimit) {
                          <nz-radio-group
                            [ngModel]="characteristic.value"
                            (ngModelChange)="store.setValue(characteristic.code, $event)"
                            [nzDisabled]="characteristic.forced"
                          >
                            @for (option of characteristic.options; track option.code) {
                              <label
                                [attr.for]="'cpq-' + characteristic.code + '-' + option.code"
                                appRadioControl
                                nz-radio
                                [nzValue]="option.code"
                                [nzDisabled]="
                                  option.disabled && option.code !== characteristic.value
                                "
                                >{{ option.label }}</label
                              >
                            }
                          </nz-radio-group>
                        } @else {
                          <nz-select
                            [nzId]="'cpq-' + characteristic.code"
                            nzShowSearch
                            [ngModel]="characteristic.value"
                            (ngModelChange)="store.setValue(characteristic.code, $event)"
                            [nzDisabled]="characteristic.forced"
                          >
                            @for (option of characteristic.options; track option.code) {
                              <nz-option
                                [nzValue]="option.code"
                                [nzLabel]="option.label"
                                [nzDisabled]="
                                  option.disabled && option.code !== characteristic.value
                                "
                              ></nz-option>
                            }
                          </nz-select>
                        }
                        @for (option of blocked(characteristic); track option.code) {
                          <div class="reason">
                            <nz-tag nzColor="red">{{ option.label }}</nz-tag>
                            {{ option.reasons[0] }}
                          </div>
                        }
                      }
                      @case ('range') {
                        <div class="range">
                          <nz-slider
                            [nzMin]="characteristic.min ?? 0"
                            [nzMax]="characteristic.max ?? 1000"
                            [nzStep]="characteristic.step_size ?? 1"
                            [ngModel]="numeric(characteristic)"
                            (ngModelChange)="store.setValue(characteristic.code, $event)"
                            [nzDisabled]="characteristic.forced"
                          ></nz-slider>
                          <nz-input-number
                            [nzId]="'cpq-' + characteristic.code"
                            [nzMin]="characteristic.min ?? 0"
                            [nzMax]="characteristic.max ?? 1000"
                            [nzStep]="characteristic.step_size ?? 1"
                            [ngModel]="numeric(characteristic)"
                            (ngModelChange)="onRange(characteristic, $event)"
                            [nzDisabled]="characteristic.forced"
                          ></nz-input-number>
                        </div>
                      }
                      @default {
                        <nz-switch
                          [nzId]="'cpq-' + characteristic.code"
                          [ngModel]="characteristic.value === true"
                          (ngModelChange)="store.setValue(characteristic.code, $event)"
                          [nzDisabled]="characteristic.forced"
                        ></nz-switch>
                      }
                    }
                    @if (characteristic.forced && characteristic.forced_message) {
                      <div class="reason">{{ characteristic.forced_message }}</div>
                    }
                  </nz-form-control>
                </nz-form-item>
              }

              <div class="nav">
                <button
                  nz-button
                  [disabled]="store.activeStep() === 0"
                  (click)="store.setStep(store.activeStep() - 1)"
                >
                  {{ 'CPQ_CONFIGURATOR.PREVIOUS' | translate }}
                </button>
                <button
                  nz-button
                  nzType="primary"
                  [disabled]="store.activeStep() >= store.steps().length - 1"
                  (click)="store.setStep(store.activeStep() + 1)"
                >
                  {{ 'CPQ_CONFIGURATOR.NEXT' | translate }}
                </button>
              </div>
            </nz-card>
          </nz-spin>

          <nz-tabs>
            <nz-tab [nzTitle]="'CPQ_CONFIGURATOR.TAB.BOM' | translate">
              <nz-table
                [nzData]="evaluation.bom"
                nzSize="small"
                [nzShowPagination]="false"
                [nzFrontPagination]="false"
              >
                <thead>
                  <tr>
                    <th>{{ 'CPQ_CONFIGURATOR.COLUMN.CODE' | translate }}</th>
                    <th>{{ 'CPQ_CONFIGURATOR.COLUMN.DESCRIPTION' | translate }}</th>
                    <th class="num">{{ 'CPQ_CONFIGURATOR.COLUMN.QUANTITY' | translate }}</th>
                    @if (costs()) {
                      <th class="num">{{ 'CPQ_CONFIGURATOR.COLUMN.UNIT_COST' | translate }}</th>
                      <th class="num">{{ 'CPQ_CONFIGURATOR.COLUMN.LINE_COST' | translate }}</th>
                    }
                    <th class="num">{{ 'CPQ_CONFIGURATOR.COLUMN.LEAD_TIME' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of evaluation.bom; track line.code) {
                    <tr>
                      <td>{{ line.item_code }}</td>
                      <td>
                        {{ line.name }}
                        @if (line.auto_include_message) {
                          <nz-tag nzColor="gold">{{
                            'CPQ_CONFIGURATOR.AUTO_INCLUDED' | translate
                          }}</nz-tag>
                          <div class="reason">{{ line.auto_include_message }}</div>
                        }
                      </td>
                      <td class="num">{{ trim(line.quantity) }} {{ line.uom }}</td>
                      @if (costs()) {
                        <td class="num">{{ money(line.unit_cost) }}</td>
                        <td class="num">{{ money(line.line_cost) }}</td>
                      }
                      <td class="num">{{ line.lead_time_days }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </nz-tab>
            <nz-tab [nzTitle]="'CPQ_CONFIGURATOR.TAB.ROUTING' | translate">
              <nz-table
                [nzData]="evaluation.routing"
                nzSize="small"
                [nzShowPagination]="false"
                [nzFrontPagination]="false"
              >
                <thead>
                  <tr>
                    <th>{{ 'CPQ_CONFIGURATOR.COLUMN.OPERATION' | translate }}</th>
                    <th>{{ 'CPQ_CONFIGURATOR.COLUMN.WORK_CENTER' | translate }}</th>
                    <th class="num">{{ 'CPQ_CONFIGURATOR.COLUMN.SETUP_HOURS' | translate }}</th>
                    <th class="num">{{ 'CPQ_CONFIGURATOR.COLUMN.RUN_HOURS' | translate }}</th>
                    @if (costs()) {
                      <th class="num">{{ 'CPQ_CONFIGURATOR.COLUMN.LINE_COST' | translate }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (step of evaluation.routing; track step.code) {
                    <tr>
                      <td>{{ step.operation }}</td>
                      <td>{{ step.work_center }}</td>
                      <td class="num">{{ trim(step.setup_hours) }}</td>
                      <td class="num">{{ trim(step.run_hours) }}</td>
                      @if (costs()) {
                        <td class="num">{{ money(step.cost) }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </nz-table>
            </nz-tab>
            <nz-tab [nzTitle]="'CPQ_CONFIGURATOR.TAB.PRICING' | translate">
              <nz-table
                [nzData]="evaluation.pricing.components"
                nzSize="small"
                [nzShowPagination]="false"
                [nzFrontPagination]="false"
              >
                <thead>
                  <tr>
                    <th>{{ 'CPQ_CONFIGURATOR.COLUMN.COMPONENT' | translate }}</th>
                    <th>{{ 'CPQ_CONFIGURATOR.COLUMN.EFFECT' | translate }}</th>
                    <th class="num">{{ 'CPQ_CONFIGURATOR.COLUMN.VALUE' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (component of evaluation.pricing.components; track component.code) {
                    <tr>
                      <td>{{ component.label }}</td>
                      <td>
                        <nz-tag>{{
                          'CPQ_CONFIGURATOR.EFFECT.' + component.effect.toUpperCase() | translate
                        }}</nz-tag>
                      </td>
                      <td class="num">{{ trim(component.value) }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </nz-tab>
          </nz-tabs>
        </div>

        <aside class="side">
          <nz-card class="summary" [nzTitle]="'CPQ_CONFIGURATOR.SUMMARY.TITLE' | translate">
            <div class="stats">
              <nz-statistic
                [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.SELLING_PRICE' | translate"
                [nzValue]="money(evaluation.totals.selling_price)"
              ></nz-statistic>
              <nz-statistic
                [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.LIST_PRICE' | translate"
                [nzValue]="money(evaluation.totals.list_price)"
              ></nz-statistic>
              @if (costs()) {
                <nz-statistic
                  [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.INDUSTRIAL_COST' | translate"
                  [nzValue]="money(evaluation.totals.industrial_cost)"
                ></nz-statistic>
                <nz-statistic
                  [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.MARGIN' | translate"
                  [nzValue]="
                    money(evaluation.totals.margin_amount) +
                    ' (' +
                    trim(evaluation.totals.margin_percent) +
                    ' %)'
                  "
                ></nz-statistic>
              }
              <nz-statistic
                [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.LEAD_TIME' | translate"
                [nzValue]="
                  evaluation.totals.lead_time_days + ' ' + ('CPQ_CONFIGURATOR.DAYS' | translate)
                "
              ></nz-statistic>
              <nz-statistic
                [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.TOTAL_PRICE' | translate"
                [nzValue]="money(evaluation.totals.total_selling_price)"
              ></nz-statistic>
            </div>

            <div class="terms">
              <nz-form-item>
                <nz-form-label nzFor="cpq-quantity">{{
                  'CPQ_CONFIGURATOR.TOTAL.QUANTITY' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <nz-input-number
                    nzId="cpq-quantity"
                    [ngModel]="store.quantity()"
                    (ngModelChange)="store.setQuantity($event)"
                    [nzMin]="1"
                  ></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="cpq-discount">{{
                  'CPQ_CONFIGURATOR.TOTAL.DISCOUNT' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <nz-input-number
                    nzId="cpq-discount"
                    [ngModel]="store.discountPercent()"
                    (ngModelChange)="store.setDiscount($event)"
                    [nzMin]="0"
                    [nzMax]="100"
                    [nzPrecision]="2"
                  ></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="cpq-customer">{{
                  'CPQ_CONFIGURATOR.CUSTOMER_REFERENCE' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    id="cpq-customer"
                    maxlength="190"
                    [ngModel]="store.customerReference()"
                    (ngModelChange)="store.setCustomerReference($event)"
                  />
                </nz-form-control>
              </nz-form-item>
            </div>

            <div class="partnumber">
              <span class="caption">{{ 'CPQ_CONFIGURATOR.PART_NUMBER' | translate }}</span>
              @if (store.instance(); as instance) {
                <code class="pn">{{ instance.part_number }}</code>
                <nz-alert
                  nzType="success"
                  nzShowIcon
                  [nzMessage]="
                    (store.reused()
                      ? 'CPQ_CONFIGURATOR.CONFIRM.REUSED'
                      : 'CPQ_CONFIGURATOR.CONFIRM.CREATED'
                    ) | translate: { partNumber: instance.part_number }
                  "
                ></nz-alert>
              } @else {
                <code class="pn">{{
                  evaluation.deduplication.part_number ?? evaluation.part_number_preview
                }}</code>
                @if (evaluation.deduplication.existing) {
                  <nz-alert
                    nzType="info"
                    nzShowIcon
                    [nzMessage]="
                      'CPQ_CONFIGURATOR.CONFIRM.WILL_REUSE'
                        | translate: { partNumber: evaluation.deduplication.part_number ?? '' }
                    "
                  ></nz-alert>
                }
              }
            </div>

            <div class="actions">
              @if (canWrite()) {
                <button
                  nz-button
                  nzType="primary"
                  nzBlock
                  [nzLoading]="store.confirming()"
                  [disabled]="!store.canConfirm()"
                  (click)="confirm()"
                >
                  {{ 'CPQ_CONFIGURATOR.CONFIRM.ACTION' | translate }}
                </button>
              }
              <button
                nz-button
                nzBlock
                [nzLoading]="store.loadingProposal()"
                [disabled]="!evaluation.complete || !evaluation.valid"
                (click)="openProposal()"
              >
                {{ 'CPQ_CONFIGURATOR.PROPOSAL.GENERATE' | translate }}
              </button>
            </div>
            @if (!evaluation.complete && evaluation.missing.length > 0) {
              <p class="reason">
                {{ 'CPQ_CONFIGURATOR.MISSING' | translate: { count: evaluation.missing.length } }}
              </p>
            }
          </nz-card>

          <app-cpq-visual-preview [visual]="evaluation.visual"></app-cpq-visual-preview>
        </aside>
      </div>
    } @else {
      <nz-spin nzSimple></nz-spin>
    }

    <app-cpq-proposal-drawer
      [proposal]="store.proposal()"
      [canDownload]="!!store.instance()"
      (closed)="store.closeProposal()"
      (download)="downloadPdf()"
    ></app-cpq-proposal-drawer>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
      gap: 16px;
      align-items: start;
    }
    .side {
      display: grid;
      gap: 16px;
      position: sticky;
      top: 16px;
    }
    .models {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .gap {
      margin-bottom: 12px;
      display: block;
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
    }
    .terms {
      margin-top: 12px;
    }
    .range {
      display: grid;
      grid-template-columns: 1fr 140px;
      gap: 16px;
      align-items: center;
    }
    .reason {
      color: #8c8c8c;
      font-size: 12px;
      margin-top: 4px;
    }
    .unit {
      color: #8c8c8c;
      margin-left: 4px;
    }
    .nav {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
    }
    .partnumber {
      display: grid;
      gap: 6px;
      margin: 12px 0;
    }
    .caption {
      color: #8c8c8c;
      font-size: 12px;
    }
    .pn {
      font-size: 14px;
      word-break: break-all;
    }
    .actions {
      display: grid;
      gap: 8px;
    }
    .num {
      text-align: right;
    }
    @media (max-width: 1100px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .side {
        position: static;
      }
    }
  `,
})
export class CpqConfigureComponent implements OnInit {
  protected readonly store = inject(CpqConfigureStore);
  private readonly route = inject(ActivatedRoute);
  private readonly permissions = inject(PermissionsService);
  private readonly i18n = inject(I18nService);

  protected readonly radioLimit = RADIO_LIMIT;
  readonly canWrite = computed(() => this.permissions.canWrite(CPQ_MODULE));
  /** The API leaves the industrial figures out for who may not see them; the screen follows. */
  readonly costs = computed(() => this.store.evaluation()?.totals.industrial_cost !== undefined);

  ngOnInit(): void {
    void this.start();
  }

  async start(): Promise<void> {
    await this.store.loadModels();
    const modelId = this.route.snapshot.paramMap.get('modelId');
    if (modelId) {
      await this.store.selectModel(modelId);
    }
  }

  choose(modelId: string): void {
    void this.store.selectModel(modelId);
  }

  lang(): 'it' | 'en' | 'de' | 'fr' {
    const language = (document.documentElement.lang || 'en').slice(0, 2);

    return (['it', 'en', 'de', 'fr'].includes(language) ? language : 'en') as
      'it' | 'en' | 'de' | 'fr';
  }

  stepStatus(step: CpqEvalStep): 'wait' | 'process' | 'finish' | 'error' {
    const index = this.store.steps().findIndex((candidate) => candidate.code === step.code);
    if (step.status === 'error') {
      return 'error';
    }
    if (index === this.store.activeStep()) {
      return 'process';
    }

    return step.status === 'complete' ? 'finish' : 'wait';
  }

  violationText(violation: CpqViolation): string {
    return (
      violation.message ?? this.translateKey(violationKey(violation), violationParams(violation))
    );
  }

  alertType(violation: CpqViolation): 'error' | 'warning' | 'info' {
    return severityAlert(violation.severity);
  }

  /** The options a rule blocks, with the reason, for the explanation under the choices. */
  blocked(characteristic: CpqEvalCharacteristic): CpqEvalCharacteristic['options'] {
    return characteristic.options.filter((option) => option.disabled && option.reasons.length > 0);
  }

  numeric(characteristic: CpqEvalCharacteristic): number {
    return typeof characteristic.value === 'number'
      ? characteristic.value
      : (characteristic.min ?? 0);
  }

  onRange(characteristic: CpqEvalCharacteristic, value: number | string | null): void {
    const parsed = numberOrNull(value);
    if (parsed === null) {
      this.store.clearValue(characteristic.code);
    } else {
      this.store.setValue(characteristic.code, parsed);
    }
  }

  money(value: number | undefined): string {
    return formatMoney(value, this.store.evaluation()?.totals.currency ?? 'EUR');
  }

  trim(value: number | undefined): string {
    return trimNumber(value);
  }

  async confirm(): Promise<void> {
    await this.store.confirm();
  }

  async openProposal(): Promise<void> {
    await this.store.loadProposal(this.costs());
  }

  async downloadPdf(): Promise<void> {
    const blob = await this.store.downloadProposalPdf();
    const instance = this.store.instance();
    if (blob && instance) {
      downloadBlob(blob, `proposal-${instance.part_number}.pdf`);
    }
  }

  private translateKey(key: string, params: Record<string, string | number>): string {
    return this.i18n.instant(key, params);
  }
}
