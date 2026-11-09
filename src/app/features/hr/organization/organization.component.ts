import { Component, computed, inject, signal } from '@angular/core';
import { DepartmentResource, HrEmployeeApiService, PermissionsService, PositionResource } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { map, tap } from 'rxjs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudOption } from '../shared/crud/crud.types';

type Row = { id: string } & Record<string, unknown>;

/** Org chart: departments (tree, no cycles: server 422) and positions. */
@Component({
  selector: 'app-hr-organization',
  imports: [NzCardModule, NzTabsModule, PageHeaderComponent, TranslatePipe, CrudTableComponent],
  template: `
    <app-page-header
      [title]="'hrmOrg.title' | translate"
      [subtitle]="'hrmOrg.subtitle' | translate"
    />
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmOrg.departments' | translate">
          <app-crud-table [config]="departmentsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmOrg.positions' | translate">
          <app-crud-table [config]="positionsConfig()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
  `,
})
export class OrganizationComponent {
  private readonly api = inject(HrEmployeeApiService);
  private readonly permissions = inject(PermissionsService);

  private readonly departments = signal<DepartmentResource[]>([]);
  private readonly departmentOptions = computed<CrudOption[]>(() =>
    this.departments().map((d) => ({ value: d.id, label: `${d.code} - ${d.name}` })),
  );

  protected readonly departmentsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmOrg.departments',
    canWrite: this.permissions.canWrite('hr'),
    list: () =>
      this.api.getDepartments().pipe(
        tap((res) => this.departments.set(res.data)),
        map((res) => res.data as unknown as Row[]),
      ),
    create: (payload) => this.api.createDepartment(payload as never),
    update: (id, payload) => this.api.updateDepartment(id, payload as never),
    fields: [
      { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 50 },
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 255 },
      {
        key: 'parent_id',
        labelKey: 'hrmOrg.parent',
        type: 'select',
        nullable: true,
        options: () => this.departmentOptions(),
      },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
    ],
  }));

  protected readonly positionsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmOrg.positions',
    canWrite: this.permissions.canWrite('hr'),
    list: () => this.api.getPositions().pipe(map((res) => res.data as PositionResource[] as unknown as Row[])),
    create: (payload) => this.api.createPosition(payload as never),
    update: (id, payload) => this.api.updatePosition(id, payload as never),
    fields: [
      { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 50 },
      { key: 'title', labelKey: 'hrmCommon.title', type: 'text', required: true, maxLength: 255 },
      {
        key: 'department_id',
        labelKey: 'hrmOrg.department',
        type: 'select',
        nullable: true,
        options: () => this.departmentOptions(),
      },
      { key: 'headcount_budget', labelKey: 'hrmOrg.headcountBudget', type: 'integer' },
      { key: 'is_critical_role', labelKey: 'hrmOrg.criticalRole', type: 'boolean', defaultValue: false },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
    ],
  }));
}
