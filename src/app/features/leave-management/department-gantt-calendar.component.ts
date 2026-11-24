import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  GanttAbsenceSpan,
  GanttDayColumn,
  GanttEmployeeRow,
  I18nService,
  LeaveCountryCode,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { LeaveManagementNavComponent } from './leave-management-nav.component';
import { LeaveManagementStore } from './leave-management.store';
import { isDateInAbsenceSpan, LEAVE_TYPE_TAG_COLORS, SWISS_CANTONS } from './leave-management.util';

/**
 * Department Absence Gantt Calendar (Calendario di Reparto) with holiday markers,
 * overlapping absences, and daily minimum staffing threshold (presidio minimo) alerts.
 */
@Component({
  selector: 'app-department-gantt-calendar',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzStatisticModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
    PageHeaderComponent,
    TranslatePipe,
    LeaveManagementNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'leaveMgmt.title' | translate"
      [subtitle]="'leaveMgmt.subtitle' | translate"
    />
    <app-leave-management-nav activeTab="gantt" />

    <nz-card class="mb-4">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-6 items-end">
        <div>
          <label class="block text-xs font-medium mb-1" for="gantt-from">{{
            'leaveMgmt.field.startDate' | translate
          }}</label>
          <input
            nz-input
            id="gantt-from"
            type="date"
            [ngModel]="fromDate()"
            (ngModelChange)="fromDate.set($event)"
          />
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="gantt-to">{{
            'leaveMgmt.field.endDate' | translate
          }}</label>
          <input
            nz-input
            id="gantt-to"
            type="date"
            [ngModel]="toDate()"
            (ngModelChange)="toDate.set($event)"
          />
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="gantt-dept">{{
            'leaveMgmt.field.department' | translate
          }}</label>
          <nz-select
            nzId="gantt-dept"
            class="w-full"
            nzAllowClear
            [ngModel]="departmentId()"
            (ngModelChange)="departmentId.set($event ?? '')"
          >
            @for (dept of store.departments(); track dept.id) {
              <nz-option [nzValue]="dept.id" [nzLabel]="dept.name" />
            }
          </nz-select>
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="gantt-country">{{
            'leaveMgmt.field.country' | translate
          }}</label>
          <nz-select
            nzId="gantt-country"
            class="w-full"
            [ngModel]="country()"
            (ngModelChange)="country.set($event)"
          >
            <nz-option nzValue="CH" [nzLabel]="'leaveMgmt.country.CH' | translate" />
            <nz-option nzValue="IT" [nzLabel]="'leaveMgmt.country.IT' | translate" />
          </nz-select>
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="gantt-canton">{{
            'leaveMgmt.field.canton' | translate
          }}</label>
          @if (country() === 'CH') {
            <nz-select
              nzId="gantt-canton"
              class="w-full"
              [ngModel]="canton()"
              (ngModelChange)="canton.set($event)"
            >
              @for (c of cantons; track c) {
                <nz-option [nzValue]="c" [nzLabel]="c" />
              }
            </nz-select>
          } @else {
            <input
              nz-input
              id="gantt-canton"
              [ngModel]="canton()"
              (ngModelChange)="canton.set($event)"
              placeholder="MI / RM"
            />
          }
        </div>
        <div class="flex gap-2">
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="lm-gantt-refresh-btn"
            [nzLoading]="store.loading()"
            (click)="reload()"
          >
            {{ 'leaveMgmt.action.loadCatalog' | translate }}
          </button>
          @if (canManage()) {
            <button
              nz-button
              type="button"
              data-testid="lm-threshold-open-btn"
              (click)="openThresholdDrawer()"
            >
              {{ 'leaveMgmt.action.configureThreshold' | translate }}
            </button>
          }
        </div>
      </div>
    </nz-card>

    @if (store.gantt(); as gantt) {
      <div class="grid grid-cols-1 gap-4 md:grid-cols-4 mb-4">
        <nz-card>
          <nz-statistic
            [nzTitle]="'leaveMgmt.field.department' | translate"
            [nzValue]="gantt.total_employees"
          />
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzTitle]="'leaveMgmt.field.minPresentCount' | translate"
            [nzValue]="gantt.threshold?.effective_min_required ?? 0"
          />
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzTitle]="'leaveMgmt.field.minPresentPercent' | translate"
            [nzValue]="gantt.threshold?.min_present_percent ?? 0"
            nzSuffix="%"
          />
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzTitle]="'leaveMgmt.gantt.presentRow' | translate"
            [nzValue]="store.staffingBreachedDaysCount()"
          />
        </nz-card>
      </div>

      @if (store.staffingBreachedDaysCount() > 0) {
        <nz-alert
          class="mb-4"
          nzType="warning"
          nzShowIcon
          [nzMessage]="'leaveMgmt.gantt.breachAlert' | translate"
        />
      }

      <nz-card>
        <div class="overflow-x-auto">
          <nz-table
            #ganttTable
            [nzData]="gantt.employees"
            [nzFrontPagination]="false"
            [nzShowPagination]="false"
            nzSize="small"
            [nzScroll]="{ x: '1100px' }"
          >
            <thead>
              <tr>
                <th nzLeft nzWidth="200px">{{ 'leaveMgmt.field.employee' | translate }}</th>
                @for (day of gantt.days; track day.date) {
                  <th
                    nzWidth="44px"
                    class="text-center"
                    [nzTooltipTitle]="dayTooltip(day)"
                    nz-tooltip
                  >
                    <div class="text-xs font-semibold">{{ day.date.slice(8, 10) }}</div>
                    <div class="text-[10px]">
                      @if (day.holiday) {
                        <nz-tag [nzColor]="day.holiday.is_sunday ? 'orange' : 'purple'">F</nz-tag>
                      } @else if (day.is_weekend) {
                        <span class="opacity-50">{{ day.weekday.slice(0, 2) }}</span>
                      } @else {
                        <span>{{ day.weekday.slice(0, 2) }}</span>
                      }
                    </div>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (emp of ganttTable.data; track emp.employee_id) {
                <tr>
                  <td nzLeft>
                    <div class="font-medium">{{ emp.employee_name }}</div>
                    <div class="text-xs opacity-70">
                      {{ emp.employee_number }} · {{ (emp.fte_ratio * 100).toFixed(0) }}%
                    </div>
                  </td>
                  @for (day of gantt.days; track day.date) {
                    <td class="text-center p-1">
                      @if (absenceForDay(emp, day.date); as abs) {
                        <nz-tag
                          [nzColor]="typeColor(abs.leave_type)"
                          nz-tooltip
                          [nzTooltipTitle]="
                            ('leaveMgmt.type.' + abs.leave_type | translate) +
                            ' (' +
                            abs.status +
                            ')'
                          "
                        >
                          {{ abs.status === 'approved' ? '✓' : '…' }}
                        </nz-tag>
                      } @else if (day.holiday) {
                        <span class="text-xs opacity-60">★</span>
                      } @else if (day.is_weekend) {
                        <span class="text-xs opacity-30">·</span>
                      }
                    </td>
                  }
                </tr>
              }
              <tr>
                <td nzLeft class="font-semibold">{{ 'leaveMgmt.gantt.presentRow' | translate }}</td>
                @for (day of gantt.days; track day.date) {
                  <td class="text-center">
                    <nz-tag [nzColor]="day.threshold_breached ? 'red' : 'green'">
                      {{ day.present_count }}
                    </nz-tag>
                  </td>
                }
              </tr>
            </tbody>
          </nz-table>
        </div>
      </nz-card>
    }

    <nz-drawer
      [nzVisible]="thresholdDrawerOpen()"
      [nzTitle]="'leaveMgmt.action.configureThreshold' | translate"
      [nzWidth]="420"
      (nzOnClose)="thresholdDrawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="thresholdForm" (ngSubmit)="saveThreshold()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="th-dept">{{
              'leaveMgmt.field.department' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="th-dept" formControlName="department_id">
                @for (dept of store.departments(); track dept.id) {
                  <nz-option [nzValue]="dept.id" [nzLabel]="dept.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired nzFor="th-count">{{
              'leaveMgmt.field.minPresentCount' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-input-number
                id="th-count"
                class="w-full"
                formControlName="min_present_count"
                [nzMin]="0"
                [nzMax]="500"
              />
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired nzFor="th-pct">{{
              'leaveMgmt.field.minPresentPercent' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-input-number
                id="th-pct"
                class="w-full"
                formControlName="min_present_percent"
                [nzMin]="0"
                [nzMax]="100"
              />
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzFor="th-block">{{
              'leaveMgmt.field.hardBlock' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-switch id="th-block" formControlName="enforce_hard_block" />
            </nz-form-control>
          </nz-form-item>

          <div class="flex justify-end gap-2 mt-4">
            <button nz-button type="button" (click)="thresholdDrawerOpen.set(false)">
              {{ 'leaveMgmt.action.cancel' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              type="submit"
              [disabled]="thresholdForm.invalid"
              [nzLoading]="store.saving()"
            >
              {{ 'leaveMgmt.action.configureThreshold' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class DepartmentGanttCalendarComponent implements OnInit {
  protected readonly store = inject(LeaveManagementStore);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly cantons = SWISS_CANTONS;
  protected readonly fromDate = signal(this.defaultFromDate());
  protected readonly toDate = signal(this.defaultToDate());
  protected readonly departmentId = signal('');
  protected readonly country = signal<LeaveCountryCode>('CH');
  protected readonly canton = signal('TI');
  protected readonly thresholdDrawerOpen = signal(false);

  protected readonly canManage = computed(
    () => this.permissions.canWrite('hr') || this.permissions.canWrite('leave_management'),
  );

  protected readonly thresholdForm = this.fb.nonNullable.group({
    department_id: ['', Validators.required],
    min_present_count: [1, [Validators.required, Validators.min(0)]],
    min_present_percent: [50, [Validators.required, Validators.min(0), Validators.max(100)]],
    enforce_hard_block: [false],
  });

  ngOnInit(): void {
    void this.store.loadDirectory();
    void this.reload();
  }

  protected async reload(): Promise<void> {
    try {
      await this.store.loadGantt({
        from: this.fromDate(),
        to: this.toDate(),
        department_id: this.departmentId() || undefined,
        country: this.country(),
        canton_or_province_code: this.canton() || undefined,
      });
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected absenceForDay(emp: GanttEmployeeRow, date: string): GanttAbsenceSpan | null {
    return emp.absences.find((a) => isDateInAbsenceSpan(date, a.start_date, a.end_date)) ?? null;
  }

  protected typeColor(leaveType: GanttAbsenceSpan['leave_type']): string {
    return LEAVE_TYPE_TAG_COLORS[leaveType] ?? 'blue';
  }

  protected dayTooltip(day: GanttDayColumn): string {
    if (day.holiday) {
      return `${day.date} — ${day.holiday.name}${day.holiday.is_sunday ? ' (Sunday)' : ''}`;
    }
    return `${day.date} (${day.present_count} present / min ${day.required_min})`;
  }

  protected openThresholdDrawer(): void {
    const firstDept = this.departmentId() || this.store.departments()[0]?.id || '';
    const existing = this.store.thresholds().find((t) => t.department_id === firstDept);
    this.thresholdForm.patchValue({
      department_id: firstDept,
      min_present_count: existing?.min_present_count ?? 1,
      min_present_percent: existing?.min_present_percent ?? 50,
      enforce_hard_block: existing?.enforce_hard_block ?? false,
    });
    this.thresholdDrawerOpen.set(true);
  }

  protected async saveThreshold(): Promise<void> {
    if (this.thresholdForm.invalid) {
      return;
    }
    const val = this.thresholdForm.getRawValue();
    try {
      await this.store.upsertStaffingThreshold(val.department_id, {
        min_present_count: val.min_present_count,
        min_present_percent: val.min_present_percent,
        enforce_hard_block: val.enforce_hard_block,
      });
      this.thresholdDrawerOpen.set(false);
      await this.reload();
      this.message.success(this.i18n.translate('leaveMgmt.action.configureThreshold'));
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  private defaultFromDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private defaultToDate(): string {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }
}
