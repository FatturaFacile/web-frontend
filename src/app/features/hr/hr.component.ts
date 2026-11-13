import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
  FrontierWorkerResource,
  HireEmployeePayload,
  HrApiService,
  HrLeaveApiService,
  LeaveTypeResource,
  I18nService,
  LeaveRequestResource,
  PayrollRunResource,
  SubmitLeaveRequestPayload,
  SubmitTimesheetPayload,
  TerminateEmployeePayload,
  TimesheetResource,
  TranslateService,
} from '@core';
import {
  IconActionDirective,
  ModalActionsDirective,
  MoneyPipe,
  PageHeaderComponent,
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

  // --- Employees State ---
  readonly employees = signal<EmployeeResource[]>([]);
  readonly loadingEmployees = signal(false);
  readonly employeesTotal = signal(0);
  readonly employeesPage = signal(1);
  readonly employeesSearch = signal('');
  readonly employeesStatusFilter = signal<string | null>(null);

  // --- Leave Requests State ---
  readonly leaveRequests = signal<LeaveRequestResource[]>([]);
  readonly loadingLeaves = signal(false);
  readonly leavesTotal = signal(0);
  readonly leavesPage = signal(1);

  // --- Timesheets State ---
  readonly timesheets = signal<TimesheetResource[]>([]);
  readonly loadingTimesheets = signal(false);
  readonly timesheetsTotal = signal(0);
  readonly timesheetsPage = signal(1);

  // --- Payroll & Frontier State ---
  readonly payrollRuns = signal<PayrollRunResource[]>([]);
  readonly loadingPayroll = signal(false);
  readonly frontierWorkers = signal<FrontierWorkerResource[]>([]);
  readonly loadingFrontier = signal(false);

  // --- KPI Computed Metrics ---
  readonly kpiTotalEmployees = computed(() => this.employees().length);
  readonly kpiActiveEmployees = computed(
    () => this.employees().filter((e) => e.employment_status === 'active').length
  );
  readonly kpiProbationEmployees = computed(
    () => this.employees().filter((e) => e.employment_status === 'probation').length
  );
  readonly kpiPendingLeaves = computed(
    () => this.leaveRequests().filter((l) => l.status === 'pending').length
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
    this.loadEmployees();
    this.loadLeaveRequests();
    this.loadTimesheets();
    this.loadPayrollRuns();
    this.loadFrontierWorkers();
  }

  // --- Employees Logic ---

  loadEmployees(page = 1): void {
    this.loadingEmployees.set(true);
    this.employeesPage.set(page);

    const params: Record<string, string | number> = {
      page,
      per_page: 15,
    };
    if (this.employeesSearch().trim()) {
      params['search'] = this.employeesSearch().trim();
    }
    if (this.employeesStatusFilter()) {
      params['status'] = this.employeesStatusFilter()!;
    }

    this.api.getEmployees(params).subscribe({
      next: (res) => {
        this.employees.set(res?.data || []);
        this.employeesTotal.set(res?.meta?.total ?? res?.data?.length ?? 0);
        this.loadingEmployees.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('hrmEmp.msgImpossibileCaricareIDipendenti'));
        this.loadingEmployees.set(false);
      },
    });
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
        this.loadEmployees(1);
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
            this.loadEmployees(this.employeesPage());
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
            this.loadEmployees(this.employeesPage());
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
            this.loadEmployees(this.employeesPage());
          },
          error: () => this.message.error(this.translate.instant('hrmEmp.msgErroreDuranteLaCessazioneDelRapporto')),
        });
      },
    });
  }

  // --- Leave Requests Logic ---

  loadLeaveRequests(page = 1): void {
    this.loadingLeaves.set(true);
    this.leavesPage.set(page);
    this.api.getLeaveRequests({ page, per_page: 15 }).subscribe({
      next: (res) => {
        this.leaveRequests.set(res?.data || []);
        this.leavesTotal.set(res?.meta?.total ?? res?.data?.length ?? 0);
        this.loadingLeaves.set(false);
      },
      error: () => this.loadingLeaves.set(false),
    });
  }

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
        this.loadLeaveRequests(1);
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
        this.loadLeaveRequests(this.leavesPage());
      },
      // 409: a running approval workflow decides, the request cannot be approved manually.
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  cancelLeave(req: LeaveRequestResource, reason: string): void {
    this.api.cancelLeaveRequest(req.id, reason).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('hrmLeave.requestCancelled'));
        this.loadLeaveRequests(this.leavesPage());
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  rejectLeave(req: LeaveRequestResource): void {
    this.api.rejectLeaveRequest(req.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('hrmEmp.msgRichiestaRifiutata'));
        this.loadLeaveRequests(this.leavesPage());
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  // --- Timesheets Logic ---

  loadTimesheets(page = 1): void {
    this.loadingTimesheets.set(true);
    this.timesheetsPage.set(page);
    this.api.getTimesheets({ page, per_page: 15 }).subscribe({
      next: (res) => {
        this.timesheets.set(res?.data || []);
        this.timesheetsTotal.set(res?.meta?.total ?? res?.data?.length ?? 0);
        this.loadingTimesheets.set(false);
      },
      error: () => this.loadingTimesheets.set(false),
    });
  }

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
        this.loadTimesheets(1);
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
        this.loadTimesheets(this.timesheetsPage());
      },
      error: () => this.message.error(this.translate.instant('hrmEmp.msgErroreDuranteLApprovazioneDelTimesheet')),
    });
  }

  // --- Payroll & Frontier Logic ---

  loadPayrollRuns(): void {
    this.loadingPayroll.set(true);
    this.api.getPayrollRuns().subscribe({
      next: (res) => {
        this.payrollRuns.set(res?.data || []);
        this.loadingPayroll.set(false);
      },
      error: () => this.loadingPayroll.set(false),
    });
  }

  loadFrontierWorkers(): void {
    this.loadingFrontier.set(true);
    this.api.getFrontierWorkers().subscribe({
      next: (res) => {
        this.frontierWorkers.set(res?.data || []);
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
