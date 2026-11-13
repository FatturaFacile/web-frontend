import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { applyServerErrors, AuthStore, PermissionsService, ProjectChangeOrder, ProjectControlApiService } from '@core';
import { IconActionDirective, ModalActionsDirective, MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';

@Component({
  selector: 'app-pc-change-orders',
  styleUrl: './pc-change-orders.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    FormsModule, ReactiveFormsModule, NzAlertModule, NzButtonModule, NzFormModule, NzInputModule, NzInputNumberModule, NzModalModule, ModalActionsDirective, IconActionDirective, NzTableModule, NzTagModule, MoneyPipe, TranslatePipe],
  template: `
    @if (canWrite) {
      <button nz-button nzType="primary" type="button" class="mb-4" appIconAction="create" (click)="openModal()"></button>
    }
    <nz-table #table nzSize="middle" [nzData]="items()" [nzLoading]="loading()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th [nzSortFn]="'order_number' | gridSort">{{ 'PRJ.NUMBER' | translate }}</th>
          <th [nzSortFn]="'title' | gridSort">{{ 'PRJ.TITLE' | translate }}</th>
          <th nzAlign="right" [nzSortFn]="'cost_impact_amount' | gridSort">{{ 'PRJ.COST_IMPACT' | translate }}</th>
          <th nzAlign="right" [nzSortFn]="'revenue_impact_amount' | gridSort">{{ 'PRJ.REVENUE_IMPACT' | translate }}</th>
          <th nzAlign="right" [nzSortFn]="'schedule_impact_days' | gridSort">{{ 'PRJ.SCHEDULE_IMPACT' | translate }}</th>
          <th [nzSortFn]="'status' | gridSort">{{ 'PRJ.STATUS' | translate }}</th>
          <th>{{ 'PRJ.ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (order of table.data; track order.id) {
          <tr>
            <td>{{ order.order_number }}</td>
            <td>{{ order.title }}</td>
            <td nzAlign="right">{{ order.cost_impact_amount | money: currency() }}</td>
            <td nzAlign="right">{{ order.revenue_impact_amount | money: currency() }}</td>
            <td nzAlign="right">{{ order.schedule_impact_days }}</td>
            <td>
              <nz-tag>{{ order.status }}</nz-tag>
              @if (order.rejection_reason) {
                <div class="text-muted text-xs">{{ order.rejection_reason }}</div>
              }
            </td>
            <td>
              @if (canWrite && (order.status === 'submitted' || order.status === 'pending_approval')) {
                <button nz-button nzSize="small" nzType="primary" type="button" (click)="approve(order)">{{ 'PRJ.APPROVE' | translate }}</button>
                <button nz-button nzSize="small" nzDanger type="button" (click)="rejectTarget.set(order)">{{ 'PRJ.REJECT' | translate }}</button>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="'PRJ.CHANGE_ORDER_NEW' | translate" [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" okAction="create" (nzOnOk)="save()" (nzOnCancel)="modalOpen.set(false)">
      <ng-container *nzModalContent>
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" class="mb-3" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="co-number">{{ 'PRJ.NUMBER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.order_number.errors?.['serverError'] ?? ('PRJ.REQUIRED' | translate)"><input id="co-number" nz-input formControlName="order_number" maxlength="50" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="co-title">{{ 'PRJ.TITLE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.title.errors?.['serverError'] ?? ('PRJ.REQUIRED' | translate)"><input id="co-title" nz-input formControlName="title" maxlength="255" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="co-scope">{{ 'PRJ.SCOPE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.scope_description.errors?.['serverError'] ?? ('PRJ.REQUIRED' | translate)"><textarea id="co-scope" nz-input rows="3" maxlength="5000" formControlName="scope_description"></textarea></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="co-cost">{{ 'PRJ.COST_IMPACT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.cost_impact_amount.errors?.['serverError'] ?? ('PRJ.REQUIRED' | translate)"><nz-input-number id="co-cost" formControlName="cost_impact_amount" [nzPrecision]="2" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="co-revenue">{{ 'PRJ.REVENUE_IMPACT' | translate }}</nz-form-label>
            <nz-form-control><nz-input-number id="co-revenue" formControlName="revenue_impact_amount" [nzPrecision]="2" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="co-days">{{ 'PRJ.SCHEDULE_IMPACT' | translate }}</nz-form-label>
            <nz-form-control><nz-input-number id="co-days" formControlName="schedule_impact_days" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="rejectTarget() !== null" [nzTitle]="'PRJ.REJECT' | translate" [nzOkDanger]="true" [nzOkDisabled]="!rejectReason.trim()" (nzOnOk)="reject()" (nzOnCancel)="rejectTarget.set(null)">
      <ng-container *nzModalContent>
        <label for="co-reject">{{ 'PRJ.REJECTION_REASON' | translate }}</label>
        <textarea id="co-reject" nz-input rows="3" [(ngModel)]="rejectReason"></textarea>
      </ng-container>
    </nz-modal>
  `,
})
export class PcChangeOrdersComponent implements OnInit {
  readonly projectId = input.required<string>();

  private readonly api = inject(ProjectControlApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  protected readonly items = signal<ProjectChangeOrder[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly rejectTarget = signal<ProjectChangeOrder | null>(null);
  protected rejectReason = '';

  protected readonly form = this.fb.group({
    order_number: this.fb.control('', [Validators.required, Validators.maxLength(50)]),
    title: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    scope_description: this.fb.control('', [Validators.required, Validators.maxLength(5000)]),
    cost_impact_amount: this.fb.control<number | null>(null, Validators.required),
    revenue_impact_amount: this.fb.control<number | null>(null),
    schedule_impact_days: this.fb.control<number | null>(null),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getChangeOrders(this.projectId()).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openModal(): void {
    this.formErrors.set([]);
    this.form.reset();
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api.createChangeOrder(this.projectId(), { ...value, cost_impact_amount: value.cost_impact_amount ?? 0 }).subscribe({
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

  protected approve(order: ProjectChangeOrder): void {
    this.api.approveChangeOrder(order.id).subscribe({ next: () => this.load() });
  }

  protected reject(): void {
    const order = this.rejectTarget();
    if (!order) {
      return;
    }
    this.api.rejectChangeOrder(order.id, this.rejectReason.trim()).subscribe({
      next: () => {
        this.rejectTarget.set(null);
        this.rejectReason = '';
        this.load();
      },
    });
  }
}
