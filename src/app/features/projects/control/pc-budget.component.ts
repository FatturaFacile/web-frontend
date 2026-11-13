import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { applyServerErrors, AuthStore, PermissionsService, ProjectBudget, ProjectControlApiService } from '@core';
import { IconActionDirective, ModalActionsDirective, MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';

/** Budget of a project: category report, versions, revision, approval and baseline. */
@Component({
  selector: 'app-pc-budget',
  styleUrl: './pc-budget.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    FormsModule, ReactiveFormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzFormModule, NzInputModule, NzInputNumberModule, NzModalModule, ModalActionsDirective, NzTableModule, NzTagModule, MoneyPipe, TranslatePipe],
  template: `
    <div class="row mb-4">
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openRevision()">{{ 'PRJ.BUDGET_REVISE' | translate }}</button>
        @if (budget(); as b) {
          @if (b.status !== 'approved') {
            <button nz-button type="button" (click)="approve()">{{ 'PRJ.APPROVE' | translate }}</button>
            <button nz-button nzDanger type="button" (click)="rejectOpen.set(true)">{{ 'PRJ.REJECT' | translate }}</button>
          } @else {
            <button nz-button type="button" (click)="baseline()">{{ 'PRJ.BUDGET_BASELINE' | translate }}</button>
          }
        }
      }
    </div>

    @if (budget(); as b) {
      <p>
        <nz-tag>{{ b.status }}</nz-tag>
        <nz-tag>v{{ b.current_version_number }}</nz-tag>
        {{ 'PRJ.BUDGET_REVENUE' | translate }}: <strong>{{ b.total_revenue_budget | money: currency() }}</strong> -
        {{ 'PRJ.BUDGET_COST' | translate }}: <strong>{{ b.total_cost_budget | money: currency() }}</strong> -
        {{ 'PRJ.BUDGET_MARGIN' | translate }}: <strong>{{ b.projected_margin_amount | money: currency() }} ({{ b.projected_margin_percentage }}%)</strong>
      </p>
      @if (b.category_report; as report) {
        <nz-table #categoryTable nzSize="small" [nzData]="report.categories" [nzShowPagination]="false">
          <thead>
            <tr>
              <th [nzSortFn]="'category' | gridSort">{{ 'PRJ.CATEGORY' | translate }}</th>
              <th nzAlign="right" [nzSortFn]="'budget' | gridSort">{{ 'PRJ.BUDGET' | translate }}</th>
              <th nzAlign="right" [nzSortFn]="'committed' | gridSort">{{ 'PRJ.COMMITTED' | translate }}</th>
              <th nzAlign="right" [nzSortFn]="'actual' | gridSort">{{ 'PRJ.ACTUAL' | translate }}</th>
              <th nzAlign="right" [nzSortFn]="'available' | gridSort">{{ 'PRJ.AVAILABLE' | translate }}</th>
              <th nzAlign="right">{{ 'PRJ.CONSUMED' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of categoryTable.data; track row.category) {
              <tr>
                <td>{{ row.category }}</td>
                <td nzAlign="right">{{ row.budget | money: currency() }}</td>
                <td nzAlign="right">{{ row.committed | money: currency() }}</td>
                <td nzAlign="right">{{ row.actual | money: currency() }}</td>
                <td nzAlign="right">{{ row.available | money: currency() }}</td>
                <td nzAlign="right">{{ row.consumed_percentage ?? '' }}{{ row.consumed_percentage ? '%' : '' }}</td>
              </tr>
            }
            <tr>
              <td><strong>{{ 'PRJ.TOTAL' | translate }}</strong></td>
              <td nzAlign="right"><strong>{{ report.totals.budget | money: currency() }}</strong></td>
              <td nzAlign="right"><strong>{{ report.totals.committed | money: currency() }}</strong></td>
              <td nzAlign="right"><strong>{{ report.totals.actual | money: currency() }}</strong></td>
              <td nzAlign="right"><strong>{{ report.totals.available | money: currency() }}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </nz-table>
      }
      @if (b.versions && b.versions.length > 0) {
        <h4 class="mt-4">{{ 'PRJ.BUDGET_VERSIONS' | translate }}</h4>
        <nz-table #versionTable nzSize="small" [nzData]="b.versions" [nzShowPagination]="false">
          <thead>
            <tr>
              <th [nzSortFn]="'version_number' | gridSort">#</th>
              <th>{{ 'PRJ.REASON' | translate }}</th>
              <th nzAlign="right" [nzSortFn]="'total_revenue_budget' | gridSort">{{ 'PRJ.BUDGET_REVENUE' | translate }}</th>
              <th nzAlign="right" [nzSortFn]="'total_cost_budget' | gridSort">{{ 'PRJ.BUDGET_COST' | translate }}</th>
              <th>{{ 'PRJ.BASELINE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (version of versionTable.data; track version.version_number) {
              <tr>
                <td>{{ version.version_number }}</td>
                <td>{{ version.revision_reason ?? '' }}</td>
                <td nzAlign="right">{{ version.total_revenue_budget | money: currency() }}</td>
                <td nzAlign="right">{{ version.total_cost_budget | money: currency() }}</td>
                <td>{{ (version.is_baseline ? 'PRJ.YES' : 'PRJ.NO') | translate }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    } @else {
      <nz-alert nzType="info" nzShowIcon [nzMessage]="'PRJ.NO_BUDGET' | translate" />
    }

    <nz-modal [nzVisible]="revisionOpen()" [nzTitle]="'PRJ.BUDGET_REVISE' | translate" [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" okAction="save" (nzOnOk)="saveRevision()" (nzOnCancel)="revisionOpen.set(false)">
      <ng-container *nzModalContent>
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" class="mb-3" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          @for (field of fields; track field.control) {
            <nz-form-item>
              <nz-form-label [nzRequired]="field.control === 'total_revenue_budget'" [nzFor]="'bg-' + field.control">{{ field.labelKey | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="'PRJ.REQUIRED' | translate">
                <nz-input-number [id]="'bg-' + field.control" [formControlName]="field.control" [nzMin]="0" [nzPrecision]="2" />
              </nz-form-control>
            </nz-form-item>
          }
          <nz-form-item>
            <nz-form-label nzFor="bg-reason">{{ 'PRJ.REASON' | translate }}</nz-form-label>
            <nz-form-control><input id="bg-reason" nz-input formControlName="revision_reason" maxlength="500" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="rejectOpen()" [nzTitle]="'PRJ.REJECT' | translate" [nzOkDanger]="true" [nzOkDisabled]="!rejectReason.trim()" (nzOnOk)="reject()" (nzOnCancel)="rejectOpen.set(false)">
      <ng-container *nzModalContent>
        <label for="bg-reject">{{ 'PRJ.REJECTION_REASON' | translate }}</label>
        <textarea id="bg-reject" nz-input rows="3" [(ngModel)]="rejectReason"></textarea>
      </ng-container>
    </nz-modal>
  `,
})
export class PcBudgetComponent implements OnInit {
  readonly projectId = input.required<string>();

  private readonly api = inject(ProjectControlApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  protected readonly budget = signal<ProjectBudget | null>(null);
  protected readonly saving = signal(false);
  protected readonly revisionOpen = signal(false);
  protected readonly rejectOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected rejectReason = '';

  protected readonly fields = [
    { control: 'total_revenue_budget', labelKey: 'PRJ.BUDGET_REVENUE' },
    { control: 'labour_budget', labelKey: 'PRJ.BUDGET_LABOUR' },
    { control: 'material_budget', labelKey: 'PRJ.BUDGET_MATERIAL' },
    { control: 'supplier_budget', labelKey: 'PRJ.BUDGET_SUPPLIER' },
    { control: 'fleet_budget', labelKey: 'PRJ.BUDGET_FLEET' },
    { control: 'expense_budget', labelKey: 'PRJ.BUDGET_EXPENSE' },
    { control: 'contingency_budget', labelKey: 'PRJ.BUDGET_CONTINGENCY' },
  ] as const;

  protected readonly form = this.fb.group({
    total_revenue_budget: this.fb.control<number | null>(null, Validators.required),
    labour_budget: this.fb.control<number | null>(null),
    material_budget: this.fb.control<number | null>(null),
    supplier_budget: this.fb.control<number | null>(null),
    fleet_budget: this.fb.control<number | null>(null),
    expense_budget: this.fb.control<number | null>(null),
    contingency_budget: this.fb.control<number | null>(null),
    revision_reason: this.fb.control(''),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api.getBudget(this.projectId()).subscribe({
      next: (res) => this.budget.set(res.data),
      error: () => this.budget.set(null),
    });
  }

  protected openRevision(): void {
    this.formErrors.set([]);
    this.form.reset();
    this.revisionOpen.set(true);
  }

  protected saveRevision(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .saveBudget(this.projectId(), { ...value, total_revenue_budget: value.total_revenue_budget ?? 0, revision_reason: value.revision_reason || null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.revisionOpen.set(false);
          this.load();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.formErrors.set(applyServerErrors(this.form, err));
        },
      });
  }

  protected approve(): void {
    this.api.approveBudget(this.projectId()).subscribe({ next: () => this.load() });
  }

  protected baseline(): void {
    this.api.baselineBudget(this.projectId()).subscribe({ next: () => this.load() });
  }

  protected reject(): void {
    this.api.rejectBudget(this.projectId(), this.rejectReason.trim()).subscribe({
      next: () => {
        this.rejectOpen.set(false);
        this.load();
      },
    });
  }
}
