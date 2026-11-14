import { Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { applyServerErrors, AuthStore, FetchGridModel, I18nService, PermissionsService, ProjectControlApiService, ProjectMilestone, QueryFilterParams } from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, TableColumnDef, TranslatePipe } from '@shared';

@Component({
  selector: 'app-pc-milestones',
  styleUrl: './pc-milestones.component.scss',
  imports: [
    BaseTableComponent,
    FormsModule, ReactiveFormsModule, NzAlertModule, NzButtonModule, NzFormModule, NzInputModule, NzInputNumberModule, NzModalModule, ModalActionsDirective, IconActionDirective, NzTagModule, MoneyPipe, TranslatePipe],
  template: `
    @if (canWrite) {
      <button nz-button nzType="primary" type="button" class="mb-4" appIconAction="create" (click)="openModal(null)"></button>
    }
    <app-base-table [grid]="grid" [columns]="columns()" [actionsTemplate]="actionsTpl" exportFileName="project-milestones" />
    <ng-template #amountTpl let-milestone>{{ milestone.billing_amount | money: currency() }}</ng-template>
    <ng-template #percentageTpl let-milestone>{{ milestone.billing_percentage }}%</ng-template>
    <ng-template #statusTpl let-milestone>
      <nz-tag [nzColor]="milestone.is_completed ? 'green' : 'default'">{{ (milestone.is_completed ? 'PRJ.COMPLETED' : 'PRJ.PLANNED') | translate }}</nz-tag>
      @if (milestone.is_billed) {
        <nz-tag nzColor="blue">{{ 'PRJ.BILLED' | translate }}</nz-tag>
      }
    </ng-template>
    <ng-template #actionsTpl let-milestone>
      @if (canWrite) {
        @if (!milestone.is_billed) {
          <button nz-button nzSize="small" type="button" appIconAction="edit" (click)="openModal(milestone)"></button>
        }
        @if (!milestone.is_completed) {
          <button nz-button nzSize="small" type="button" (click)="complete(milestone)">{{ 'PRJ.COMPLETE' | translate }}</button>
        }
        @if (milestone.is_completed && !milestone.is_billed) {
          <button nz-button nzSize="small" nzType="primary" type="button" (click)="billTarget.set(milestone)">{{ 'PRJ.BILL' | translate }}</button>
        }
      }
    </ng-template>

    <nz-modal [nzVisible]="modalOpen()" [nzTitle]="'PRJ.MILESTONE_FORM' | translate" [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" okAction="save" (nzOnOk)="save()" (nzOnCancel)="modalOpen.set(false)">
      <ng-container *nzModalContent>
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" class="mb-3" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ms-name">{{ 'PRJ.NAME' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.name.errors?.['serverError'] ?? ('PRJ.REQUIRED' | translate)"><input id="ms-name" nz-input formControlName="name" maxlength="150" /></nz-form-control>
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

    <nz-modal [nzVisible]="billTarget() !== null" [nzTitle]="'PRJ.BILL' | translate" [nzOkDisabled]="taxRate === null" (nzOnOk)="bill()" (nzOnCancel)="billTarget.set(null)">
      <ng-container *nzModalContent>
        <p>{{ 'PRJ.BILL_HINT' | translate }}</p>
        <label for="ms-tax">{{ 'PRJ.TAX_RATE' | translate }}</label>
        <nz-input-number id="ms-tax" [(ngModel)]="taxRate" [nzMin]="0" [nzMax]="100" [nzPrecision]="2" />
      </ng-container>
    </nz-modal>
  `,
})
export class PcMilestonesComponent {
  readonly projectId = input.required<string>();

  private readonly api = inject(ProjectControlApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  /** Milestones of the project: paging, sorting, filters and grouping run on the API. */
  protected readonly grid = new FetchGridModel<ProjectMilestone, QueryFilterParams>((query) => this.api.getMilestones(this.projectId(), query));

  private readonly amountTpl = viewChild<TemplateRef<{ $implicit: ProjectMilestone; value: unknown }>>('amountTpl');
  private readonly percentageTpl = viewChild<TemplateRef<{ $implicit: ProjectMilestone; value: unknown }>>('percentageTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: ProjectMilestone; value: unknown }>>('statusTpl');

  private milestoneState(milestone: ProjectMilestone): string {
    return milestone.is_billed ? 'billed' : milestone.is_completed ? 'completed' : 'planned';
  }

  protected readonly columns = computed<TableColumnDef<ProjectMilestone>[]>(() => {
    this.i18n.currentLanguage();
    const label = (state: string): string => this.i18n.translate({ billed: 'PRJ.BILLED', completed: 'PRJ.COMPLETED' }[state] ?? 'PRJ.PLANNED');
    return [
      { key: 'name', header: 'PRJ.NAME' },
      { key: 'milestone_date', header: 'PRJ.DATE' },
      { key: 'billing_amount', header: 'PRJ.BILLING_AMOUNT', align: 'right', customCellTemplate: this.amountTpl() },
      { key: 'billing_percentage', header: 'PRJ.BILLING_PERCENTAGE', align: 'right', customCellTemplate: this.percentageTpl() },
      {
        key: 'state',
        header: 'PRJ.STATUS',
        valueGetter: (milestone) => label(this.milestoneState(milestone)),
        valueLabel: label,
        customCellTemplate: this.statusTpl(),
      },
    ];
  });
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly billTarget = signal<ProjectMilestone | null>(null);
  protected taxRate: number | null = 22;
  private editingId: string | null = null;

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    milestone_date: this.fb.control('', Validators.required),
    billing_amount: this.fb.control<number | null>(null),
    billing_percentage: this.fb.control<number | null>(null),
  });

  protected load(): void {
    this.grid.reload();
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
    if (!milestone || this.taxRate === null) {
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
