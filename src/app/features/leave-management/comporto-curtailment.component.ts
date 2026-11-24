import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService, LeaveCountryCode, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { LeaveManagementNavComponent } from './leave-management-nav.component';
import { LeaveManagementStore } from './leave-management.store';
import { DEADLINE_ALERT_COLORS } from './leave-management.util';

/**
 * Monitor for Italian Periodo di Comporto, Swiss Art. 329b CO Ferienkürzung (1/12 per full month
 * beyond grace), vacation expiration alerts, and CH/IT Payroll Absence Integration Feed (Mod 076 / Mod 077).
 */
@Component({
  selector: 'app-comporto-curtailment',
  imports: [
    DecimalPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzInputNumberModule,
    NzProgressModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    LeaveManagementNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'leaveMgmt.title' | translate"
      [subtitle]="'leaveMgmt.subtitle' | translate"
    />
    <app-leave-management-nav activeTab="comporto" />

    <nz-card class="mb-4">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-5 items-end">
        <div>
          <label class="block text-xs font-medium mb-1" for="cmp-emp">{{
            'leaveMgmt.field.employee' | translate
          }}</label>
          <nz-select
            nzId="cmp-emp"
            class="w-full"
            nzShowSearch
            [ngModel]="employeeId()"
            (ngModelChange)="employeeId.set($event)"
          >
            @for (emp of store.employees(); track emp.id) {
              <nz-option [nzValue]="emp.id" [nzLabel]="emp.full_name" />
            }
          </nz-select>
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="cmp-year">Year</label>
          <nz-input-number
            id="cmp-year"
            class="w-full"
            [ngModel]="fiscalYear()"
            (ngModelChange)="fiscalYear.set($event)"
            [nzMin]="2020"
            [nzMax]="2050"
          />
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="cmp-month">Payroll Month</label>
          <nz-input-number
            id="cmp-month"
            class="w-full"
            [ngModel]="month()"
            (ngModelChange)="month.set($event)"
            [nzMin]="1"
            [nzMax]="12"
          />
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="cmp-country">{{
            'leaveMgmt.field.country' | translate
          }}</label>
          <nz-select
            nzId="cmp-country"
            class="w-full"
            [ngModel]="country()"
            (ngModelChange)="country.set($event)"
          >
            <nz-option nzValue="CH" [nzLabel]="'leaveMgmt.country.CH' | translate" />
            <nz-option nzValue="IT" [nzLabel]="'leaveMgmt.country.IT' | translate" />
          </nz-select>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="lm-evaluate-comporto-btn"
            [disabled]="!employeeId()"
            [nzLoading]="store.loading()"
            (click)="evaluate(false)"
          >
            {{ 'leaveMgmt.action.evaluate' | translate }}
          </button>
          @if (canManage()) {
            <button
              nz-button
              type="button"
              [disabled]="!employeeId() || country() !== 'CH'"
              (click)="evaluate(true)"
            >
              {{ 'leaveMgmt.action.applyCurtailment' | translate }}
            </button>
          }
        </div>
      </div>
    </nz-card>

    @if (store.comportoEvaluation(); as evalData) {
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
        <nz-card [nzTitle]="'leaveMgmt.comporto.title' | translate">
          <nz-progress
            class="mb-3"
            [nzPercent]="evalData.italian_comporto.utilization_percent"
            [nzStatus]="evalData.italian_comporto.status === 'exceeded' ? 'exception' : 'active'"
          />
          <nz-descriptions nzBordered [nzColumn]="1" nzSize="small">
            <nz-descriptions-item nzTitle="Window (Months)">{{
              evalData.italian_comporto.window_months
            }}</nz-descriptions-item>
            <nz-descriptions-item nzTitle="Max Comporto Days">{{
              evalData.italian_comporto.max_days
            }}</nz-descriptions-item>
            <nz-descriptions-item nzTitle="Sick Days in Window">{{
              evalData.italian_comporto.sick_days_in_window
            }}</nz-descriptions-item>
            <nz-descriptions-item nzTitle="Remaining Days">{{
              evalData.italian_comporto.remaining_days
            }}</nz-descriptions-item>
            <nz-descriptions-item nzTitle="Status">
              <nz-tag [nzColor]="evalData.italian_comporto.status === 'ok' ? 'green' : 'red'">
                {{ evalData.italian_comporto.status }}
              </nz-tag>
            </nz-descriptions-item>
          </nz-descriptions>
        </nz-card>

        <nz-card [nzTitle]="'leaveMgmt.curtailment.title' | translate">
          <nz-descriptions nzBordered [nzColumn]="1" nzSize="small">
            <nz-descriptions-item nzTitle="Art. 329a CO Base Entitlement">
              {{ evalData.swiss_curtailment.art329a_base_entitlement_days }} d
            </nz-descriptions-item>
            <nz-descriptions-item nzTitle="Grace Months (Franchigia)">
              {{ evalData.swiss_curtailment.grace_months }}
            </nz-descriptions-item>
            <nz-descriptions-item nzTitle="Qualifying Absence Days / Full Months">
              {{ evalData.swiss_curtailment.qualifying_absence_days }} d ({{
                evalData.swiss_curtailment.full_absence_months
              }}
              m)
            </nz-descriptions-item>
            <nz-descriptions-item nzTitle="Curtailment Fraction (Art. 329b CO)">
              <nz-tag nzColor="blue">{{ evalData.swiss_curtailment.reduction_fraction }}</nz-tag>
              (-{{ evalData.swiss_curtailment.reduction_days }} d)
            </nz-descriptions-item>
            <nz-descriptions-item nzTitle="Net Entitlement">
              <strong>{{ evalData.swiss_curtailment.net_entitlement_days }} d</strong>
            </nz-descriptions-item>
          </nz-descriptions>
        </nz-card>
      </div>

      @if (evalData.vacation_deadline_alerts.length > 0) {
        <nz-card class="mb-4" [nzTitle]="'leaveMgmt.ledger.deadline' | translate">
          @for (al of evalData.vacation_deadline_alerts; track al.leave_type) {
            <nz-alert
              class="mb-2"
              [nzType]="
                al.alert_level === 'expired' || al.alert_level === 'critical' ? 'error' : 'warning'
              "
              nzShowIcon
              [nzMessage]="
                ('leaveMgmt.type.' + al.leave_type | translate) +
                ': ' +
                al.expiring_amount +
                ' — ' +
                al.deadline_date
              "
            />
          }
        </nz-card>
      }
    }

    @if (canManage()) {
      <nz-card [nzTitle]="'leaveMgmt.payrollFeed.title' | translate">
        <div class="mb-3">
          <button nz-button type="button" (click)="loadPayroll()" [nzLoading]="store.loading()">
            {{ 'leaveMgmt.payrollFeed.title' | translate }}
          </button>
        </div>
        <nz-table #payrollTable [nzData]="store.payrollSummary()" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'leaveMgmt.field.employee' | translate }}</th>
              <th>{{ 'leaveMgmt.field.country' | translate }}</th>
              <th nzAlign="right">Days</th>
              <th nzAlign="right">Hours</th>
              <th nzAlign="right">{{ 'leaveMgmt.ledger.curtailment' | translate }}</th>
              <th>PUC / SUVA / INAIL</th>
            </tr>
          </thead>
          <tbody>
            @for (row of payrollTable.data; track row.employee_id) {
              <tr>
                <td>{{ row.employee_name || row.employee_id }}</td>
                <td>
                  <nz-tag>{{ row.country }}</nz-tag>
                </td>
                <td nzAlign="right">{{ row.total_absence_days | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ row.total_absence_hours | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ row.curtailment_reduction_days | number: '1.2-2' }}</td>
                <td>
                  @for (p of row.inps_puc_protocols; track p) {
                    <nz-tag nzColor="volcano">PUC: {{ p }}</nz-tag>
                  }
                  @for (s of row.suva_claims; track s) {
                    <nz-tag nzColor="red">SUVA: {{ s }}</nz-tag>
                  }
                  @for (i of row.inail_claims; track i) {
                    <nz-tag nzColor="orange">INAIL: {{ i }}</nz-tag>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
  `,
})
export class ComportoCurtailmentComponent implements OnInit {
  protected readonly store = inject(LeaveManagementStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly employeeId = signal('');
  protected readonly fiscalYear = signal(new Date().getFullYear());
  protected readonly month = signal(new Date().getMonth() + 1);
  protected readonly country = signal<LeaveCountryCode>('CH');

  protected readonly canManage = computed(
    () => this.permissions.canWrite('hr') || this.permissions.canWrite('leave_management'),
  );

  ngOnInit(): void {
    void this.store.loadDirectory();
    if (this.canManage()) {
      void this.loadPayroll();
    }
  }

  protected async evaluate(applyCurtailment: boolean): Promise<void> {
    if (!this.employeeId()) {
      return;
    }
    try {
      await this.store.evaluateComporto({
        employee_id: this.employeeId(),
        fiscal_year: this.fiscalYear(),
        country: this.country(),
        apply_curtailment: applyCurtailment,
      });
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected async loadPayroll(): Promise<void> {
    try {
      await this.store.loadPayrollSummary({
        year: this.fiscalYear(),
        month: this.month(),
        country: this.country(),
      });
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected alertColor(level: keyof typeof DEADLINE_ALERT_COLORS): string {
    return DEADLINE_ALERT_COLORS[level] ?? 'default';
  }
}
