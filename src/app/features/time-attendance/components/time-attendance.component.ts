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
import { PageHeaderComponent } from '@shared';
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
  ],
  template: `
    <app-page-header
      title="Rilevazione Presenze & Compliance Oraria (IT / CH)"
      subtitle="Cartellino orario, monitoraggio limiti settimanali ArG (45h/50h) e riposo giornaliero D.Lgs. 66/2003"
    />

    <nz-spin [nzSpinning]="store.isLoading()">
      <!-- Top Row: Clock-in Terminal & Compliance Gauges -->
      <div nz-row [nzGutter]="16" class="top-row">
        <!-- Interactive Clock-In Widget -->
        <div nz-col [nzXs]="24" [nzLg]="8">
          <nz-card nzTitle="Terminale Timbratura Virtuale" class="terminal-card">
            <div class="terminal-content">
              <div class="status-indicator">
                <span class="status-dot" [class.online]="store.isClockedIn()"></span>
                <span class="status-text">
                  {{ store.isClockedIn() ? 'In Servizio (Clocked-In)' : 'Non in Servizio' }}
                </span>
              </div>

              <div class="today-details">
                <p><strong>Inizio Turno Oggi:</strong> {{ store.data()?.todaySession?.clockInTime ?? '--:--' }}</p>
                <p><strong>Pausa Registrata:</strong> {{ store.data()?.todaySession?.breakMinutes ?? 0 }} min</p>
                <p><strong>Ore Lavorate Oggi:</strong> {{ store.data()?.todaySession?.totalTodayHours | number: '1.2-2' }} h</p>
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
                  <i class="fa-solid fa-right-from-bracket fa-icon-spaced"></i> Registra Uscita (Clock-Out)
                } @else {
                  <i class="fa-solid fa-right-to-bracket fa-icon-spaced"></i> Registra Ingresso (Clock-In)
                }
              </button>
            </div>
          </nz-card>
        </div>

        <!-- Swiss ArG Limit Tracker -->
        <div nz-col [nzXs]="24" [nzLg]="8">
          <nz-card nzTitle="Compliance Limiti Settimanali (ArG / D.Lgs. 66)" class="gauge-card">
            <div class="gauge-content">
              <div class="progress-wrap">
                <nz-progress
                  [nzPercent]="store.weeklyPercent()"
                  [nzStrokeColor]="store.weeklyPercent() > 90 ? '#ff4d4f' : '#1677ff'"
                  nzType="dashboard"
                  [nzWidth]="120"
                />
              </div>
              <div class="gauge-meta">
                <p class="stat-highlight">
                  <strong>{{ store.weeklyWorked() }} h</strong> / {{ store.weeklyLimit() }} h
                </p>
                <p class="stat-sub">Regime: {{ store.summary()?.regime }}</p>
                <nz-tag nzColor="success">
                  <i class="fa-solid fa-shield-check fa-icon-spaced"></i>
                  Riposo 11h Conforme
                </nz-tag>
              </div>
            </div>
          </nz-card>
        </div>

        <!-- Vacation & ROL Accruals -->
        <div nz-col [nzXs]="24" [nzLg]="8">
          <nz-card nzTitle="Saldo Ferie & Permessi (Accruals)" class="accrual-card">
            <div nz-row [nzGutter]="16">
              <div nz-col [nzSpan]="12">
                <nz-statistic
                  [nzValue]="store.vacations()?.remainingDays ?? 0"
                  nzTitle="Ferie Residue"
                  [nzSuffix]="'gg'"
                  [nzValueStyle]="{ color: '#52c41a' }"
                />
              </div>
              <div nz-col [nzSpan]="12">
                <nz-statistic
                  [nzValue]="store.vacations()?.rolHoursAvailable ?? 0"
                  nzTitle="ROL / Banca Ore"
                  [nzSuffix]="'ore'"
                  [nzValueStyle]="{ color: '#1677ff' }"
                />
              </div>
            </div>
            <div class="accrual-info">
              <span>Spettanza annuale: {{ store.vacations()?.annualEntitlementDays }} giorni</span>
              <span>Goduti: {{ store.vacations()?.takenDays }} giorni</span>
            </div>
          </nz-card>
        </div>
      </div>

      <!-- Bottom: Attendance Records Table -->
      <nz-card nzTitle="Registro Timbrature e Dettaglio Settimanale" class="records-card">
        <nz-table
          #attendanceTable
          [nzData]="store.records()"
          [nzFrontPagination]="true"
          [nzPageSize]="5"
          nzSize="middle"
        >
          <thead>
            <tr>
              <th>Data</th>
              <th>Entrata</th>
              <th>Uscita</th>
              <th>Pausa (min)</th>
              <th>Ore Totali</th>
              <th>Stato Turno</th>
              <th>Note di Conformità Legale</th>
            </tr>
          </thead>
          <tbody>
            @for (rec of attendanceTable.data; track rec.id) {
              <tr>
                <td><strong>{{ rec.date }}</strong></td>
                <td>{{ rec.clockIn }}</td>
                <td>{{ rec.clockOut ?? 'In corso...' }}</td>
                <td>{{ rec.breakMinutes }} min</td>
                <td><strong>{{ rec.hoursWorked | number: '1.2-2' }} h</strong></td>
                <td>
                  @if (rec.status === 'COMPLETED') {
                    <nz-tag nzColor="blue">Chiuso</nz-tag>
                  } @else {
                    <nz-tag nzColor="processing">Attivo</nz-tag>
                  }
                </td>
                <td>
                  <span class="compliance-text">
                    <i class="fa-solid fa-circle-check" style="color: #52c41a;"></i> {{ rec.complianceNotice }}
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
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #d9d9d9;
    }

    .status-dot.online {
      background-color: #52c41a;
      box-shadow: 0 0 8px rgba(82, 196, 26, 0.6);
    }

    .status-text {
      font-weight: 600;
      font-size: 14px;
    }

    .today-details p {
      margin: 4px 0;
      font-size: 13px;
      color: #595959;
    }

    .clock-toggle-btn {
      margin-top: 8px;
      font-weight: 600;
    }

    .gauge-content {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 10px 0;
    }

    .gauge-meta .stat-highlight {
      font-size: 18px;
      margin: 0;
    }

    .gauge-meta .stat-sub {
      font-size: 12px;
      color: #8c8c8c;
      margin: 4px 0 10px 0;
    }

    .accrual-info {
      margin-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: #8c8c8c;
      border-top: 1px solid #f0f0f0;
      padding-top: 12px;
    }

    .records-card {
      border-radius: 8px;
    }

    .compliance-text {
      font-size: 12px;
      color: #262626;
    }
  `,
})
export class TimeAttendanceComponent implements OnInit {
  readonly store = inject(TimeAttendanceStore);

  ngOnInit(): void {
    this.store.loadData();
  }
}
