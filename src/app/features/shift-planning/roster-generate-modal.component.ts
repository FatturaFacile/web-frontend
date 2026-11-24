import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  EmployeeResource,
  GenerateRosterPayload,
  HrApiService,
  RosterPeriod,
  RosterPeriodType,
  RotationPattern,
  ROTATION_PATTERNS,
  ShiftPlanningApiService,
  ShiftTemplate,
  TranslateService,
} from '@core';
import { TranslatePipe, RadioControlDirective } from '@shared';
import { periodStart, templateLabel } from './shift-planning.util';

/**
 * Creates a draft roster: a rotation pattern (5x2, 6x6) laid over a team and a set of shift templates, or a copy of a
 * previous period. The period type decides the length (a week or the calendar month of the start date).
 */
@Component({
  selector: 'app-roster-generate-modal',
  imports: [
    RadioControlDirective,
    ReactiveFormsModule,
    TranslatePipe,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzRadioModule,
    NzSelectModule,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'SHIFT_PLANNING.GENERATE' | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="!canSubmit()"
      [nzOkText]="'SHIFT_PLANNING.GENERATE' | translate"
      (nzOnCancel)="open.set(false)"
      (nzOnOk)="submit()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label>{{ 'SHIFT_PLANNING.MODE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-radio-group formControlName="mode">
                <label for="roster-generate-modal-pattern" appRadioControl nz-radio nzValue="pattern">{{
                  'SHIFT_PLANNING.MODE_PATTERN' | translate
                }}</label>
                <label for="roster-generate-modal-clone" appRadioControl nz-radio nzValue="clone">{{
                  'SHIFT_PLANNING.MODE_CLONE' | translate
                }}</label>
              </nz-radio-group>
            </nz-form-control>
          </nz-form-item>

          <div class="row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="gen-type">{{
                'SHIFT_PLANNING.PERIOD_TYPE' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="gen-type" formControlName="period_type">
                  <nz-option
                    nzValue="weekly"
                    [nzLabel]="'SHIFT_PLANNING.WEEKLY' | translate"
                  ></nz-option>
                  <nz-option
                    nzValue="monthly"
                    [nzLabel]="'SHIFT_PLANNING.MONTHLY' | translate"
                  ></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="gen-start">{{
                'SHIFT_PLANNING.START_DATE' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="gen-start" type="date" formControlName="start_date"
              /></nz-form-control>
            </nz-form-item>
          </div>

          @if (form.controls.mode.value === 'pattern') {
            <nz-form-item>
              <nz-form-label nzRequired nzFor="gen-pattern">{{
                'SHIFT_PLANNING.PATTERN' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="gen-pattern" formControlName="pattern">
                  @for (pattern of patterns; track pattern) {
                    <nz-option
                      [nzValue]="pattern"
                      [nzLabel]="'SHIFT_PLANNING.PATTERN_' + pattern.toUpperCase() | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="gen-employees">{{
                'SHIFT_PLANNING.TEAM' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select
                  nzId="gen-employees"
                  nzMode="multiple"
                  nzShowSearch
                  formControlName="employee_ids"
                >
                  @for (employee of employees(); track employee.id) {
                    <nz-option [nzValue]="employee.id" [nzLabel]="employee.full_name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="gen-templates">{{
                'SHIFT_PLANNING.TEMPLATES' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select
                  nzId="gen-templates"
                  nzMode="multiple"
                  formControlName="shift_template_ids"
                >
                  @for (template of templates(); track template.id) {
                    <nz-option
                      [nzValue]="template.id"
                      [nzLabel]="template.code + ' · ' + label(template)"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          } @else {
            <nz-form-item>
              <nz-form-label nzRequired nzFor="gen-source">{{
                'SHIFT_PLANNING.SOURCE_PERIOD' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="gen-source" formControlName="source_period_id">
                  @for (period of periods(); track period.id) {
                    <nz-option
                      [nzValue]="period.id"
                      [nzLabel]="period.start_date + ' – ' + period.end_date"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
  `,
})
export class RosterGenerateModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly hr = inject(HrApiService);
  private readonly shiftApi = inject(ShiftPlanningApiService);
  private readonly translate = inject(TranslateService);

  readonly open = model(false);
  readonly templates = input<ShiftTemplate[]>([]);
  readonly saving = input(false);
  readonly generated = output<GenerateRosterPayload>();

  readonly patterns = ROTATION_PATTERNS;
  readonly employees = signal<EmployeeResource[]>([]);
  readonly periods = signal<RosterPeriod[]>([]);

  readonly form = this.fb.group({
    mode: this.fb.control<'pattern' | 'clone'>('pattern'),
    period_type: this.fb.control<RosterPeriodType>('weekly'),
    start_date: this.fb.control(periodStart(new Date().toISOString().slice(0, 10), 'weekly'), [
      Validators.required,
    ]),
    pattern: this.fb.control<RotationPattern>('5x2'),
    employee_ids: this.fb.control<string[]>([]),
    shift_template_ids: this.fb.control<string[]>([]),
    source_period_id: this.fb.control(''),
  });

  readonly canSubmit = computed(() => {
    // Recomputes on every form change through the signal bridge below.
    const value = this.valueSignal();
    return (
      value.start_date !== '' &&
      (value.mode === 'pattern'
        ? value.employee_ids.length > 0 && value.shift_template_ids.length > 0
        : value.source_period_id !== '')
    );
  });

  private readonly valueSignal = signal(this.form.getRawValue());

  constructor() {
    this.form.valueChanges.subscribe(() => this.valueSignal.set(this.form.getRawValue()));

    effect(() => {
      if (this.open() && this.employees().length === 0) {
        this.hr.getEmployees({ per_page: 200 }).subscribe({
          next: (response) => this.employees.set(response.data),
          error: () => undefined,
        });
        this.shiftApi.getPeriods().subscribe({
          next: (response) => this.periods.set(response.data),
          error: () => undefined,
        });
      }
    });
  }

  label(template: ShiftTemplate): string {
    return templateLabel(template.name, this.translate.currentLanguage());
  }

  submit(): void {
    const value = this.form.getRawValue();
    const base: GenerateRosterPayload = {
      period_type: value.period_type,
      start_date: periodStart(value.start_date, value.period_type),
    };

    this.generated.emit(
      value.mode === 'pattern'
        ? {
            ...base,
            pattern: value.pattern,
            employee_ids: value.employee_ids,
            shift_template_ids: value.shift_template_ids,
          }
        : { ...base, source_period_id: value.source_period_id },
    );
  }
}
