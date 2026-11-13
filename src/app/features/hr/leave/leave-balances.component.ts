import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HrLeaveApiService, I18nService, LeaveBalanceResource } from '@core';
import { TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError } from '../shared/hr-http.util';

/** Leave balances (decimal-string hours) and the monthly accrual run. */
@Component({
  selector: 'app-leave-balances',
  styleUrl: './leave-balances.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    FormsModule, NzButtonModule, NzInputModule, NzTableModule, TranslatePipe],
  template: `
    <div class="flex justify-between items-center mb-3 gap-2">
      <h3 class="m-0">{{ 'hrmLeave.balances' | translate }}</h3>
      @if (canWrite()) {
        <div class="flex items-center gap-2">
          <label for="accrue-month">{{ 'hrmLeave.month' | translate }}</label>
          <input
            nz-input
            id="accrue-month"
            type="number"
            min="1"
            max="12"
            class="w-field-xs"
            [ngModel]="month()"
            (ngModelChange)="month.set($event)"
          />
          <button nz-button nzType="primary" type="button" [nzLoading]="accruing()" (click)="accrue()">
            {{ 'hrmLeave.accrue' | translate }}
          </button>
        </div>
      }
    </div>
    <nz-table #table [nzData]="balances()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
      <thead>
        <tr>
          <th>{{ 'hrmCommon.employee' | translate }}</th>
          <th [nzSortFn]="'fiscal_year' | gridSort" [nzFilters]="'fiscal_year' | gridFilterList: table.nzData" [nzFilterFn]="'fiscal_year' | gridFilterFn">{{ 'hrmCommon.year' | translate }}</th>
          <th [nzSortFn]="'entitlement_hours' | gridSort" [nzFilters]="'entitlement_hours' | gridFilterList: table.nzData" [nzFilterFn]="'entitlement_hours' | gridFilterFn">{{ 'hrmSelfService.entitlement' | translate }}</th>
          <th [nzSortFn]="'carryover_hours' | gridSort" [nzFilters]="'carryover_hours' | gridFilterList: table.nzData" [nzFilterFn]="'carryover_hours' | gridFilterFn">{{ 'hrmSelfService.carryover' | translate }}</th>
          <th [nzSortFn]="'accrued_hours' | gridSort" [nzFilters]="'accrued_hours' | gridFilterList: table.nzData" [nzFilterFn]="'accrued_hours' | gridFilterFn">{{ 'hrmSelfService.accrued' | translate }}</th>
          <th [nzSortFn]="'used_hours' | gridSort" [nzFilters]="'used_hours' | gridFilterList: table.nzData" [nzFilterFn]="'used_hours' | gridFilterFn">{{ 'hrmSelfService.used' | translate }}</th>
          <th [nzSortFn]="'pending_hours' | gridSort" [nzFilters]="'pending_hours' | gridFilterList: table.nzData" [nzFilterFn]="'pending_hours' | gridFilterFn">{{ 'hrmSelfService.pending' | translate }}</th>
          <th [nzSortFn]="'available_hours' | gridSort" [nzFilters]="'available_hours' | gridFilterList: table.nzData" [nzFilterFn]="'available_hours' | gridFilterFn">{{ 'hrmSelfService.available' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.id) {
          <tr>
            <td>{{ row.employee_id.slice(0, 8) }}</td>
            <td>{{ row.fiscal_year }}</td>
            <td>{{ row.entitlement_hours }}</td>
            <td>{{ row.carryover_hours }}</td>
            <td>{{ row.accrued_hours }}</td>
            <td>{{ row.used_hours }}</td>
            <td>{{ row.pending_hours }}</td>
            <td>
              <strong>{{ row.available_hours }}</strong>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class LeaveBalancesComponent implements OnInit {
  readonly canWrite = input(false);

  private readonly api = inject(HrLeaveApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly balances = signal<LeaveBalanceResource[]>([]);
  protected readonly loading = signal(true);
  protected readonly accruing = signal(false);
  protected readonly month = signal<number | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.getLeaveBalances().subscribe({
      next: (res) => {
        this.balances.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }

  protected accrue(): void {
    this.accruing.set(true);
    this.api.accrueLeaveBalances(this.month() ?? undefined).subscribe({
      next: (res) => {
        this.accruing.set(false);
        this.message.success(this.i18n.translate('hrmLeave.accrued', { count: res.data.balances_accrued }));
        this.reload();
      },
      error: (err: unknown) => {
        this.accruing.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
