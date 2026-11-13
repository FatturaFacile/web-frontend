import { Component, computed, inject, input, signal } from '@angular/core';
import {
  HrTimeApiService,
  RoundingMode,
  ScheduleGroupMemberPayload,
  ScheduleGroupRulesPayload,
} from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { map } from 'rxjs';
import { ActionFormComponent, ActionFormConfig } from '../shared/action-form/action-form.component';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudOption } from '../shared/crud/crud.types';

type Row = { id: string } & Record<string, unknown>;

const ROUNDING_MODES: RoundingMode[] = ['none', 'nearest', 'employee_favour', 'employer_favour'];

/** Schedule groups (tolerances, rounding and allowances by version), their members and the badges of the employees. */
@Component({
  selector: 'app-time-schedule-groups',
  styleUrl: './time-schedule-groups.component.scss',
  imports: [
    ModalActionsDirective,
    ActionFormComponent,
    NzModalModule,
    TranslatePipe,
    CrudTableComponent,
  ],
  template: `
    <app-crud-table [config]="groupsConfig()" />

    <h3 class="mt-4">{{ 'hrmTimeX.badgeTitle' | translate }}</h3>
    <app-action-form [config]="badgeConfig()" [canWrite]="canWrite()" />

    <nz-modal
      [nzVisible]="rulesOpen()"
      [nzTitle]="'hrmTimeX.rulesTitle' | translate"
      [nzFooter]="null"
      nzWidth="720px"
      (nzOnCancel)="rulesOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <app-action-form [config]="rulesConfig()" (submitted)="rulesOpen.set(false)" />
      </ng-container>
    </nz-modal>
    <nz-modal
      [nzVisible]="memberOpen()"
      [nzTitle]="'hrmTimeX.memberTitle' | translate"
      [nzFooter]="null"
      (nzOnCancel)="memberOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <app-action-form [config]="memberConfig()" (submitted)="memberOpen.set(false)" />
      </ng-container>
    </nz-modal>
  `,
})
export class TimeScheduleGroupsComponent {
  readonly canWrite = input(false);
  readonly employees = input<CrudOption[]>([]);

  private readonly api = inject(HrTimeApiService);

  protected readonly rulesOpen = signal(false);
  protected readonly memberOpen = signal(false);
  private readonly selectedGroup = signal<string>('');

  protected readonly groupsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmTimeX.groups',
    canWrite: this.canWrite(),
    list: () => this.api.getScheduleGroups().pipe(map((res) => res.data as unknown as Row[])),
    create: (payload) => this.api.createScheduleGroup(payload as never),
    rowActions: [
      {
        labelKey: 'hrmTimeX.addRules',
        writeOnly: true,
        run: (row) => {
          this.selectedGroup.set(row.id);
          this.rulesOpen.set(true);
        },
      },
      {
        labelKey: 'hrmTimeX.addMember',
        writeOnly: true,
        run: (row) => {
          this.selectedGroup.set(row.id);
          this.memberOpen.set(true);
        },
      },
    ],
    fields: [
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 120 },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
    ],
  }));

  protected readonly rulesConfig = computed<ActionFormConfig>(() => {
    const groupId = this.selectedGroup();
    return {
      submitLabelKey: 'hrmCommon.save',
      fields: [
        { key: 'valid_from', labelKey: 'hrmTimeX.validFrom', type: 'date', required: true },
        { key: 'tolerance_before_minutes', labelKey: 'hrmTimeX.toleranceBefore', type: 'integer', min: 0, max: 120 },
        { key: 'tolerance_after_minutes', labelKey: 'hrmTimeX.toleranceAfter', type: 'integer', min: 0, max: 120 },
        { key: 'rounding_minutes', labelKey: 'hrmTimeX.roundingMinutes', type: 'integer', min: 0, max: 60 },
        {
          key: 'rounding_mode',
          labelKey: 'hrmTimeX.roundingMode',
          type: 'select',
          options: () =>
            ROUNDING_MODES.map((value) => ({ value, labelKey: `hrmTimeX.roundingModes.${value}` })),
        },
        {
          key: 'night_allowance_percent',
          labelKey: 'hrmTimeX.nightPercent',
          type: 'decimal',
          nullable: true,
          min: 0,
          max: 300,
        },
        {
          key: 'sunday_allowance_percent',
          labelKey: 'hrmTimeX.sundayPercent',
          type: 'decimal',
          nullable: true,
          min: 0,
          max: 300,
        },
        {
          key: 'holiday_allowance_percent',
          labelKey: 'hrmTimeX.holidayPercent',
          type: 'decimal',
          nullable: true,
          min: 0,
          max: 300,
        },
        {
          key: 'daily_allowance_amount',
          labelKey: 'hrmTimeX.dailyAmount',
          type: 'decimal',
          nullable: true,
          min: 0,
        },
        {
          key: 'daily_allowance_minimum_minutes',
          labelKey: 'hrmTimeX.dailyMinimum',
          type: 'integer',
          min: 0,
          max: 1440,
        },
      ],
      submit: (payload) =>
        this.api.addScheduleGroupRules(groupId, payload as unknown as ScheduleGroupRulesPayload),
    };
  });

  protected readonly memberConfig = computed<ActionFormConfig>(() => {
    const groupId = this.selectedGroup();
    return {
      submitLabelKey: 'hrmCommon.save',
      fields: [
        {
          key: 'employee_id',
          labelKey: 'hrmCommon.employee',
          type: 'select',
          required: true,
          options: () => this.employees(),
        },
        { key: 'valid_from', labelKey: 'hrmCommon.from', type: 'date', required: true },
        { key: 'valid_to', labelKey: 'hrmCommon.to', type: 'date', nullable: true, notBefore: 'valid_from' },
      ],
      submit: (payload) =>
        this.api.addScheduleGroupMember(groupId, payload as unknown as ScheduleGroupMemberPayload),
    };
  });

  protected readonly badgeConfig = computed<ActionFormConfig>(() => ({
    submitLabelKey: 'hrmTimeX.registerBadge',
    resetOnSuccess: true,
    fields: [
      {
        key: 'employee_id',
        labelKey: 'hrmCommon.employee',
        type: 'select',
        required: true,
        options: () => this.employees(),
      },
      {
        key: 'badge_code',
        labelKey: 'hrmTimeX.badgeCode',
        type: 'text',
        required: true,
        maxLength: 120,
      },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
    ],
    submit: (payload) => this.api.registerBadge(payload as never),
  }));
}
