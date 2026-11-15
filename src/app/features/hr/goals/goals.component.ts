import { Component, computed, inject, OnInit, signal, viewChildren } from '@angular/core';
import {
  EmployeeResource,
  GoalCycleRecord,
  GoalRecord,
  HrApiService,
  HrWorkforceApiService,
  PermissionsService,
  TeamRecord,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudOption, crudPage, isRowsQuery } from '../shared/crud/crud.types';
import { GoalDetailComponent } from './goal-detail.component';

type Row = { id: string } & Record<string, unknown>;

const LEVELS = ['company', 'team', 'employee'];
const STATUSES = ['draft', 'active', 'completed', 'cancelled'];

/** Goals and OKR: cycles, goals cascading from the company to the employee, key results and check-ins. */
@Component({
  selector: 'app-hr-goals',
  styleUrl: './goals.component.scss',
  imports: [NzCardModule, NzTabsModule, PageHeaderComponent, TranslatePipe, CrudTableComponent, GoalDetailComponent],
  template: `
    <app-page-header [title]="'hrmGoals.title' | translate" [subtitle]="'hrmGoals.subtitle' | translate" />
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmGoals.goals' | translate">
          <app-crud-table [config]="goalsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmGoals.cycles' | translate">
          <app-crud-table [config]="cyclesConfig()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
    <app-goal-detail
      [goalId]="detailTarget()"
      [canWrite]="canWrite()"
      (closed)="detailTarget.set(null)"
      (changed)="reloadTables()"
    />
  `,
})
export class GoalsComponent implements OnInit {
  private readonly api = inject(HrWorkforceApiService);
  private readonly hrApi = inject(HrApiService);
  private readonly permissions = inject(PermissionsService);
  private readonly tables = viewChildren(CrudTableComponent);

  protected readonly canWrite = computed(() => this.permissions.canWrite('hr'));
  protected readonly detailTarget = signal<string | null>(null);
  private readonly cycles = signal<GoalCycleRecord[]>([]);
  private readonly employees = signal<EmployeeResource[]>([]);
  private readonly teams = signal<TeamRecord[]>([]);
  private readonly goals = signal<GoalRecord[]>([]);

  private readonly cycleOptions = computed<CrudOption[]>(() => this.cycles().map((c) => ({ value: c.id, label: c.name })));
  private readonly employeeOptions = computed<CrudOption[]>(() =>
    this.employees().map((e) => ({ value: e.id, label: `${e.employee_number} - ${e.full_name}` })),
  );
  private readonly teamOptions = computed<CrudOption[]>(() => this.teams().map((t) => ({ value: t.id, label: t.name })));
  private readonly goalOptions = computed<CrudOption[]>(() => this.goals().map((g) => ({ value: g.id, label: g.title })));

  protected readonly goalsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmGoals.goals',
    canWrite: this.canWrite(),
    gridList: (query) => {
      if (isRowsQuery(query)) {
        this.loadLookups();
      }
      return crudPage(this.api.getGoals(query));
    },
    create: (payload) => this.api.createGoal(payload as never),
    update: (id, payload) => this.api.updateGoal(id, payload as never),
    remove: (id) => this.api.deleteGoal(id),
    rowActions: [{ labelKey: 'hrmGoals.detail', run: (row) => this.detailTarget.set(row.id) }],
    fields: [
      { key: 'title', labelKey: 'hrmCommon.title', type: 'text', required: true, maxLength: 180 },
      {
        key: 'goal_cycle_id',
        labelKey: 'hrmGoals.cycle',
        type: 'select',
        required: true,
        createOnly: true,
        options: () => this.cycleOptions(),
      },
      {
        key: 'level',
        labelKey: 'hrmGoals.levelCol',
        type: 'select',
        required: true,
        createOnly: true,
        defaultValue: 'employee',
        options: () => LEVELS.map((value) => ({ value, labelKey: `hrmGoals.level.${value}` })),
      },
      {
        key: 'employee_id',
        labelKey: 'hrmCommon.employee',
        type: 'select',
        nullable: true,
        createOnly: true,
        requiredWhen: (values) => values['level'] === 'employee',
        options: () => this.employeeOptions(),
      },
      {
        key: 'team_id',
        labelKey: 'hrmGoals.team',
        type: 'select',
        nullable: true,
        createOnly: true,
        requiredWhen: (values) => values['level'] === 'team',
        options: () => this.teamOptions(),
      },
      { key: 'parent_goal_id', labelKey: 'hrmGoals.parentGoal', type: 'select', nullable: true, options: () => this.goalOptions() },
      { key: 'weight', labelKey: 'hrmGoals.weight', type: 'decimal', defaultValue: '1', positive: true },
      { key: 'due_on', labelKey: 'hrmGoals.dueOn', type: 'date', nullable: true },
      {
        key: 'status',
        labelKey: 'hrmCommon.statusCol',
        type: 'select',
        defaultValue: 'active',
        options: () => STATUSES.map((value) => ({ value, labelKey: `hrmGoals.status.${value}` })),
      },
      { key: 'description', labelKey: 'hrmCommon.description', type: 'textarea', nullable: true, column: false, maxLength: 5000 },
      { key: 'progress', labelKey: 'hrmGoals.progress', type: 'text', noForm: true },
    ],
  }));

  protected readonly cyclesConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmGoals.cycles',
    canWrite: this.canWrite(),
    gridList: (query) => crudPage(this.api.getGoalCycles(query)),
    create: (payload) => this.api.createGoalCycle(payload as never),
    update: (id, payload) => this.api.updateGoalCycle(id, payload as never),
    isReadonly: (row) => row['status'] === 'closed',
    rowActions: [
      {
        labelKey: 'hrmGoals.closeCycle',
        writeOnly: true,
        visible: (row) => row['status'] !== 'closed',
        run: (row) => this.api.closeGoalCycle(row.id),
      },
    ],
    fields: [
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 120 },
      { key: 'starts_on', labelKey: 'hrmGoals.startsOn', type: 'date', required: true },
      { key: 'ends_on', labelKey: 'hrmGoals.endsOn', type: 'date', required: true, notBefore: 'starts_on' },
      {
        key: 'status',
        labelKey: 'hrmCommon.statusCol',
        type: 'select',
        defaultValue: 'draft',
        options: () => [
          { value: 'draft', labelKey: 'hrmGoals.cycleStatus.draft' },
          { value: 'active', labelKey: 'hrmGoals.cycleStatus.active' },
          { value: 'closed', labelKey: 'hrmGoals.cycleStatus.closed' },
        ],
      },
    ],
  }));

  ngOnInit(): void {
    this.loadLookups();
  }

  protected reloadTables(): void {
    this.tables().forEach((table) => table.reload());
  }

  /** The select options of the forms need every row, not the filtered page of the grid. */
  private loadLookups(): void {
    this.api.getGoalCycles().subscribe({ next: (res) => this.cycles.set(res.data) });
    this.api.getGoals().subscribe({ next: (res) => this.goals.set(res.data) });
    this.api.getTeams().subscribe({ next: (res) => this.teams.set(res.data) });
    this.hrApi.getEmployees({ per_page: 100 }).subscribe({ next: (res) => this.employees.set(res.data) });
  }
}
