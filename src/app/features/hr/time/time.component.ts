import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AuthStore, EmployeeResource, HrApiService, HrTimeApiService, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudOption, crudPage } from '../shared/crud/crud.types';
import { TimeClosingsComponent } from './time-closings.component';
import { TimeMealsComponent } from './time-meals.component';
import { TimePayrollViewComponent } from './time-payroll-view.component';
import { TimePresenceComponent } from './time-presence.component';
import { TimePunchImportComponent } from './time-punch-import.component';
import { TimeScheduleGroupsComponent } from './time-schedule-groups.component';
import { TimeReportComponent } from './time-report.component';

type Row = { id: string } & Record<string, unknown>;

const EVENT_TYPES = ['In', 'Out', 'BreakStart', 'BreakEnd'];
const SOURCES = ['badge', 'terminal', 'web', 'mobile', 'spreadsheet', 'paper', 'manual'];

/** Time tracking (`/hr/time/*`): events, report, monthly closings, overtime rules, audit trail. */
@Component({
  selector: 'app-hr-time',
  styleUrl: './time.component.scss',
  imports: [
    NzAlertModule,
    NzCardModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    CrudTableComponent,
    TimeClosingsComponent,
    TimeMealsComponent,
    TimePayrollViewComponent,
    TimePresenceComponent,
    TimePunchImportComponent,
    TimeReportComponent,
    TimeScheduleGroupsComponent,
  ],
  template: `
    <app-page-header [title]="'hrmTime.title' | translate" [subtitle]="'hrmTime.subtitle' | translate" />
    <nz-card>
      <nz-alert nzType="info" nzShowIcon class="mb-3" [nzMessage]="'hrmTime.closedMonthHint' | translate" />
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmTime.events' | translate">
          <app-crud-table [config]="eventsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTime.report' | translate">
          <app-time-report [employees]="employees()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTime.closings' | translate">
          <app-time-closings [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTime.overtimeRules' | translate">
          <app-crud-table [config]="overtimeConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTimeX.presenceTab' | translate">
          <app-time-presence />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTimeX.payrollViewTab' | translate">
          <app-time-payroll-view [employees]="employeeOptions()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTimeX.groupsTab' | translate">
          <app-time-schedule-groups [canWrite]="canWrite()" [employees]="employeeOptions()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTimeX.punchTab' | translate">
          <app-time-punch-import [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTimeX.mealsTab' | translate">
          <app-time-meals [canWrite]="canWrite()" [employees]="employeeOptions()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTime.audit' | translate">
          <app-crud-table [config]="auditConfig()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
  `,
})
export class TimeComponent implements OnInit {
  private readonly api = inject(HrTimeApiService);
  private readonly hrApi = inject(HrApiService);
  private readonly permissions = inject(PermissionsService);
  private readonly authStore = inject(AuthStore);

  protected readonly canWrite = computed(() => this.permissions.canWrite('hr'));
  protected readonly employees = signal<EmployeeResource[]>([]);
  protected readonly employeeOptions = computed<CrudOption[]>(() =>
    this.employees().map((e) => ({ value: e.id, label: `${e.employee_number} - ${e.full_name}` })),
  );

  protected readonly eventsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmTime.events',
    canWrite: this.canWrite(),
    gridList: (query) => crudPage(this.api.getEvents(query)),
    create: (payload) => this.api.createEvent(payload as never),
    update: (id, payload) => this.api.updateEvent(id, payload as never),
    remove: (id, reason) => this.api.deleteEvent(id, reason ?? ''),
    removeWithReason: true,
    isReadonly: (row) => Boolean(row['deleted_by']),
    fields: [
      {
        key: 'employee_id',
        serverKey: 'user_id',
        labelKey: 'hrmCommon.employee',
        type: 'select',
        createOnly: true,
        nullable: true,
        options: () => this.employeeOptions(),
      },
      {
        key: 'event_type',
        labelKey: 'hrmTime.eventType',
        type: 'select',
        required: true,
        options: () => EVENT_TYPES.map((value) => ({ value, labelKey: `hrmTime.eventTypeValue.${value}` })),
      },
      { key: 'occurred_at', labelKey: 'hrmTime.occurredAt', type: 'datetime', notInFuture: true },
      {
        key: 'source',
        labelKey: 'hrmTime.source',
        type: 'select',
        defaultValue: 'manual',
        options: () => SOURCES.map((value) => ({ value, labelKey: `hrmTime.sourceValue.${value}` })),
      },
      { key: 'note', labelKey: 'hrmCommon.notes', type: 'text', nullable: true, maxLength: 1000 },
      {
        key: 'reason',
        labelKey: 'hrmCommon.reason',
        type: 'text',
        // API: always on a correction; on a new event when the time is given or it is recorded for another employee.
        requiredWhen: (values, editing) =>
          editing ||
          String(values['occurred_at'] ?? '').trim() !== '' ||
          (String(values['employee_id'] ?? '').trim() !== '' && values['employee_id'] !== this.authStore.user()?.id),
        minLength: 3,
        maxLength: 1000,
        column: false,
      },
    ],
  }));

  protected readonly overtimeConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmTime.overtimeRules',
    canWrite: this.canWrite(),
    gridList: (query) => crudPage(this.api.getOvertimeRules(query)),
    create: (payload) => this.api.createOvertimeRule(payload as never),
    update: (id, payload) => this.api.updateOvertimeRule(id, payload as never),
    remove: (id) => this.api.deleteOvertimeRule(id),
    fields: [
      { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 40 },
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 150 },
      {
        key: 'basis',
        labelKey: 'hrmTime.basis',
        type: 'select',
        required: true,
        options: () => ['daily', 'weekly'].map((value) => ({ value, labelKey: `hrmTime.basisValue.${value}` })),
      },
      { key: 'threshold_minutes', labelKey: 'hrmTime.thresholdMinutes', type: 'integer', required: true, min: 0, max: 10080 },
      { key: 'premium_percent', labelKey: 'hrmTime.premiumPercent', type: 'decimal', required: true, min: 0, max: 500 },
      { key: 'wage_type_code', labelKey: 'hrmEmp.wageTypeCode', type: 'text', nullable: true, maxLength: 20 },
      { key: 'priority', labelKey: 'hrmTime.priority', type: 'integer', min: 0, max: 1000 },
      { key: 'valid_from', labelKey: 'hrmCommon.from', type: 'date', nullable: true },
      { key: 'valid_to', labelKey: 'hrmCommon.to', type: 'date', nullable: true, notBefore: 'valid_from' },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
    ],
  }));

  protected readonly auditConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmTime.audit',
    canWrite: false,
    gridList: (query) => crudPage(this.api.getAudit(query)),
    fields: [
      { key: 'occurred_at', labelKey: 'hrmCommon.date', type: 'text' },
      { key: 'actor_name', labelKey: 'hrmTime.actor', type: 'text' },
      { key: 'action', labelKey: 'hrmTime.action', type: 'text' },
      { key: 'entity_type', labelKey: 'hrmTime.entity', type: 'text' },
      { key: 'reason', labelKey: 'hrmCommon.reason', type: 'text' },
    ],
  }));

  ngOnInit(): void {
    this.hrApi.getEmployees({ per_page: 100 }).subscribe({ next: (res) => this.employees.set(res.data) });
  }
}
