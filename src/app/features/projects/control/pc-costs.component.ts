import { Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  FetchGridModel,
  I18nService,
  PermissionsService,
  ProjectControlApiService,
  ProjectCostEntry,
  ProjectExpenseCategory,
  QueryFilterParams,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, TableColumnDef, TranslatePipe } from '@shared';

const EXPENSE_CATEGORIES: ProjectExpenseCategory[] = [
  'travel_lodging',
  'meals_subsistence',
  'licensing_permits',
  'site_rentals',
  'laboratory_testing',
  'expense',
  'subcontractor',
  'equipment',
];

@Component({
  selector: 'app-pc-costs',
  styleUrl: './pc-costs.component.scss',
  imports: [
    BaseTableComponent,
    FormsModule, ReactiveFormsModule, NzAlertModule, NzButtonModule, NzFormModule, NzInputModule, NzInputNumberModule, NzModalModule, ModalActionsDirective, IconActionDirective, NzSelectModule, NzSwitchModule, NzTagModule, MoneyPipe, TranslatePipe],
  template: `
    <div class="row mb-4">
      <nz-select class="w-field-md" nzAllowClear [attr.aria-label]="'PRJ.APPROVAL_STATUS' | translate" [nzPlaceHolder]="'PRJ.APPROVAL_STATUS' | translate" [(ngModel)]="approvalFilter" (ngModelChange)="onApprovalFilterChange($event)">
        <nz-option nzValue="pending" [nzLabel]="'PRJ.APPROVAL_PENDING' | translate" />
        <nz-option nzValue="approved" [nzLabel]="'PRJ.APPROVAL_APPROVED' | translate" />
        <nz-option nzValue="rejected" [nzLabel]="'PRJ.APPROVAL_REJECTED' | translate" />
      </nz-select>
      <span class="grow"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" appIconAction="create" (click)="openModal()"></button>
      }
    </div>

    <app-base-table [grid]="grid" [columns]="columns()" [actionsTemplate]="actionsTpl" exportFileName="project-costs" />
    <ng-template #totalTpl let-cost>{{ cost.total_cost | money: currency() }}</ng-template>
    <ng-template #billableTpl let-cost>{{ (cost.is_billable ? 'PRJ.YES' : 'PRJ.NO') | translate }}</ng-template>
    <ng-template #approvalTpl let-cost>
      <nz-tag>{{ cost.approval_status }}</nz-tag>
      @if (cost.rejection_reason) {
        <div class="text-muted text-xs">{{ cost.rejection_reason }}</div>
      }
    </ng-template>
    <ng-template #actionsTpl let-cost>
      @if (canWrite && cost.approval_status === 'pending') {
        <button nz-button nzSize="small" nzType="primary" type="button" (click)="approve(cost)">{{ 'PRJ.APPROVE' | translate }}</button>
        <button nz-button nzSize="small" nzDanger type="button" (click)="rejectTarget.set(cost)">{{ 'PRJ.REJECT' | translate }}</button>
      }
    </ng-template>

    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="'PRJ.EXPENSE_NEW' | translate" [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" okAction="create" (nzOnOk)="save()" (nzOnCancel)="modalOpen.set(false)">
      <ng-container *nzModalContent>
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" class="mb-3" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ex-category">{{ 'PRJ.CATEGORY' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select id="ex-category" formControlName="expense_category">
                @for (category of categories; track category) {
                  <nz-option [nzValue]="category" [nzLabel]="'PRJ.EXPENSE_' + category.toUpperCase() | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ex-description">{{ 'PRJ.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.description.errors?.['serverError'] ?? ('PRJ.REQUIRED' | translate)"><input id="ex-description" nz-input formControlName="description" maxlength="200" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ex-amount">{{ 'PRJ.AMOUNT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.amount.errors?.['serverError'] ?? ('PRJ.REQUIRED' | translate)"><nz-input-number id="ex-amount" formControlName="amount" [nzMin]="0.01" [nzPrecision]="2" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ex-date">{{ 'PRJ.DATE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.incurred_date.errors?.['serverError'] ?? ('PRJ.REQUIRED' | translate)"><input id="ex-date" nz-input type="date" formControlName="incurred_date" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ex-billable">{{ 'PRJ.BILLABLE' | translate }}</nz-form-label>
            <nz-form-control><nz-switch id="ex-billable" formControlName="is_billable" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="rejectTarget() !== null" [nzTitle]="'PRJ.REJECT' | translate" [nzOkDanger]="true" [nzOkDisabled]="!rejectReason.trim()" (nzOnOk)="reject()" (nzOnCancel)="rejectTarget.set(null)">
      <ng-container *nzModalContent>
        <label for="ex-reject">{{ 'PRJ.REJECTION_REASON' | translate }}</label>
        <textarea id="ex-reject" nz-input rows="3" [(ngModel)]="rejectReason"></textarea>
      </ng-container>
    </nz-modal>
  `,
})
export class PcCostsComponent {
  readonly projectId = input.required<string>();

  private readonly api = inject(ProjectControlApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  protected readonly categories = EXPENSE_CATEGORIES;
  private readonly i18n = inject(I18nService);

  /** Cost entries of the project: paging, sorting, filters and grouping run on the API. */
  protected readonly grid = new FetchGridModel<ProjectCostEntry, QueryFilterParams & { approval_status?: string }>((query) =>
    this.api.getCosts(this.projectId(), query),
  );

  private readonly totalTpl = viewChild<TemplateRef<{ $implicit: ProjectCostEntry; value: unknown }>>('totalTpl');
  private readonly billableTpl = viewChild<TemplateRef<{ $implicit: ProjectCostEntry; value: unknown }>>('billableTpl');
  private readonly approvalTpl = viewChild<TemplateRef<{ $implicit: ProjectCostEntry; value: unknown }>>('approvalTpl');

  protected readonly columns = computed<TableColumnDef<ProjectCostEntry>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'incurred_date', header: 'PRJ.DATE' },
      { key: 'cost_category', header: 'PRJ.CATEGORY' },
      { key: 'description', header: 'PRJ.DESCRIPTION' },
      { key: 'total_cost', header: 'PRJ.TOTAL', align: 'right', customCellTemplate: this.totalTpl() },
      {
        key: 'is_billable',
        serverKey: 'billable',
        header: 'PRJ.BILLABLE',
        valueGetter: (cost) => this.i18n.translate(cost.is_billable ? 'PRJ.YES' : 'PRJ.NO'),
        valueLabel: (value) => this.i18n.translate(value === 'yes' ? 'PRJ.YES' : 'PRJ.NO'),
        customCellTemplate: this.billableTpl(),
      },
      { key: 'approval_status', header: 'PRJ.APPROVAL_STATUS', customCellTemplate: this.approvalTpl() },
    ];
  });
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly rejectTarget = signal<ProjectCostEntry | null>(null);
  protected approvalFilter: string | null = null;
  protected rejectReason = '';

  protected readonly form = this.fb.group({
    expense_category: this.fb.control<ProjectExpenseCategory>('expense', Validators.required),
    description: this.fb.control('', [Validators.required, Validators.maxLength(200)]),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    incurred_date: this.fb.control('', Validators.required),
    is_billable: this.fb.control(false),
  });

  protected load(): void {
    this.grid.reload();
  }

  protected onApprovalFilterChange(status: string | null): void {
    this.approvalFilter = status;
    this.grid.setFilter({ approval_status: status ?? undefined });
  }

  protected openModal(): void {
    this.formErrors.set([]);
    this.form.reset({ expense_category: 'expense', is_billable: false });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api.createExpense(this.projectId(), { ...value, amount: value.amount ?? 0 }).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }

  protected approve(cost: ProjectCostEntry): void {
    this.api.approveExpense(cost.id).subscribe({ next: () => this.load() });
  }

  protected reject(): void {
    const cost = this.rejectTarget();
    if (!cost) {
      return;
    }
    this.api.rejectExpense(cost.id, this.rejectReason.trim()).subscribe({
      next: () => {
        this.rejectTarget.set(null);
        this.rejectReason = '';
        this.load();
      },
    });
  }
}
