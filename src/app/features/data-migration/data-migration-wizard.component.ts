import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslateService } from '@core';
import {
  MigrationJob,
  MigrationJobStatus,
  MigrationTargetEntity,
  MigrationValidationError,
} from './data-migration.models';
import { DataMigrationStore } from './data-migration.store';

@Component({
  selector: 'app-data-migration-wizard',
  providers: [DataMigrationStore],
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  styleUrl: './data-migration-wizard.component.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.DATA_MIGRATION' | translate"
      [subtitle]="'dataMigration.subtitle' | translate"
    />

    @if (store.errorMessage(); as errorMsg) {
      <nz-alert
        nzType="error"
        nzShowIcon
        class="mb-3"
        [nzMessage]="errorMsg | translate"
      />
    }

    <nz-card class="mb-4">
      <nz-steps [nzCurrent]="store.currentStep()" (nzIndexChange)="store.setStep($event)" class="wizard-steps">
        <nz-step [nzTitle]="'dataMigration.step.1.title' | translate"></nz-step>
        <nz-step [nzTitle]="'dataMigration.step.2.title' | translate"></nz-step>
        <nz-step [nzTitle]="'dataMigration.step.3.title' | translate"></nz-step>
        <nz-step [nzTitle]="'dataMigration.step.4.title' | translate"></nz-step>
        <nz-step [nzTitle]="'dataMigration.step.5.title' | translate"></nz-step>
      </nz-steps>

      <nz-spin [nzSpinning]="store.busy() || store.uploading() || store.validating() || store.committing()">
        @switch (store.currentStep()) {
          @case (0) {
            <section aria-labelledby="step1-connector-heading">
              <h3 id="step1-connector-heading">{{ 'dataMigration.label.selectConnector' | translate }}</h3>
              <div class="connector-grid">
                @for (connector of store.connectors(); track connector.code) {
                  <button
                    type="button"
                    class="connector-card"
                    [class.selected]="store.selectedSourceSystem() === connector.code"
                    (click)="store.selectConnector(connector.code)"
                  >
                    <div class="connector-header">
                      <span>{{ connector.name_key | translate }}</span>
                      <nz-tag [nzColor]="connector.jurisdiction === 'CH' ? 'red' : connector.jurisdiction === 'IT' ? 'blue' : 'purple'">
                        {{ connector.jurisdiction }}
                      </nz-tag>
                    </div>
                    <p class="connector-desc">{{ connector.description_key | translate }}</p>
                  </button>
                }
              </div>

              <h3>{{ 'dataMigration.label.selectEntities' | translate }}</h3>
              <div class="entity-grid">
                @for (schema of store.entitySchemas(); track schema.code) {
                  <label
                    nz-checkbox
                    [attr.for]="'mig-entity-' + schema.code"
                    [nzId]="'mig-entity-' + schema.code"
                    [ngModel]="isEntitySelected(schema.code)"
                    (ngModelChange)="toggleEntity(schema.code, $event)"
                  >
                    {{ schema.label_key | translate }}
                  </label>
                }
              </div>

              <div class="mb-3">
                <label for="migration-tpl-select" class="d-block mb-1">
                  {{ 'dataMigration.label.mappingTemplate' | translate }}
                </label>
                <nz-select
                  id="migration-tpl-select"
                  nzId="migration-tpl-select"
                  style="width: 340px"
                  nzAllowClear
                  [ngModel]="store.selectedTemplateId()"
                  (ngModelChange)="store.selectTemplate($event)"
                >
                  @for (tpl of store.templates(); track tpl.id) {
                    <nz-option [nzValue]="tpl.id" [nzLabel]="tpl.name"></nz-option>
                  }
                </nz-select>
              </div>

              @if (store.selectedTargetEntities().length > 0) {
                <div class="template-downloads">
                  @for (entity of store.selectedTargetEntities(); track entity) {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      (click)="store.downloadTemplate(entity, 'xlsx')"
                    >
                      {{ 'dataMigration.action.downloadXlsx' | translate }} ({{ 'dataMigration.entity.' + entity | translate }})
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      (click)="store.downloadTemplate(entity, 'csv')"
                    >
                      {{ 'dataMigration.action.downloadCsv' | translate }} ({{ 'dataMigration.entity.' + entity | translate }})
                    </button>
                  }
                </div>
              }

              <div class="step-actions">
                <span></span>
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  [disabled]="!store.canProceedToStep2()"
                  (click)="store.setStep(1)"
                >
                  {{ 'dataMigration.action.next' | translate }}
                </button>
              </div>
            </section>
          }

          @case (1) {
            <section aria-labelledby="step2-upload-heading">
              <h3 id="step2-upload-heading">{{ 'dataMigration.step.2.title' | translate }}</h3>
              <label class="dropzone d-block" for="migration-archive-input">
                <p>{{ 'dataMigration.label.dropzoneTitle' | translate }}</p>
                <input
                  id="migration-archive-input"
                  type="file"
                  accept=".zip,.xlsx,.csv,.xml"
                  (change)="onFileSelected($event)"
                />
              </label>

              @if (selectedFile(); as file) {
                <nz-alert
                  nzType="info"
                  nzShowIcon
                  class="mt-3"
                  [nzMessage]="file.name"
                />
              }

              <div class="step-actions">
                <button nz-button type="button" (click)="store.setStep(0)">
                  {{ 'dataMigration.action.back' | translate }}
                </button>
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  [disabled]="selectedFile() === null"
                  [nzLoading]="store.uploading()"
                  (click)="uploadSelectedFile()"
                >
                  {{ 'dataMigration.action.uploadFile' | translate }}
                </button>
              </div>
            </section>
          }

          @case (2) {
            <section aria-labelledby="step3-mapping-heading">
              <div class="step-actions mb-3" style="margin-top: 0">
                <h3 id="step3-mapping-heading" style="margin: 0">{{ 'dataMigration.step.3.title' | translate }}</h3>
                <div style="display: flex; gap: 8px">
                  <button nz-button type="button" (click)="store.runAutoMap(false)">
                    {{ 'dataMigration.action.autoMap' | translate }}
                  </button>
                  <button nz-button type="button" (click)="saveTemplate()">
                    {{ 'dataMigration.action.saveTemplate' | translate }}
                  </button>
                </div>
              </div>

              <div class="transforms-row">
                <div>
                  <label for="mig-date-fmt">{{ 'dataMigration.label.dateFormat' | translate }}</label>
                  <nz-select
                    id="mig-date-fmt"
                    nzId="mig-date-fmt"
                    style="width: 100%"
                    [ngModel]="store.valueTransformations().date_format ?? 'Y-m-d'"
                    (ngModelChange)="store.updateTransformations({ date_format: $event })"
                  >
                    <nz-option nzValue="Y-m-d" nzLabel="YYYY-MM-DD"></nz-option>
                    <nz-option nzValue="d/m/Y" nzLabel="DD/MM/YYYY (IT)"></nz-option>
                    <nz-option nzValue="d.m.Y" nzLabel="DD.MM.YYYY (CH)"></nz-option>
                  </nz-select>
                </div>
                <div>
                  <label for="mig-dec-sep">{{ 'dataMigration.label.decimalSeparator' | translate }}</label>
                  <nz-select
                    id="mig-dec-sep"
                    nzId="mig-dec-sep"
                    style="width: 100%"
                    [ngModel]="store.valueTransformations().decimal_separator ?? '.'"
                    (ngModelChange)="store.updateTransformations({ decimal_separator: $event })"
                  >
                    <nz-option nzValue="." nzLabel=". (CH / ISO)"></nz-option>
                    <nz-option nzValue="," nzLabel=", (IT / EU)"></nz-option>
                  </nz-select>
                </div>
                <div>
                  <label for="mig-currency">{{ 'dataMigration.label.currencyDefault' | translate }}</label>
                  <nz-select
                    id="mig-currency"
                    nzId="mig-currency"
                    style="width: 100%"
                    [ngModel]="store.valueTransformations().currency_default ?? 'EUR'"
                    (ngModelChange)="store.updateTransformations({ currency_default: $event })"
                  >
                    <nz-option nzValue="EUR" nzLabel="EUR"></nz-option>
                    <nz-option nzValue="CHF" nzLabel="CHF"></nz-option>
                    <nz-option nzValue="USD" nzLabel="USD"></nz-option>
                  </nz-select>
                </div>
              </div>

              @for (entity of store.selectedTargetEntities(); track entity) {
                <h4 class="mt-3">{{ 'dataMigration.entity.' + entity | translate }}</h4>
                <nz-table [nzData]="fieldsForEntity(entity)" nzSize="small" [nzShowPagination]="false">
                  <thead>
                    <tr>
                      <th>{{ 'dataMigration.label.targetField' | translate }}</th>
                      <th>{{ 'dataMigration.label.sourceColumn' | translate }}</th>
                      <th>{{ 'dataMigration.label.confidence' | translate }}</th>
                      <th>{{ 'dataMigration.label.defaultValue' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (fieldDef of fieldsForEntity(entity); track fieldDef.field) {
                      <tr>
                        <td>
                          <strong>{{ fieldDef.field }}</strong>
                          @if (fieldDef.required) {
                            <nz-tag nzColor="blue" class="ml-1">*</nz-tag>
                          }
                        </td>
                        <td>
                          <nz-select
                            style="width: 240px"
                            nzAllowClear
                            [ngModel]="mappingEntry(entity, fieldDef.field)?.source_column ?? null"
                            (ngModelChange)="store.updateMappingField(entity, fieldDef.field, $event)"
                          >
                            @for (header of store.sourceHeaders(); track header) {
                              <nz-option [nzValue]="header" [nzLabel]="header"></nz-option>
                            }
                          </nz-select>
                        </td>
                        <td>
                          <nz-tag [nzColor]="(mappingEntry(entity, fieldDef.field)?.confidence ?? 0) >= 0.85 ? 'green' : 'orange'">
                            {{ ((mappingEntry(entity, fieldDef.field)?.confidence ?? 0) * 100).toFixed(0) }}%
                          </nz-tag>
                        </td>
                        <td>
                          <input
                            nz-input
                            style="width: 180px"
                            [ngModel]="mappingEntry(entity, fieldDef.field)?.default_value ?? ''"
                            (ngModelChange)="
                              store.updateMappingField(
                                entity,
                                fieldDef.field,
                                mappingEntry(entity, fieldDef.field)?.source_column ?? null,
                                $event
                              )
                            "
                          />
                        </td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              }

              <div class="step-actions">
                <button nz-button type="button" (click)="store.setStep(1)">
                  {{ 'dataMigration.action.back' | translate }}
                </button>
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  [nzLoading]="store.validating()"
                  (click)="store.runDryRun(true)"
                >
                  {{ 'dataMigration.action.runDryRun' | translate }}
                </button>
              </div>
            </section>
          }

          @case (3) {
            <section aria-labelledby="step4-dryrun-heading">
              <div class="step-actions mb-3" style="margin-top: 0">
                <h3 id="step4-dryrun-heading" style="margin: 0">{{ 'dataMigration.step.4.title' | translate }}</h3>
                <button
                  nz-button
                  nzType="default"
                  type="button"
                  [nzLoading]="store.validating()"
                  (click)="store.runDryRun(false)"
                >
                  {{ 'dataMigration.action.runDryRun' | translate }}
                </button>
              </div>

              @if (store.dryRunReport(); as report) {
                <div class="kpi-grid">
                  <nz-card nzSize="small">
                    <nz-statistic [nzTitle]="'dataMigration.label.totalRows' | translate" [nzValue]="report.summary.total_rows" />
                  </nz-card>
                  <nz-card nzSize="small">
                    <nz-statistic [nzTitle]="'dataMigration.label.validRows' | translate" [nzValue]="report.summary.valid_rows" />
                  </nz-card>
                  <nz-card nzSize="small">
                    <nz-statistic [nzTitle]="'dataMigration.label.errorRows' | translate" [nzValue]="report.summary.error_rows" />
                  </nz-card>
                  @if (report.summary.gl_balance.has_opening_balances) {
                    <nz-card nzSize="small">
                      <nz-statistic
                        [nzTitle]="'dataMigration.label.glBalance' | translate"
                        [nzValue]="report.summary.gl_balance.total_debit + ' / ' + report.summary.gl_balance.total_credit"
                      />
                      <nz-tag [nzColor]="report.summary.gl_balance.is_balanced ? 'green' : 'red'">
                        {{ (report.summary.gl_balance.is_balanced ? 'dataMigration.label.balanced' : 'dataMigration.label.unbalanced') | translate }}
                      </nz-tag>
                    </nz-card>
                  }
                </div>

                @if (report.errors.length > 0) {
                  <nz-table #errTable [nzData]="report.errors" nzSize="small" [nzPageSize]="15">
                    <thead>
                      <tr>
                        <th>{{ 'dataMigration.label.rowIndex' | translate }}</th>
                        <th>{{ 'dataMigration.label.recordId' | translate }}</th>
                        <th>{{ 'dataMigration.label.targetField' | translate }}</th>
                        <th>{{ 'dataMigration.label.rawValue' | translate }}</th>
                        <th>{{ 'dataMigration.label.suggestedFix' | translate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (err of errTable.data; track err.id) {
                        <tr>
                          <td>{{ err.row_index }}</td>
                          <td>{{ err.source_record_identifier }}</td>
                          <td>
                            <strong>{{ err.field_name }}</strong>
                            <div style="font-size: 12px; color: #b91c1c">{{ err.message_key | translate }}</div>
                          </td>
                          <td>
                            <div class="inline-fix-cell">
                              <input
                                nz-input
                                nzSize="small"
                                style="width: 170px"
                                [ngModel]="draftValue(err)"
                                (ngModelChange)="setDraft(err, $event)"
                              />
                              <button
                                nz-button
                                nzSize="small"
                                type="button"
                                (click)="saveInlineError(err)"
                              >
                                {{ 'dataMigration.action.saveInlineFix' | translate }}
                              </button>
                            </div>
                          </td>
                          <td>
                            @if (err.suggested_fix) {
                              <button
                                nz-button
                                nzSize="small"
                                nzType="dashed"
                                type="button"
                                (click)="applySuggestedFix(err)"
                              >
                                {{ 'dataMigration.action.applySuggestedFix' | translate }} ({{ err.suggested_fix }})
                              </button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </nz-table>
                }
              }

              <div class="step-actions">
                <button nz-button type="button" (click)="store.setStep(2)">
                  {{ 'dataMigration.action.back' | translate }}
                </button>
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  [disabled]="!store.canProceedToStep5()"
                  (click)="store.setStep(4)"
                >
                  {{ 'dataMigration.action.next' | translate }}
                </button>
              </div>
            </section>
          }

          @case (4) {
            <section aria-labelledby="step5-commit-heading">
              <h3 id="step5-commit-heading">{{ 'dataMigration.step.5.title' | translate }}</h3>

              @if (store.activeJob(); as job) {
                <nz-alert
                  class="mb-3"
                  nzShowIcon
                  [nzType]="job.status === 'Completed' ? 'success' : job.status === 'RolledBack' ? 'warning' : 'info'"
                  [nzMessage]="'dataMigration.status.' + job.status | translate"
                />

                <div class="step-actions" style="margin-top: 0; margin-bottom: 16px">
                  <button nz-button type="button" (click)="store.setStep(3)">
                    {{ 'dataMigration.action.back' | translate }}
                  </button>
                  <div style="display: flex; gap: 8px">
                    @if (job.status === 'DryRunValidated') {
                      <button
                        nz-button
                        nzType="primary"
                        type="button"
                        [nzLoading]="store.committing()"
                        (click)="store.commitActiveJob()"
                      >
                        {{ 'dataMigration.action.commit' | translate }}
                      </button>
                    }
                    @if (job.status === 'Completed') {
                      <button
                        nz-button
                        nzDanger
                        type="button"
                        [nzLoading]="store.rollingBack()"
                        (click)="confirmRollback(job)"
                      >
                        {{ 'dataMigration.action.rollback' | translate }}
                      </button>
                    }
                  </div>
                </div>
              }
            </section>
          }
        }
      </nz-spin>
    </nz-card>

    <nz-card [nzTitle]="'dataMigration.label.historyTitle' | translate">
      <nz-table #jobsTable [nzData]="store.jobs()" nzSize="small" [nzPageSize]="10">
        <thead>
          <tr>
            <th>{{ 'dataMigration.label.selectConnector' | translate }}</th>
            <th>{{ 'COMMON.STATUS' | translate }}</th>
            <th>{{ 'dataMigration.label.totalRows' | translate }}</th>
            <th>{{ 'dataMigration.label.validRows' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (job of jobsTable.data; track job.id) {
            <tr>
              <td>{{ 'dataMigration.connector.' + job.source_system + '.name' | translate }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(job.status)">
                  {{ 'dataMigration.status.' + job.status | translate }}
                </nz-tag>
              </td>
              <td>{{ job.total_rows }}</td>
              <td>{{ job.imported_rows }}</td>
              <td>
                @if (job.status === 'Completed') {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    [nzLoading]="store.rollingBack()"
                    (click)="confirmRollback(job)"
                  >
                    {{ 'dataMigration.action.rollback' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class DataMigrationWizardComponent implements OnInit {
  protected readonly store = inject(DataMigrationStore);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(TranslateService);

  protected readonly selectedFile = signal<File | null>(null);

  ngOnInit(): void {
    void this.store.init();
  }

  protected isEntitySelected(entity: MigrationTargetEntity): boolean {
    return this.store.selectedTargetEntities().includes(entity);
  }

  protected toggleEntity(entity: MigrationTargetEntity, checked: boolean): void {
    const current = this.store.selectedTargetEntities();
    if (checked && !current.includes(entity)) {
      this.store.setTargetEntities([...current, entity]);
    } else if (!checked) {
      this.store.setTargetEntities(current.filter((e) => e !== entity));
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.item(0) ?? null);
  }

  protected async uploadSelectedFile(): Promise<void> {
    const file = this.selectedFile();
    if (file === null) return;
    await this.store.uploadArchive(file);
  }

  protected fieldsForEntity(entity: MigrationTargetEntity) {
    return this.store.entitySchemas().find((s) => s.code === entity)?.fields ?? [];
  }

  protected mappingEntry(entity: string, field: string) {
    return this.store.columnMappings()[entity]?.[field];
  }

  protected saveTemplate(): void {
    const primaryEntity = this.store.selectedTargetEntities()[0];
    const source = this.store.selectedSourceSystem();
    if (!primaryEntity || !source) return;
    void this.store.saveCurrentAsTemplate(`${source} Custom ${primaryEntity}`, primaryEntity);
  }

  protected draftValue(err: MigrationValidationError): string {
    const key = `${err.entity_type}:${err.row_index}:${err.field_name}`;
    return this.store.editingValues()[key] ?? err.raw_value ?? '';
  }

  protected setDraft(err: MigrationValidationError, value: string): void {
    this.store.setInlineDraft(`${err.entity_type}:${err.row_index}:${err.field_name}`, value);
  }

  protected saveInlineError(err: MigrationValidationError): void {
    void this.store.patchErrorValue(
      err.entity_type,
      err.row_index,
      err.field_name,
      this.draftValue(err),
    );
  }

  protected applySuggestedFix(err: MigrationValidationError): void {
    if (!err.suggested_fix) return;
    this.setDraft(err, err.suggested_fix);
    void this.store.patchErrorValue(
      err.entity_type,
      err.row_index,
      err.field_name,
      err.suggested_fix,
    );
  }

  protected confirmRollback(job: MigrationJob): void {
    this.modal.confirm({
      nzTitle: this.i18n.instant('dataMigration.label.confirmRollbackTitle'),
      nzContent: this.i18n.instant('dataMigration.label.confirmRollbackBody'),
      nzOkDanger: true,
      nzOnOk: () => this.store.rollbackJob(job.id),
    });
  }

  protected statusColor(status: MigrationJobStatus): string {
    switch (status) {
      case 'Completed':
        return 'green';
      case 'DryRunValidated':
        return 'blue';
      case 'RolledBack':
        return 'orange';
      case 'Failed':
        return 'red';
      default:
        return 'default';
    }
  }
}
