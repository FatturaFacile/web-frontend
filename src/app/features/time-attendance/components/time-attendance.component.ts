import { Component, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { TimeAttendanceStore } from '../state/time-attendance.store';

@Component({
  selector: 'app-time-attendance',
  imports: [
    DecimalPipe,
    NzCardModule,
    NzGridModule,
    NzButtonModule,
    NzProgressModule,
    NzTableModule,
    NzTagModule,
    NzStatisticModule,
    NzAlertModule,
    NzSpinModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'ATTENDANCE.TITLE' | translate"
      [subtitle]="'ATTENDANCE.SUBTITLE' | translate"
    />

    <nz-spin [nzSpinning]="store.isLoading()">
      <!-- Top Row: Clock-in Terminal & Compliance Gauges -->
      <div nz-row [nzGutter]="16" class="top-row">
        <!-- Interactive Clock-In Widget -->
        <div nz-col [nzXs]="24" [nzLg]="8">
          <nz-card [nzTitle]="'ATTENDANCE.TERMINAL_TITLE' | translate" class="terminal-card">
            <div class="terminal-content">
              <div class="status-indicator">
                <span class="status-dot" [class.online]="store.isClockedIn()"></span>
                <span class="status-text">
                  {{ store.isClockedIn() ? ('ATTENDANCE.CLOCKED_IN' | translate) : ('ATTENDANCE.CLOCKED_OUT' | translate) }}
                </span>
              </div>

              <div class="today-details">
                <p><strong>{{ 'ATTENDANCE.SHIFT_START' | translate }}</strong> {{ store.data()?.todaySession?.clockInTime ?? '--:--' }}</p>
                <p><strong>{{ 'ATTENDANCE.LOGGED_BREAK' | translate }}</strong> {{ store.data()?.todaySession?.breakMinutes ?? 0 }} min</p>
                <p><strong>{{ 'ATTENDANCE.HOURS_TODAY' | translate }}</strong> {{ store.data()?.todaySession?.totalTodayHours | number: '1.2-2' }} h</p>
              </div>

              <button
                nz-button
                nzSize="large"
                nzBlock
                [nzType]="store.isClockedIn() ? 'default' : 'primary'"
                [nzDanger]="store.isClockedIn()"
                (click)="store.toggleClock()"
                class="clock-toggle-btn"
              >
                @if (store.isClockedIn()) {
                  <i class="fa-solid fa-right-from-bracket fa-icon-spaced"></i> {{ 'ATTENDANCE.BTN_CLOCK_OUT' | translate }}
                } @else {
                  <i class="fa-solid fa-right-to-bracket fa-icon-spaced"></i> {{ 'ATTENDANCE.BTN_CLOCK_IN' | translate }}
                }
              </button>
            </div>
          </nz-card>
        </div>

        <!-- Swiss ArG Limit Tracker -->
        <div nz-col [nzXs]="24" [nzLg]="8">
          <nz-card [nzTitle]="'ATTENDANCE.LIMITS_TITLE' | translate" class="gauge-card">
            <div class="gauge-content">
              <div class="progress-wrap">
                <nz-progress
                  [nzPercent]="store.weeklyPercent()"
                  [nzStrokeColor]="store.weeklyPercent() > 90 ? '#ef4444' : 'var(--primary-color, #0d9488)'"
                  nzType="dashboard"
                  [nzWidth]="120"
                />
              </div>
              <div class="gauge-meta">
                <p class="stat-highlight">
                  <strong>{{ store.weeklyWorked() }} h</strong> / {{ store.weeklyLimit() }} h
                </p>
                <p class="stat-sub">{{ 'ATTENDANCE.REGIME_LABEL' | translate }} {{ store.summary()?.regime }}</p>
                <nz-tag nzColor="success">
                  <i class="fa-solid fa-shield-check fa-icon-spaced"></i>
                  {{ 'ATTENDANCE.REST_COMPLIANT' | translate }}
                </nz-tag>
              </div>
            </div>
          </nz-card>
        </div>

        <!-- Vacation & ROL Accruals -->
        <div nz-col [nzXs]="24" [nzLg]="8">
          <nz-card [nzTitle]="'ATTENDANCE.ACCRUALS_TITLE' | translate" class="accrual-card">
            <div nz-row [nzGutter]="16">
              <div nz-col [nzSpan]="12">
                <nz-statistic
                  [nzValue]="store.vacations()?.remainingDays ?? 0"
                  [nzTitle]="'ATTENDANCE.VACATION_REMAINING' | translate"
                  [nzSuffix]="'ATTENDANCE.DAYS_SUFFIX' | translate"
                  [nzValueStyle]="{ color: '#10b981' }"
                />
              </div>
              <div nz-col [nzSpan]="12">
                <nz-statistic
                  [nzValue]="store.vacations()?.rolHoursAvailable ?? 0"
                  [nzTitle]="'ATTENDANCE.TIME_BANK' | translate"
                  [nzSuffix]="'ATTENDANCE.HOURS_SUFFIX' | translate"
                  [nzValueStyle]="{ color: 'var(--primary-color, #0d9488)' }"
                />
              </div>
            </div>
            <div class="accrual-info">
              <span>{{ 'ATTENDANCE.ANNUAL_ENTITLEMENT' | translate: { days: store.vacations()?.annualEntitlementDays ?? 0 } }}</span>
              <span>{{ 'ATTENDANCE.DAYS_TAKEN' | translate: { days: store.vacations()?.takenDays ?? 0 } }}</span>
            </div>
          </nz-card>
        </div>
      </div>

      <!-- Bottom: Attendance Records Table -->
      <nz-card [nzTitle]="'ATTENDANCE.LOG_TITLE' | translate" class="records-card">
        <nz-table
          #attendanceTable
          [nzData]="store.records()"
          [nzFrontPagination]="true"
          [nzPageSize]="5"
          nzSize="middle"
        >
          <thead>
            <tr>
              <th>{{ 'COMMON.DATE' | translate }}</th>
              <th>{{ 'ATTENDANCE.COL_IN' | translate }}</th>
              <th>{{ 'ATTENDANCE.COL_OUT' | translate }}</th>
              <th>{{ 'ATTENDANCE.COL_BREAK' | translate }}</th>
              <th>{{ 'ATTENDANCE.COL_TOTAL_HOURS' | translate }}</th>
              <th>{{ 'ATTENDANCE.COL_SHIFT_STATUS' | translate }}</th>
              <th>{{ 'ATTENDANCE.COL_COMPLIANCE_NOTES' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (rec of attendanceTable.data; track rec.id) {
              <tr>
                <td><strong>{{ rec.date }}</strong></td>
                <td>{{ rec.clockIn }}</td>
                <td>{{ rec.clockOut ?? ('ATTENDANCE.SHIFT_IN_PROGRESS' | translate) }}</td>
                <td>{{ rec.breakMinutes }} min</td>
                <td><strong>{{ rec.hoursWorked | number: '1.2-2' }} h</strong></td>
                <td>
                  @if (rec.status === 'COMPLETED') {
                    <nz-tag nzColor="blue">{{ 'ATTENDANCE.SHIFT_CLOSED' | translate }}</nz-tag>
                  } @else {
                    <nz-tag nzColor="processing">{{ 'ATTENDANCE.SHIFT_ACTIVE' | translate }}</nz-tag>
                  }
                </td>
                <td>
                  <span class="compliance-text">
                    <i class="fa-solid fa-circle-check" style="color: #10b981;"></i> {{ rec.complianceNotice }}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    </nz-spin>
  `,
  styles: `
    .top-row {
      margin-bottom: 20px;
    }

    .terminal-card,
    .gauge-card,
    .accrual-card {
      min-height: 240px;
      border-radius: 8px;
    }

    .terminal-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #94a3b8;
    }

    .status-dot.online {
      background: #10b981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
    }

    .status-text {
      font-weight: 600;
      font-size: 13px;
      color: var(--text-primary);
    }

    .today-details {
      font-size: 13px;
      line-height: 1.6;
      color: var(--text-secondary);
    }

    .today-details p {
      margin-bottom: 4px;
    }

    .clock-toggle-btn {
      height: 42px;
      font-weight: 600;
      border-radius: 6px;
      margin-top: 4px;
    }

    .gauge-content {
      display: flex;
      align-items: center;
      gap: 20px;
      padding-top: 8px;
    }

    .gauge-meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .stat-highlight {
      font-size: 16px;
      margin: 0;
      color: var(--text-primary);
    }

    .stat-sub {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 0;
    }

    .accrual-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .accrual-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 16px;
      font-size: 12px;
      color: var(--text-secondary);
      border-top: 1px solid var(--border-color);
      padding-top: 10px;
    }

    .records-card {
      border-radius: 8px;
    }

    .compliance-text {
      font-size: 12px;
      color: var(--text-secondary);
    }
  `,
})
export class TimeAttendanceComponent implements OnInit {
  readonly store = inject(TimeAttendanceStore);

  ngOnInit(): void {
    this.store.loadData();
  }
}
