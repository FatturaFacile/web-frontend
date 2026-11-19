import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  FSM_CONTRACT_STATUSES,
  FSM_COVERAGE_TYPES,
  FsmContractStatus,
  FsmCoverageType,
  FsmMaintenanceContract,
  GapViewsApiService,
  I18nService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { CustomerSelectComponent } from '../../warranty-rma/components/shared/customer-select.component';

const STATUS_COLORS: Record<FsmContractStatus, string> = {
  draft: 'default',
  active: 'green',
  suspended: 'orange',
  expired: 'red',
  cancelled: 'default',
};

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function firstError(error: unknown): string | null {
  const body = (error as { error?: { message?: unknown; errors?: Record<string, unknown> } })
    ?.error;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  return typeof body?.message === 'string' ? body.message : null;
}

/** Recurring maintenance contracts of the field service, with the manual run of the preventive maintenance engine. */
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
  template: `
    <app-page-header
      [title]="'FSM.CONTRACTS.TITLE' | translate"
      [subtitle]="'FSM.CONTRACTS.SUBTITLE' | translate"
    >
      <div header-actions>
        <button nz-button [nzLoading]="running()" (click)="runPreventive()">
          {{ 'FSM.CONTRACTS.RUN_PREVENTIVE' | translate }}
        </button>
        <button nz-button nzType="primary" (click)="openCreate()">
          {{ 'FSM.CONTRACTS.NEW' | translate }}
        </button>
      </div>
    </app-page-header>

    @if (loadError()) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="'FSM.CONTRACTS.LOAD_ERROR' | translate" />
    }

    <nz-card>
      <nz-table
        nzSize="small"
        [nzData]="contracts()"
        [nzLoading]="loading()"
        [nzShowPagination]="contracts().length > 10"
      >
        <thead>
          <tr>
            <th>{{ 'FSM.CONTRACTS.NUMBER' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.NAME' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.STATUS' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.COVERAGE' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.PERIOD' | translate }}</th>
            <th>{{ 'FSM.CONTRACTS.VISITS' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (c of contracts(); track c.id) {
            <tr>
              <td>{{ c.contract_number }}</td>
              <td>{{ c.title }}</td>
              <td>
                <nz-tag [nzColor]="color(c.status)">{{
                  'FSM.CONTRACTS.STATUSES.' + c.status.toUpperCase() | translate
                }}</nz-tag>
              </td>
              <td>
                {{
                  c.coverage_type
                    ? ('FSM.CONTRACTS.COVERAGES.' + c.coverage_type.toUpperCase() | translate)
                    : '-'
                }}
              </td>
              <td>{{ c.start_date }} → {{ c.end_date ?? '∞' }}</td>
              <td>{{ c.used_visits_current_year }} / {{ c.included_visits_per_year ?? '∞' }}</td>
              <td>
                <button nz-button nzSize="small" (click)="openEdit(c)">
                  {{ 'COMMON.EDIT' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7">{{ 'FSM.CONTRACTS.EMPTY' | translate }}</td>
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
      nzWidth="720px"
      (nzOnOk)="save()"
      (nzOnCancel)="modalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        @if (formError()) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="formError()" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="fsm_customer">{{
              'FSM.CONTRACTS.CUSTOMER' | translate
            }}</nz-form-label>
            <nz-form-control>
              <app-customer-select
                inputId="fsm_customer"
                formControlName="customer_id"
                [initialLabel]="editing()?.customer_id ?? null"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="fsm_number">{{
              'FSM.CONTRACTS.NUMBER' | translate
            }}</nz-form-label>
            <nz-form-control>
              <input nz-input id="fsm_number" formControlName="contract_number" maxlength="60" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="fsm_title">{{
              'FSM.CONTRACTS.NAME' | translate
            }}</nz-form-label>
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
            <nz-form-label nzFor="fsm_status">{{
              'FSM.CONTRACTS.STATUS' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="fsm_status" formControlName="status">
                @for (s of statuses; track s) {
                  <nz-option
                    [nzValue]="s"
                    [nzLabel]="'FSM.CONTRACTS.STATUSES.' + s.toUpperCase() | translate"
                  />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="fsm_coverage">{{
              'FSM.CONTRACTS.COVERAGE' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="fsm_coverage" nzAllowClear formControlName="coverage_type">
                @for (c of coverages; track c) {
                  <nz-option
                    [nzValue]="c"
                    [nzLabel]="'FSM.CONTRACTS.COVERAGES.' + c.toUpperCase() | translate"
                  />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="fsm_visits">{{
              'FSM.CONTRACTS.INCLUDED_VISITS' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-input-number
                nzId="fsm_visits"
                formControlName="included_visits_per_year"
                [nzMin]="0"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="fsm_callout">{{
              'FSM.CONTRACTS.CALLOUT_FEE' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-input-number
                nzId="fsm_callout"
                formControlName="callout_fee_amount"
                [nzMin]="0"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="fsm_rate">{{
              'FSM.CONTRACTS.HOURLY_RATE' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-input-number nzId="fsm_rate" formControlName="hourly_labor_rate" [nzMin]="0" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="fsm_notes">{{ 'FSM.CONTRACTS.NOTES' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea
                nz-input
                id="fsm_notes"
                rows="3"
                formControlName="notes"
                maxlength="5000"
              ></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class MaintenanceContractsComponent implements OnInit {
  private readonly api = inject(GapViewsApiService);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly statuses = FSM_CONTRACT_STATUSES;
  protected readonly coverages = FSM_COVERAGE_TYPES;
  protected readonly contracts = signal<FsmMaintenanceContract[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly running = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<FsmMaintenanceContract | null>(null);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    customer_id: this.fb.control<string | null>(null, Validators.required),
    contract_number: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(60),
    ]),
    title: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(180)]),
    start_date: this.fb.control<Date | null>(null, Validators.required),
    end_date: this.fb.control<Date | null>(null),
    status: this.fb.nonNullable.control<FsmContractStatus>('draft'),
    coverage_type: this.fb.control<FsmCoverageType | null>(null),
    included_visits_per_year: this.fb.control<number | null>(null),
    callout_fee_amount: this.fb.control<number | null>(null),
    hourly_labor_rate: this.fb.control<number | null>(null),
    notes: this.fb.control<string | null>(null),
  });

  ngOnInit(): void {
    this.load();
  }

  protected color(status: FsmContractStatus): string {
    return STATUS_COLORS[status] ?? 'default';
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({ status: 'draft' });
    this.modalOpen.set(true);
  }

  protected openEdit(contract: FsmMaintenanceContract): void {
    this.editing.set(contract);
    this.formError.set(null);
    this.form.reset({
      customer_id: contract.customer_id,
      contract_number: contract.contract_number,
      title: contract.title,
      start_date: new Date(contract.start_date),
      end_date: contract.end_date ? new Date(contract.end_date) : null,
      status: contract.status,
      coverage_type: contract.coverage_type,
      included_visits_per_year: contract.included_visits_per_year,
      callout_fee_amount: Number(contract.callout_fee_amount),
      hourly_labor_rate:
        contract.hourly_labor_rate === null ? null : Number(contract.hourly_labor_rate),
      notes: contract.notes,
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    const v = this.form.getRawValue();
    const payload = {
      customer_id: v.customer_id ?? '',
      contract_number: v.contract_number,
      title: v.title,
      start_date: isoDate(v.start_date) ?? '',
      end_date: isoDate(v.end_date),
      status: v.status,
      coverage_type: v.coverage_type,
      included_visits_per_year: v.included_visits_per_year,
      callout_fee_amount: v.callout_fee_amount,
      hourly_labor_rate: v.hourly_labor_rate,
      currency: null,
      notes: v.notes || null,
    };
    const current = this.editing();
    const call = current
      ? this.api.updateMaintenanceContract(current.id, payload)
      : this.api.createMaintenanceContract(payload);
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
        this.formError.set(firstError(error) ?? this.i18n.translate('FSM.CONTRACTS.SAVE_FAILED'));
      },
    });
  }

  protected runPreventive(): void {
    this.running.set(true);
    this.api.runPreventiveMaintenance().subscribe({
      next: () => {
        this.running.set(false);
        this.message.success(this.i18n.translate('FSM.CONTRACTS.PREVENTIVE_DONE'));
      },
      error: (error: unknown) => {
        this.running.set(false);
        this.message.error(
          firstError(error) ?? this.i18n.translate('FSM.CONTRACTS.PREVENTIVE_FAILED'),
        );
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.listMaintenanceContracts().subscribe({
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
