import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { applyServerErrors, AuthStore, I18nService, PermissionsService, ProjectControlApiService, ProjectMilestone } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';

@Component({
  selector: 'app-pc-milestones',
  imports: [FormsModule, ReactiveFormsModule, NzAlertModule, NzButtonModule, NzFormModule, NzInputModule, NzInputNumberModule, NzModalModule, NzTableModule, NzTagModule, MoneyPipe, TranslatePipe],
  template: `
    @if (canWrite) {
      <button nz-button nzType="primary" type="button" (click)="openModal(null)">{{ 'PRJ.MILESTONE_NEW' | translate }}</button>
    }
    <nz-table #table nzSize="middle" [nzData]="items()" [nzLoading]="loading()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'PRJ.NAME' | translate }}</th>
          <th>{{ 'PRJ.DATE' | translate }}</th>
          <th nzAlign="right">{{ 'PRJ.BILLING_AMOUNT' | translate }}</th>
          <th nzAlign="right">{{ 'PRJ.BILLING_PERCENTAGE' | translate }}</th>
          <th>{{ 'PRJ.STATUS' | translate }}</th>
          <th>{{ 'PRJ.ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (milestone of table.data; track milestone.id) {
          <tr>
            <td>{{ milestone.name }}</td>
            <td>{{ milestone.milestone_date }}</td>
            <td nzAlign="right">{{ milestone.billing_amount | money: currency() }}</td>
            <td nzAlign="right">{{ milestone.billing_percentage }}%</td>
            <td>
              <nz-tag [nzColor]="milestone.is_completed ? 'green' : 'default'">{{ (milestone.is_completed ? 'PRJ.COMPLETED' : 'PRJ.PLANNED') | translate }}</nz-tag>
              @if (milestone.is_billed) {
                <nz-tag nzColor="blue">{{ 'PRJ.BILLED' | translate }}</nz-tag>
              }
            </td>
            <td>
              @if (canWrite) {
                @if (!milestone.is_billed) {
                  <button nz-button nzSize="small" type="button" (click)="openModal(milestone)">{{ 'PRJ.EDIT' | translate }}</button>
                }
                @if (!milestone.is_completed) {
                  <button nz-button nzSize="small" type="button" (click)="complete(milestone)">{{ 'PRJ.COMPLETE' | translate }}</button>
                }
                @if (milestone.is_completed && !milestone.is_billed) {
                  <button nz-button nzSize="small" nzType="primary" type="button" (click)="billTarget.set(milestone)">{{ 'PRJ.BILL' | translate }}</button>
                }
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="'PRJ.MILESTONE_FORM' | translate" [nzOkLoading]="saving()" (nzOnOk)="save()" (nzOnCancel)="modalOpen.set(false)">
      <ng-container *nzModalContent>
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ms-name">{{ 'PRJ.NAME' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.name.errors?.['serverError'] ?? ('PRJ.REQUIRED' | translate)"><input id="ms-name" nz-input formControlName="name" maxlength="255" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ms-date">{{ 'PRJ.DATE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.milestone_date.errors?.['serverError'] ?? ('PRJ.REQUIRED' | translate)"><input id="ms-date" nz-input type="date" formControlName="milestone_date" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ms-amount">{{ 'PRJ.BILLING_AMOUNT' | translate }}</nz-form-label>
            <nz-form-control><nz-input-number id="ms-amount" formControlName="billing_amount" [nzMin]="0" [nzPrecision]="2" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ms-percentage">{{ 'PRJ.BILLING_PERCENTAGE' | translate }}</nz-form-label>
            <nz-form-control><nz-input-number id="ms-percentage" formControlName="billing_percentage" [nzMin]="0" [nzMax]="100" [nzPrecision]="2" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="billTarget() !== null" [nzTitle]="'PRJ.BILL' | translate" (nzOnOk)="bill()" (nzOnCancel)="billTarget.set(null)">
      <ng-container *nzModalContent>
        <p>{{ 'PRJ.BILL_HINT' | translate }}</p>
        <label for="ms-tax">{{ 'PRJ.TAX_RATE' | translate }}</label>
        <nz-input-number id="ms-tax" [(ngModel)]="taxRate" [nzMin]="0" [nzMax]="100" [nzPrecision]="2" />
      </ng-container>
    </nz-modal>
  `,
})
export class PcMilestonesComponent implements OnInit {
  readonly projectId = input.required<string>();

  private readonly api = inject(ProjectControlApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  protected readonly items = signal<ProjectMilestone[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly billTarget = signal<ProjectMilestone | null>(null);
  protected taxRate = 22;
  private editingId: string | null = null;

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    milestone_date: this.fb.control('', Validators.required),
    billing_amount: this.fb.control<number | null>(null),
    billing_percentage: this.fb.control<number | null>(null),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getMilestones(this.projectId()).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openModal(milestone: ProjectMilestone | null): void {
    this.editingId = milestone?.id ?? null;
    this.formErrors.set([]);
    this.form.reset({
      name: milestone?.name ?? '',
      milestone_date: milestone?.milestone_date?.slice(0, 10) ?? '',
      billing_amount: milestone ? Number(milestone.billing_amount) : null,
      billing_percentage: milestone ? Number(milestone.billing_percentage) : null,
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      milestone_date: value.milestone_date,
      ...(value.billing_amount !== null ? { billing_amount: value.billing_amount } : {}),
      ...(value.billing_percentage !== null ? { billing_percentage: value.billing_percentage } : {}),
    };
    const id = this.editingId;
    this.saving.set(true);
    (id ? this.api.updateMilestone(id, payload) : this.api.createMilestone(this.projectId(), payload)).subscribe({
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

  protected complete(milestone: ProjectMilestone): void {
    this.api.completeMilestone(milestone.id).subscribe({ next: () => this.load() });
  }

  protected bill(): void {
    const milestone = this.billTarget();
    if (!milestone) {
      return;
    }
    this.api.billMilestone(this.projectId(), milestone.id, { tax_rate: this.taxRate }).subscribe({
      next: (res) => {
        this.billTarget.set(null);
        this.message.success(`${this.i18n.translate('PRJ.INVOICE_CREATED')} ${res.data.invoice_number ?? ''}`);
        this.load();
      },
    });
  }
}
