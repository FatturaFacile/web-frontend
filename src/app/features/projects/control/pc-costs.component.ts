import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  PermissionsService,
  ProjectControlApiService,
  ProjectCostEntry,
  ProjectExpenseCategory,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';

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
  imports: [FormsModule, ReactiveFormsModule, NzAlertModule, NzButtonModule, NzFormModule, NzInputModule, NzInputNumberModule, NzModalModule, NzSelectModule, NzSwitchModule, NzTableModule, NzTagModule, MoneyPipe, TranslatePipe],
  template: `
    <div>
      <nz-select nzAllowClear [attr.aria-label]="'PRJ.APPROVAL_STATUS' | translate" [nzPlaceHolder]="'PRJ.APPROVAL_STATUS' | translate" [(ngModel)]="approvalFilter" (ngModelChange)="load()">
        <nz-option nzValue="pending" [nzLabel]="'PRJ.APPROVAL_PENDING' | translate" />
        <nz-option nzValue="approved" [nzLabel]="'PRJ.APPROVAL_APPROVED' | translate" />
        <nz-option nzValue="rejected" [nzLabel]="'PRJ.APPROVAL_REJECTED' | translate" />
      </nz-select>
      <span></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openModal()">{{ 'PRJ.EXPENSE_NEW' | translate }}</button>
      }
    </div>

    <nz-table #table nzSize="middle" [nzData]="items()" [nzLoading]="loading()" [nzPageSize]="20">
      <thead>
        <tr>
          <th>{{ 'PRJ.DATE' | translate }}</th>
          <th>{{ 'PRJ.CATEGORY' | translate }}</th>
          <th>{{ 'PRJ.DESCRIPTION' | translate }}</th>
          <th nzAlign="right">{{ 'PRJ.TOTAL' | translate }}</th>
          <th>{{ 'PRJ.BILLABLE' | translate }}</th>
          <th>{{ 'PRJ.APPROVAL_STATUS' | translate }}</th>
          <th>{{ 'PRJ.ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (cost of table.data; track cost.id) {
          <tr>
            <td>{{ cost.incurred_date }}</td>
            <td>{{ cost.cost_category }}</td>
            <td>{{ cost.description }}</td>
            <td nzAlign="right">{{ cost.total_cost | money: currency() }}</td>
            <td>{{ (cost.is_billable ? 'PRJ.YES' : 'PRJ.NO') | translate }}</td>
            <td>
              <nz-tag>{{ cost.approval_status }}</nz-tag>
              @if (cost.rejection_reason) {
                <div class="muted">{{ cost.rejection_reason }}</div>
              }
            </td>
            <td>
              @if (canWrite && cost.approval_status === 'pending') {
                <button nz-button nzSize="small" nzType="primary" type="button" (click)="approve(cost)">{{ 'PRJ.APPROVE' | translate }}</button>
                <button nz-button nzSize="small" nzDanger type="button" (click)="rejectTarget.set(cost)">{{ 'PRJ.REJECT' | translate }}</button>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="'PRJ.EXPENSE_NEW' | translate" [nzOkLoading]="saving()" (nzOnOk)="save()" (nzOnCancel)="modalOpen.set(false)">
      <ng-container *nzModalContent>
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" />
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
            <nz-form-control [nzErrorTip]="form.controls.description.errors?.['serverError'] ?? ('PRJ.REQUIRED' | translate)"><input id="ex-description" nz-input formControlName="description" maxlength="255" /></nz-form-control>
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
export class PcCostsComponent implements OnInit {
  readonly projectId = input.required<string>();

  private readonly api = inject(ProjectControlApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  protected readonly categories = EXPENSE_CATEGORIES;
  protected readonly items = signal<ProjectCostEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly rejectTarget = signal<ProjectCostEntry | null>(null);
  protected approvalFilter: string | null = null;
  protected rejectReason = '';

  protected readonly form = this.fb.group({
    expense_category: this.fb.control<ProjectExpenseCategory>('expense', Validators.required),
    description: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    incurred_date: this.fb.control('', Validators.required),
    is_billable: this.fb.control(false),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getCosts(this.projectId(), { approval_status: this.approvalFilter ?? undefined }).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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
