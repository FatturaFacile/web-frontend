import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  Dimension,
  GeneralLedgerApiService,
  ManufacturingProductionApiService,
  MfgMachineDetail,
  MfgWorkCenterDetail,
  MfgWorkCenterStatus,
  MfgWorkingCalendarDetail,
  SaveMachinePayload,
  SaveWorkCenterPayload,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { forkJoin } from 'rxjs';
import { apiErrorText, toNum, WorkCenterNode, workCenterTree } from './production-engineering.utils';

const STATUSES: readonly MfgWorkCenterStatus[] = ['active', 'maintenance', 'inactive', 'decommissioned'];
const STATUS_COLOR: Record<MfgWorkCenterStatus, string> = {
  active: 'green',
  maintenance: 'orange',
  inactive: 'default',
  decommissioned: 'red',
};

type WorkCenterDraft = Required<Pick<SaveWorkCenterPayload, 'work_center_code' | 'name' | 'status' | 'currency_code'>> & {
  description: string;
  department_code: string;
  capacity_hours_per_day: number;
  efficiency_rate: number;
  availability_rate: number;
  parallel_capacity_units: number;
  oee_target_percent: number;
  availability_target_percent: number | null;
  performance_target_percent: number | null;
  quality_target_percent: number | null;
  hourly_cost_rate: number;
  hourly_overhead_rate: number;
  hourly_setup_cost_rate: number;
  hourly_machine_run_cost_rate: number;
  default_queue_wait_minutes: number;
  default_move_time_minutes: number;
  cost_center_id: string | null;
  working_calendar_id: string | null;
  parent_work_center_id: string | null;
  alternate_work_center_ids: string[];
};

interface MachineDraft {
  machine_code: string;
  name: string;
  work_center_id: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  status: MfgWorkCenterStatus;
  is_industria_40_enabled: boolean;
  is_transizione_50_enabled: boolean;
  telemetry_device_id: string;
  ideal_cycle_time_seconds_per_unit: number | null;
  parallel_capacity_units: number;
  efficiency_factor_percent: number | null;
  hourly_machine_run_cost_rate_override: number | null;
}

export const blankWorkCenter = (): WorkCenterDraft => ({
  work_center_code: '',
  name: '',
  description: '',
  department_code: '',
  status: 'active',
  currency_code: 'CHF',
  capacity_hours_per_day: 8,
  efficiency_rate: 100,
  availability_rate: 100,
  parallel_capacity_units: 1,
  oee_target_percent: 85,
  availability_target_percent: null,
  performance_target_percent: null,
  quality_target_percent: null,
  hourly_cost_rate: 0,
  hourly_overhead_rate: 0,
  hourly_setup_cost_rate: 0,
  hourly_machine_run_cost_rate: 0,
  default_queue_wait_minutes: 0,
  default_move_time_minutes: 0,
  cost_center_id: null,
  working_calendar_id: null,
  parent_work_center_id: null,
  alternate_work_center_ids: [],
});

export const blankMachine = (workCenterId: string): MachineDraft => ({
  machine_code: '',
  name: '',
  work_center_id: workCenterId,
  manufacturer: '',
  model: '',
  serial_number: '',
  status: 'active',
  is_industria_40_enabled: false,
  is_transizione_50_enabled: false,
  telemetry_device_id: '',
  ideal_cycle_time_seconds_per_unit: null,
  parallel_capacity_units: 1,
  efficiency_factor_percent: null,
  hourly_machine_run_cost_rate_override: null,
});

const draftOf = (center: MfgWorkCenterDetail): WorkCenterDraft => ({
  work_center_code: center.work_center_code,
  name: center.name,
  description: center.description ?? '',
  department_code: center.department_code ?? '',
  status: center.status,
  currency_code: center.currency_code,
  capacity_hours_per_day: toNum(center.capacity_hours_per_day),
  efficiency_rate: toNum(center.efficiency_rate),
  availability_rate: toNum(center.availability_rate),
  parallel_capacity_units: center.parallel_capacity_units,
  oee_target_percent: toNum(center.oee_target_percent),
  availability_target_percent: center.availability_target_percent == null ? null : toNum(center.availability_target_percent),
  performance_target_percent: center.performance_target_percent == null ? null : toNum(center.performance_target_percent),
  quality_target_percent: center.quality_target_percent == null ? null : toNum(center.quality_target_percent),
  hourly_cost_rate: toNum(center.hourly_cost_rate),
  hourly_overhead_rate: toNum(center.hourly_overhead_rate),
  hourly_setup_cost_rate: toNum(center.hourly_setup_cost_rate),
  hourly_machine_run_cost_rate: toNum(center.hourly_machine_run_cost_rate),
  default_queue_wait_minutes: center.default_queue_wait_minutes,
  default_move_time_minutes: center.default_move_time_minutes,
  cost_center_id: center.cost_center_id ?? null,
  working_calendar_id: center.working_calendar_id ?? null,
  parent_work_center_id: center.parent_work_center_id ?? null,
  alternate_work_center_ids: [...center.alternate_work_center_ids],
});

const machineDraftOf = (machine: MfgMachineDetail): MachineDraft => ({
  machine_code: machine.machine_code,
  name: machine.name,
  work_center_id: machine.work_center_id,
  manufacturer: machine.manufacturer ?? '',
  model: machine.model ?? '',
  serial_number: machine.serial_number ?? '',
  status: machine.status,
  is_industria_40_enabled: machine.is_industria_40_enabled,
  is_transizione_50_enabled: machine.is_transizione_50_enabled,
  telemetry_device_id: machine.telemetry_device_id ?? '',
  ideal_cycle_time_seconds_per_unit: machine.ideal_cycle_time_seconds_per_unit == null ? null : toNum(machine.ideal_cycle_time_seconds_per_unit),
  parallel_capacity_units: machine.parallel_capacity_units,
  efficiency_factor_percent: machine.efficiency_factor_percent == null ? null : toNum(machine.efficiency_factor_percent),
  hourly_machine_run_cost_rate_override:
    machine.hourly_machine_run_cost_rate_override == null ? null : toNum(machine.hourly_machine_run_cost_rate_override),
});

const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** Work centres as a tree with their machines, and the drawers that edit both. */
@Component({
  selector: 'app-mfg-work-centers',
  imports: [
    DecimalPipe,
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  styles: `
    .toolbar { display: flex; gap: 12px; margin-bottom: 16px; justify-content: space-between; flex-wrap: wrap }
    .num { text-align: right; font-variant-numeric: tabular-nums }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px 16px }
    .grid .field { display: flex; flex-direction: column; gap: 4px; font-size: 13px }
    .grid nz-input-number, .grid nz-select { width: 100% }
    h4 { margin: 20px 0 8px }
    .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px }
    .machines { margin: 0 }
  `,
  template: `
    <app-page-header
      [title]="'MFG_PE.WORK_CENTERS_TITLE' | translate"
      [subtitle]="'MFG_PE.WORK_CENTERS_SUBTITLE' | translate"
    ></app-page-header>

    <div class="toolbar">
      <input
        nz-input
        style="max-width: 320px"
        [attr.aria-label]="'MFG_PE.SEARCH' | translate"
        [placeholder]="'MFG_PE.SEARCH' | translate"
        [ngModel]="search()"
        (ngModelChange)="search.set($event)"
        data-testid="search"
      />
      <button nz-button nzType="primary" type="button" data-testid="new-center" (click)="openCenter(null)">
        {{ 'MFG_PE.NEW_WORK_CENTER' | translate }}
      </button>
    </div>

    <nz-spin [nzSpinning]="loading()">
      <nz-table nzSize="small" [nzData]="rows()" [nzFrontPagination]="false" [nzShowPagination]="false" data-testid="centers-table">
        <thead>
          <tr>
            <th scope="col" nzWidth="40px"></th>
            <th scope="col">{{ 'MFG_PE.COL_CODE' | translate }}</th>
            <th scope="col">{{ 'MFG_PE.COL_NAME' | translate }}</th>
            <th scope="col">{{ 'MFG_PE.COL_STATUS' | translate }}</th>
            <th scope="col" class="num">{{ 'MFG_PE.COL_CAPACITY' | translate }}</th>
            <th scope="col" class="num">{{ 'MFG_PE.COL_EFFICIENCY' | translate }}</th>
            <th scope="col" class="num">{{ 'MFG_PE.COL_OEE_TARGET' | translate }}</th>
            <th scope="col" class="num">{{ 'MFG_PE.COL_RATES' | translate }}</th>
            <th scope="col">{{ 'MFG_PE.COL_BADGES' | translate }}</th>
            <th scope="col"><span class="sr-only">{{ 'MFG_PE.COL_ACTIONS' | translate }}</span></th>
          </tr>
        </thead>
        <tbody>
          @for (node of rows(); track node.center.id) {
            <tr [attr.data-testid]="'center-' + node.center.work_center_code">
              <td [nzExpand]="expanded().has(node.center.id)" (nzExpandChange)="toggle(node.center.id)" [nzShowExpand]="true"></td>
              <td [style.padding-left.px]="16 + node.depth * 20"><strong>{{ node.center.work_center_code }}</strong></td>
              <td>{{ node.center.name }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(node.center.status)">{{ 'MFG_PE.STATUS_' + node.center.status.toUpperCase() | translate }}</nz-tag>
              </td>
              <td class="num">{{ node.center.capacity_hours_per_day | number: '1.0-2' }} h × {{ node.center.parallel_capacity_units }}</td>
              <td class="num">{{ node.center.efficiency_rate | number: '1.0-2' }}%</td>
              <td class="num">{{ node.center.oee_target_percent | number: '1.0-2' }}%</td>
              <td class="num">{{ totalRate(node.center) | number: '1.2-2' }} {{ node.center.currency_code }}/h</td>
              <td>
                @if (i40Count(node.center.id) > 0) {
                  <nz-tag nzColor="blue" data-testid="badge-i40">{{ 'MFG_PE.BADGE_I40' | translate }} · {{ i40Count(node.center.id) }}</nz-tag>
                }
                @if (t50Count(node.center.id) > 0) {
                  <nz-tag nzColor="purple" data-testid="badge-t50">{{ 'MFG_PE.BADGE_T50' | translate }} · {{ t50Count(node.center.id) }}</nz-tag>
                }
              </td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="openCenter(node.center)">{{ 'MFG_PE.EDIT' | translate }}</button>
                <button
                  nz-button
                  nzSize="small"
                  nzDanger
                  type="button"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'MFG_PE.CONFIRM_DELETE' | translate"
                  (nzOnConfirm)="removeCenter(node.center)"
                >
                  {{ 'MFG_PE.DELETE' | translate }}
                </button>
              </td>
            </tr>
            <tr [nzExpand]="expanded().has(node.center.id)">
              <div class="toolbar">
                <strong>{{ 'MFG_PE.MACHINES' | translate }}</strong>
                <button nz-button nzSize="small" type="button" [attr.data-testid]="'new-machine-' + node.center.work_center_code" (click)="openMachine(null, node.center.id)">
                  {{ 'MFG_PE.NEW_MACHINE' | translate }}
                </button>
              </div>
              <table class="machines" [attr.aria-label]="'MFG_PE.MACHINES' | translate">
                <tbody>
                  @for (machine of machinesOf(node.center.id); track machine.id) {
                    <tr [attr.data-testid]="'machine-' + machine.machine_code">
                      <td><strong>{{ machine.machine_code }}</strong></td>
                      <td>{{ machine.name }}</td>
                      <td><nz-tag [nzColor]="statusColor(machine.status)">{{ 'MFG_PE.STATUS_' + machine.status.toUpperCase() | translate }}</nz-tag></td>
                      <td>
                        @if (machine.is_industria_40_enabled) {
                          <nz-tag nzColor="blue">{{ 'MFG_PE.BADGE_I40' | translate }}</nz-tag>
                        }
                        @if (machine.is_transizione_50_enabled) {
                          <nz-tag nzColor="purple">{{ 'MFG_PE.BADGE_T50' | translate }}</nz-tag>
                        }
                      </td>
                      <td>
                        <button nz-button nzSize="small" type="button" (click)="openMachine(machine, node.center.id)">{{ 'MFG_PE.EDIT' | translate }}</button>
                        <button nz-button nzSize="small" nzDanger type="button" nz-popconfirm [nzPopconfirmTitle]="'MFG_PE.CONFIRM_DELETE' | translate" (nzOnConfirm)="removeMachine(machine)">
                          {{ 'MFG_PE.DELETE' | translate }}
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td>{{ 'MFG_PE.NO_MACHINES' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer [nzVisible]="center() !== null" [nzWidth]="720" nzPlacement="right" [nzTitle]="(editingCenterId() ? 'MFG_PE.EDIT_WORK_CENTER' : 'MFG_PE.NEW_WORK_CENTER') | translate" (nzOnClose)="center.set(null)">
      <ng-container *nzDrawerContent>
        @if (center(); as c) {
          <div data-testid="center-form">
            <div class="grid">
              <div class="field"><span>{{ 'MFG_PE.COL_CODE' | translate }}</span><input [attr.aria-label]="'MFG_PE.COL_CODE' | translate" nz-input [ngModel]="c.work_center_code" (ngModelChange)="patchCenter({ work_center_code: $event })" data-testid="f-code" />
              </div>
              <div class="field"><span>{{ 'MFG_PE.COL_NAME' | translate }}</span><input [attr.aria-label]="'MFG_PE.COL_NAME' | translate" nz-input [ngModel]="c.name" (ngModelChange)="patchCenter({ name: $event })" data-testid="f-name" />
              </div>
              <div class="field"><span>{{ 'MFG_PE.DEPARTMENT' | translate }}</span><input [attr.aria-label]="'MFG_PE.DEPARTMENT' | translate" nz-input [ngModel]="c.department_code" (ngModelChange)="patchCenter({ department_code: $event })" />
              </div>
              <div class="field"><span>{{ 'MFG_PE.COL_STATUS' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.COL_STATUS' | translate" [ngModel]="c.status" (ngModelChange)="patchCenter({ status: $event })">
                  @for (s of statuses; track s) {
                    <nz-option [nzValue]="s" [nzLabel]="'MFG_PE.STATUS_' + s.toUpperCase() | translate"></nz-option>
                  }
                </nz-select>
              </div>
              <div class="field"><span>{{ 'MFG_PE.PARENT_CENTER' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.PARENT_CENTER' | translate" nzAllowClear [ngModel]="c.parent_work_center_id" (ngModelChange)="patchCenter({ parent_work_center_id: $event })">
                  @for (o of parentOptions(); track o.id) {
                    <nz-option [nzValue]="o.id" [nzLabel]="o.work_center_code + ' · ' + o.name"></nz-option>
                  }
                </nz-select>
              </div>
              <div class="field"><span>{{ 'MFG_PE.COST_CENTER' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.COST_CENTER' | translate" nzAllowClear nzShowSearch [ngModel]="c.cost_center_id" (ngModelChange)="patchCenter({ cost_center_id: $event })" data-testid="f-cost-center">
                  @for (o of costCenters(); track o.id) {
                    <nz-option [nzValue]="o.id" [nzLabel]="o.code + ' · ' + o.name"></nz-option>
                  }
                </nz-select>
              </div>
            </div>

            <h4>{{ 'MFG_PE.SECTION_CAPACITY' | translate }}</h4>
            <div class="grid">
              <div class="field"><span>{{ 'MFG_PE.CALENDAR' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.CALENDAR' | translate" nzAllowClear [ngModel]="c.working_calendar_id" (ngModelChange)="patchCenter({ working_calendar_id: $event })" data-testid="f-calendar">
                  @for (o of calendars(); track o.id) {
                    <nz-option [nzValue]="o.id" [nzLabel]="o.code + ' · ' + o.name"></nz-option>
                  }
                </nz-select>
              </div>
              <div class="field"><span>{{ 'MFG_PE.HOURS_PER_DAY' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.HOURS_PER_DAY' | translate" [nzMin]="0" [nzMax]="24" [ngModel]="c.capacity_hours_per_day" (ngModelChange)="patchCenter({ capacity_hours_per_day: $event ?? 0 })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.PARALLEL_UNITS' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.PARALLEL_UNITS' | translate" [nzMin]="1" [nzMax]="1000" [ngModel]="c.parallel_capacity_units" (ngModelChange)="patchCenter({ parallel_capacity_units: $event ?? 1 })" data-testid="f-parallel"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.EFFICIENCY_PCT' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.EFFICIENCY_PCT' | translate" [nzMin]="1" [nzMax]="200" [ngModel]="c.efficiency_rate" (ngModelChange)="patchCenter({ efficiency_rate: $event ?? 100 })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.AVAILABILITY_PCT' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.AVAILABILITY_PCT' | translate" [nzMin]="1" [nzMax]="100" [ngModel]="c.availability_rate" (ngModelChange)="patchCenter({ availability_rate: $event ?? 100 })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.QUEUE_MINUTES' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.QUEUE_MINUTES' | translate" [nzMin]="0" [ngModel]="c.default_queue_wait_minutes" (ngModelChange)="patchCenter({ default_queue_wait_minutes: $event ?? 0 })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.MOVE_MINUTES' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.MOVE_MINUTES' | translate" [nzMin]="0" [ngModel]="c.default_move_time_minutes" (ngModelChange)="patchCenter({ default_move_time_minutes: $event ?? 0 })"></nz-input-number>
              </div>
            </div>

            <h4>{{ 'MFG_PE.SECTION_OEE_TARGETS' | translate }}</h4>
            <div class="grid">
              <div class="field"><span>{{ 'MFG_PE.OEE' | translate }} %</span><nz-input-number [attr.aria-label]="'MFG_PE.OEE' | translate" [nzMin]="0" [nzMax]="100" [ngModel]="c.oee_target_percent" (ngModelChange)="patchCenter({ oee_target_percent: $event ?? 0 })" data-testid="f-oee-target"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.AVAILABILITY' | translate }} %</span><nz-input-number [attr.aria-label]="'MFG_PE.AVAILABILITY' | translate" [nzMin]="0" [nzMax]="100" [ngModel]="c.availability_target_percent" (ngModelChange)="patchCenter({ availability_target_percent: $event })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.PERFORMANCE' | translate }} %</span><nz-input-number [attr.aria-label]="'MFG_PE.PERFORMANCE' | translate" [nzMin]="0" [nzMax]="100" [ngModel]="c.performance_target_percent" (ngModelChange)="patchCenter({ performance_target_percent: $event })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.QUALITY' | translate }} %</span><nz-input-number [attr.aria-label]="'MFG_PE.QUALITY' | translate" [nzMin]="0" [nzMax]="100" [ngModel]="c.quality_target_percent" (ngModelChange)="patchCenter({ quality_target_percent: $event })"></nz-input-number>
              </div>
            </div>

            <h4>{{ 'MFG_PE.SECTION_RATES' | translate }} ({{ c.currency_code }}/h)</h4>
            <div class="grid">
              <div class="field"><span>{{ 'MFG_PE.RATE_SETUP' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.RATE_SETUP' | translate" [nzMin]="0" [ngModel]="c.hourly_setup_cost_rate" (ngModelChange)="patchCenter({ hourly_setup_cost_rate: $event ?? 0 })" data-testid="f-rate-setup"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.RATE_MACHINE' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.RATE_MACHINE' | translate" [nzMin]="0" [ngModel]="c.hourly_machine_run_cost_rate" (ngModelChange)="patchCenter({ hourly_machine_run_cost_rate: $event ?? 0 })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.RATE_LABOUR' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.RATE_LABOUR' | translate" [nzMin]="0" [ngModel]="c.hourly_cost_rate" (ngModelChange)="patchCenter({ hourly_cost_rate: $event ?? 0 })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.RATE_OVERHEAD' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.RATE_OVERHEAD' | translate" [nzMin]="0" [ngModel]="c.hourly_overhead_rate" (ngModelChange)="patchCenter({ hourly_overhead_rate: $event ?? 0 })"></nz-input-number>
              </div>
            </div>

            <h4>{{ 'MFG_PE.ALTERNATES' | translate }}</h4>
            <nz-select nzMode="multiple" style="width: 100%" [ngModel]="c.alternate_work_center_ids" (ngModelChange)="patchCenter({ alternate_work_center_ids: $event })" [attr.aria-label]="'MFG_PE.ALTERNATES' | translate">
              @for (o of parentOptions(); track o.id) {
                <nz-option [nzValue]="o.id" [nzLabel]="o.work_center_code + ' · ' + o.name"></nz-option>
              }
            </nz-select>

            <div class="actions">
              <button nz-button type="button" (click)="center.set(null)">{{ 'MFG_PE.CANCEL' | translate }}</button>
              <button nz-button nzType="primary" type="button" data-testid="save-center" [disabled]="!centerValid() || saving()" [nzLoading]="saving()" (click)="saveCenter()">
                {{ 'MFG_PE.SAVE' | translate }}
              </button>
            </div>
          </div>
        }
      </ng-container>
    </nz-drawer>

    <nz-drawer [nzVisible]="machine() !== null" [nzWidth]="560" nzPlacement="right" [nzTitle]="(editingMachineId() ? 'MFG_PE.EDIT_MACHINE' : 'MFG_PE.NEW_MACHINE') | translate" (nzOnClose)="machine.set(null)">
      <ng-container *nzDrawerContent>
        @if (machine(); as m) {
          <div data-testid="machine-form">
            <div class="grid">
              <div class="field"><span>{{ 'MFG_PE.COL_CODE' | translate }}</span><input [attr.aria-label]="'MFG_PE.COL_CODE' | translate" nz-input [ngModel]="m.machine_code" (ngModelChange)="patchMachine({ machine_code: $event })" data-testid="m-code" />
              </div>
              <div class="field"><span>{{ 'MFG_PE.COL_NAME' | translate }}</span><input [attr.aria-label]="'MFG_PE.COL_NAME' | translate" nz-input [ngModel]="m.name" (ngModelChange)="patchMachine({ name: $event })" data-testid="m-name" />
              </div>
              <div class="field"><span>{{ 'MFG_PE.MANUFACTURER' | translate }}</span><input [attr.aria-label]="'MFG_PE.MANUFACTURER' | translate" nz-input [ngModel]="m.manufacturer" (ngModelChange)="patchMachine({ manufacturer: $event })" />
              </div>
              <div class="field"><span>{{ 'MFG_PE.MODEL' | translate }}</span><input [attr.aria-label]="'MFG_PE.MODEL' | translate" nz-input [ngModel]="m.model" (ngModelChange)="patchMachine({ model: $event })" />
              </div>
              <div class="field"><span>{{ 'MFG_PE.SERIAL' | translate }}</span><input [attr.aria-label]="'MFG_PE.SERIAL' | translate" nz-input [ngModel]="m.serial_number" (ngModelChange)="patchMachine({ serial_number: $event })" />
              </div>
              <div class="field"><span>{{ 'MFG_PE.COL_STATUS' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.COL_STATUS' | translate" [ngModel]="m.status" (ngModelChange)="patchMachine({ status: $event })">
                  @for (s of statuses; track s) {
                    <nz-option [nzValue]="s" [nzLabel]="'MFG_PE.STATUS_' + s.toUpperCase() | translate"></nz-option>
                  }
                </nz-select>
              </div>
              <div class="field"><span>{{ 'MFG_PE.PARALLEL_UNITS' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.PARALLEL_UNITS' | translate" [nzMin]="1" [nzMax]="1000" [ngModel]="m.parallel_capacity_units" (ngModelChange)="patchMachine({ parallel_capacity_units: $event ?? 1 })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.EFFICIENCY_PCT' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.EFFICIENCY_PCT' | translate" [nzMin]="1" [nzMax]="200" [ngModel]="m.efficiency_factor_percent" (ngModelChange)="patchMachine({ efficiency_factor_percent: $event })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.IDEAL_CYCLE' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.IDEAL_CYCLE' | translate" [nzMin]="0" [ngModel]="m.ideal_cycle_time_seconds_per_unit" (ngModelChange)="patchMachine({ ideal_cycle_time_seconds_per_unit: $event })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.RATE_MACHINE_OVERRIDE' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.RATE_MACHINE_OVERRIDE' | translate" [nzMin]="0" [ngModel]="m.hourly_machine_run_cost_rate_override" (ngModelChange)="patchMachine({ hourly_machine_run_cost_rate_override: $event })"></nz-input-number>
              </div>
              <div class="field"><span>{{ 'MFG_PE.TELEMETRY_DEVICE' | translate }}</span><input [attr.aria-label]="'MFG_PE.TELEMETRY_DEVICE' | translate" nz-input [ngModel]="m.telemetry_device_id" (ngModelChange)="patchMachine({ telemetry_device_id: $event })" />
              </div>
            </div>
            <div class="grid" style="margin-top: 16px">
              <span nz-checkbox [ngModel]="m.is_industria_40_enabled" (ngModelChange)="patchMachine({ is_industria_40_enabled: $event })" data-testid="m-i40">{{ 'MFG_PE.INDUSTRIA_40' | translate }}</span>
              <span nz-checkbox [ngModel]="m.is_transizione_50_enabled" (ngModelChange)="patchMachine({ is_transizione_50_enabled: $event })" data-testid="m-t50">{{ 'MFG_PE.TRANSIZIONE_50' | translate }}</span>
            </div>
            <div class="actions">
              <button nz-button type="button" (click)="machine.set(null)">{{ 'MFG_PE.CANCEL' | translate }}</button>
              <button nz-button nzType="primary" type="button" data-testid="save-machine" [disabled]="!machineValid() || saving()" [nzLoading]="saving()" (click)="saveMachine()">
                {{ 'MFG_PE.SAVE' | translate }}
              </button>
            </div>
          </div>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class WorkCentersComponent {
  private readonly api = inject(ManufacturingProductionApiService);
  private readonly ledger = inject(GeneralLedgerApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = STATUSES;
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly search = signal('');
  protected readonly centers = signal<MfgWorkCenterDetail[]>([]);
  protected readonly machines = signal<MfgMachineDetail[]>([]);
  protected readonly calendars = signal<MfgWorkingCalendarDetail[]>([]);
  protected readonly costCenters = signal<Dimension[]>([]);
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly center = signal<WorkCenterDraft | null>(null);
  protected readonly editingCenterId = signal<string | null>(null);
  protected readonly machine = signal<MachineDraft | null>(null);
  protected readonly editingMachineId = signal<string | null>(null);

  protected readonly rows = computed<WorkCenterNode[]>(() => {
    const needle = this.search().trim().toLowerCase();
    const all = workCenterTree(this.centers());

    return needle === ''
      ? all
      : all.filter(({ center }) => `${center.work_center_code} ${center.name}`.toLowerCase().includes(needle));
  });
  protected readonly parentOptions = computed(() => this.centers().filter((c) => c.id !== this.editingCenterId()));
  protected readonly centerValid = computed(() => {
    const c = this.center();

    return !!c && c.work_center_code.trim() !== '' && c.name.trim() !== '';
  });
  protected readonly machineValid = computed(() => {
    const m = this.machine();

    return !!m && m.machine_code.trim() !== '' && m.name.trim() !== '';
  });

  constructor() {
    this.reload();
    this.ledger
      .getCostCenters({ per_page: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (res) => this.costCenters.set(res.data), error: () => this.costCenters.set([]) });
  }

  protected statusColor = (status: MfgWorkCenterStatus): string => STATUS_COLOR[status] ?? 'default';
  protected totalRate = (c: MfgWorkCenterDetail): number =>
    toNum(c.hourly_setup_cost_rate) + toNum(c.hourly_machine_run_cost_rate) + toNum(c.hourly_cost_rate) + toNum(c.hourly_overhead_rate);
  protected machinesOf = (id: string): MfgMachineDetail[] => this.machines().filter((m) => m.work_center_id === id);
  protected i40Count = (id: string): number => this.machinesOf(id).filter((m) => m.is_industria_40_enabled).length;
  protected t50Count = (id: string): number => this.machinesOf(id).filter((m) => m.is_transizione_50_enabled).length;

  protected toggle(id: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) {
        next.add(id);
      }

      return next;
    });
  }

  protected openCenter(source: MfgWorkCenterDetail | null): void {
    this.editingCenterId.set(source?.id ?? null);
    this.center.set(source ? draftOf(source) : blankWorkCenter());
  }

  protected patchCenter(patch: Partial<WorkCenterDraft>): void {
    this.center.update((c) => (c ? { ...c, ...patch } : c));
  }

  protected openMachine(source: MfgMachineDetail | null, workCenterId: string): void {
    this.editingMachineId.set(source?.id ?? null);
    this.machine.set(source ? machineDraftOf(source) : blankMachine(workCenterId));
  }

  protected patchMachine(patch: Partial<MachineDraft>): void {
    this.machine.update((m) => (m ? { ...m, ...patch } : m));
  }

  protected saveCenter(): void {
    const c = this.center();
    if (!c) {
      return;
    }
    const payload: SaveWorkCenterPayload = {
      ...c,
      description: blankToNull(c.description),
      department_code: blankToNull(c.department_code),
    };
    const id = this.editingCenterId();
    this.saving.set(true);
    (id ? this.api.updateWorkCenter(id, payload) : this.api.createWorkCenter(payload))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.saved('MFG_PE.SAVED', () => this.center.set(null)),
        error: (err: unknown) => this.failed(err),
      });
  }

  protected saveMachine(): void {
    const m = this.machine();
    if (!m) {
      return;
    }
    const payload: SaveMachinePayload = {
      ...m,
      manufacturer: blankToNull(m.manufacturer),
      model: blankToNull(m.model),
      serial_number: blankToNull(m.serial_number),
      telemetry_device_id: blankToNull(m.telemetry_device_id),
    };
    const id = this.editingMachineId();
    this.saving.set(true);
    (id ? this.api.updateMachine(id, payload) : this.api.createMachine(payload))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.saved('MFG_PE.SAVED', () => this.machine.set(null)),
        error: (err: unknown) => this.failed(err),
      });
  }

  protected removeCenter(center: MfgWorkCenterDetail): void {
    this.api
      .deleteWorkCenter(center.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.saved('MFG_PE.DELETED'), error: (err: unknown) => this.failed(err) });
  }

  protected removeMachine(machine: MfgMachineDetail): void {
    this.api
      .deleteMachine(machine.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.saved('MFG_PE.DELETED'), error: (err: unknown) => this.failed(err) });
  }

  private saved(key: string, close?: () => void): void {
    this.saving.set(false);
    close?.();
    this.message.success(this.i18n.instant(key));
    this.reload();
  }

  private failed(err: unknown): void {
    this.saving.set(false);
    this.message.error(apiErrorText(err) ?? this.i18n.instant('MFG_PE.ERROR'));
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({
      centers: this.api.listWorkCenters({ per_page: 200 }),
      machines: this.api.listMachines({ per_page: 500 }),
      calendars: this.api.listWorkingCalendars({ per_page: 100 }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.centers.set(res.centers.data);
          this.machines.set(res.machines.data);
          this.calendars.set(res.calendars.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.i18n.instant('MFG_PE.LOAD_ERROR'));
        },
      });
  }
}
