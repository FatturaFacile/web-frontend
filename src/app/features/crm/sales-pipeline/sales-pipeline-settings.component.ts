import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import {
  I18nService,
  SALES_FORECAST_CATEGORIES,
  SalesPipelineApiService,
  type SalesForecastCategory,
  type SalesLossReason,
  type SalesPipeline,
  type SalesPipelineStage,
} from '@core';
import { TranslatePipe } from '@shared';

/** Locales the catalog labels are kept in; the API serves the one that matches the user language. */
export const CATALOG_LOCALES = ['it-CH', 'de-CH', 'fr-CH', 'en', 'it-IT'] as const;

type Editor = 'pipeline' | 'stage' | 'reason';

/** Removes empty labels so only the languages that were filled in are stored. */
export function cleanTranslations(values: Record<string, string>): Record<string, string> | null {
  const entries = Object.entries(values).filter(([, label]) => label.trim() !== '');
  return entries.length === 0
    ? null
    : Object.fromEntries(entries.map(([locale, label]) => [locale, label.trim()]));
}

/**
 * Configuration of the sales pipelines (per business line / market), their stages with win probability, forecast
 * category and terminal flags, and the loss-reason catalog. Used pipelines and stages cannot be deleted (the API
 * answers 422): they are deactivated instead.
 */
@Component({
  selector: 'app-sales-pipeline-settings',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @if (error()) {
      <nz-alert
        nzType="error"
        nzShowIcon
        data-testid="settings-error"
        [nzMessage]="'SALESPIPE.LOAD_ERROR' | translate"
      />
    }

    <nz-spin [nzSpinning]="loading()">
      <nz-card [nzTitle]="'SALESPIPE.PIPELINES' | translate" [nzExtra]="pipelineActions">
        <ng-template #pipelineActions>
          <button
            nz-button
            type="button"
            data-testid="install-catalog"
            [nzLoading]="installing()"
            (click)="installCatalog()"
          >
            {{ 'SALESPIPE.INSTALL_CATALOG' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="pipeline-new"
            (click)="openPipeline(null)"
          >
            {{ 'SALESPIPE.PIPELINE_NEW' | translate }}
          </button>
        </ng-template>
        <nz-table
          #pipelineTable
          [nzData]="pipelines()"
          [nzShowPagination]="false"
          nzSize="small"
          [nzScroll]="{ x: '700px' }"
          data-testid="pipeline-table"
        >
          <thead>
            <tr>
              <th>{{ 'SALESPIPE.NAME' | translate }}</th>
              <th>{{ 'SALESPIPE.BUSINESS_LINE' | translate }}</th>
              <th>{{ 'SALESPIPE.MARKET' | translate }}</th>
              <th>{{ 'SALESPIPE.DEALS' | translate }}</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (pipeline of pipelineTable.data; track pipeline.id) {
              <tr [class.selected]="pipeline.id === selectedId()">
                <td>
                  <button
                    nz-button
                    nzType="link"
                    nzSize="small"
                    type="button"
                    data-testid="pipeline-select"
                    (click)="select(pipeline.id)"
                  >
                    {{ pipeline.name }}
                  </button>
                  @if (pipeline.is_default) {
                    <nz-tag nzColor="blue">{{ 'SALESPIPE.IS_DEFAULT' | translate }}</nz-tag>
                  }
                  @if (!pipeline.is_active) {
                    <nz-tag>{{ 'SALESPIPE.IS_ACTIVE' | translate }} ✕</nz-tag>
                  }
                </td>
                <td>{{ pipeline.business_line }}</td>
                <td>{{ pipeline.market }}</td>
                <td>{{ pipeline.opportunities_count }}</td>
                <td>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    data-testid="pipeline-edit"
                    (click)="openPipeline(pipeline)"
                  >
                    {{ 'SALESPIPE.PIPELINE_EDIT' | translate }}
                  </button>
                </td>
                <td>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    data-testid="pipeline-delete"
                    [disabled]="pipeline.is_default || pipeline.opportunities_count > 0"
                    [attr.title]="
                      pipeline.opportunities_count > 0 ? ('SALESPIPE.IN_USE' | translate) : null
                    "
                    nz-popconfirm
                    [nzPopconfirmTitle]="'SALESPIPE.DELETE_CONFIRM' | translate"
                    (nzOnConfirm)="deletePipeline(pipeline)"
                  >
                    {{ 'SALESPIPE.DELETE' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      @if (selectedPipeline(); as pipeline) {
        <nz-card
          [nzTitle]="('SALESPIPE.STAGES' | translate) + ' · ' + pipeline.name"
          [nzExtra]="stageActions"
        >
          <ng-template #stageActions>
            <button
              nz-button
              nzType="primary"
              type="button"
              data-testid="stage-new"
              (click)="openStage(null)"
            >
              {{ 'SALESPIPE.STAGE_NEW' | translate }}
            </button>
          </ng-template>
          <nz-table
            #stageTable
            [nzData]="stages()"
            [nzShowPagination]="false"
            nzSize="small"
            [nzScroll]="{ x: '700px' }"
            data-testid="stage-table"
          >
            <thead>
              <tr>
                <th>{{ 'SALESPIPE.STAGE_ORDER' | translate }}</th>
                <th>{{ 'SALESPIPE.NAME' | translate }}</th>
                <th>{{ 'SALESPIPE.PROBABILITY' | translate }}</th>
                <th>{{ 'SALESPIPE.CATEGORY' | translate }}</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (stage of stageTable.data; track stage.id) {
                <tr>
                  <td>{{ stage.sequence }}</td>
                  <td>
                    {{ stage.name }}
                    @if (stage.is_won) {
                      <nz-tag nzColor="green">{{ 'SALESPIPE.STAGE_WON' | translate }}</nz-tag>
                    }
                    @if (stage.is_lost) {
                      <nz-tag nzColor="red">{{ 'SALESPIPE.STAGE_LOST' | translate }}</nz-tag>
                    }
                    @if (!stage.is_active) {
                      <nz-tag>{{ 'SALESPIPE.IS_ACTIVE' | translate }} ✕</nz-tag>
                    }
                  </td>
                  <td>{{ stage.default_probability }}%</td>
                  <td>{{ categoryLabel(stage.forecast_category) }}</td>
                  <td>
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      data-testid="stage-edit"
                      (click)="openStage(stage)"
                    >
                      {{ 'SALESPIPE.STAGE_EDIT' | translate }}
                    </button>
                  </td>
                  <td>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      data-testid="stage-delete"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'SALESPIPE.DELETE_CONFIRM' | translate"
                      (nzOnConfirm)="deleteStage(stage)"
                    >
                      {{ 'SALESPIPE.DELETE' | translate }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      }

      <nz-card [nzTitle]="'SALESPIPE.LOSS_REASONS' | translate" [nzExtra]="reasonActions">
        <ng-template #reasonActions>
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="reason-new"
            (click)="openReason(null)"
          >
            {{ 'SALESPIPE.LOSS_REASON_NEW' | translate }}
          </button>
        </ng-template>
        <nz-table
          #reasonTable
          [nzData]="lossReasons()"
          [nzShowPagination]="false"
          nzSize="small"
          data-testid="reason-table"
        >
          <thead>
            <tr>
              <th>{{ 'SALESPIPE.NAME' | translate }}</th>
              <th>{{ 'SALESPIPE.REQUIRES_COMPETITOR' | translate }}</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (reason of reasonTable.data; track reason.id) {
              <tr>
                <td>
                  {{ reason.name }}
                  @if (!reason.is_active) {
                    <nz-tag>{{ 'SALESPIPE.IS_ACTIVE' | translate }} ✕</nz-tag>
                  }
                </td>
                <td>{{ reason.requires_competitor ? '✓' : '' }}</td>
                <td>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    data-testid="reason-edit"
                    (click)="openReason(reason)"
                  >
                    {{ 'SALESPIPE.LOSS_REASON_EDIT' | translate }}
                  </button>
                </td>
                <td>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    data-testid="reason-delete"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'SALESPIPE.DELETE_CONFIRM' | translate"
                    (nzOnConfirm)="deleteReason(reason)"
                  >
                    {{ 'SALESPIPE.DELETE' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    </nz-spin>

    <nz-modal
      [nzVisible]="editor() !== null"
      [nzTitle]="editorTitle() | translate"
      [nzFooter]="editorFooter"
      (nzOnCancel)="editor.set(null)"
    >
      <ng-container *nzModalContent>
        @switch (editor()) {
          @case ('pipeline') {
            <form
              nz-form
              nzLayout="vertical"
              [formGroup]="pipelineForm"
              data-testid="pipeline-form"
            >
              @if (!editingPipeline()) {
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'SALESPIPE.CODE' | translate }}</nz-form-label>
                  <nz-form-control [nzErrorTip]="'SALESPIPE.REQUIRED' | translate"
                    ><input
                      nz-input
                      formControlName="code"
                      maxlength="40"
                      data-testid="pipeline-code"
                  /></nz-form-control>
                </nz-form-item>
              }
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'SALESPIPE.NAME' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'SALESPIPE.REQUIRED' | translate"
                  ><input
                    nz-input
                    formControlName="name"
                    maxlength="150"
                    data-testid="pipeline-name"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SALESPIPE.BUSINESS_LINE' | translate }}</nz-form-label>
                <nz-form-control
                  ><input nz-input formControlName="business_line" maxlength="100"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SALESPIPE.MARKET' | translate }}</nz-form-label>
                <nz-form-control
                  ><input nz-input formControlName="market" maxlength="50"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SALESPIPE.IS_DEFAULT' | translate }}</nz-form-label>
                <nz-form-control><nz-switch formControlName="is_default" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SALESPIPE.IS_ACTIVE' | translate }}</nz-form-label>
                <nz-form-control><nz-switch formControlName="is_active" /></nz-form-control>
              </nz-form-item>
              @if (!editingPipeline()) {
                <nz-form-item>
                  <nz-form-label>{{
                    'SALESPIPE.INSTALL_STANDARD_STAGES' | translate
                  }}</nz-form-label>
                  <nz-form-control
                    ><nz-switch formControlName="install_standard_stages"
                  /></nz-form-control>
                </nz-form-item>
              }
              <ng-container formGroupName="translations">
                <p class="labels-title">{{ 'SALESPIPE.LABELS' | translate }}</p>
                @for (locale of locales; track locale) {
                  <nz-form-item
                    ><nz-form-label>{{ locale }}</nz-form-label
                    ><nz-form-control
                      ><input
                        nz-input
                        [formControlName]="locale"
                        maxlength="150" /></nz-form-control
                  ></nz-form-item>
                }
              </ng-container>
            </form>
          }
          @case ('stage') {
            <form nz-form nzLayout="vertical" [formGroup]="stageForm" data-testid="stage-form">
              @if (!editingStage()) {
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'SALESPIPE.CODE' | translate }}</nz-form-label>
                  <nz-form-control [nzErrorTip]="'SALESPIPE.REQUIRED' | translate"
                    ><input nz-input formControlName="code" maxlength="50" data-testid="stage-code"
                  /></nz-form-control>
                </nz-form-item>
              }
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'SALESPIPE.NAME' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'SALESPIPE.REQUIRED' | translate"
                  ><input nz-input formControlName="name" maxlength="100" data-testid="stage-name"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired>{{
                  'SALESPIPE.STAGE_PROBABILITY' | translate
                }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'SALESPIPE.REQUIRED' | translate"
                  ><nz-input-number
                    formControlName="default_probability"
                    [nzMin]="0"
                    [nzMax]="100"
                    class="full"
                    data-testid="stage-probability"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SALESPIPE.STAGE_CATEGORY' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="forecast_category" class="full">
                    @for (category of categories; track category) {
                      <nz-option [nzValue]="category" [nzLabel]="categoryLabel(category)" />
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SALESPIPE.STAGE_ORDER' | translate }}</nz-form-label>
                <nz-form-control
                  ><nz-input-number formControlName="sequence" [nzMin]="0" class="full"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SALESPIPE.STAGE_WON' | translate }}</nz-form-label>
                <nz-form-control
                  ><nz-switch formControlName="is_won" data-testid="stage-won"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SALESPIPE.STAGE_LOST' | translate }}</nz-form-label>
                <nz-form-control
                  ><nz-switch formControlName="is_lost" data-testid="stage-lost"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SALESPIPE.IS_ACTIVE' | translate }}</nz-form-label>
                <nz-form-control><nz-switch formControlName="is_active" /></nz-form-control>
              </nz-form-item>
              @if (editingStage()) {
                <nz-form-item>
                  <nz-form-label>{{ 'SALESPIPE.STAGE_REPRICE' | translate }}</nz-form-label>
                  <nz-form-control
                    ><nz-switch
                      formControlName="reprice_open_opportunities"
                      data-testid="stage-reprice"
                  /></nz-form-control>
                </nz-form-item>
              }
              <ng-container formGroupName="translations">
                <p class="labels-title">{{ 'SALESPIPE.LABELS' | translate }}</p>
                @for (locale of locales; track locale) {
                  <nz-form-item
                    ><nz-form-label>{{ locale }}</nz-form-label
                    ><nz-form-control
                      ><input
                        nz-input
                        [formControlName]="locale"
                        maxlength="100" /></nz-form-control
                  ></nz-form-item>
                }
              </ng-container>
            </form>
          }
          @case ('reason') {
            <form nz-form nzLayout="vertical" [formGroup]="reasonForm" data-testid="reason-form">
              @if (!editingReason()) {
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'SALESPIPE.CODE' | translate }}</nz-form-label>
                  <nz-form-control [nzErrorTip]="'SALESPIPE.REQUIRED' | translate"
                    ><input
                      nz-input
                      formControlName="code"
                      maxlength="50"
                      data-testid="reason-code"
                  /></nz-form-control>
                </nz-form-item>
              }
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'SALESPIPE.NAME' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'SALESPIPE.REQUIRED' | translate"
                  ><input nz-input formControlName="name" maxlength="150" data-testid="reason-name"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SALESPIPE.REQUIRES_COMPETITOR' | translate }}</nz-form-label>
                <nz-form-control
                  ><nz-switch formControlName="requires_competitor"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SALESPIPE.IS_ACTIVE' | translate }}</nz-form-label>
                <nz-form-control><nz-switch formControlName="is_active" /></nz-form-control>
              </nz-form-item>
              <ng-container formGroupName="translations">
                <p class="labels-title">{{ 'SALESPIPE.LABELS' | translate }}</p>
                @for (locale of locales; track locale) {
                  <nz-form-item
                    ><nz-form-label>{{ locale }}</nz-form-label
                    ><nz-form-control
                      ><input
                        nz-input
                        [formControlName]="locale"
                        maxlength="150" /></nz-form-control
                  ></nz-form-item>
                }
              </ng-container>
            </form>
          }
        }
      </ng-container>
    </nz-modal>
    <ng-template #editorFooter>
      <button nz-button type="button" (click)="editor.set(null)">
        {{ 'SALESPIPE.CANCEL' | translate }}
      </button>
      <button
        nz-button
        nzType="primary"
        type="button"
        data-testid="editor-save"
        [nzLoading]="saving()"
        (click)="saveEditor()"
      >
        {{ 'SALESPIPE.SAVE' | translate }}
      </button>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }
    nz-card {
      margin-bottom: 12px;
    }
    nz-card button + button {
      margin-left: 8px;
    }
    .full {
      width: 100%;
    }
    .labels-title {
      font-weight: 600;
      margin: 8px 0;
    }
    tr.selected td {
      background: var(--ant-color-primary-bg, #e6f4ff);
    }
  `,
})
export class SalesPipelineSettingsComponent implements OnInit {
  private readonly api = inject(SalesPipelineApiService);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly locales = CATALOG_LOCALES;
  protected readonly categories: readonly SalesForecastCategory[] = SALES_FORECAST_CATEGORIES;

  readonly pipelines = signal<SalesPipeline[]>([]);
  readonly lossReasons = signal<SalesLossReason[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly installing = signal(false);
  readonly editor = signal<Editor | null>(null);
  readonly editingPipeline = signal<SalesPipeline | null>(null);
  readonly editingStage = signal<SalesPipelineStage | null>(null);
  readonly editingReason = signal<SalesLossReason | null>(null);

  readonly selectedPipeline = computed(
    () => this.pipelines().find((pipeline) => pipeline.id === this.selectedId()) ?? null,
  );
  readonly stages = computed(() =>
    [...(this.selectedPipeline()?.stages ?? [])].sort((a, b) => a.sequence - b.sequence),
  );
  readonly editorTitle = computed(() => {
    switch (this.editor()) {
      case 'pipeline':
        return this.editingPipeline() ? 'SALESPIPE.PIPELINE_EDIT' : 'SALESPIPE.PIPELINE_NEW';
      case 'stage':
        return this.editingStage() ? 'SALESPIPE.STAGE_EDIT' : 'SALESPIPE.STAGE_NEW';
      default:
        return this.editingReason() ? 'SALESPIPE.LOSS_REASON_EDIT' : 'SALESPIPE.LOSS_REASON_NEW';
    }
  });

  private labels() {
    return this.fb.group({
      'it-CH': this.fb.control(''),
      'de-CH': this.fb.control(''),
      'fr-CH': this.fb.control(''),
      en: this.fb.control(''),
      'it-IT': this.fb.control(''),
    });
  }

  readonly pipelineForm = this.fb.group({
    code: this.fb.control('', [
      Validators.required,
      Validators.pattern(/^[a-z0-9_]+$/),
      Validators.maxLength(40),
    ]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    business_line: this.fb.control(''),
    market: this.fb.control(''),
    is_default: this.fb.control(false),
    is_active: this.fb.control(true),
    install_standard_stages: this.fb.control(true),
    translations: this.labels(),
  });

  readonly stageForm = this.fb.group({
    code: this.fb.control('', [
      Validators.required,
      Validators.pattern(/^[a-z0-9_]+$/),
      Validators.maxLength(50),
    ]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
    default_probability: this.fb.control(10, [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ]),
    forecast_category: this.fb.control<SalesForecastCategory>('pipeline'),
    sequence: this.fb.control(10),
    is_won: this.fb.control(false),
    is_lost: this.fb.control(false),
    is_active: this.fb.control(true),
    reprice_open_opportunities: this.fb.control(false),
    translations: this.labels(),
  });

  readonly reasonForm = this.fb.group({
    code: this.fb.control('', [
      Validators.required,
      Validators.pattern(/^[a-z0-9_]+$/),
      Validators.maxLength(50),
    ]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    requires_competitor: this.fb.control(false),
    is_active: this.fb.control(true),
    translations: this.labels(),
  });

  ngOnInit(): void {
    void this.reload();
  }

  categoryLabel(category: string): string {
    return this.i18n.translate(`SALESPIPE.CAT_${category.toUpperCase()}`);
  }

  select(id: string): void {
    this.selectedId.set(id);
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const [pipelines, reasons] = await Promise.all([
        firstValueFrom(this.api.listPipelines()),
        firstValueFrom(this.api.listLossReasons()),
      ]);
      this.pipelines.set(pipelines);
      this.lossReasons.set(reasons);
      if (
        this.selectedId() === null ||
        !pipelines.some((pipeline) => pipeline.id === this.selectedId())
      ) {
        this.selectedId.set(
          pipelines.find((pipeline) => pipeline.is_default)?.id ?? pipelines[0]?.id ?? null,
        );
      }
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async installCatalog(): Promise<void> {
    this.installing.set(true);
    try {
      await firstValueFrom(this.api.installCatalog());
      this.message.success(this.i18n.translate('SALESPIPE.CATALOG_INSTALLED'));
      await this.reload();
    } catch {
      // Reported by the HTTP interceptor.
    } finally {
      this.installing.set(false);
    }
  }

  openPipeline(pipeline: SalesPipeline | null): void {
    this.editingPipeline.set(pipeline);
    this.pipelineForm.reset({
      code: pipeline?.code ?? '',
      name: pipeline?.name ?? '',
      business_line: pipeline?.business_line ?? '',
      market: pipeline?.market ?? '',
      is_default: pipeline?.is_default ?? false,
      is_active: pipeline?.is_active ?? true,
      install_standard_stages: true,
      translations: this.fill(pipeline?.translations),
    });
    this.editor.set('pipeline');
  }

  openStage(stage: SalesPipelineStage | null): void {
    this.editingStage.set(stage);
    this.stageForm.reset({
      code: stage?.code ?? '',
      name: stage?.name ?? '',
      default_probability: stage?.default_probability ?? 10,
      forecast_category: stage?.forecast_category ?? 'pipeline',
      sequence: stage?.sequence ?? (this.stages().at(-1)?.sequence ?? 0) + 10,
      is_won: stage?.is_won ?? false,
      is_lost: stage?.is_lost ?? false,
      is_active: stage?.is_active ?? true,
      reprice_open_opportunities: false,
      translations: this.fill(stage?.translations),
    });
    this.editor.set('stage');
  }

  openReason(reason: SalesLossReason | null): void {
    this.editingReason.set(reason);
    this.reasonForm.reset({
      code: reason?.code ?? '',
      name: reason?.name ?? '',
      requires_competitor: reason?.requires_competitor ?? false,
      is_active: reason?.is_active ?? true,
      translations: this.fill(reason?.translations),
    });
    this.editor.set('reason');
  }

  async saveEditor(): Promise<void> {
    const kind = this.editor();
    if (kind === null) {
      return;
    }

    const form =
      kind === 'pipeline' ? this.pipelineForm : kind === 'stage' ? this.stageForm : this.reasonForm;
    const editing =
      kind === 'pipeline'
        ? this.editingPipeline()
        : kind === 'stage'
          ? this.editingStage()
          : this.editingReason();
    // The code is only entered on creation.
    if (editing) {
      form.controls.code.clearValidators();
      form.controls.code.updateValueAndValidity();
    }
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    try {
      await this.persist(kind, editing?.id ?? null);
      this.editor.set(null);
      this.message.success(this.i18n.translate('SALESPIPE.SAVED'));
      await this.reload();
    } catch {
      // The API refused (for instance a duplicate code): the interceptor shows the message and the dialog stays open.
    } finally {
      this.saving.set(false);
    }
  }

  async deletePipeline(pipeline: SalesPipeline): Promise<void> {
    await this.remove(() => firstValueFrom(this.api.deletePipeline(pipeline.id)));
  }

  async deleteStage(stage: SalesPipelineStage): Promise<void> {
    await this.remove(() => firstValueFrom(this.api.deleteStage(stage.id)));
  }

  async deleteReason(reason: SalesLossReason): Promise<void> {
    await this.remove(() => firstValueFrom(this.api.deleteLossReason(reason.id)));
  }

  private async persist(kind: Editor, id: string | null): Promise<void> {
    if (kind === 'pipeline') {
      const value = this.pipelineForm.getRawValue();
      const payload = {
        name: value.name,
        business_line: value.business_line || null,
        market: value.market || null,
        is_default: value.is_default,
        is_active: value.is_active,
        translations: cleanTranslations(value.translations),
      };
      await firstValueFrom(
        id
          ? this.api.updatePipeline(id, payload)
          : this.api.createPipeline({
              ...payload,
              code: value.code,
              install_standard_stages: value.install_standard_stages,
            }),
      );
      return;
    }

    if (kind === 'stage') {
      const value = this.stageForm.getRawValue();
      const payload = {
        name: value.name,
        default_probability: value.default_probability,
        forecast_category: value.forecast_category,
        sequence: value.sequence,
        is_won: value.is_won,
        is_lost: value.is_lost,
        is_active: value.is_active,
        translations: cleanTranslations(value.translations),
      };
      await firstValueFrom(
        id
          ? this.api.updateStage(id, {
              ...payload,
              reprice_open_opportunities: value.reprice_open_opportunities,
            })
          : this.api.createStage({
              ...payload,
              code: value.code,
              pipeline_id: this.selectedId() ?? undefined,
            }),
      );
      return;
    }

    const value = this.reasonForm.getRawValue();
    const payload = {
      name: value.name,
      requires_competitor: value.requires_competitor,
      is_active: value.is_active,
      translations: cleanTranslations(value.translations),
    };
    await firstValueFrom(
      id
        ? this.api.updateLossReason(id, payload)
        : this.api.createLossReason({ ...payload, code: value.code }),
    );
  }

  private async remove(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
      this.message.success(this.i18n.translate('SALESPIPE.DELETED'));
      await this.reload();
    } catch {
      // A pipeline, stage or reason in use answers 422/409: the interceptor shows why, and it stays.
    }
  }

  private fill(
    translations: Record<string, string> | null | undefined,
  ): Record<(typeof CATALOG_LOCALES)[number], string> {
    return {
      'it-CH': translations?.['it-CH'] ?? '',
      'de-CH': translations?.['de-CH'] ?? '',
      'fr-CH': translations?.['fr-CH'] ?? '',
      en: translations?.['en'] ?? '',
      'it-IT': translations?.['it-IT'] ?? '',
    };
  }
}
