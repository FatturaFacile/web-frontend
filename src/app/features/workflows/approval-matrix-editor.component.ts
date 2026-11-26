import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  I18nService,
  WorkflowApiService,
  WorkflowApprovalMatrix,
  WorkflowMatrixTier,
  WorkflowSimulationResult,
  WorkflowSubjectType,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  APPROVAL_TYPES,
  APPROVER_TYPES,
  EditableMatrix,
  emptyCondition,
  emptyMatrix,
  emptyTier,
  MATRIX_FIELDS,
  MATRIX_OPERATORS,
  nextPriority,
  nextTierLevel,
  toEditable,
  toRequest,
  validateMatrix,
} from './approval-matrix.util';

/** The sample document attributes the simulation form edits. */
interface SimulationInput {
  amount: number;
  currency: string;
  cost_center_id: string;
  category: string;
  discount_percent: number | null;
  new_supplier: boolean;
}

/**
 * Approval matrix editor (Mod 006): the matrices of a document type by priority, each with the conditions that select it
 * and its tiers (levels run in sequence, tiers of one level in parallel, with amount bounds, approver and approval
 * type), plus a simulation of a matrix against sample document attributes.
 */
@Component({
  selector: 'app-approval-matrix-editor',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'workflows.matrix.title' | translate"></app-page-header>

    <nz-card [nzTitle]="'workflows.matrix.list' | translate">
      <nz-table [nzData]="matrices()" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'workflows.matrix.priority' | translate }}</th>
            <th>{{ 'workflows.matrix.code' | translate }}</th>
            <th>{{ 'workflows.matrix.name' | translate }}</th>
            <th>{{ 'workflows.matrix.subjectType' | translate }}</th>
            <th>{{ 'workflows.matrix.status' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (matrix of matrices(); track matrix.id) {
            <tr data-testid="matrix-row">
              <td>{{ matrix.priority }}</td>
              <td>{{ matrix.code }}</td>
              <td>{{ matrix.name }}</td>
              <td>{{ 'workflows.subject_types.' + matrix.subject_type | translate }}</td>
              <td>
                @if (matrix.is_default) {
                  <nz-tag nzColor="blue">{{ 'workflows.matrix.default' | translate }}</nz-tag>
                }
                <nz-tag [nzColor]="matrix.is_active ? 'green' : 'default'">
                  {{ (matrix.is_active ? 'workflows.matrix.active' : 'workflows.matrix.inactive') | translate }}
                </nz-tag>
              </td>
              <td>
                <button nz-button nzSize="small" (click)="edit(matrix)">{{ 'workflows.matrix.edit' | translate }}</button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      <button nz-button nzType="dashed" (click)="newMatrix()" data-testid="new-matrix">
        {{ 'workflows.matrix.new' | translate }}
      </button>
    </nz-card>

    <nz-card [nzTitle]="'workflows.matrix.editor' | translate" class="section">
      <div class="row">
        <label class="inline">
          {{ 'workflows.matrix.code' | translate }}
          <input nz-input maxlength="60" [ngModel]="draft().code" (ngModelChange)="mutate(setText('code', $event))" />
        </label>
        <label class="inline wide">
          {{ 'workflows.matrix.name' | translate }}
          <input nz-input maxlength="150" [ngModel]="draft().name" (ngModelChange)="mutate(setText('name', $event))" />
        </label>
        <label class="inline">
          {{ 'workflows.matrix.subjectType' | translate }}
          <nz-select class="select" [ngModel]="draft().subject_type" (ngModelChange)="mutate(setText('subject_type', $event))">
            @for (type of subjectTypes(); track type.code) {
              <nz-option [nzValue]="type.code" [nzLabel]="'workflows.subject_types.' + type.code | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="inline">
          {{ 'workflows.matrix.currency' | translate }}
          <input nz-input class="currency" maxlength="3" [ngModel]="draft().currency" (ngModelChange)="mutate(setText('currency', $event.toUpperCase()))" />
        </label>
        <label class="inline">
          {{ 'workflows.matrix.priority' | translate }}
          <nz-input-number [ngModel]="draft().priority" (ngModelChange)="mutate(setNumber('priority', $event))" [nzMin]="1" [nzStep]="10"></nz-input-number>
        </label>
        <label class="inline">
          {{ 'workflows.matrix.autoApproveBelow' | translate }}
          <nz-input-number [ngModel]="draft().auto_approve_below" (ngModelChange)="mutate(setNumber('auto_approve_below', $event))" [nzMin]="0"></nz-input-number>
        </label>
        <label class="inline">
          {{ 'workflows.matrix.active' | translate }}
          <nz-switch [ngModel]="draft().is_active" (ngModelChange)="mutate(setFlag('is_active', $event))"></nz-switch>
        </label>
        <label class="inline">
          {{ 'workflows.matrix.default' | translate }}
          <nz-switch [ngModel]="draft().is_default" (ngModelChange)="mutate(setFlag('is_default', $event))"></nz-switch>
        </label>
      </div>

      <h4>{{ 'workflows.matrix.conditions' | translate }}</h4>
      <p class="hint">{{ 'workflows.matrix.conditionsHint' | translate }}</p>
      @for (condition of draft().conditions; track $index; let c = $index) {
        <div class="row" data-testid="condition-row">
          <nz-select class="select" [ngModel]="condition.field" (ngModelChange)="mutate(setCondition(c, 'field', $event))" [attr.aria-label]="'workflows.matrix.field' | translate">
            @for (field of fields; track field) {
              <nz-option [nzValue]="field" [nzLabel]="'workflows.matrix.field.' + field | translate"></nz-option>
            }
          </nz-select>
          <nz-select class="select" [ngModel]="condition.operator" (ngModelChange)="mutate(setCondition(c, 'operator', $event))" [attr.aria-label]="'workflows.matrix.operator' | translate">
            @for (operator of operators; track operator) {
              <nz-option [nzValue]="operator" [nzLabel]="'workflows.matrix.operator.' + operator | translate"></nz-option>
            }
          </nz-select>
          <input nz-input class="value" [ngModel]="condition.valueText" (ngModelChange)="mutate(setCondition(c, 'valueText', $event))" [placeholder]="'workflows.matrix.valueHint' | translate" [attr.aria-label]="'workflows.matrix.value' | translate" />
          <button nz-button nzSize="small" nzDanger (click)="mutate(removeCondition(c))">{{ 'workflows.matrix.remove' | translate }}</button>
        </div>
      }
      <button nz-button nzSize="small" (click)="mutate(addCondition())" data-testid="add-condition">{{ 'workflows.matrix.addCondition' | translate }}</button>

      <h4>{{ 'workflows.matrix.tiers' | translate }}</h4>
      <p class="hint">{{ 'workflows.matrix.tiersHint' | translate }}</p>
      <nz-table [nzData]="draft().tiers" [nzFrontPagination]="false" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'workflows.matrix.tierLevel' | translate }}</th>
            <th>{{ 'workflows.matrix.thresholdMin' | translate }}</th>
            <th>{{ 'workflows.matrix.thresholdMax' | translate }}</th>
            <th>{{ 'workflows.matrix.approverType' | translate }}</th>
            <th>{{ 'workflows.matrix.approverValue' | translate }}</th>
            <th>{{ 'workflows.matrix.approvalType' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (tier of draft().tiers; track $index; let t = $index) {
            <tr data-testid="tier-row">
              <td><nz-input-number [ngModel]="tier.tier_level" (ngModelChange)="mutate(setTier(t, 'tier_level', $event))" [nzMin]="1" [attr.aria-label]="'workflows.matrix.tierLevel' | translate"></nz-input-number></td>
              <td><nz-input-number [ngModel]="tier.threshold_min" (ngModelChange)="mutate(setTier(t, 'threshold_min', $event))" [nzMin]="0" [attr.aria-label]="'workflows.matrix.thresholdMin' | translate"></nz-input-number></td>
              <td><nz-input-number [ngModel]="tier.threshold_max" (ngModelChange)="mutate(setTier(t, 'threshold_max', $event))" [nzMin]="0" [attr.aria-label]="'workflows.matrix.thresholdMax' | translate"></nz-input-number></td>
              <td>
                <nz-select [ngModel]="tier.approver_type" (ngModelChange)="mutate(setTier(t, 'approver_type', $event))" [attr.aria-label]="'workflows.matrix.approverType' | translate">
                  @for (type of approverTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="'workflows.matrix.approver.' + type | translate"></nz-option>
                  }
                </nz-select>
              </td>
              <td><input nz-input [disabled]="tier.approver_type === 'reporting_manager'" [ngModel]="tier.approver_value" (ngModelChange)="mutate(setTier(t, 'approver_value', $event))" [attr.aria-label]="'workflows.matrix.approverValue' | translate" /></td>
              <td>
                <nz-select [ngModel]="tier.approval_type" (ngModelChange)="mutate(setTier(t, 'approval_type', $event))" [attr.aria-label]="'workflows.matrix.approvalType' | translate">
                  @for (type of approvalTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="'workflows.matrix.approval.' + type | translate"></nz-option>
                  }
                </nz-select>
              </td>
              <td><button nz-button nzSize="small" nzDanger (click)="mutate(removeTier(t))">{{ 'workflows.matrix.remove' | translate }}</button></td>
            </tr>
          }
        </tbody>
      </nz-table>
      <button nz-button nzSize="small" (click)="mutate(addTier())" data-testid="add-tier">{{ 'workflows.matrix.addTier' | translate }}</button>

      <h4>{{ 'workflows.matrix.fallback' | translate }}</h4>
      <div class="row">
        <nz-select class="select" nzAllowClear [ngModel]="draft().fallbackType" (ngModelChange)="mutate(setFallbackType($event))" [nzPlaceHolder]="'workflows.matrix.noFallback' | translate" [attr.aria-label]="'workflows.matrix.fallback' | translate">
          @for (type of approverTypes; track type) {
            <nz-option [nzValue]="type" [nzLabel]="'workflows.matrix.approver.' + type | translate"></nz-option>
          }
        </nz-select>
        @if (draft().fallbackType && draft().fallbackType !== 'reporting_manager') {
          <input nz-input class="value" [ngModel]="draft().fallbackValue" (ngModelChange)="mutate(setText('fallbackValue', $event))" [attr.aria-label]="'workflows.matrix.approverValue' | translate" />
        }
      </div>

      @if (errors().length > 0) {
        <nz-alert class="section" nzType="warning" nzShowIcon [nzMessage]="'workflows.matrix.fixErrors' | translate" [nzDescription]="errorList"></nz-alert>
        <ng-template #errorList>
          <ul>
            @for (error of errors(); track error) {
              <li>{{ error | translate }}</li>
            }
          </ul>
        </ng-template>
      }
      <div class="row section">
        <button nz-button nzType="primary" data-testid="save-matrix" [nzLoading]="saving()" (click)="save()">{{ 'workflows.matrix.save' | translate }}</button>
      </div>
    </nz-card>

    <nz-card [nzTitle]="'workflows.matrix.simulate.title' | translate" class="section">
      <div class="row">
        <label class="inline">
          {{ 'workflows.matrix.field.amount' | translate }}
          <nz-input-number [ngModel]="sim().amount" (ngModelChange)="patchSim('amount', $event)" [nzMin]="0" data-testid="sim-amount"></nz-input-number>
        </label>
        <label class="inline">
          {{ 'workflows.matrix.field.currency' | translate }}
          <input nz-input class="currency" maxlength="3" [ngModel]="sim().currency" (ngModelChange)="patchSim('currency', $event)" />
        </label>
        <label class="inline">
          {{ 'workflows.matrix.field.cost_center_id' | translate }}
          <input nz-input [ngModel]="sim().cost_center_id" (ngModelChange)="patchSim('cost_center_id', $event)" />
        </label>
        <label class="inline">
          {{ 'workflows.matrix.field.category' | translate }}
          <input nz-input [ngModel]="sim().category" (ngModelChange)="patchSim('category', $event)" />
        </label>
        <label class="inline">
          {{ 'workflows.matrix.field.discount_percent' | translate }}
          <nz-input-number [ngModel]="sim().discount_percent" (ngModelChange)="patchSim('discount_percent', $event)" [nzMin]="0" [nzMax]="100"></nz-input-number>
        </label>
        <label class="inline">
          {{ 'workflows.matrix.field.new_supplier' | translate }}
          <nz-switch [ngModel]="sim().new_supplier" (ngModelChange)="patchSim('new_supplier', $event)"></nz-switch>
        </label>
        <button nz-button nzType="primary" data-testid="simulate" [nzLoading]="simulating()" (click)="simulate()">{{ 'workflows.matrix.simulate.run' | translate }}</button>
      </div>
      @if (result(); as outcome) {
        <div data-testid="simulation-result" class="result">
          @if (outcome.blocked) {
            <nz-tag nzColor="red">{{ 'workflows.matrix.simulate.blocked' | translate }}</nz-tag>
          } @else if (outcome.auto_approved) {
            <nz-tag nzColor="green">{{ 'workflows.matrix.simulate.autoApproved' | translate }}</nz-tag>
          } @else if (outcome.matrix) {
            <nz-tag nzColor="blue">{{ 'workflows.matrix.simulate.matched' | translate: { name: outcome.matrix.name } }}</nz-tag>
          } @else {
            <nz-tag>{{ 'workflows.matrix.simulate.noMatch' | translate }}</nz-tag>
          }
          @if (outcome.used_default) {
            <nz-tag nzColor="orange">{{ 'workflows.matrix.simulate.usedDefault' | translate }}</nz-tag>
          }
          @if (outcome.used_fallback) {
            <nz-tag nzColor="orange">{{ 'workflows.matrix.simulate.usedFallback' | translate }}</nz-tag>
          }
          <ol>
            @for (tier of outcome.tiers; track $index) {
              <li>
                {{ 'workflows.matrix.simulate.tier' | translate: { level: tier.tier_level } }}:
                {{ 'workflows.matrix.approver.' + tier.approver_type | translate }} {{ tier.approver_value }}
                ({{ 'workflows.matrix.approval.' + tier.approval_type | translate }})
              </li>
            }
          </ol>
        </div>
      }
    </nz-card>
  `,
  styles: `
    .row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: flex-end;
      margin-bottom: 12px;
    }
    .select {
      min-width: 200px;
    }
    .value {
      min-width: 220px;
      width: auto;
    }
    .wide {
      min-width: 260px;
    }
    .currency {
      width: 90px;
    }
    .section {
      margin-top: 16px;
      display: block;
    }
    .inline {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .hint {
      color: var(--text-secondary);
    }
    .result {
      margin-top: 12px;
    }
  `,
})
export class ApprovalMatrixEditorComponent implements OnInit {
  private readonly api = inject(WorkflowApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly fields = MATRIX_FIELDS;
  protected readonly operators = MATRIX_OPERATORS;
  protected readonly approverTypes = APPROVER_TYPES;
  protected readonly approvalTypes = APPROVAL_TYPES;

  readonly matrices = signal<WorkflowApprovalMatrix[]>([]);
  readonly subjectTypes = signal<WorkflowSubjectType[]>([]);
  readonly draft = signal<EditableMatrix>(emptyMatrix());
  readonly saving = signal(false);
  readonly simulating = signal(false);
  readonly result = signal<WorkflowSimulationResult | null>(null);
  /** Validation errors shown after a failed save attempt (translation keys or server messages). */
  readonly errors = signal<string[]>([]);
  readonly sim = signal<SimulationInput>({ amount: 0, currency: 'CHF', cost_center_id: '', category: '', discount_percent: null, new_supplier: false });

  ngOnInit(): void {
    this.api.getSubjectTypes().subscribe({ next: (res) => this.subjectTypes.set(res.data), error: () => undefined });
    this.loadMatrices();
  }

  loadMatrices(): void {
    this.api.getMatrices({ per_page: 100 }).subscribe({ next: (res) => this.matrices.set(res.data), error: () => undefined });
  }

  newMatrix(): void {
    this.draft.set(emptyMatrix(this.draft().subject_type, nextPriority(this.matrices())));
    this.errors.set([]);
    this.result.set(null);
  }

  edit(matrix: WorkflowApprovalMatrix): void {
    this.draft.set(toEditable(matrix));
    this.errors.set([]);
    this.result.set(null);
  }

  /** Applies an edit to a deep copy of the draft, so every change publishes a new value. */
  mutate(edit: (matrix: EditableMatrix) => void): void {
    this.draft.update((current) => {
      const copy = structuredClone(current);
      edit(copy);
      return copy;
    });
    if (this.errors().length > 0) {
      this.errors.set(validateMatrix(this.draft()));
    }
  }

  // --- edits (each returns the function that mutate() applies) ---
  setText(key: 'code' | 'name' | 'subject_type' | 'currency' | 'fallbackValue', value: string): (m: EditableMatrix) => void {
    return (m) => {
      m[key] = value;
    };
  }
  setNumber(key: 'priority' | 'auto_approve_below', value: number | null): (m: EditableMatrix) => void {
    return (m) => {
      if (key === 'priority') {
        m.priority = value ?? 0;
      } else {
        m.auto_approve_below = value ?? null;
      }
    };
  }
  setFlag(key: 'is_active' | 'is_default', value: boolean): (m: EditableMatrix) => void {
    return (m) => {
      m[key] = value;
    };
  }
  setFallbackType(value: EditableMatrix['fallbackType'] | null): (m: EditableMatrix) => void {
    return (m) => {
      m.fallbackType = value ?? null;
    };
  }
  addCondition(): (m: EditableMatrix) => void {
    return (m) => {
      m.conditions.push(emptyCondition());
    };
  }
  removeCondition(index: number): (m: EditableMatrix) => void {
    return (m) => {
      m.conditions.splice(index, 1);
    };
  }
  setCondition(index: number, key: 'field' | 'operator' | 'valueText', value: string): (m: EditableMatrix) => void {
    return (m) => {
      (m.conditions[index] as unknown as Record<string, string>)[key] = value;
    };
  }
  addTier(): (m: EditableMatrix) => void {
    return (m) => {
      m.tiers.push(emptyTier(nextTierLevel(m.tiers)));
    };
  }
  removeTier(index: number): (m: EditableMatrix) => void {
    return (m) => {
      m.tiers.splice(index, 1);
    };
  }
  setTier(index: number, key: keyof WorkflowMatrixTier, value: string | number | null): (m: EditableMatrix) => void {
    return (m) => {
      (m.tiers[index] as unknown as Record<string, unknown>)[key] = value;
    };
  }

  patchSim(key: keyof SimulationInput, value: string | number | boolean | null): void {
    this.sim.update((current) => ({ ...current, [key]: value }));
  }

  save(): void {
    const problems = validateMatrix(this.draft());
    this.errors.set(problems);
    if (problems.length > 0) {
      return;
    }
    const payload = toRequest(this.draft());
    const id = this.draft().id;
    this.saving.set(true);
    const request = id ? this.api.updateMatrix(id, payload) : this.api.createMatrix(payload);
    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.draft.set(toEditable(res.data));
        this.loadMatrices();
        this.notify('success', 'workflows.matrix.saved');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        // 422 carries the field errors of the API in the user's language.
        const detail = error instanceof HttpErrorResponse && error.status === 422 ? error.error?.message : null;
        this.errors.set([typeof detail === 'string' && detail !== '' ? detail : 'workflows.matrix.saveError']);
      },
    });
  }

  /** Simulates the selected (saved) matrix, or the matrices of the document type when the draft is new. */
  simulate(): void {
    const draft = this.draft();
    if (draft.subject_type === '') {
      this.errors.set(['workflows.matrix.error.nameRequired']);
      return;
    }
    const sim = this.sim();
    this.simulating.set(true);
    this.api
      .simulateMatrix({
        subject_type: draft.subject_type,
        matrix_id: draft.id,
        attributes: {
          amount: sim.amount,
          currency: sim.currency.toUpperCase(),
          cost_center_id: sim.cost_center_id || undefined,
          category: sim.category || undefined,
          discount_percent: sim.discount_percent ?? undefined,
          new_supplier: sim.new_supplier,
        },
      })
      .subscribe({
        next: (res) => {
          this.simulating.set(false);
          this.result.set(res.data);
        },
        error: () => {
          this.simulating.set(false);
          this.notify('error', 'workflows.matrix.simulate.error');
        },
      });
  }

  private notify(level: 'success' | 'error', key: string): void {
    this.message[level](this.i18n.translate(key));
  }
}
