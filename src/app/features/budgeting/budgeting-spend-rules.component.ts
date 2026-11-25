import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BudgetingApiService, PermissionsService, SPEND_DOCUMENT_TYPES, SPEND_MODES, SPEND_STAGES, SpendDocumentType, SpendMode, SpendRule, SpendStage, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { BudgetingDimensionsComponent } from './budgeting-dimensions.component';
import { apiErrorText, blankToNull, OPTIONAL_UUID_PATTERN } from './budgeting.util';

/** Spend rules: allow, warn or block when the spend of an account, cost centre or project goes past a percentage of its budget. */
@Component({
  selector: 'app-budgeting-spend-rules',
  styleUrl: './budgeting.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    BudgetingDimensionsComponent,
    IconActionDirective,
    ModalActionsDirective,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    @if (canManage) {
      <div class="toolbar">
        <span class="spacer"></span>
        <button nz-button nzType="primary" (click)="openModal()">{{ 'BUDGETING_CONTROL.NEW_RULE' | translate }}</button>
      </div>
    }

    <nz-card class="main-card">
      <nz-table #table [nzData]="rules()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'BUDGETING.NAME' | translate }}</th>
            <th>{{ 'BUDGETING_CONTROL.MODE' | translate }}</th>
            <th class="num">{{ 'BUDGETING_CONTROL.THRESHOLD' | translate }}</th>
            <th>{{ 'BUDGETING_CONTROL.DOCUMENT_TYPES' | translate }}</th>
            <th>{{ 'BUDGETING_CONTROL.STAGES' | translate }}</th>
            <th class="num">{{ 'BUDGETING_CONTROL.PRIORITY' | translate }}</th>
            <th>{{ 'BUDGETING_CONTROL.ACTIVE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.name }}</td>
              <td><nz-tag [nzColor]="row.mode === 'hard_block' ? 'red' : row.mode === 'warning' ? 'orange' : 'green'">{{ ('BUDGETING_CONTROL.MODE_' + row.mode.toUpperCase()) | translate }}</nz-tag></td>
              <td class="num">{{ row.threshold_percent | number: '1.0-2' }}%</td>
              <td>@for (type of row.document_types; track type) { <nz-tag>{{ ('BUDGETING_CONTROL.DOCUMENT_' + type.toUpperCase()) | translate }}</nz-tag> }</td>
              <td>@for (stage of row.stages; track stage) { <nz-tag>{{ ('BUDGETING_CONTROL.STAGE_' + stage.toUpperCase()) | translate }}</nz-tag> }</td>
              <td class="num">{{ row.priority }}</td>
              <td>{{ (row.is_active ? 'BUDGETING_CONTROL.YES' : 'BUDGETING_CONTROL.NO') | translate }}</td>
              <td>
                @if (canManage) {
                  <div class="row-actions">
                    <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'BUDGETING.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  </div>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (rules().length === 0) {
        <nz-empty [nzNotFoundContent]="'BUDGETING_CONTROL.NO_RULES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'BUDGETING_CONTROL.EDIT_RULE' : 'BUDGETING_CONTROL.NEW_RULE') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="rule-name">{{ 'BUDGETING.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="rule-name" formControlName="name" maxlength="160" /></nz-form-control>
          </nz-form-item>
          <app-budgeting-dimensions [group]="form" />
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'BUDGETING_CONTROL.MODE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="mode">
                  @for (mode of modes; track mode) {
                    <nz-option [nzValue]="mode" [nzLabel]="('BUDGETING_CONTROL.MODE_' + mode.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rule-threshold">{{ 'BUDGETING_CONTROL.THRESHOLD' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'BUDGETING_CONTROL.THRESHOLD_HINT' | translate"><input nz-input id="rule-threshold" type="number" min="0" max="1000" step="any" formControlName="threshold_percent" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'BUDGETING_CONTROL.DOCUMENT_TYPES' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="document_types" nzMode="multiple">
                @for (type of documentTypes; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="('BUDGETING_CONTROL.DOCUMENT_' + type.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'BUDGETING_CONTROL.STAGES' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="stages" nzMode="multiple">
                @for (stage of stages; track stage) {
                  <nz-option [nzValue]="stage" [nzLabel]="('BUDGETING_CONTROL.STAGE_' + stage.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="rule-priority">{{ 'BUDGETING_CONTROL.PRIORITY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rule-priority" type="number" min="-100" max="100" formControlName="priority" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'BUDGETING_CONTROL.ENFORCE_WITHOUT_BUDGET' | translate }}</nz-form-label>
              <nz-form-control><nz-switch formControlName="enforce_without_budget"></nz-switch></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'BUDGETING_CONTROL.ACTIVE' | translate }}</nz-form-label>
              <nz-form-control><nz-switch formControlName="is_active"></nz-switch></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class BudgetingSpendRulesComponent implements OnInit {
  private readonly api = inject(BudgetingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly canManage = inject(PermissionsService).canWrite('budgeting_control');
  readonly modes = SPEND_MODES;
  readonly documentTypes = SPEND_DOCUMENT_TYPES;
  readonly stages = SPEND_STAGES;
  readonly rules = signal<SpendRule[]>([]);
  readonly modalVisible = signal(false);
  readonly editing = signal<SpendRule | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    account_id: this.fb.control<string | null>(null),
    cost_center_id: this.fb.control<string | null>(null),
    project_id: ['', [Validators.pattern(OPTIONAL_UUID_PATTERN)]],
    mode: ['warning' as SpendMode, [Validators.required]],
    threshold_percent: [100, [Validators.required, Validators.min(0), Validators.max(1000)]],
    document_types: [['requisition', 'purchase_order'] as SpendDocumentType[], [Validators.required, Validators.minLength(1)]],
    stages: [['submit', 'approve'] as SpendStage[], [Validators.required, Validators.minLength(1)]],
    enforce_without_budget: [false],
    priority: [0, [Validators.min(-100), Validators.max(100)]],
    is_active: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getRules().subscribe({
      next: (response) => this.rules.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  openModal(rule?: SpendRule): void {
    this.editing.set(rule ?? null);
    this.form.reset(
      rule
        ? { name: rule.name, account_id: rule.account_id, cost_center_id: rule.cost_center_id, project_id: rule.project_id ?? '', mode: rule.mode, threshold_percent: Number(rule.threshold_percent), document_types: rule.document_types, stages: rule.stages, enforce_without_budget: rule.enforce_without_budget, priority: rule.priority, is_active: rule.is_active }
        : { name: '', account_id: null, cost_center_id: null, project_id: '', mode: 'warning', threshold_percent: 100, document_types: ['requisition', 'purchase_order'], stages: ['submit', 'approve'], enforce_without_budget: false, priority: 0, is_active: true },
    );
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload = { ...value, project_id: blankToNull(value.project_id) };
    const editing = this.editing();
    const request = editing ? this.api.updateRule(editing.id, payload) : this.api.createRule(payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING_CONTROL.RULE_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  remove(rule: SpendRule): void {
    this.api.deleteRule(rule.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
