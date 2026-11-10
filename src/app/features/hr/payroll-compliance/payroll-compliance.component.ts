import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { EmployeeResource, HrApiService, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { CrudOption } from '../shared/crud/crud.types';
import { FrontierPanelComponent } from './frontier-panel.component';
import { HiringSimulationPanelComponent } from './hiring-simulation-panel.component';
import { LabourCostPanelComponent } from './labour-cost-panel.component';
import { LegalTablesComponent } from './legal-tables.component';
import { SwissdecPanelComponent } from './swissdec-panel.component';
import { TariffsPanelComponent } from './tariffs-panel.component';
import { WithholdingStatementsPanelComponent } from './withholding-statements-panel.component';

/** Payroll compliance: Swissdec, legal tables, withholding tax, frontier workers, labour cost reports and hiring simulation. */
@Component({
  selector: 'app-payroll-compliance',
  imports: [
    NzCardModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    FrontierPanelComponent,
    HiringSimulationPanelComponent,
    LabourCostPanelComponent,
    LegalTablesComponent,
    SwissdecPanelComponent,
    TariffsPanelComponent,
    WithholdingStatementsPanelComponent,
  ],
  template: `
    <app-page-header
      [title]="'hrmCompliance.title' | translate"
      [subtitle]="'hrmCompliance.subtitle' | translate"
    />
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmCompliance.tabs.swissdec' | translate">
          <app-swissdec-panel [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmCompliance.tabs.statements' | translate">
          <app-withholding-statements-panel [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmCompliance.tabs.tariffs' | translate">
          <app-tariffs-panel [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmCompliance.tabs.legal' | translate">
          <app-legal-tables [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmCompliance.tabs.frontier' | translate">
          <app-frontier-panel [canWrite]="canWrite()" [employees]="employeeOptions()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmCompliance.tabs.reports' | translate">
          <app-labour-cost-panel [employees]="employeeOptions()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmCompliance.tabs.hiring' | translate">
          <app-hiring-simulation-panel />
        </nz-tab>
      </nz-tabs>
    </nz-card>
  `,
})
export class PayrollComplianceComponent implements OnInit {
  private readonly hrApi = inject(HrApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('payroll'));
  private readonly employees = signal<EmployeeResource[]>([]);
  protected readonly employeeOptions = computed<CrudOption[]>(() =>
    this.employees().map((e) => ({ value: e.id, label: `${e.employee_number} - ${e.full_name}` })),
  );

  ngOnInit(): void {
    this.hrApi
      .getEmployees({ per_page: 100 })
      .subscribe({ next: (res) => this.employees.set(res.data) });
  }
}
