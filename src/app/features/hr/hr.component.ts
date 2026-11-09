import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  LeaveRequestResource,
  PayrollRunResource,
  SubmitLeaveRequestPayload,
  SubmitTimesheetPayload,
  TerminateEmployeePayload,
  TimesheetResource,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-hr',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    UpperCasePipe,
    MoneyPipe,
    TranslatePipe,
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
  private readonly api = inject(HrApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly router = inject(Router);

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
    first_name: ['', [Validators.required]],
    last_name: ['', [Validators.required]],
    work_email: ['', [Validators.required, Validators.email]],
    base_annual_salary: [30000, [Validators.required, Validators.min(0)]],
    hire_date: [new Date(), [Validators.required]],
    employment_type: ['full_time' as EmploymentType, [Validators.required]],
    weekly_hours: [40, [Validators.min(1), Validators.max(60)]],
    probation_months: [6, [Validators.min(0), Validators.max(12)]],
  });

  readonly isLeaveModalVisible = signal(false);
  readonly isSubmittingLeave = signal(false);
  readonly leaveForm = this.fb.group({
    employee_id: ['', [Validators.required]],
    leave_type_id: ['vacation', [Validators.required]],
    start_date: [new Date(), [Validators.required]],
    end_date: [new Date(Date.now() + 5 * 86400000), [Validators.required]],
    total_hours: [40, [Validators.required, Validators.min(0.5)]],
    reason: [''],
  });

  readonly isTimesheetModalVisible = signal(false);
  readonly isSubmittingTimesheet = signal(false);
  readonly timesheetForm = this.fb.group({
    employee_id: ['', [Validators.required]],
    work_date: [new Date(), [Validators.required]],
    regular_hours: [8, [Validators.required, Validators.min(0), Validators.max(24)]],
    overtime_hours: [0, [Validators.min(0), Validators.max(24)]],
    billable_hours: [8, [Validators.min(0), Validators.max(24)]],
    description: [''],
  });

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
        this.message.error('Impossibile caricare i dipendenti');
        this.loadingEmployees.set(false);
      },
    });
  }

  openHireModal(): void {
    this.hireForm.reset({
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
      hire_date:
        val.hire_date instanceof Date
          ? val.hire_date.toISOString().split('T')[0]
          : String(val.hire_date),
      employment_type: val.employment_type,
      weekly_hours: Number(val.weekly_hours),
      probation_months: Number(val.probation_months),
    };

    this.api.createEmployee(payload).subscribe({
      next: () => {
        this.message.success('Nuovo dipendente assunto con successo');
        this.isSubmittingHire.set(false);
        this.isHireModalVisible.set(false);
        this.loadEmployees(1);
      },
      error: () => {
        this.message.error('Errore durante l’assunzione del dipendente');
        this.isSubmittingHire.set(false);
      },
    });
  }

  completeProbation(emp: EmployeeResource): void {
    this.modal.confirm({
      nzTitle: `Confermare periodo di prova per ${emp.full_name}?`,
      nzContent: 'Lo stato di assunzione passerà da "Periodo di Prova" a "Attivo".',
      nzOkText: 'Conferma Prova',
      nzOnOk: () => {
        this.api.completeProbation(emp.id).subscribe({
          next: () => {
            this.message.success('Periodo di prova confermato');
            this.loadEmployees(this.employeesPage());
          },
          error: () => this.message.error('Errore durante la conferma della prova'),
        });
      },
    });
  }

  openEmployeeFile(emp: EmployeeResource): void {
    void this.router.navigate(['/hr/employees', emp.id]);
  }

  promoteEmployee(emp: EmployeeResource): void {
    this.modal.confirm({
      nzTitle: `Promuovere il dipendente ${emp.full_name}?`,
      nzContent: 'Verrà applicato un aumento retributivo e aggiornamento di qualifica.',
      nzOkText: 'Promuovi',
      nzOnOk: () => {
        const newSalary = Number(emp.base_annual_salary) * 1.1;
        this.api.promoteEmployee(emp.id, { base_annual_salary: Math.round(newSalary) }).subscribe({
          next: () => {
            this.message.success('Dipendente promosso con successo');
            this.loadEmployees(this.employeesPage());
          },
          error: () => this.message.error('Errore durante la promozione'),
        });
      },
    });
  }

  terminateEmployee(emp: EmployeeResource): void {
    this.modal.confirm({
      nzTitle: `Terminare rapporto con ${emp.full_name}?`,
      nzContent: 'Verrà registrata la data di cessazione e archiviato il fascicolo.',
      nzOkDanger: true,
      nzOkText: 'Termina Rapporto',
      nzOnOk: () => {
        const payload: TerminateEmployeePayload = {
          termination_date: new Date().toISOString().split('T')[0],
          reason: 'Cessazione consensuale',
        };
        this.api.terminateEmployee(emp.id, payload).subscribe({
          next: () => {
            this.message.success('Rapporto di lavoro terminato');
            this.loadEmployees(this.employeesPage());
          },
          error: () => this.message.error('Errore durante la cessazione del rapporto'),
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
      leave_type_id: 'vacation',
      start_date: new Date(),
      end_date: new Date(Date.now() + 5 * 86400000),
      total_hours: 40,
      reason: '',
    });
    this.isLeaveModalVisible.set(true);
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
          ? val.start_date.toISOString().split('T')[0]
          : String(val.start_date),
      end_date:
        val.end_date instanceof Date
          ? val.end_date.toISOString().split('T')[0]
          : String(val.end_date),
      total_hours: Number(val.total_hours),
      reason: val.reason || null,
    };

    this.api.submitLeaveRequest(payload).subscribe({
      next: () => {
        this.message.success('Richiesta di ferie/permesso inviata');
        this.isSubmittingLeave.set(false);
        this.isLeaveModalVisible.set(false);
        this.loadLeaveRequests(1);
      },
      error: () => {
        this.message.error('Errore durante l’invio della richiesta');
        this.isSubmittingLeave.set(false);
      },
    });
  }

  approveLeave(req: LeaveRequestResource): void {
    this.api.approveLeaveRequest(req.id).subscribe({
      next: () => {
        this.message.success('Richiesta approvata');
        this.loadLeaveRequests(this.leavesPage());
      },
      error: () => this.message.error('Errore durante l’approvazione'),
    });
  }

  rejectLeave(req: LeaveRequestResource): void {
    this.api.rejectLeaveRequest(req.id).subscribe({
      next: () => {
        this.message.success('Richiesta rifiutata');
        this.loadLeaveRequests(this.leavesPage());
      },
      error: () => this.message.error('Errore durante il rifiuto'),
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
          ? val.work_date.toISOString().split('T')[0]
          : String(val.work_date),
      regular_hours: Number(val.regular_hours),
      overtime_hours: Number(val.overtime_hours),
      billable_hours: Number(val.billable_hours),
      description: val.description || null,
    };

    this.api.submitTimesheet(payload).subscribe({
      next: () => {
        this.message.success('Presenze/ore registrate con successo');
        this.isSubmittingTimesheet.set(false);
        this.isTimesheetModalVisible.set(false);
        this.loadTimesheets(1);
      },
      error: () => {
        this.message.error('Errore durante la registrazione delle ore');
        this.isSubmittingTimesheet.set(false);
      },
    });
  }

  approveTimesheet(ts: TimesheetResource): void {
    this.api.approveTimesheet(ts.id).subscribe({
      next: () => {
        this.message.success('Timesheet approvato');
        this.loadTimesheets(this.timesheetsPage());
      },
      error: () => this.message.error('Errore durante l’approvazione del timesheet'),
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
