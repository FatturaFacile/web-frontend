import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FetchGridModel, HrTimeApiService, I18nService, MealBookingPayload, PaginatedResponse, QueryFilterParams } from '@core';
import { BaseTableComponent, TableColumnDef, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { of, tap } from 'rxjs';
import { ActionFormComponent, ActionFormConfig } from '../shared/action-form/action-form.component';
import { CrudOption } from '../shared/crud/crud.types';

type MealRow = Record<string, unknown>;

type MealQuery = QueryFilterParams & { employee_id?: string | null; from?: string; to?: string };

const EMPTY_PAGE = { success: true, message: '', data: [], meta: { total: 0 } } as unknown as PaginatedResponse<MealRow>;

const SOURCES = ['badge', 'terminal', 'web', 'mobile', 'spreadsheet', 'paper', 'manual'];

/** Meal bookings of a period and the booking of a meal (for yourself or, with the right, for an employee). */
@Component({
  selector: 'app-time-meals',
  styleUrl: './time-meals.component.scss',
  imports: [
    BaseTableComponent,
    ActionFormComponent,
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    TranslatePipe,
  ],
  template: `
    <app-action-form [config]="bookConfig()" [canWrite]="canWrite()" />

    <h3 class="mt-4">{{ 'hrmTimeX.mealBookings' | translate }}</h3>
    <div class="filter-bar">
      <div>
        <label for="meal-employee">{{ 'hrmCommon.employee' | translate }}</label>
        <nz-select
          id="meal-employee"
          class="w-field-md"
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
    @if (searched()) {
      <app-base-table [grid]="grid" [columns]="columns()" [size]="'small'" [scroll]="{}" exportFileName="meal-bookings" />
      <ng-template #occurredTpl let-row>{{ text(row['occurred_at']) | date: 'medium' }}</ng-template>
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
  protected readonly searched = signal(false);
  /** Server-driven grid of the bookings of the period (it only loads once a period is chosen). */
  protected readonly grid = new FetchGridModel<MealRow, MealQuery>((query) =>
    query.from && query.to ? this.api.getMealBookings({ ...query, from: query.from, to: query.to }) : of(EMPTY_PAGE),
  );
  private readonly occurredTpl = viewChild<TemplateRef<unknown>>('occurredTpl');
  protected readonly loading = computed(() => this.grid.loading());
  protected readonly columns = computed<TableColumnDef<MealRow>[]>(() => {
    return [
      {
        key: 'user_id',
        header: 'hrmCommon.employee',
        valueGetter: (row) => this.employeeName(row['user_id']),
        valueLabel: (value) => this.employeeName(value),
      },
      { key: 'meal_type', header: 'hrmTimeX.mealType' },
      { key: 'occurred_at', header: 'hrmTime.occurredAt', customCellTemplate: this.occurredTpl() },
      { key: 'source', header: 'hrmTime.source' },
    ];
  });
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
      { key: 'note', labelKey: 'hrmCommon.notes', type: 'text', nullable: true, maxLength: 1000 },
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
    this.searched.set(true);
    this.grid.setFilter({ employee_id: this.employeeId(), from: this.from(), to: this.to() });
  }
}
