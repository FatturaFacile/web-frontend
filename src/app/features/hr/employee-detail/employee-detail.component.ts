import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EmployeeResource, HrApiService, I18nService, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { HrStatusTagComponent } from '../shared/hr-status-tag.component';
import { reportHttpError } from '../shared/hr-http.util';
import { EmployeeContractsComponent } from './employee-contracts.component';
import { EmployeeDocumentsComponent } from './employee-documents.component';
import { EmployeeTransferComponent } from './employee-transfer.component';

/** Employee file at `/hr/employees/:id`. */
@Component({
  selector: 'app-employee-detail',
  styleUrl: './employee-detail.component.scss',
  imports: [
    DatePipe,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzSkeletonModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    HrStatusTagComponent,
    EmployeeContractsComponent,
    EmployeeDocumentsComponent,
    EmployeeTransferComponent,
  ],
  template: `
    <app-page-header [title]="employee()?.full_name ?? ('hrmEmp.title' | translate)" />
    <nz-card>
      <a nz-button nzType="link" routerLink="/hr/employees">{{ 'hrmEmp.backToList' | translate }}</a>
      @if (loading()) {
        <nz-skeleton [nzActive]="true" />
      } @else if (employee(); as e) {
        <div class="flex justify-between items-start mb-3">
          <nz-descriptions nzBordered [nzColumn]="{ xs: 1, md: 3 }" class="flex-1">
            <nz-descriptions-item [nzTitle]="'hrmSelfService.employeeNumber' | translate">{{ e.employee_number }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmSelfService.workEmail' | translate">{{ e.work_email }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmSelfService.hireDate' | translate">{{ e.hire_date | date: 'mediumDate' }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmSelfService.employmentStatus' | translate">
              <app-hr-status-tag [value]="e.employment_status" />
            </nz-descriptions-item>
          </nz-descriptions>
          @if (canWrite()) {
            <app-employee-transfer class="ml-3" [employeeId]="e.id" (transferred)="load()" />
          }
        </div>
        <nz-tabs>
          <nz-tab [nzTitle]="'hrmEmp.contracts' | translate">
            <app-employee-contracts [employeeId]="e.id" />
          </nz-tab>
          <nz-tab [nzTitle]="'hrmEmp.documents' | translate">
            <app-employee-documents [employeeId]="e.id" />
          </nz-tab>
        </nz-tabs>
      }
    </nz-card>
  `,
})
export class EmployeeDetailComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: '',
  });

  private readonly api = inject(HrApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly employee = signal<EmployeeResource | null>(null);
  protected readonly loading = signal(true);
  protected readonly canWrite = computed(() => this.permissions.canWrite('hr'));

  constructor() {
    effect(() => {
      if (this.id()) {
        this.load();
      }
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getEmployee(this.id()).subscribe({
      next: (res) => {
        this.employee.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }
}
