import { Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FetchGridModel, HrLeaveApiService, I18nService, LeaveBalanceResource } from '@core';
import { BaseTableComponent, TableColumnDef, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { reportHttpError } from '../shared/hr-http.util';

/** Leave balances (decimal-string hours) and the monthly accrual run. */
@Component({
  selector: 'app-leave-balances',
  styleUrl: './leave-balances.component.scss',
  imports: [BaseTableComponent, FormsModule, NzButtonModule, NzInputModule, TranslatePipe],
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
    <app-base-table [grid]="grid" [columns]="columns()" [scroll]="{}" exportFileName="leave-balances" />

    <ng-template #employeeTpl let-row>{{ row.employee_name || row.employee_id.slice(0, 8) }}</ng-template>
    <ng-template #availableTpl let-row><strong>{{ row.available_hours }}</strong></ng-template>
  `,
})
export class LeaveBalancesComponent {
  readonly canWrite = input(false);

  private readonly api = inject(HrLeaveApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** Server-driven grid of the balances. */
  protected readonly grid = new FetchGridModel<LeaveBalanceResource>((query) => this.api.getLeaveBalances(undefined, query));
  private readonly employeeTpl = viewChild<TemplateRef<unknown>>('employeeTpl');
  private readonly availableTpl = viewChild<TemplateRef<unknown>>('availableTpl');
  protected readonly columns = computed<TableColumnDef<LeaveBalanceResource>[]>(() => {
    return [
      { key: 'employee_name', serverKey: 'employee.full_name', header: 'hrmCommon.employee', customCellTemplate: this.employeeTpl() },
      { key: 'fiscal_year', header: 'hrmCommon.year' },
      { key: 'entitlement_hours', header: 'hrmSelfService.entitlement', align: 'right' },
      { key: 'carryover_hours', header: 'hrmSelfService.carryover', align: 'right' },
      { key: 'accrued_hours', header: 'hrmSelfService.accrued', align: 'right' },
      { key: 'used_hours', header: 'hrmSelfService.used', align: 'right' },
      { key: 'pending_hours', header: 'hrmSelfService.pending', align: 'right' },
      { key: 'available_hours', header: 'hrmSelfService.available', align: 'right', customCellTemplate: this.availableTpl() },
    ];
  });
  protected readonly accruing = signal(false);
  protected readonly month = signal<number | null>(null);

  protected reload(): void {
    this.grid.reload();
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
