import { DatePipe } from '@angular/common';
import { Component, computed, inject, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { MrpRunPayload } from './mrp.models';
import { MrpStore } from './mrp.store';
import {
  CAPACITY_MODE_KEYS,
  CAPACITY_MODES,
  countEntries,
  DIRECTION_KEYS,
  DIRECTIONS,
  EXCEPTION_COLORS,
  EXCEPTION_KEYS,
  PROPOSAL_TYPE_COLORS,
  PROPOSAL_TYPE_KEYS,
  RUN_MODE_KEYS,
  RUN_MODES,
  RUN_STATUS_COLORS,
  RUN_STATUS_KEYS,
  toNumber,
} from './mrp.utils';
import { MrpExceptionCode, MrpProposalType } from './mrp.models';

/**
 * The run bar of the MRP workspace: the run history select, the status and duration of the selected run, the failed-run alert,
 * the KPI cards and the modal that starts a new run (run mode, horizon of 1 to 730 days, capacity mode, direction and the
 * customs and supplier shutdown options).
 */
@Component({
  selector: 'app-mrp-run-bar',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzStatisticModule,
    NzSwitchModule,
    NzTagModule,
  ],
  styles: `
    :host {
      display: block;
      margin-bottom: 16px;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;
    }
    .run-select {
      min-width: 280px;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .muted {
      color: var(--ant-text-color-secondary, rgba(0, 0, 0, 0.45));
    }
    .overload {
      color: #cf1322;
    }
  `,
  template: `
    <div class="bar">
      <nz-select
        class="run-select"
        data-testid="run-select"
        [ngModel]="store.selectedRunId()"
        [nzLoading]="store.runsLoading()"
        [nzPlaceHolder]="'MRP.RUN_SELECT' | translate"
        [attr.aria-label]="'MRP.RUN_SELECT' | translate"
        (ngModelChange)="selectRun($event)"
      >
        @for (run of store.runs(); track run.id) {
          <nz-option
            [nzValue]="run.id"
            [nzLabel]="run.run_code + ' · ' + (runStatusKeys[run.status] | translate)"
          ></nz-option>
        }
      </nz-select>

      <button nz-button nzType="primary" type="button" data-testid="new-run" (click)="openModal()">
        {{ 'MRP.NEW_RUN' | translate }}
      </button>

      @if (store.selectedRun(); as run) {
        <nz-tag data-testid="run-status" [nzColor]="runStatusColors[run.status]">
          {{ runStatusKeys[run.status] | translate }}
        </nz-tag>
        @if (run.execution_duration_ms !== null) {
          <span class="muted" data-testid="run-duration">
            {{ 'MRP.RUN_DURATION' | translate: { ms: run.execution_duration_ms } }}
          </span>
        }
        @if (run.started_at) {
          <span class="muted">{{ run.started_at | date: 'short' }}</span>
        }
      }
    </div>

    @if (store.selectedRun(); as run) {
      @if (run.status === 'Failed') {
        <nz-alert
          nzType="error"
          nzShowIcon
          data-testid="run-failed"
          [nzMessage]="'MRP.RUN_FAILED_TITLE' | translate"
          [nzDescription]="run.error_message ?? ''"
        ></nz-alert>
      }
    }

    @if (store.kpis(); as kpis) {
      <div class="kpis" data-testid="kpis">
        <nz-card nzSize="small">
          <nz-statistic
            data-testid="kpi-proposals"
            [nzTitle]="'MRP.KPI_PROPOSALS' | translate"
            [nzValue]="kpis.proposals_total"
          ></nz-statistic>
          <div class="tags" data-testid="kpi-by-type">
            @for (entry of byType(); track entry.key) {
              <nz-tag [nzColor]="typeColors[entry.key]"
                >{{ typeKeys[entry.key] | translate }}: {{ entry.count }}</nz-tag
              >
            }
          </div>
        </nz-card>
        <nz-card nzSize="small">
          <nz-statistic
            data-testid="kpi-exceptions"
            [nzTitle]="'MRP.KPI_EXCEPTIONS' | translate"
            [nzValue]="exceptionTotal()"
          ></nz-statistic>
          <div class="tags">
            @for (entry of byException(); track entry.key) {
              <nz-tag [nzColor]="exceptionColors[entry.key]"
                >{{ exceptionKeys[entry.key] | translate }}: {{ entry.count }}</nz-tag
              >
            }
          </div>
        </nz-card>
        <nz-card nzSize="small">
          <nz-statistic
            data-testid="kpi-overloaded"
            [nzTitle]="'MRP.KPI_OVERLOADED_BUCKETS' | translate"
            [nzValue]="kpis.overloaded_buckets"
            [nzValueStyle]="kpis.overloaded_buckets > 0 ? { color: '#cf1322' } : {}"
          ></nz-statistic>
          <div class="muted">
            {{
              'MRP.KPI_OVERLOADED_CENTERS'
                | translate
                  : { centers: kpis.overloaded_work_centers, buckets: kpis.capacity_buckets }
            }}
          </div>
        </nz-card>
        <nz-card nzSize="small">
          <nz-statistic
            data-testid="kpi-max-load"
            [nzTitle]="'MRP.KPI_MAX_LOAD' | translate"
            [nzValue]="maxLoad()"
            nzSuffix="%"
            [nzValueStyle]="maxLoad() > 100 ? { color: '#cf1322' } : {}"
          ></nz-statistic>
        </nz-card>
      </div>
    }

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="'MRP.RUN_MODAL_TITLE' | translate"
      [nzOkText]="'MRP.RUN_START' | translate"
      [nzCancelText]="'MRP.CANCEL' | translate"
      [nzOkLoading]="store.starting()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="submit()"
      (nzOnCancel)="modalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" data-testid="run-form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="horizon">{{
              'MRP.FIELD_HORIZON' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'MRP.ERR_HORIZON' | translate">
              <nz-input-number
                nzId="horizon"
                data-testid="horizon"
                formControlName="planning_horizon_days"
                [nzMin]="1"
                [nzMax]="730"
                [nzStep]="1"
              ></nz-input-number>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'MRP.FIELD_RUN_MODE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="run_mode" data-testid="run-mode">
                @for (mode of runModes; track mode) {
                  <nz-option [nzValue]="mode" [nzLabel]="runModeKeys[mode] | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'MRP.FIELD_CAPACITY_MODE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="capacity_scheduling_mode" data-testid="capacity-mode">
                @for (mode of capacityModes; track mode) {
                  <nz-option
                    [nzValue]="mode"
                    [nzLabel]="capacityKeys[mode] | translate"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'MRP.FIELD_DIRECTION' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="scheduling_direction" data-testid="direction">
                @for (direction of directions; track direction) {
                  <nz-option
                    [nzValue]="direction"
                    [nzLabel]="directionKeys[direction] | translate"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'MRP.FIELD_CUSTOMS' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'MRP.HINT_CUSTOMS' | translate">
              <nz-switch
                formControlName="include_cross_border_customs_lead_time"
                data-testid="customs"
              ></nz-switch>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'MRP.FIELD_SHUTDOWN' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'MRP.HINT_SHUTDOWN' | translate">
              <nz-switch
                formControlName="apply_supplier_shutdown_calendars"
                data-testid="shutdown"
              ></nz-switch>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class MrpRunBarComponent {
  protected readonly store = inject(MrpStore);
  private readonly fb = inject(FormBuilder);

  /** A run was started or the selected run changed: the workspace reloads its data. */
  readonly refresh = output<void>();

  protected readonly modalOpen = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    planning_horizon_days: [
      90,
      [Validators.required, Validators.min(1), Validators.max(730), Validators.pattern(/^\d+$/)],
    ],
    run_mode: this.fb.nonNullable.control<MrpRunPayload['run_mode']>('RegenerativeFull'),
    capacity_scheduling_mode:
      this.fb.nonNullable.control<MrpRunPayload['capacity_scheduling_mode']>('InfiniteCapacity'),
    scheduling_direction:
      this.fb.nonNullable.control<MrpRunPayload['scheduling_direction']>('BackwardFromDueDate'),
    include_cross_border_customs_lead_time: false,
    apply_supplier_shutdown_calendars: false,
  });

  protected readonly runModes = RUN_MODES;
  protected readonly capacityModes = CAPACITY_MODES;
  protected readonly directions = DIRECTIONS;
  protected readonly runModeKeys = RUN_MODE_KEYS;
  protected readonly capacityKeys = CAPACITY_MODE_KEYS;
  protected readonly directionKeys = DIRECTION_KEYS;
  protected readonly runStatusKeys = RUN_STATUS_KEYS;
  protected readonly runStatusColors = RUN_STATUS_COLORS;
  protected readonly typeKeys: Record<string, string> = PROPOSAL_TYPE_KEYS;
  protected readonly typeColors: Record<string, string> = PROPOSAL_TYPE_COLORS;
  protected readonly exceptionKeys: Record<string, string> = EXCEPTION_KEYS;
  protected readonly exceptionColors: Record<string, string> = EXCEPTION_COLORS;

  protected readonly byType = computed(() =>
    countEntries(this.store.kpis()?.by_type).filter(
      (entry) => (entry.key as MrpProposalType) in PROPOSAL_TYPE_KEYS,
    ),
  );
  protected readonly byException = computed(() =>
    countEntries(this.store.kpis()?.by_exception).filter(
      (entry) => (entry.key as MrpExceptionCode) in EXCEPTION_KEYS,
    ),
  );
  protected readonly exceptionTotal = computed(() =>
    this.byException().reduce((sum, entry) => sum + entry.count, 0),
  );
  protected readonly maxLoad = computed(
    () => Math.round(toNumber(this.store.kpis()?.max_load_percentage) * 100) / 100,
  );

  protected selectRun(runId: string | null): void {
    this.store.selectRun(runId);
    this.refresh.emit();
  }

  protected openModal(): void {
    this.modalOpen.set(true);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.store.startRun(this.form.getRawValue() as MrpRunPayload).subscribe((run) => {
      if (run !== null) {
        this.modalOpen.set(false);
        this.refresh.emit();
      }
    });
  }
}
