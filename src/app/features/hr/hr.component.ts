import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import {
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  EmployeeResource,
  EmploymentType,
  FetchGridModel,
  FrontierWorkerResource,
  HireEmployeePayload,
  HrApiService,
  HrLeaveApiService,
  LeaveTypeResource,
  I18nService,
  LeaveRequestResource,
  PayrollRunResource,
  QueryFilterParams,
  SubmitLeaveRequestPayload,
  SubmitTimesheetPayload,
  TerminateEmployeePayload,
  TimesheetResource,
  TranslateService,
} from '@core';
import {
  BaseTableComponent,
  GridFilterFnPipe,
  GridFilterListPipe,
  GridSortPipe,
  IconActionDirective,
  ModalActionsDirective,
  MoneyPipe,
  PageHeaderComponent,
  TableColumnDef,
  TranslatePipe,
} from '@shared';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { toIsoDate } from '@shared/utils/iso-date';
import { uuidFormat } from '@shared/utils/uuid-validator';
import { validationTipKey } from '@shared/utils/validation-tip';
import { reportHttpError } from './shared/hr-http.util';
import { ReasonButtonComponent } from './shared/reason-button.component';

/** Employment types accepted by the API (HireEmployeeRequest `in:`), with their label key. */
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contractor', 'apprentice', 'seasonal'] as const;

/** Contract types accepted by the API (HireEmployeeRequest `in:`), labels in hrmEmp.contractType.*. */
const CONTRACT_TYPES = ['permanent', 'fixed_term', 'apprenticeship', 'contractor', 'internship'] as const;

@Component({
  selector: 'app-hr',
  styleUrl: './hr.component.scss',
  imports: [
    BaseTableComponent,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    IconActionDirective,
    ModalActionsDirective,
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    UpperCasePipe,
    MoneyPipe,
    TranslatePipe,
    ReasonButtonComponent,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzTabsModule,
    NzGridModule,
    NzStatisticModule,
    NzModalModule,
    NzFormModule,
    NzDividerModule,
    PageHeaderComponent,
  ],
  templateUrl: './hr.component.html',
})
export class HrComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly api = inject(HrApiService);
  private readonly leaveApi = inject(HrLeaveApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly employmentTypes = EMPLOYMENT_TYPES;
  protected readonly contractTypes = CONTRACT_TYPES;
  readonly leaveTypes = signal<LeaveTypeResource[]>([]);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly selectedTab = signal<number>(0);

  // --- Employees State: a server-driven grid (paging, sorting, filters and grouping over the whole dataset) ---
  readonly employeesGrid = new FetchGridModel<EmployeeResource, QueryFilterParams & { status?: string }>((query) =>
    this.api.getEmployees(query),
  );
  /** Rows of the loaded page. */
  readonly employees = computed(() => this.employeesGrid.items());
  readonly employeesSearch = signal('');
  readonly employeesStatusFilter = signal<string | null>(null);

  // --- Leave Requests State ---
  readonly leavesGrid = new FetchGridModel<LeaveRequestResource>((query) => this.api.getLeaveRequests(query));
  readonly leaveRequests = computed(() => this.leavesGrid.items());

  // --- Timesheets State ---
  readonly timesheetsGrid = new FetchGridModel<TimesheetResource>((query) => this.api.getTimesheets(query));

  // --- Payroll & Frontier State ---
  readonly payrollGrid = new FetchGridModel<PayrollRunResource>((query) => this.api.getPayrollRuns(query));
  /** The frontier workers are assessed in PHP for one year (not a list endpoint): the table stays client-side. */
  readonly frontierWorkers = signal<FrontierWorkerResource[]>([]);
  readonly loadingFrontier = signal(false);

  private readonly employeeNumberTpl = viewChild<TemplateRef<unknown>>('employeeNumberTpl');
  private readonly employeeNameTpl = viewChild<TemplateRef<unknown>>('employeeNameTpl');
  private readonly employmentTypeTpl = viewChild<TemplateRef<unknown>>('employmentTypeTpl');
  private readonly employmentStatusTpl = viewChild<TemplateRef<unknown>>('employmentStatusTpl');
  private readonly salaryTpl = viewChild<TemplateRef<unknown>>('salaryTpl');
  private readonly hireDateTpl = viewChild<TemplateRef<unknown>>('hireDateTpl');
  private readonly leaveNumberTpl = viewChild<TemplateRef<unknown>>('leaveNumberTpl');
  private readonly leaveEmployeeTpl = viewChild<TemplateRef<unknown>>('leaveEmployeeTpl');
  private readonly leaveTypeTpl = viewChild<TemplateRef<unknown>>('leaveTypeTpl');
  private readonly leaveStartTpl = viewChild<TemplateRef<unknown>>('leaveStartTpl');
  private readonly leaveEndTpl = viewChild<TemplateRef<unknown>>('leaveEndTpl');
  private readonly leaveHoursTpl = viewChild<TemplateRef<unknown>>('leaveHoursTpl');
  private readonly leaveReasonTpl = viewChild<TemplateRef<unknown>>('leaveReasonTpl');
  private readonly leaveStatusTpl = viewChild<TemplateRef<unknown>>('leaveStatusTpl');
  private readonly timesheetNumberTpl = viewChild<TemplateRef<unknown>>('timesheetNumberTpl');
  private readonly timesheetEmployeeTpl = viewChild<TemplateRef<unknown>>('timesheetEmployeeTpl');
  private readonly timesheetDateTpl = viewChild<TemplateRef<unknown>>('timesheetDateTpl');
  private readonly timesheetRegularTpl = viewChild<TemplateRef<unknown>>('timesheetRegularTpl');
  private readonly timesheetOvertimeTpl = viewChild<TemplateRef<unknown>>('timesheetOvertimeTpl');
  private readonly timesheetTotalTpl = viewChild<TemplateRef<unknown>>('timesheetTotalTpl');
  private readonly timesheetBillableTpl = viewChild<TemplateRef<unknown>>('timesheetBillableTpl');
  private readonly timesheetStatusTpl = viewChild<TemplateRef<unknown>>('timesheetStatusTpl');
  private readonly payrollPeriodTpl = viewChild<TemplateRef<unknown>>('payrollPeriodTpl');
  private readonly payrollCountryTpl = viewChild<TemplateRef<unknown>>('payrollCountryTpl');
  private readonly payrollGrossTpl = viewChild<TemplateRef<unknown>>('payrollGrossTpl');
  private readonly payrollNetTpl = viewChild<TemplateRef<unknown>>('payrollNetTpl');
  private readonly payrollStatusTpl = viewChild<TemplateRef<unknown>>('payrollStatusTpl');
  private readonly payrollDateTpl = viewChild<TemplateRef<unknown>>('payrollDateTpl');

  readonly employeeColumns = computed<TableColumnDef<EmployeeResource>[]>(() => {
    return [
      { key: 'employee_number', header: 'hrmEmp.lblMatricola', customCellTemplate: this.employeeNumberTpl() },
      { key: 'full_name', header: 'hrmEmp.lblDipendente', customCellTemplate: this.employeeNameTpl() },
      { key: 'work_email', header: 'hrmEmp.lblEmailAziendale' },
      { key: 'employment_type', header: 'hrmEmp.lblTipoContratto', customCellTemplate: this.employmentTypeTpl() },
      { key: 'employment_status', header: 'hrmEmp.lblStato', customCellTemplate: this.employmentStatusTpl() },
      { key: 'base_annual_salary', header: 'hrmEmp.lblRalRetribuzione', align: 'right', customCellTemplate: this.salaryTpl() },
      { key: 'hire_date', header: 'hrmEmp.lblDataAssunzione', customCellTemplate: this.hireDateTpl() },
    ];
  });

  readonly leaveColumns = computed<TableColumnDef<LeaveRequestResource>[]>(() => {
    return [
      { key: 'request_number', header: 'hrmEmp.lblNRichiesta', customCellTemplate: this.leaveNumberTpl() },
      { key: 'employee_name', serverKey: 'employee.full_name', header: 'hrmEmp.lblIdDipendente', customCellTemplate: this.leaveEmployeeTpl() },
      { key: 'leave_type_name', serverKey: 'leaveType.name', header: 'hrmEmp.lblTipologia', customCellTemplate: this.leaveTypeTpl() },
      { key: 'start_date', header: 'hrmEmp.lblDataInizio', customCellTemplate: this.leaveStartTpl() },
      { key: 'end_date', header: 'hrmEmp.lblDataFine', customCellTemplate: this.leaveEndTpl() },
      { key: 'total_hours', header: 'hrmEmp.lblOreGiorni', align: 'right', customCellTemplate: this.leaveHoursTpl() },
      { key: 'reason', header: 'hrmEmp.lblMotivazione', customCellTemplate: this.leaveReasonTpl() },
      { key: 'status', header: 'hrmEmp.lblStato', customCellTemplate: this.leaveStatusTpl() },
    ];
  });

  readonly timesheetColumns = computed<TableColumnDef<TimesheetResource>[]>(() => {
    return [
      { key: 'timesheet_number', header: 'hrmEmp.lblNRapporto', customCellTemplate: this.timesheetNumberTpl() },
      { key: 'employee_name', serverKey: 'employee.full_name', header: 'hrmEmp.lblDipendente', customCellTemplate: this.timesheetEmployeeTpl() },
      { key: 'work_date', header: 'hrmEmp.lblDataLavorativa', customCellTemplate: this.timesheetDateTpl() },
      { key: 'regular_hours', header: 'hrmEmp.lblOreOrdinarie', align: 'right', customCellTemplate: this.timesheetRegularTpl() },
      { key: 'overtime_hours', header: 'hrmEmp.lblStraordinari', align: 'right', customCellTemplate: this.timesheetOvertimeTpl() },
      { key: 'total_hours', header: 'hrmEmp.lblTotaleOre', align: 'right', customCellTemplate: this.timesheetTotalTpl() },
      { key: 'billable_hours', header: 'hrmEmp.lblFatturabili', align: 'right', customCellTemplate: this.timesheetBillableTpl() },
      { key: 'status', header: 'hrmEmp.lblStato', customCellTemplate: this.timesheetStatusTpl() },
    ];
  });

  readonly payrollColumns = computed<TableColumnDef<PayrollRunResource>[]>(() => {
    return [
      { key: 'month', header: 'hrmEmp.lblPeriodoElaborazione', customCellTemplate: this.payrollPeriodTpl() },
      { key: 'country', header: 'hrmEmp.lblNazione', customCellTemplate: this.payrollCountryTpl() },
      { key: 'employees_count', header: 'hrmEmp.lblDipendentiElaborati', align: 'right' },
      { key: 'total_gross', header: 'hrmEmp.lblMonteRetributivoLordo', align: 'right', customCellTemplate: this.payrollGrossTpl() },
      { key: 'total_net', header: 'hrmEmp.lblTotaleNettoErogato', align: 'right', customCellTemplate: this.payrollNetTpl() },
      { key: 'status', header: 'hrmEmp.lblStato', customCellTemplate: this.payrollStatusTpl() },
      { key: 'created_at', header: 'hrmEmp.lblDataCalcolo', customCellTemplate: this.payrollDateTpl() },
    ];
  });

  // --- KPI Computed Metrics ---
  readonly kpiTotalEmployees = computed(() => this.employeesGrid.totalCount());
  readonly kpiActiveEmployees = computed(
    () => this.employees().filter((e) => e.employment_status === 'active').length
  );
  readonly kpiProbationEmployees = computed(
    () => this.employees().filter((e) => e.employment_status === 'probation').length
  );
  readonly kpiPendingLeaves = computed(
    () => this.leavesGrid.items().filter((l) => l.status === 'pending').length
  );

  // --- Modals & Forms ---
  readonly isHireModalVisible = signal(false);
  readonly isSubmittingHire = signal(false);
  readonly hireForm = this.fb.group({
    first_name: ['', [Validators.required, Validators.maxLength(100)]],
    last_name: ['', [Validators.required, Validators.maxLength(100)]],
    work_email: ['', [Validators.required, Validators.email, Validators.maxLength(180)]],
    base_annual_salary: [30000, [Validators.required, Validators.min(0)]],
    hire_date: [new Date() as Date | null],
    employment_type: ['full_time' as EmploymentType],
    contract_type: ['permanent' as (typeof CONTRACT_TYPES)[number]],
    weekly_hours: [40, [Validators.min(1), Validators.max(60)]],
    probation_months: [6, [Validators.min(0), Validators.max(12)]],
  });

  readonly isLeaveModalVisible = signal(false);
  readonly isSubmittingLeave = signal(false);
  readonly leaveForm = this.fb.group({
    employee_id: ['', [Validators.required, uuidFormat]],
    leave_type_id: ['', [Validators.required, uuidFormat]],
    start_date: [new Date(), [Validators.required]],
    end_date: [new Date(Date.now() + 5 * 86400000), [Validators.required, endsNotBefore('start_date')]],
    total_hours: [40, [Validators.required, Validators.min(0.5), Validators.max(2000)]],
    reason: ['', Validators.maxLength(1000)],
  });

  readonly isTimesheetModalVisible = signal(false);
  readonly isSubmittingTimesheet = signal(false);
  readonly timesheetForm = this.fb.group({
    employee_id: ['', [Validators.required, uuidFormat]],
    work_date: [new Date(), [Validators.required]],
    regular_hours: [8, [Validators.required, Validators.min(0), Validators.max(24)]],
    overtime_hours: [0, [Validators.min(0), Validators.max(24)]],
    billable_hours: [8, [Validators.min(0), Validators.max(24)]],
    description: ['', Validators.maxLength(1000)],
  });

  constructor() {
    revalidateOnStartChange(this.leaveForm, 'start_date', 'end_date', this.destroyRef);
  }

  /** Error text of a control of one of the modal forms, from the shared validation keys. */
  fieldError(form: FormGroup, key: string): string {
    return this.i18n.translate(validationTipKey(form.get(key)) || 'COMMON.VALIDATION.INVALID_VALUE');
  }

  ngOnInit(): void {
    this.loadFrontierWorkers();
  }

  // --- Employees Logic ---

  setEmployeesSearch(value: string): void {
    this.employeesSearch.set(value);
    this.employeesGrid.setFilter({ search: value.trim() || undefined });
  }

  setEmployeesStatus(value: string | null): void {
    this.employeesStatusFilter.set(value);
    this.employeesGrid.setFilter({ status: value ?? undefined });
  }

  openHireModal(): void {
    this.hireForm.reset({
      contract_type: 'permanent',
      first_name: '',
      last_name: '',
      work_email: '',
      base_annual_salary: 30000,
      hire_date: new Date(),
      employment_type: 'full_time',
      weekly_hours: 40,
      probation_months: 6,
    });
    this.isHireModalVisible.set(true);
  }

  submitHire(): void {
    if (this.hireForm.invalid) {
      this.hireForm.markAllAsTouched();
      return;
    }

    this.isSubmittingHire.set(true);
    const val = this.hireForm.getRawValue();
    const payload: HireEmployeePayload = {
      first_name: val.first_name,
      last_name: val.last_name,
      work_email: val.work_email,
      base_annual_salary: Number(val.base_annual_salary),
      hire_date: val.hire_date
        ? val.hire_date instanceof Date
          ? toIsoDate(val.hire_date)
          : String(val.hire_date)
        : undefined,
      employment_type: val.employment_type || undefined,
      contract_type: val.contract_type || undefined,
      weekly_hours: Number(val.weekly_hours),
      probation_months: Number(val.probation_months),
    };

    this.api.createEmployee(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('hrmEmp.msgNuovoDipendenteAssuntoConSuccesso'));
        this.isSubmittingHire.set(false);
        this.isHireModalVisible.set(false);
        this.employeesGrid.reload();
      },
      error: () => {
        this.message.error(this.translate.instant('hrmEmp.msgErroreDuranteLAssunzioneDelDipendente'));
        this.isSubmittingHire.set(false);
      },
    });
  }

  completeProbation(emp: EmployeeResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('hrmEmp.dlgConfermarePeriodoDiProvaPer', { full_name: emp.full_name }),
      nzContent: this.translate.instant('hrmEmp.dlgLoStatoDiAssunzionePasseraDa'),
      nzOkText: this.translate.instant('hrmEmp.dlgConfermaProva'),
      nzOnOk: () => {
        this.api.completeProbation(emp.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('hrmEmp.msgPeriodoDiProvaConfermato'));
            this.employeesGrid.reload();
          },
          error: () => this.message.error(this.translate.instant('hrmEmp.msgErroreDuranteLaConfermaDellaProva')),
        });
      },
    });
  }

  openEmployeeFile(emp: EmployeeResource): void {
    void this.router.navigate(['/hr/employees', emp.id]);
  }

  promoteEmployee(emp: EmployeeResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('hrmEmp.dlgPromuovereIlDipendente', { full_name: emp.full_name }),
      nzContent: this.translate.instant('hrmEmp.dlgVerraApplicatoUnAumentoRetributivoE'),
      nzOkText: this.translate.instant('hrmEmp.dlgPromuovi'),
      nzOnOk: () => {
        const newSalary = Number(emp.base_annual_salary) * 1.1;
        this.api.promoteEmployee(emp.id, { new_base_annual_salary: Math.round(newSalary) }).subscribe({
          next: () => {
            this.message.success(this.translate.instant('hrmEmp.msgDipendentePromossoConSuccesso'));
            this.employeesGrid.reload();
          },
          error: () => this.message.error(this.translate.instant('hrmEmp.msgErroreDuranteLaPromozione')),
        });
      },
    });
  }

  terminateEmployee(emp: EmployeeResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('hrmEmp.dlgTerminareRapportoCon', { full_name: emp.full_name }),
      nzContent: this.translate.instant('hrmEmp.dlgVerraRegistrataLaDataDiCessazione'),
      nzOkDanger: true,
      nzOkText: this.translate.instant('hrmEmp.dlgTerminaRapporto'),
      nzOnOk: () => {
        const payload: TerminateEmployeePayload = {
          termination_date: toIsoDate(new Date()),
          reason: 'Cessazione consensuale',
        };
        this.api.terminateEmployee(emp.id, payload).subscribe({
          next: () => {
            this.message.success(this.translate.instant('hrmEmp.msgRapportoDiLavoroTerminato'));
            this.employeesGrid.reload();
          },
          error: () => this.message.error(this.translate.instant('hrmEmp.msgErroreDuranteLaCessazioneDelRapporto')),
        });
      },
    });
  }

  // --- Leave Requests Logic ---

  openLeaveModal(): void {
    this.leaveForm.reset({
      employee_id: this.employees()[0]?.id || '',
      leave_type_id: '',
      start_date: new Date(),
      end_date: new Date(Date.now() + 5 * 86400000),
      total_hours: 40,
      reason: '',
    });
    this.isLeaveModalVisible.set(true);
    this.leaveApi.getLeaveTypes().subscribe({
      next: (res) => {
        const types = (res?.data ?? []).filter((type) => type.is_active);
        this.leaveTypes.set(types);
        if (!this.leaveForm.controls.leave_type_id.value) {
          this.leaveForm.controls.leave_type_id.setValue(types[0]?.id ?? '');
        }
      },
      error: () => this.leaveTypes.set([]),
    });
  }

  submitLeaveRequest(): void {
    if (this.leaveForm.invalid) {
      this.leaveForm.markAllAsTouched();
      return;
    }

    this.isSubmittingLeave.set(true);
    const val = this.leaveForm.getRawValue();
    const payload: SubmitLeaveRequestPayload = {
      employee_id: val.employee_id,
      leave_type_id: val.leave_type_id,
      start_date:
        val.start_date instanceof Date
          ? toIsoDate(val.start_date)
          : String(val.start_date),
      end_date:
        val.end_date instanceof Date
          ? toIsoDate(val.end_date)
          : String(val.end_date),
      total_hours: Number(val.total_hours),
      reason: val.reason || null,
    };

    this.api.submitLeaveRequest(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('hrmEmp.msgRichiestaDiFeriePermessoInviata'));
        this.isSubmittingLeave.set(false);
        this.isLeaveModalVisible.set(false);
        this.leavesGrid.reload();
      },
      error: () => {
        this.message.error(this.translate.instant('hrmEmp.msgErroreDuranteLInvioDellaRichiesta'));
        this.isSubmittingLeave.set(false);
      },
    });
  }

  approveLeave(req: LeaveRequestResource): void {
    this.api.approveLeaveRequest(req.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('hrmEmp.msgRichiestaApprovata'));
        this.leavesGrid.reload();
      },
      // 409: a running approval workflow decides, the request cannot be approved manually.
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  cancelLeave(req: LeaveRequestResource, reason: string): void {
    this.api.cancelLeaveRequest(req.id, reason).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('hrmLeave.requestCancelled'));
        this.leavesGrid.reload();
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  rejectLeave(req: LeaveRequestResource): void {
    this.api.rejectLeaveRequest(req.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('hrmEmp.msgRichiestaRifiutata'));
        this.leavesGrid.reload();
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  // --- Timesheets Logic ---

  openTimesheetModal(): void {
    this.timesheetForm.reset({
      employee_id: this.employees()[0]?.id || '',
      work_date: new Date(),
      regular_hours: 8,
      overtime_hours: 0,
      billable_hours: 8,
      description: '',
    });
    this.isTimesheetModalVisible.set(true);
  }

  submitTimesheet(): void {
    if (this.timesheetForm.invalid) {
      this.timesheetForm.markAllAsTouched();
      return;
    }

    this.isSubmittingTimesheet.set(true);
    const val = this.timesheetForm.getRawValue();
    const payload: SubmitTimesheetPayload = {
      employee_id: val.employee_id,
      work_date:
        val.work_date instanceof Date
          ? toIsoDate(val.work_date)
          : String(val.work_date),
      regular_hours: Number(val.regular_hours),
      overtime_hours: Number(val.overtime_hours),
      billable_hours: Number(val.billable_hours),
      description: val.description || null,
    };

    this.api.submitTimesheet(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('hrmEmp.msgPresenzeOreRegistrateConSuccesso'));
        this.isSubmittingTimesheet.set(false);
        this.isTimesheetModalVisible.set(false);
        this.timesheetsGrid.reload();
      },
      error: () => {
        this.message.error(this.translate.instant('hrmEmp.msgErroreDuranteLaRegistrazioneDelleOre'));
        this.isSubmittingTimesheet.set(false);
      },
    });
  }

  approveTimesheet(ts: TimesheetResource): void {
    this.api.approveTimesheet(ts.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('hrmEmp.msgTimesheetApprovato'));
        this.timesheetsGrid.reload();
      },
      error: () => this.message.error(this.translate.instant('hrmEmp.msgErroreDuranteLApprovazioneDelTimesheet')),
    });
  }

  // --- Payroll & Frontier Logic ---

  loadFrontierWorkers(): void {
    this.loadingFrontier.set(true);
    this.api.getFrontierWorkers(new Date().getFullYear()).subscribe({
      next: (res) => {
        this.frontierWorkers.set(res?.data?.workers ?? []);
        this.loadingFrontier.set(false);
      },
      error: () => this.loadingFrontier.set(false),
    });
  }

  // --- Helpers ---

  getEmploymentStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'success';
      case 'probation':
        return 'processing';
      case 'on_leave':
        return 'warning';
      case 'terminated':
        return 'error';
      default:
        return 'default';
    }
  }

  getLeaveStatusColor(status: string): string {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'processing';
      case 'rejected':
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  }
}
