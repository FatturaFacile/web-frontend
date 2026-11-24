import { Component, computed, inject, signal } from '@angular/core';
import { HrLeaveApiService, LeaveTypeResource, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudOption, crudPage, isRowsQuery } from '../shared/crud/crud.types';
import { LeaveBalancesComponent } from './leave-balances.component';
import { LeaveCalendarComponent } from './leave-calendar.component';

type Row = { id: string } & Record<string, unknown>;

const CATEGORIES = [
  'vacation',
  'sick',
  'maternity',
  'paternity',
  'parental',
  'unpaid',
  'rol',
  'study',
  'bereavement',
  'military',
  'accident',
  'other',
];
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contractor', 'apprentice', 'seasonal'];

/** Leave administration: types, accrual policies, balances and the leave calendar. */
@Component({
  selector: 'app-hr-leave',
  styleUrl: './leave.component.scss',
  imports: [
    NzCardModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    CrudTableComponent,
    LeaveBalancesComponent,
    LeaveCalendarComponent,
  ],
  template: `
    <app-page-header [title]="'hrmLeave.title' | translate" [subtitle]="'hrmLeave.subtitle' | translate" />
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmLeave.calendar' | translate">
          <app-leave-calendar />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmLeave.balances' | translate">
          <app-leave-balances [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmLeave.types' | translate">
          <app-crud-table [config]="typesConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmLeave.policies' | translate">
          <app-crud-table [config]="policiesConfig()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
  `,
})
export class LeaveComponent {
  private readonly api = inject(HrLeaveApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('hr'));
  private readonly leaveTypes = signal<LeaveTypeResource[]>([]);
  private readonly typeOptions = computed<CrudOption[]>(() =>
    this.leaveTypes().map((t) => ({ value: t.id, label: `${t.code} - ${t.name}` })),
  );

  /** The select options of the policies need every leave type, not the filtered page of the grid. */
  private loadLeaveTypes(): void {
    this.api.getLeaveTypes().subscribe({ next: (res) => this.leaveTypes.set(res.data) });
  }

  protected readonly typesConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmLeave.types',
    canWrite: this.canWrite(),
    gridList: (query) => {
      if (isRowsQuery(query)) {
        this.loadLeaveTypes();
      }
      return crudPage(this.api.getLeaveTypes(query));
    },
    create: (payload) => this.api.createLeaveType(payload as never),
    update: (id, payload) => this.api.updateLeaveType(id, payload as never),
    fields: [
      { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 60 },
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 150 },
      {
        key: 'category',
        labelKey: 'hrmLeave.category',
        type: 'select',
        required: true,
        options: () => CATEGORIES.map((value) => ({ value, labelKey: `hrmLeave.categoryValue.${value}` })),
      },
      { key: 'is_paid', labelKey: 'hrmLeave.isPaid', type: 'boolean', defaultValue: true },
      {
        key: 'requires_approval',
        labelKey: 'hrmLeave.requiresApproval',
        type: 'boolean',
        defaultValue: true,
      },
      { key: 'requires_attachment', labelKey: 'hrmLeave.requiresAttachment', type: 'boolean', column: false },
      { key: 'annual_entitlement_hours', labelKey: 'hrmLeave.annualEntitlement', type: 'decimal', required: true },
      {
        key: 'accrual_frequency',
        labelKey: 'hrmLeave.accrualFrequency',
        type: 'select',
        defaultValue: 'monthly',
        options: () => ['monthly', 'yearly', 'none'].map((value) => ({ value, labelKey: `hrmLeave.frequency.${value}` })),
      },
      { key: 'max_carryover_hours', labelKey: 'hrmLeave.maxCarryover', type: 'decimal', column: false },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
    ],
  }));

  protected readonly policiesConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmLeave.policies',
    canWrite: this.canWrite(),
    gridList: (query) => {
      if (isRowsQuery(query)) {
        this.loadLeaveTypes();
      }
      return crudPage(this.api.getAccrualPolicies(query));
    },
    create: (payload) => this.api.createAccrualPolicy(payload as never),
    update: (id, payload) => this.api.updateAccrualPolicy(id, payload as never),
    remove: (id) => this.api.deleteAccrualPolicy(id),
    fields: [
      { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 40 },
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 150 },
      {
        key: 'leave_type_id',
        labelKey: 'hrmCommon.type',
        type: 'select',
        required: true,
        options: () => this.typeOptions(),
      },
      {
        key: 'employment_type',
        labelKey: 'hrmLeave.employmentType',
        type: 'select',
        nullable: true,
        options: () => EMPLOYMENT_TYPES.map((value) => ({ value, label: value })),
      },
      { key: 'annual_entitlement_hours', labelKey: 'hrmLeave.annualEntitlement', type: 'decimal', required: true },
      {
        key: 'accrual_frequency',
        labelKey: 'hrmLeave.accrualFrequency',
        type: 'select',
        defaultValue: 'monthly',
        options: () => ['monthly', 'yearly'].map((value) => ({ value, labelKey: `hrmLeave.frequency.${value}` })),
      },
      { key: 'prorate_by_fte', labelKey: 'hrmLeave.prorateByFte', type: 'boolean', defaultValue: true },
      { key: 'max_balance_hours', labelKey: 'hrmLeave.maxBalance', type: 'decimal', nullable: true, column: false },
      { key: 'max_carryover_hours', labelKey: 'hrmLeave.maxCarryover', type: 'decimal', nullable: true, column: false },
      { key: 'valid_from', labelKey: 'hrmCommon.from', type: 'date', required: true },
      { key: 'valid_to', labelKey: 'hrmCommon.to', type: 'date', nullable: true, notBefore: 'valid_from' },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
    ],
  }));
}
