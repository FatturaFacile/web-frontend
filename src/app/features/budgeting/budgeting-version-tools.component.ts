import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BUDGET_SCENARIO_KINDS, BudgetImport, BudgetingApiService, BudgetVersion, IMPORT_MODES, ImportMode, TranslateService } from '@core';
import { downloadBlob, ModalActionsDirective, TranslatePipe } from '@shared';
import { BudgetingDimensionsComponent } from './budgeting-dimensions.component';
import { apiErrorText, blankToNull, OPTIONAL_UUID_PATTERN } from './budgeting.util';

export type VersionTool = 'revise' | 'scenario' | 'roll' | 'transfer' | 'import';

/** The actions of a version around the grid: revise, scenario, roll forward, transfer, Excel import and the executive pack. */
@Component({
  selector: 'app-budgeting-version-tools',
  styleUrl: './budgeting.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    BudgetingDimensionsComponent,
    ModalActionsDirective,
    TranslatePipe,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    @if (canRevise()) {
      <button nz-button (click)="open('revise')">{{ 'BUDGETING_CONTROL.REVISE' | translate }}</button>
    }
    <button nz-button (click)="open('scenario')">{{ 'BUDGETING_CONTROL.NEW_SCENARIO' | translate }}</button>
    @if (canRoll()) {
      <button nz-button (click)="open('roll')">{{ 'BUDGETING_CONTROL.ROLL_FORWARD' | translate }}</button>
    }
    @if (version().status === 'draft') {
      <button nz-button (click)="open('transfer')">{{ 'BUDGETING_CONTROL.TRANSFER' | translate }}</button>
      <button nz-button (click)="open('import')">{{ 'BUDGETING_CONTROL.IMPORT_EXCEL' | translate }}</button>
    }
    <button nz-button (click)="downloadPack()">{{ 'BUDGETING_CONTROL.EXECUTIVE_PACK' | translate }}</button>

    <nz-modal appModalActions [(nzVisible)]="visible" [nzTitle]="('BUDGETING_CONTROL.TOOL_' + tool().toUpperCase()) | translate" (nzOnCancel)="visible.set(false)" (nzOnOk)="run()" okAction="save" [nzOkDisabled]="invalid()" [nzOkText]="tool() === 'import' ? ('BUDGETING_CONTROL.IMPORT' | translate) : null">
      <ng-container *nzModalContent>
        @switch (tool()) {
          @case ('revise') {
            <form nz-form [formGroup]="reviseForm" nzLayout="vertical">
              <nz-form-item>
                <nz-form-label nzFor="revise-name">{{ 'BUDGETING.NAME' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="revise-name" formControlName="name" maxlength="160" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="revise-reason">{{ 'BUDGETING_CONTROL.REVISION_REASON' | translate }}</nz-form-label>
                <nz-form-control><textarea nz-input id="revise-reason" rows="3" formControlName="reason" maxlength="1000"></textarea></nz-form-control>
              </nz-form-item>
            </form>
          }
          @case ('scenario') {
            <form nz-form [formGroup]="scenarioForm" nzLayout="vertical">
              <nz-form-item>
                <nz-form-label nzRequired nzFor="scenario-name">{{ 'BUDGETING.NAME' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="scenario-name" formControlName="name" maxlength="160" /></nz-form-control>
              </nz-form-item>
              <div class="form-row">
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'BUDGETING_CONTROL.SCENARIO_KIND' | translate }}</nz-form-label>
                  <nz-form-control>
                    <nz-select formControlName="scenario_kind">
                      @for (kind of scenarioKinds; track kind) {
                        <nz-option [nzValue]="kind" [nzLabel]="('BUDGETING_CONTROL.SCENARIO_' + kind.toUpperCase()) | translate"></nz-option>
                      }
                    </nz-select>
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzFor="scenario-adjustment">{{ 'BUDGETING.ADJUSTMENT_PERCENT' | translate }}</nz-form-label>
                  <nz-form-control><input nz-input id="scenario-adjustment" type="number" min="-100" max="1000" step="any" formControlName="adjustment_percent" /></nz-form-control>
                </nz-form-item>
              </div>
            </form>
          }
          @case ('roll') {
            <form nz-form [formGroup]="rollForm" nzLayout="vertical">
              <nz-form-item>
                <nz-form-label nzFor="roll-name">{{ 'BUDGETING.NAME' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="roll-name" formControlName="name" maxlength="160" /></nz-form-control>
              </nz-form-item>
              <div class="form-row">
                <nz-form-item>
                  <nz-form-label nzRequired nzFor="roll-shift">{{ 'BUDGETING_CONTROL.SHIFT_MONTHS' | translate }}</nz-form-label>
                  <nz-form-control><input nz-input id="roll-shift" type="number" min="1" max="12" formControlName="shift_months" /></nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzFor="roll-adjustment">{{ 'BUDGETING.ADJUSTMENT_PERCENT' | translate }}</nz-form-label>
                  <nz-form-control><input nz-input id="roll-adjustment" type="number" min="-100" max="1000" step="any" formControlName="adjustment_percent" /></nz-form-control>
                </nz-form-item>
              </div>
            </form>
          }
          @case ('transfer') {
            <form nz-form [formGroup]="transferForm" nzLayout="vertical">
              <h4>{{ 'BUDGETING_CONTROL.TRANSFER_FROM' | translate }}</h4>
              <app-budgeting-dimensions [group]="transferForm.controls.from" [accountRequired]="true" />
              <h4>{{ 'BUDGETING_CONTROL.TRANSFER_TO' | translate }}</h4>
              <app-budgeting-dimensions [group]="transferForm.controls.to" [accountRequired]="true" />
              <div class="form-row">
                <nz-form-item>
                  <nz-form-label nzRequired nzFor="transfer-period">{{ 'BUDGETING.PERIOD' | translate }}</nz-form-label>
                  <nz-form-control><input nz-input id="transfer-period" type="number" min="1" max="12" formControlName="period" /></nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzRequired nzFor="transfer-amount">{{ 'BUDGETING.AMOUNT' | translate }}</nz-form-label>
                  <nz-form-control><input nz-input id="transfer-amount" type="number" min="0.01" step="any" formControlName="amount" /></nz-form-control>
                </nz-form-item>
              </div>
              <nz-form-item>
                <nz-form-label nzFor="transfer-comment">{{ 'BUDGETING.COMMENT' | translate }}</nz-form-label>
                <nz-form-control><textarea nz-input id="transfer-comment" rows="2" formControlName="comment" maxlength="1000"></textarea></nz-form-control>
              </nz-form-item>
            </form>
          }
          @case ('import') {
            <div class="detail-grid">
              <p class="muted">{{ 'BUDGETING_CONTROL.IMPORT_HINT' | translate }}</p>
              <div><button nz-button (click)="downloadTemplate()">{{ 'BUDGETING_CONTROL.DOWNLOAD_TEMPLATE' | translate }}</button></div>
              <input type="file" accept=".xlsx,.xls,.csv" [attr.aria-label]="'BUDGETING_CONTROL.IMPORT_FILE' | translate" (change)="pickFile($event)" />
              <nz-select [ngModel]="importMode()" (ngModelChange)="importMode.set($event)">
                @for (mode of importModes; track mode) {
                  <nz-option [nzValue]="mode" [nzLabel]="('BUDGETING_CONTROL.IMPORT_MODE_' + mode.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
              <div><button nz-button (click)="runImport(true)" [disabled]="!file()">{{ 'BUDGETING_CONTROL.VALIDATE_ONLY' | translate }}</button></div>
              @if (importResult(); as result) {
                <div>
                  <nz-tag [nzColor]="result.status === 'failed' ? 'red' : result.status === 'imported' ? 'green' : 'blue'">{{ ('BUDGETING_CONTROL.IMPORT_STATUS_' + result.status.toUpperCase()) | translate }}</nz-tag>
                  <span class="muted">{{ 'BUDGETING_CONTROL.IMPORT_COUNTS' | translate: { total: result.total_rows, imported: result.imported_rows, errors: result.error_rows } }}</span>
                </div>
                @if (result.errors.length > 0) {
                  <nz-table #errors [nzData]="result.errors" nzSize="small" [nzPageSize]="10">
                    <thead>
                      <tr>
                        <th>{{ 'BUDGETING_CONTROL.ROW' | translate }}</th>
                        <th>{{ 'BUDGETING_CONTROL.FIELD' | translate }}</th>
                        <th>{{ 'BUDGETING_CONTROL.MESSAGE' | translate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (error of errors.data; track $index) {
                        <tr>
                          <td>{{ error.row }}</td>
                          <td>{{ error.field }}</td>
                          <td>{{ error.message }}</td>
                        </tr>
                      }
                    </tbody>
                  </nz-table>
                }
              }
            </div>
          }
        }
      </ng-container>
    </nz-modal>
  `,
})
export class BudgetingVersionToolsComponent {
  private readonly api = inject(BudgetingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly version = input.required<BudgetVersion>();
  /** A new version was created (revision, scenario, roll forward): its id. */
  readonly created = output<string>();
  readonly changed = output<void>();

  readonly scenarioKinds = BUDGET_SCENARIO_KINDS;
  readonly importModes = IMPORT_MODES;
  readonly visible = signal(false);
  readonly tool = signal<VersionTool>('revise');
  readonly file = signal<File | null>(null);
  readonly importMode = signal<ImportMode>('merge');
  readonly importResult = signal<BudgetImport | null>(null);

  readonly reviseForm = this.fb.group({ name: [''], reason: ['', [Validators.required, Validators.maxLength(1000)]] });
  readonly scenarioForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    scenario_kind: ['best_case' as 'best_case' | 'worst_case' | 'custom', [Validators.required]],
    adjustment_percent: this.fb.control<number | null>(null, [Validators.min(-100), Validators.max(1000)]),
  });
  readonly rollForm = this.fb.group({
    name: [''],
    shift_months: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
    adjustment_percent: this.fb.control<number | null>(null, [Validators.min(-100), Validators.max(1000)]),
  });
  readonly transferForm = this.fb.group({
    from: this.fb.group({ account_id: ['', [Validators.required]], cost_center_id: this.fb.control<string | null>(null), project_id: ['', [Validators.pattern(OPTIONAL_UUID_PATTERN)]] }),
    to: this.fb.group({ account_id: ['', [Validators.required]], cost_center_id: this.fb.control<string | null>(null), project_id: ['', [Validators.pattern(OPTIONAL_UUID_PATTERN)]] }),
    period: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    comment: [''],
  });

  canRevise(): boolean {
    const version = this.version();
    return (version.version_type === 'budget' || version.version_type === 'revised') && (version.status === 'approved' || version.status === 'locked');
  }

  canRoll(): boolean {
    const version = this.version();
    return version.version_type === 'rolling_forecast' && (version.status === 'approved' || version.status === 'locked');
  }

  invalid(): boolean {
    switch (this.tool()) {
      case 'revise':
        return this.reviseForm.invalid;
      case 'scenario':
        return this.scenarioForm.invalid;
      case 'roll':
        return this.rollForm.invalid;
      case 'transfer':
        return this.transferForm.invalid;
      default:
        return this.file() === null;
    }
  }

  open(tool: VersionTool): void {
    this.tool.set(tool);
    this.file.set(null);
    this.importResult.set(null);
    this.reviseForm.reset({ name: '', reason: '' });
    this.scenarioForm.reset({ name: '', scenario_kind: 'best_case', adjustment_percent: null });
    this.rollForm.reset({ name: '', shift_months: 1, adjustment_percent: null });
    this.transferForm.reset({ from: { account_id: '', cost_center_id: null, project_id: '' }, to: { account_id: '', cost_center_id: null, project_id: '' }, period: 1, amount: null, comment: '' });
    this.visible.set(true);
  }

  run(): void {
    const id = this.version().id;
    const done = (key: string, createdId?: string): void => {
      this.message.success(this.translate.instant(key));
      this.visible.set(false);
      this.changed.emit();
      if (createdId) {
        this.created.emit(createdId);
      }
    };
    const failed = (error: unknown): void => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR'));

    switch (this.tool()) {
      case 'revise': {
        const value = this.reviseForm.getRawValue();
        this.api.reviseVersion(id, { name: blankToNull(value.name), reason: value.reason }).subscribe({ next: (response) => done('BUDGETING_CONTROL.REVISION_DONE', response.data.id), error: failed });
        break;
      }
      case 'scenario': {
        const value = this.scenarioForm.getRawValue();
        this.api.createScenario(id, { name: value.name, scenario_kind: value.scenario_kind, adjustment_percent: value.adjustment_percent }).subscribe({ next: (response) => done('BUDGETING_CONTROL.SCENARIO_DONE', response.data.id), error: failed });
        break;
      }
      case 'roll': {
        const value = this.rollForm.getRawValue();
        this.api.rollForward(id, { name: blankToNull(value.name), shift_months: value.shift_months, adjustment_percent: value.adjustment_percent }).subscribe({ next: (response) => done('BUDGETING_CONTROL.ROLL_DONE', response.data.id), error: failed });
        break;
      }
      case 'transfer': {
        const value = this.transferForm.getRawValue();
        this.api
          .transferBudget(id, {
            from: { account_id: value.from.account_id, cost_center_id: value.from.cost_center_id, project_id: blankToNull(value.from.project_id) },
            to: { account_id: value.to.account_id, cost_center_id: value.to.cost_center_id, project_id: blankToNull(value.to.project_id) },
            period: value.period,
            amount: String(value.amount),
            comment: blankToNull(value.comment),
          })
          .subscribe({ next: () => done('BUDGETING_CONTROL.TRANSFER_DONE'), error: failed });
        break;
      }
      default:
        this.runImport(false);
    }
  }

  pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.item(0) ?? null);
    this.importResult.set(null);
  }

  runImport(validateOnly: boolean): void {
    const file = this.file();
    if (!file) {
      return;
    }

    this.api.importBudget(this.version().id, file, this.importMode(), validateOnly).subscribe({
      next: (response) => {
        this.importResult.set(response.data);
        if (response.data.status === 'imported') {
          this.message.success(this.translate.instant('BUDGETING_CONTROL.IMPORT_DONE'));
          this.visible.set(false);
          this.changed.emit();
        }
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  downloadTemplate(): void {
    this.api.downloadImportTemplate(this.version().id).subscribe({
      next: (blob) => downloadBlob(blob, 'budget-import-template.xlsx'),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  downloadPack(): void {
    const version = this.version();
    this.api.downloadExecutivePack(version.id).subscribe({
      next: (blob) => downloadBlob(blob, `budget-pack-${version.fiscal_year}.xlsx`),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
