import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HrTimeApiService, I18nService, MealBookingPayload } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { tap } from 'rxjs';
import { ActionFormComponent, ActionFormConfig } from '../shared/action-form/action-form.component';
import { CrudOption } from '../shared/crud/crud.types';
import { reportHttpError } from '../shared/hr-http.util';

const SOURCES = ['badge', 'terminal', 'web', 'mobile', 'spreadsheet', 'paper', 'manual'];

/** Meal bookings of a period and the booking of a meal (for yourself or, with the right, for an employee). */
@Component({
  selector: 'app-time-meals',
  imports: [
    ActionFormComponent,
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
  ],
  template: `
    <app-action-form [config]="bookConfig()" [canWrite]="canWrite()" />

    <h3 class="mt-4">{{ 'hrmTimeX.mealBookings' | translate }}</h3>
    <div class="flex items-end gap-2 mb-3 flex-wrap">
      <div>
        <label for="meal-employee">{{ 'hrmCommon.employee' | translate }}</label>
        <nz-select
          id="meal-employee"
         
          nzAllowClear
          nzShowSearch
          [ngModel]="employeeId()"
          (ngModelChange)="employeeId.set($event)"
        >
          @for (option of employees(); track option.value) {
            <nz-option [nzValue]="option.value" [nzLabel]="option.label ?? option.value" />
          }
        </nz-select>
      </div>
      <div>
        <label for="meal-from">{{ 'hrmCommon.from' | translate }}</label>
        <input
          nz-input
          id="meal-from"
          type="date"
          [ngModel]="from()"
          (ngModelChange)="from.set($event)"
        />
      </div>
      <div>
        <label for="meal-to">{{ 'hrmCommon.to' | translate }}</label>
        <input
          nz-input
          id="meal-to"
          type="date"
          [ngModel]="to()"
          (ngModelChange)="to.set($event)"
        />
      </div>
      <button
        nz-button
        type="button"
        [disabled]="!from() || !to()"
        [nzLoading]="loading()"
        (click)="load()"
      >
        {{ 'hrmTimeX.show' | translate }}
      </button>
    </div>
    @if (rows(); as list) {
      <nz-table #table [nzData]="list" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'hrmCommon.employee' | translate }}</th>
            <th>{{ 'hrmTimeX.mealType' | translate }}</th>
            <th>{{ 'hrmTime.occurredAt' | translate }}</th>
            <th>{{ 'hrmTime.source' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track $index) {
            <tr>
              <td>{{ employeeName(row['employee_id']) }}</td>
              <td>{{ row['meal_type'] }}</td>
              <td>{{ text(row['occurred_at']) | date: 'medium' }}</td>
              <td>{{ row['source'] }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class TimeMealsComponent {
  readonly canWrite = input(false);
  readonly employees = input<CrudOption[]>([]);

  private readonly api = inject(HrTimeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly employeeId = signal<string | null>(null);
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly rows = signal<Record<string, unknown>[] | null>(null);
  protected readonly loading = signal(false);
  private readonly names = computed(
    () => new Map(this.employees().map((o) => [o.value, o.label ?? o.value])),
  );

  protected readonly bookConfig = computed<ActionFormConfig>(() => ({
    submitLabelKey: 'hrmTimeX.bookMeal',
    resetOnSuccess: true,
    fields: [
      {
        key: 'meal_type',
        labelKey: 'hrmTimeX.mealType',
        type: 'text',
        required: true,
        maxLength: 30,
        defaultValue: 'lunch',
      },
      {
        key: 'employee_id',
        labelKey: 'hrmCommon.employee',
        type: 'select',
        nullable: true,
        options: () => this.employees(),
      },
      { key: 'occurred_at', labelKey: 'hrmTime.occurredAt', type: 'datetime', nullable: true },
      {
        key: 'source',
        labelKey: 'hrmTime.source',
        type: 'select',
        defaultValue: 'web',
        options: () =>
          SOURCES.map((value) => ({ value, labelKey: `hrmTime.sourceValue.${value}` })),
      },
      { key: 'note', labelKey: 'hrmCommon.notes', type: 'text', nullable: true },
    ],
    submit: (payload) =>
      this.api.bookMeal(payload as unknown as MealBookingPayload).pipe(
        tap(() => {
          if (this.from() && this.to()) {
            this.load();
          }
        }),
      ),
  }));

  protected text(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  protected employeeName(id: unknown): string {
    return typeof id === 'string' ? (this.names().get(id) ?? id.slice(0, 8)) : '-';
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .getMealBookings({ employee_id: this.employeeId(), from: this.from(), to: this.to() })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }
}
