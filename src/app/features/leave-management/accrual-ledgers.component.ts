import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService, LeaveCountryCode, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { LeaveManagementNavComponent } from './leave-management-nav.component';
import { LeaveManagementStore } from './leave-management.store';
import { DEADLINE_ALERT_COLORS } from './leave-management.util';

/**
 * Employee Leave Accrual Ledgers (Estratto Conto Ratei) separating Italian Ferie / ROL / Ex-Festività
 * (with 18-month INPS contribution alerts) and Swiss Ferien (Art. 329a / 329b CO).
 */
@Component({
  selector: 'app-accrual-ledgers',
  imports: [
    DecimalPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputNumberModule,
    NzSelectModule,
    NzStatisticModule,
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
    <app-leave-management-nav activeTab="ledgers" />

    <nz-card class="mb-4">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-5 items-end">
        <div>
          <label class="block text-xs font-medium mb-1" for="ledg-year">{{
            'leaveMgmt.field.startDate' | translate
          }}</label>
          <nz-input-number
            id="ledg-year"
            class="w-full"
            [ngModel]="fiscalYear()"
            (ngModelChange)="fiscalYear.set($event)"
            [nzMin]="2020"
            [nzMax]="2050"
          />
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="ledg-month">Month</label>
          <nz-input-number
            id="ledg-month"
            class="w-full"
            [ngModel]="month()"
            (ngModelChange)="month.set($event)"
            [nzMin]="1"
            [nzMax]="12"
          />
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="ledg-country">{{
            'leaveMgmt.field.country' | translate
          }}</label>
          <nz-select
            nzId="ledg-country"
            class="w-full"
            nzAllowClear
            [ngModel]="country()"
            (ngModelChange)="country.set($event ?? '')"
          >
            <nz-option nzValue="CH" [nzLabel]="'leaveMgmt.country.CH' | translate" />
            <nz-option nzValue="IT" [nzLabel]="'leaveMgmt.country.IT' | translate" />
          </nz-select>
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="ledg-emp">{{
            'leaveMgmt.field.employee' | translate
          }}</label>
          <nz-select
            nzId="ledg-emp"
            class="w-full"
            nzAllowClear
            nzShowSearch
            [ngModel]="employeeId()"
            (ngModelChange)="employeeId.set($event ?? '')"
          >
            @for (emp of store.employees(); track emp.id) {
              <nz-option [nzValue]="emp.id" [nzLabel]="emp.full_name" />
            }
          </nz-select>
        </div>
        <div class="flex gap-2">
          <button nz-button type="button" [nzLoading]="store.loading()" (click)="reload()">
            {{ 'leaveMgmt.tab.ledgers' | translate }}
          </button>
          @if (canManage()) {
            <button
              nz-button
              nzType="primary"
              type="button"
              data-testid="lm-run-accruals-btn"
              [nzLoading]="store.saving()"
              (click)="runMonthlyAccruals()"
            >
              {{ 'leaveMgmt.action.calculateAccruals' | translate }}
            </button>
          }
        </div>
      </div>
    </nz-card>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
      <nz-card>
        <nz-statistic
          [nzTitle]="'leaveMgmt.tab.ledgers' | translate"
          [nzValue]="store.ledgers().length"
        />
      </nz-card>
      <nz-card>
        <nz-statistic
          [nzTitle]="'leaveMgmt.ledger.deadline' | translate"
          [nzValue]="store.expiringLedgersCount()"
        />
      </nz-card>
      <nz-card>
        <nz-statistic
          [nzTitle]="'leaveMgmt.ledger.projected' | translate"
          [nzValue]="(totalProjectedBalance() | number: '1.2-2') ?? ''"
        />
      </nz-card>
    </div>

    @if (store.expiringLedgersCount() > 0) {
      <nz-alert
        class="mb-4"
        nzType="warning"
        nzShowIcon
        [nzMessage]="'leaveMgmt.ledger.deadline' | translate"
      />
    }

    <nz-card>
      <nz-table
        #ledgerTable
        [nzData]="store.ledgers()"
        [nzLoading]="store.loading()"
        nzSize="middle"
      >
        <thead>
          <tr>
            <th>{{ 'leaveMgmt.field.employee' | translate }}</th>
            <th>{{ 'leaveMgmt.field.country' | translate }}</th>
            <th>{{ 'leaveMgmt.field.leaveType' | translate }}</th>
            <th nzAlign="right">{{ 'leaveMgmt.ledger.carryOver' | translate }}</th>
            <th nzAlign="right">{{ 'leaveMgmt.ledger.accruedYtd' | translate }}</th>
            <th nzAlign="right">{{ 'leaveMgmt.ledger.curtailment' | translate }}</th>
            <th nzAlign="right">{{ 'leaveMgmt.ledger.takenYtd' | translate }}</th>
            <th nzAlign="right">{{ 'leaveMgmt.ledger.plannedFuture' | translate }}</th>
            <th nzAlign="right">{{ 'leaveMgmt.ledger.pending' | translate }}</th>
            <th nzAlign="right">{{ 'leaveMgmt.ledger.projected' | translate }}</th>
            <th>{{ 'leaveMgmt.ledger.deadline' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of ledgerTable.data; track row.id) {
            <tr>
              <td>{{ row.employee_name || row.employee_id.slice(0, 8) }}</td>
              <td>
                <nz-tag>{{ row.country }}</nz-tag>
              </td>
              <td>{{ 'leaveMgmt.type.' + row.leave_type | translate }} ({{ row.unit_mode }})</td>
              <td nzAlign="right">{{ row.prior_year_carry_over | number: '1.2-2' }}</td>
              <td nzAlign="right">{{ row.accrued_ytd | number: '1.2-2' }}</td>
              <td nzAlign="right">{{ row.curtailment_reduction_ytd | number: '1.2-2' }}</td>
              <td nzAlign="right">{{ row.taken_ytd | number: '1.2-2' }}</td>
              <td nzAlign="right">{{ row.planned_approved_future | number: '1.2-2' }}</td>
              <td nzAlign="right">{{ row.pending_approval_amount | number: '1.2-2' }}</td>
              <td nzAlign="right">
                <strong>{{ row.projected_year_end_balance | number: '1.2-2' }}</strong>
              </td>
              <td>
                @if (row.expiration_deadline_date) {
                  <nz-tag [nzColor]="alertColor(row.deadline_alert_level)">
                    {{ row.expiration_deadline_date }} ({{ row.expiring_carry_over_amount }})
                  </nz-tag>
                } @else {
                  <span>—</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class AccrualLedgersComponent implements OnInit {
  protected readonly store = inject(LeaveManagementStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly fiscalYear = signal(new Date().getFullYear());
  protected readonly month = signal(new Date().getMonth() + 1);
  protected readonly country = signal<LeaveCountryCode | ''>('');
  protected readonly employeeId = signal('');

  protected readonly canManage = computed(
    () => this.permissions.canWrite('hr') || this.permissions.canWrite('leave_management'),
  );

  protected readonly totalProjectedBalance = computed(() =>
    this.store.ledgers().reduce((acc, item) => acc + item.projected_year_end_balance, 0),
  );

  ngOnInit(): void {
    void this.store.loadDirectory();
    void this.reload();
  }

  protected async reload(): Promise<void> {
    try {
      await this.store.loadLedgers({
        fiscal_year: this.fiscalYear(),
        country: this.country() || undefined,
        employee_id: this.employeeId() || undefined,
      });
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected async runMonthlyAccruals(): Promise<void> {
    try {
      const processed = await this.store.calculateMonthlyAccruals({
        fiscal_year: this.fiscalYear(),
        month: this.month(),
        country: this.country() || undefined,
        employee_id: this.employeeId() || undefined,
      });
      this.message.success(`${processed}`);
      await this.reload();
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected alertColor(level: keyof typeof DEADLINE_ALERT_COLORS): string {
    return DEADLINE_ALERT_COLORS[level] ?? 'default';
  }
}
