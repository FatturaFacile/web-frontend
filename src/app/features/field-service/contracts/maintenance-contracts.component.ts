import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  FSM_CALENDAR_UNITS,
  FSM_CONTRACT_STATUSES,
  FSM_COVERAGE_TYPES,
  FsmApiService,
  FsmContractStatus,
  FsmCoverageType,
  FsmEquipment,
  FsmMaintenanceContract,
  FsmMaintenanceContractPayload,
  FsmPreventiveRunResult,
  I18nService,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { CustomerSelectComponent } from '../../warranty-rma/components/shared/customer-select.component';
import { buildFrequencyRule, EMPTY_RULE_FORM, ruleToForm, summariseRule } from './contract-rule.utils';

const STATUS_COLORS: Record<FsmContractStatus, string> = {
  draft: 'default',
  active: 'green',
  suspended: 'orange',
  expired: 'red',
  cancelled: 'default',
};

function isoDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/**
 * Recurring maintenance contracts of the field service: coverage type, preventive frequency rule (calendar and
 * meters), included visits, call-out fee and the covered equipment, plus the manual run of the preventive engine
 * that generates the due work orders (GH-197).
 */
@Component({
  selector: 'app-maintenance-contracts',
  imports: [
    ReactiveFormsModule,
    CustomerSelectComponent,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  styles: `
    .mc-alert {
      margin-bottom: 12px;
    }

    .mc-rule {
      margin-bottom: 16px;
      padding: 8px 12px;
      border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
      border-radius: 6px;
    }

    .mc-rule-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 16px;
    }
  `,
  template: `
    <app-page-header [title]="'FSM.CONTRACTS.TITLE' | translate" [subtitle]="'FSM.CONTRACTS.SUBTITLE' | translate">
      <div header-actions>
        @if (canWrite()) {
          <button nz-button type="button" [nzLoading]="running()" (click)="runPreventive()" data-testid="run-preventive">
            {{ 'FSM.CONTRACTS.RUN_PREVENTIVE' | translate }}
          </button>
          <button nz-button nzType="primary" type="button" (click)="openCreate()">
            {{ 'FSM.CONTRACTS.NEW' | translate }}
          </button>
        }
      </div>
    </app-page-header>

    @if (loadError()) {
      <nz-alert class="mc-alert" nzType="error" nzShowIcon [nzMessage]="'FSM.CONTRACTS.LOAD_ERROR' | translate" />
    }

    @if (runResult(); as result) {
      <nz-alert
        class="mc-alert"
        nzType="success"
        nzShowIcon
        nzCloseable
        data-testid="run-result"
        [nzMessage]="
          'FSM.CONTRACTS.PREVENTIVE_RESULT'
            | translate: { created: result.created.length, evaluated: result.evaluated_assets, skipped: result.skipped_existing }
        "
        (nzOnClose)="runResult.set(null)"
      />
    }

    <nz-card>
      <nz-table nzSize="small" [nzData]="contracts()" [nzLoading]="loading()" [nzShowPagination]="contracts().length > 10" data-testid="contracts-table">
        <thead>
          <tr>
            <th>{{ 'FSM.CONTRACTS.NUMBER' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.NAME' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.STATUS' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.COVERAGE' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.RULE' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.PERIOD' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.VISITS' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.EQUIPMENT' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (c of contracts(); track c.id) {
            <tr>
              <td>{{ c.contract_number }}</td>
              <td>{{ c.title }}</td>
              <td>
                <nz-tag [nzColor]="color(c.status)">{{ 'FSM.CONTRACTS.STATUSES.' + c.status.toUpperCase() | translate }}</nz-tag>
              </td>
              <td>{{ c.coverage_type ? ('FSM.CONTRACTS.COVERAGES.' + c.coverage_type.toUpperCase() | translate) : '-' }}</td>
              <td>{{ ruleSummary(c) || '-' }}</td>
              <td>{{ c.start_date }} &rarr; {{ c.end_date ?? '∞' }}</td>
              <td>{{ c.used_visits_current_year }} / {{ c.included_visits_per_year ?? '∞' }}</td>
              <td>{{ c.equipment_passport_ids.length }}</td>
              <td>
                @if (canWrite()) {
                  <button nz-button nzSize="small" type="button" (click)="openEdit(c)">{{ 'COMMON.EDIT' | translate }}</button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="9">{{ 'FSM.CONTRACTS.EMPTY' | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="(editing() ? 'FSM.CONTRACTS.EDIT' : 'FSM.CONTRACTS.NEW') | translate"
      [nzOkText]="'COMMON.SAVE' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="form.invalid"
      [nzMaskClosable]="false"
      nzWidth="760px"
      (nzOnOk)="save()"
      (nzOnCancel)="modalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        @if (formError()) {
          <nz-alert class="mc-alert" nzType="error" nzShowIcon [nzMessage]="formError()" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="fsm_customer">{{ 'FSM.CONTRACTS.CUSTOMER' | translate }}</nz-form-label>
            <nz-form-control>
              <app-customer-select inputId="fsm_customer" formControlName="customer_id" [initialLabel]="editing()?.customer_id ?? null" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="fsm_number">{{ 'FSM.CONTRACTS.NUMBER' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input id="fsm_number" formControlName="contract_number" maxlength="60" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="fsm_title">{{ 'FSM.CONTRACTS.NAME' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input id="fsm_title" formControlName="title" maxlength="180" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'FSM.CONTRACTS.START_DATE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-date-picker formControlName="start_date" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'FSM.CONTRACTS.END_DATE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-date-picker formControlName="end_date" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="fsm_status">{{ 'FSM.CONTRACTS.STATUS' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="fsm_status" formControlName="status">
                @for (s of statuses; track s) {
                  <nz-option [nzValue]="s" [nzLabel]="'FSM.CONTRACTS.STATUSES.' + s.toUpperCase() | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="fsm_coverage">{{ 'FSM.CONTRACTS.COVERAGE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="fsm_coverage" nzAllowClear formControlName="coverage_type">
                @for (c of coverages; track c) {
                  <nz-option [nzValue]="c" [nzLabel]="'FSM.CONTRACTS.COVERAGES.' + c.toUpperCase() | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <fieldset class="mc-rule" formGroupName="rule">
            <legend>{{ 'FSM.CONTRACTS.PREVENTIVE_RULE' | translate }}</legend>
            <div class="mc-rule-grid">
              <nz-form-item>
                <nz-form-label nzFor="fsm_cal_every">{{ 'FSM.CONTRACTS.CALENDAR_EVERY' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-input-number nzId="fsm_cal_every" formControlName="calendar_every" [nzMin]="1" [nzMax]="120" [nzPrecision]="0" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="fsm_cal_unit">{{ 'FSM.CONTRACTS.CALENDAR_UNIT' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select nzId="fsm_cal_unit" formControlName="calendar_unit">
                    @for (u of units; track u) {
                      <nz-option [nzValue]="u" [nzLabel]="'FSM.CONTRACTS.UNIT_' + u.toUpperCase() | translate" />
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="fsm_meter_hours">{{ 'FSM.CONTRACTS.METER_HOURS' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-input-number nzId="fsm_meter_hours" formControlName="meter_hours" [nzMin]="0" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="fsm_meter_cycles">{{ 'FSM.CONTRACTS.METER_CYCLES' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-input-number nzId="fsm_meter_cycles" formControlName="meter_cycles" [nzMin]="0" [nzPrecision]="0" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="fsm_lead_percent">{{ 'FSM.CONTRACTS.LEAD_PERCENT' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-input-number nzId="fsm_lead_percent" formControlName="meter_lead_percent" [nzMin]="0" [nzMax]="50" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="fsm_lead_days">{{ 'FSM.CONTRACTS.LEAD_DAYS' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-input-number nzId="fsm_lead_days" formControlName="lead_days" [nzMin]="0" [nzMax]="365" [nzPrecision]="0" />
                </nz-form-control>
              </nz-form-item>
            </div>
          </fieldset>

          <nz-form-item>
            <nz-form-label nzFor="fsm_visits">{{ 'FSM.CONTRACTS.INCLUDED_VISITS' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-input-number nzId="fsm_visits" formControlName="included_visits_per_year" [nzMin]="0" [nzPrecision]="0" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="fsm_callout">{{ 'FSM.CONTRACTS.CALLOUT_FEE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-input-number nzId="fsm_callout" formControlName="callout_fee_amount" [nzMin]="0" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="fsm_rate">{{ 'FSM.CONTRACTS.HOURLY_RATE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-input-number nzId="fsm_rate" formControlName="hourly_labor_rate" [nzMin]="0" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="fsm_equipment">{{ 'FSM.CONTRACTS.EQUIPMENT' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="fsm_equipment" nzMode="multiple" nzShowSearch formControlName="equipment_passport_ids" [nzOptions]="equipmentOptions()" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="fsm_notes">{{ 'FSM.CONTRACTS.NOTES' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input id="fsm_notes" rows="3" formControlName="notes" maxlength="5000"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class MaintenanceContractsComponent implements OnInit {
  private readonly api = inject(FsmApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('service'));
  protected readonly statuses = FSM_CONTRACT_STATUSES;
  protected readonly coverages = FSM_COVERAGE_TYPES;
  protected readonly units = FSM_CALENDAR_UNITS;

  protected readonly contracts = signal<FsmMaintenanceContract[]>([]);
  protected readonly equipment = signal<FsmEquipment[]>([]);
  protected readonly equipmentOptions = computed(() => this.equipment().map((e) => ({ value: e.id, label: e.serial_number })));
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly running = signal(false);
  protected readonly runResult = signal<FsmPreventiveRunResult | null>(null);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<FsmMaintenanceContract | null>(null);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    customer_id: this.fb.control<string | null>(null, Validators.required),
    contract_number: this.fb.control('', [Validators.required, Validators.maxLength(60)]),
    title: this.fb.control('', [Validators.required, Validators.maxLength(180)]),
    start_date: this.fb.control<Date | null>(null, Validators.required),
    end_date: this.fb.control<Date | null>(null),
    status: this.fb.control<FsmContractStatus>('draft'),
    coverage_type: this.fb.control<FsmCoverageType | null>(null),
    rule: this.fb.group({
      calendar_every: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(120)]),
      calendar_unit: this.fb.control(EMPTY_RULE_FORM.calendar_unit),
      meter_hours: this.fb.control<number | null>(null, Validators.min(0)),
      meter_cycles: this.fb.control<number | null>(null, Validators.min(0)),
      meter_lead_percent: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(50)]),
      lead_days: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(365)]),
    }),
    included_visits_per_year: this.fb.control<number | null>(null),
    callout_fee_amount: this.fb.control<number | null>(null),
    hourly_labor_rate: this.fb.control<number | null>(null),
    equipment_passport_ids: this.fb.control<string[]>([]),
    notes: this.fb.control<string | null>(null),
  });

  ngOnInit(): void {
    this.load();
    this.api.listEquipment().subscribe({ next: (res) => this.equipment.set(res.data), error: () => this.equipment.set([]) });
  }

  protected color(status: FsmContractStatus): string {
    return STATUS_COLORS[status] ?? 'default';
  }

  protected ruleSummary(contract: FsmMaintenanceContract): string {
    return summariseRule(contract, (key) => this.i18n.translate(key));
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({ status: 'draft', rule: { ...EMPTY_RULE_FORM }, equipment_passport_ids: [] });
    this.modalOpen.set(true);
  }

  protected openEdit(contract: FsmMaintenanceContract): void {
    this.editing.set(contract);
    this.formError.set(null);
    this.form.reset({
      customer_id: contract.customer_id,
      contract_number: contract.contract_number,
      title: contract.title,
      start_date: new Date(`${contract.start_date}T00:00:00`),
      end_date: contract.end_date ? new Date(`${contract.end_date}T00:00:00`) : null,
      status: contract.status,
      coverage_type: contract.coverage_type,
      rule: ruleToForm(contract.preventive_frequency_rule),
      included_visits_per_year: contract.included_visits_per_year,
      callout_fee_amount: Number(contract.callout_fee_amount),
      hourly_labor_rate: contract.hourly_labor_rate === null ? null : Number(contract.hourly_labor_rate),
      equipment_passport_ids: contract.equipment_passport_ids,
      notes: contract.notes,
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    const v = this.form.getRawValue();
    const payload: FsmMaintenanceContractPayload = {
      customer_id: v.customer_id ?? '',
      contract_number: v.contract_number,
      title: v.title,
      start_date: isoDate(v.start_date) ?? '',
      end_date: isoDate(v.end_date),
      status: v.status,
      coverage_type: v.coverage_type,
      preventive_frequency_rule: buildFrequencyRule(v.rule),
      included_visits_per_year: v.included_visits_per_year,
      callout_fee_amount: v.callout_fee_amount,
      hourly_labor_rate: v.hourly_labor_rate,
      currency: null,
      notes: v.notes || null,
      equipment_passport_ids: v.equipment_passport_ids,
    };
    const current = this.editing();
    const call = current ? this.api.updateContract(current.id, payload) : this.api.createContract(payload);
    this.saving.set(true);
    this.formError.set(null);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.message.success(this.i18n.translate('FSM.CONTRACTS.SAVED'));
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const messages = applyServerErrors(this.form, error);
        this.formError.set(messages[0] ?? this.i18n.translate('FSM.CONTRACTS.SAVE_FAILED'));
      },
    });
  }

  /** Runs the preventive engine: it creates the work orders that are due and skips the cycles already generated. */
  protected runPreventive(): void {
    this.running.set(true);
    this.api.runPreventive().subscribe({
      next: (res) => {
        this.running.set(false);
        this.runResult.set(res.data);
        this.message.success(this.i18n.translate('FSM.CONTRACTS.PREVENTIVE_DONE'));
      },
      error: () => {
        this.running.set(false);
        this.message.error(this.i18n.translate('FSM.CONTRACTS.PREVENTIVE_FAILED'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.listContracts().subscribe({
      next: (response) => {
        this.contracts.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }
}
