import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  DepartmentResource,
  EmployeeResource,
  HrApiService,
  HrEmployeeApiService,
  HrShiftApiService,
  PermissionsService,
  ShiftSequenceRecord,
  ShiftTypeRecord,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { map, of, tap } from 'rxjs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudOption } from '../shared/crud/crud.types';
import { ShiftBoardComponent } from './shift-board.component';

type Row = { id: string } & Record<string, unknown>;

const PATTERNS = ['rotation', 'weekly_without_sunday', 'weekly_without_weekend', 'manual'];
const DAY_KINDS = ['weekday', 'weekend', 'holiday'];

/** Shift planning: board, shift types, rotation sequences, exceptions and staffing needs. */
@Component({
  selector: 'app-hr-shifts',
  imports: [NzCardModule, NzTabsModule, PageHeaderComponent, TranslatePipe, CrudTableComponent, ShiftBoardComponent],
  template: `
    <app-page-header [title]="'hrmShift.title' | translate" [subtitle]="'hrmShift.subtitle' | translate" />
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmShift.board' | translate">
          <app-shift-board [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmShift.place' | translate">
          <app-crud-table [config]="placeConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmShift.types' | translate">
          <app-crud-table [config]="typesConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmShift.sequences' | translate">
          <app-crud-table [config]="sequencesConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmShift.assignments' | translate">
          <app-crud-table [config]="assignmentsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmShift.exceptions' | translate">
          <app-crud-table [config]="exceptionsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmShift.staffing' | translate">
          <app-crud-table [config]="staffingConfig()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
  `,
})
export class ShiftsComponent implements OnInit {
  private readonly api = inject(HrShiftApiService);
  private readonly hrApi = inject(HrApiService);
  private readonly orgApi = inject(HrEmployeeApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('hr'));
  private readonly employees = signal<EmployeeResource[]>([]);
  private readonly departments = signal<DepartmentResource[]>([]);
  private readonly shiftTypes = signal<ShiftTypeRecord[]>([]);
  private readonly sequences = signal<ShiftSequenceRecord[]>([]);

  private readonly employeeOptions = computed<CrudOption[]>(() =>
    this.employees().map((e) => ({ value: e.id, label: `${e.employee_number} - ${e.full_name}` })),
  );
  private readonly departmentOptions = computed<CrudOption[]>(() =>
    this.departments().map((d) => ({ value: d.id, label: `${d.code} - ${d.name}` })),
  );
  private readonly typeOptions = computed<CrudOption[]>(() =>
    this.shiftTypes().map((t) => ({ value: t.id, label: `${t.code} - ${t.name}` })),
  );
  private readonly sequenceOptions = computed<CrudOption[]>(() =>
    this.sequences().map((s) => ({ value: s.id, label: s.name })),
  );

  /** Create-only forms: the API has no list for these resources. */
  private createOnly(titleKey: string, fields: CrudConfig<Row>['fields'], create: (p: Record<string, unknown>) => unknown): CrudConfig<Row> {
    return {
      titleKey,
      canWrite: this.canWrite(),
      list: () => of([] as Row[]),
      create: (payload) => create(payload) as ReturnType<NonNullable<CrudConfig<Row>['create']>>,
      fields,
    };
  }

  protected readonly placeConfig = computed(() =>
    this.createOnly(
      'hrmShift.place',
      [
        { key: 'employee_id', labelKey: 'hrmCommon.employee', type: 'select', required: true, options: () => this.employeeOptions() },
        { key: 'shift_type_id', labelKey: 'hrmShift.shiftType', type: 'select', required: true, options: () => this.typeOptions() },
        { key: 'work_date', labelKey: 'hrmCommon.date', type: 'date', required: true },
        { key: 'note', labelKey: 'hrmCommon.notes', type: 'text', nullable: true },
      ],
      (payload) => this.api.placeShift(payload as never),
    ),
  );

  protected readonly typesConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmShift.types',
    canWrite: this.canWrite(),
    list: () =>
      this.api.getShiftTypes().pipe(
        tap((res) => this.shiftTypes.set(res.data)),
        map((res) => res.data as unknown as Row[]),
      ),
    create: (payload) => this.api.createShiftType(payload as never),
    update: (id, payload) => this.api.updateShiftType(id, payload as never),
    fields: [
      { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 20 },
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 120 },
      {
        key: 'category',
        labelKey: 'hrmSelfService.category',
        type: 'select',
        required: true,
        options: () => ['working', 'absence', 'on_call'].map((value) => ({ value, labelKey: `hrmShift.category.${value}` })),
      },
      { key: 'start_time', labelKey: 'hrmShift.startTime', type: 'text', nullable: true },
      { key: 'end_time', labelKey: 'hrmShift.endTime', type: 'text', nullable: true },
      { key: 'break_minutes', labelKey: 'hrmShift.breakMinutes', type: 'integer', column: false },
      { key: 'is_paid_absence', labelKey: 'hrmShift.paidAbsence', type: 'boolean', column: false },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
    ],
  }));

  protected readonly sequencesConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmShift.sequences',
    canWrite: this.canWrite(),
    list: () =>
      this.api.getShiftSequences().pipe(
        tap((res) => this.sequences.set(res.data)),
        map((res) => res.data as unknown as Row[]),
      ),
    create: (payload) =>
      this.api.createShiftSequence({
        ...(payload as never as Record<string, unknown>),
        steps: String(payload['steps'] ?? '')
          .split(',')
          .map((step) => step.trim())
          .map((step) => (step === '' || step === '-' ? null : step)),
      } as never),
    fields: [
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 120 },
      {
        key: 'pattern',
        labelKey: 'hrmShift.pattern',
        type: 'select',
        required: true,
        options: () => PATTERNS.map((value) => ({ value, labelKey: `hrmShift.patternValue.${value}` })),
      },
      { key: 'steps', labelKey: 'hrmShift.steps', type: 'text', required: true, column: false },
      { key: 'skip_holidays', labelKey: 'hrmShift.skipHolidays', type: 'boolean' },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
    ],
  }));

  protected readonly assignmentsConfig = computed(() =>
    this.createOnly(
      'hrmShift.assignments',
      [
        { key: 'employee_id', labelKey: 'hrmCommon.employee', type: 'select', required: true, options: () => this.employeeOptions() },
        { key: 'shift_sequence_id', labelKey: 'hrmShift.sequence', type: 'select', required: true, options: () => this.sequenceOptions() },
        { key: 'start_date', labelKey: 'hrmCommon.from', type: 'date', required: true },
        { key: 'end_date', labelKey: 'hrmCommon.to', type: 'date', nullable: true },
        { key: 'offset_days', labelKey: 'hrmShift.offsetDays', type: 'integer' },
      ],
      (payload) => this.api.assignShiftSequence(payload as never),
    ),
  );

  protected readonly exceptionsConfig = computed(() =>
    this.createOnly(
      'hrmShift.exceptions',
      [
        { key: 'exception_date', labelKey: 'hrmCommon.date', type: 'date', required: true },
        { key: 'employee_id', labelKey: 'hrmCommon.employee', type: 'select', nullable: true, options: () => this.employeeOptions() },
        { key: 'department_id', labelKey: 'hrmOrg.department', type: 'select', nullable: true, options: () => this.departmentOptions() },
        { key: 'shift_type_id', labelKey: 'hrmShift.shiftType', type: 'select', nullable: true, options: () => this.typeOptions() },
        { key: 'reason', labelKey: 'hrmCommon.reason', type: 'text', nullable: true },
      ],
      (payload) => this.api.addShiftException(payload as never),
    ),
  );

  protected readonly staffingConfig = computed(() =>
    this.createOnly(
      'hrmShift.staffing',
      [
        { key: 'department_id', labelKey: 'hrmOrg.department', type: 'select', required: true, options: () => this.departmentOptions() },
        { key: 'shift_type_id', labelKey: 'hrmShift.shiftType', type: 'select', required: true, options: () => this.typeOptions() },
        {
          key: 'day_kind',
          labelKey: 'hrmShift.dayKind',
          type: 'select',
          required: true,
          options: () => DAY_KINDS.map((value) => ({ value, labelKey: `hrmShift.dayKindValue.${value}` })),
        },
        { key: 'required_count', labelKey: 'hrmShift.requiredCount', type: 'integer', required: true },
        { key: 'valid_from', labelKey: 'hrmCommon.from', type: 'date', required: true },
        { key: 'valid_to', labelKey: 'hrmCommon.to', type: 'date', nullable: true },
      ],
      (payload) => this.api.setStaffingNeed(payload as never),
    ),
  );

  ngOnInit(): void {
    this.hrApi.getEmployees({ per_page: 100 }).subscribe({ next: (res) => this.employees.set(res.data) });
    this.orgApi.getDepartments().subscribe({ next: (res) => this.departments.set(res.data) });
    this.api.getShiftTypes().subscribe({ next: (res) => this.shiftTypes.set(res.data) });
    this.api.getShiftSequences().subscribe({ next: (res) => this.sequences.set(res.data) });
  }
}
