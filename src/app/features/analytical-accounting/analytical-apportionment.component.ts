import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AllocationDriver,
  AllocationDriverType,
  DRIVER_TYPES,
  ScheduleStep,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AnalyticalAccountingStore } from './analytical-accounting.store';

const currentPeriod = (): string => new Date().toISOString().slice(0, 7);

/**
 * Step-down apportionment console: the ordered cascade of senders with their drivers, the driver values of the period,
 * the preview with the full step-by-step trace and warnings, and the consolidate and reverse actions of the monthly cycle.
 */
@Component({
  selector: 'app-analytical-apportionment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './analytical-accounting.scss',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'ANALYTICAL.APPORTION_TITLE' | translate"
      [subtitle]="'ANALYTICAL.APPORTION_SUBTITLE' | translate"
    ></app-page-header>

    <nz-card [nzTitle]="'ANALYTICAL.STEP_1_CASCADE' | translate">
      <div class="toolbar">
        <nz-select
          style="min-width: 240px"
          [nzPlaceHolder]="'ANALYTICAL.SCHEDULE' | translate"
          [ngModel]="scheduleId()"
          (ngModelChange)="selectSchedule($event)"
        >
          @for (schedule of store.activeSchedules(); track schedule.id) {
            <nz-option [nzValue]="schedule.id" [nzLabel]="schedule.name"></nz-option>
          }
        </nz-select>
        <input nz-input style="width: 160px" [ngModel]="scheduleName()" (ngModelChange)="scheduleName.set($event)" [placeholder]="'ANALYTICAL.SCHEDULE_NAME' | translate" />
        <button nz-button (click)="addStep()">{{ 'ANALYTICAL.ADD_STEP' | translate }}</button>
        <button nz-button nzType="primary" [disabled]="!canSaveSchedule()" [nzLoading]="store.saving()" (click)="saveSchedule()">
          {{ 'ANALYTICAL.SAVE' | translate }}
        </button>
      </div>
      <nz-table [nzData]="steps()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'ANALYTICAL.STEP_ORDER' | translate }}</th>
            <th>{{ 'ANALYTICAL.SENDER' | translate }}</th>
            <th>{{ 'ANALYTICAL.DRIVER' | translate }}</th>
            <th>{{ 'ANALYTICAL.INCLUDE_DESCENDANTS' | translate }}</th>
            <th>{{ 'ANALYTICAL.FIXED_WEIGHTS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (step of steps(); track $index; let i = $index) {
            <tr>
              <td>{{ step.step_order }}</td>
              <td>
                <nz-select style="min-width: 200px" [ngModel]="step.source_center_id" (ngModelChange)="patchStep(i, { source_center_id: $event })">
                  @for (center of store.activeCenters(); track center.id) {
                    <nz-option [nzValue]="center.id" [nzLabel]="center.code + ' ' + center.name"></nz-option>
                  }
                </nz-select>
              </td>
              <td>
                <nz-select style="min-width: 180px" [ngModel]="step.driver_type" (ngModelChange)="patchStep(i, { driver_type: $event })">
                  @for (type of driverTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="'ANALYTICAL.DRIVER_' + type | translate"></nz-option>
                  }
                </nz-select>
              </td>
              <td>
                <input type="checkbox" [checked]="step.include_descendants" (change)="patchStep(i, { include_descendants: $any($event.target).checked })" [attr.aria-label]="'ANALYTICAL.INCLUDE_DESCENDANTS' | translate" />
              </td>
              <td>
                @if (step.driver_type === 'FIXED_PERCENTAGE') {
                  <input nz-input [ngModel]="weightsText(step)" (ngModelChange)="setWeights(i, $event)" placeholder="CODE=50, CODE=50" />
                  <span [class]="weightsSum(step) === 100 ? 'positive' : 'negative'">{{ weightsSum(step) }} / 100</span>
                } @else {
                  <span class="muted">—</span>
                }
              </td>
              <td><button nz-button nzSize="small" nzDanger (click)="removeStep(i)">×</button></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card [nzTitle]="'ANALYTICAL.STEP_2_DRIVERS' | translate">
      <div class="toolbar">
        <nz-select style="min-width: 220px" [ngModel]="driverId()" (ngModelChange)="driverId.set($event)" [nzPlaceHolder]="'ANALYTICAL.DRIVER' | translate">
          @for (driver of valueDrivers(); track driver.id) {
            <nz-option [nzValue]="driver.id" [nzLabel]="driver.name"></nz-option>
          }
        </nz-select>
        <input nz-input type="month" style="width: 160px" [ngModel]="period()" (ngModelChange)="period.set($event)" [attr.aria-label]="'ANALYTICAL.PERIOD' | translate" />
        <button nz-button [disabled]="!driverId()" (click)="saveValues()">{{ 'ANALYTICAL.SAVE_VALUES' | translate }}</button>
      </div>
      <div class="form-grid">
        @for (center of receiverCenters(); track center.id) {
          <label>{{ center.code }} {{ center.name }}
            <input nz-input type="number" min="0" [ngModel]="values()[center.id]" (ngModelChange)="setValue(center.id, $event)" />
          </label>
        }
      </div>
    </nz-card>

    <nz-card [nzTitle]="'ANALYTICAL.STEP_3_RUN' | translate">
      <div class="toolbar">
        <button nz-button [disabled]="!scheduleId()" [nzLoading]="store.saving()" (click)="preview()">{{ 'ANALYTICAL.PREVIEW' | translate }}</button>
        <button nz-button nzType="primary" [disabled]="!store.canConsolidate()" nz-popconfirm [nzPopconfirmTitle]="'ANALYTICAL.CONFIRM_CONSOLIDATE' | translate" (nzOnConfirm)="consolidate()">
          {{ 'ANALYTICAL.CONSOLIDATE' | translate }}
        </button>
        <button nz-button nzDanger [disabled]="!store.canReverse()" nz-popconfirm [nzPopconfirmTitle]="'ANALYTICAL.CONFIRM_REVERSE' | translate" (nzOnConfirm)="reverse()">
          {{ 'ANALYTICAL.REVERSE' | translate }}
        </button>
      </div>

      @if (store.activeRun(); as run) {
        <p>
          <nz-tag [nzColor]="run.status === 'CONSOLIDATED' ? 'green' : run.status === 'REVERSED' ? 'red' : 'blue'">{{ 'ANALYTICAL.RUN_' + run.status | translate }}</nz-tag>
          {{ run.period_key }} · {{ 'ANALYTICAL.TOTAL_POOL' | translate }} {{ run.total_pool }} ·
          {{ 'ANALYTICAL.TOTAL_ALLOCATED' | translate }} {{ run.total_allocated }} ·
          {{ 'ANALYTICAL.TOTAL_UNALLOCATED' | translate }} {{ run.total_unallocated }}
        </p>
        @for (warning of store.runWarnings(); track $index) {
          <nz-alert nzType="warning" nzShowIcon [nzMessage]="'ANALYTICAL.WARNING_' + warning.code | translate" [nzDescription]="warning.message" style="margin-bottom: 8px"></nz-alert>
        }
        @for (item of store.trace(); track item.step.step_order) {
          <div class="trace-step">
            <h4>
              {{ 'ANALYTICAL.STEP' | translate }} {{ item.step.step_order }} · {{ centerLabel(item.step.source_center_id) }} ·
              {{ 'ANALYTICAL.DRIVER_' + item.step.driver_type | translate }} · {{ 'ANALYTICAL.POOL' | translate }} {{ item.step.pool_amount }}
              @if (!item.balanced) { <nz-tag nzColor="red">{{ 'ANALYTICAL.UNBALANCED' | translate }}</nz-tag> }
            </h4>
            <nz-table [nzData]="item.allocations" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'ANALYTICAL.RECEIVER' | translate }}</th>
                  <th class="num">{{ 'ANALYTICAL.DRIVER_VALUE' | translate }}</th>
                  <th class="num">{{ 'ANALYTICAL.DRIVER_TOTAL' | translate }}</th>
                  <th class="num">{{ 'ANALYTICAL.SHARE' | translate }}</th>
                  <th class="num">{{ 'ANALYTICAL.ALLOCATED' | translate }}</th>
                  <th class="num">{{ 'ANALYTICAL.ROUNDING' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (allocation of item.allocations; track allocation.id) {
                  <tr>
                    <td>{{ centerLabel(allocation.target_center_id) }}</td>
                    <td class="num">{{ allocation.driver_value }}</td>
                    <td class="num">{{ allocation.driver_total }}</td>
                    <td class="num">{{ shareText(allocation.share_ratio) }}</td>
                    <td class="num">{{ allocation.allocated_amount }}</td>
                    <td class="num">{{ allocation.rounding_adjustment }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </div>
        }
      }
    </nz-card>

    <nz-card [nzTitle]="'ANALYTICAL.RUN_HISTORY' | translate">
      <nz-table [nzData]="store.runs()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'ANALYTICAL.PERIOD' | translate }}</th>
            <th>{{ 'ANALYTICAL.STATUS' | translate }}</th>
            <th class="num">{{ 'ANALYTICAL.TOTAL_ALLOCATED' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (run of store.runs(); track run.id) {
            <tr>
              <td>{{ run.period_key }}</td>
              <td>{{ 'ANALYTICAL.RUN_' + run.status | translate }}</td>
              <td class="num">{{ run.total_allocated }}</td>
              <td><button nz-button nzSize="small" (click)="open(run.id)">{{ 'ANALYTICAL.TRACE' | translate }}</button></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class AnalyticalApportionmentComponent implements OnInit {
  protected readonly store = inject(AnalyticalAccountingStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly driverTypes = DRIVER_TYPES;
  protected readonly scheduleId = signal<string | null>(null);
  protected readonly scheduleName = signal('');
  protected readonly steps = signal<ScheduleStep[]>([]);
  protected readonly driverId = signal<string | null>(null);
  protected readonly period = signal(currentPeriod());
  protected readonly values = signal<Record<string, number | null>>({});

  protected readonly valueDrivers = computed<AllocationDriver[]>(() =>
    this.store.drivers().filter((driver) => driver.is_active && driver.driver_type !== 'FIXED_PERCENTAGE'),
  );
  protected readonly receiverCenters = computed(() => this.store.activeCenters());
  protected readonly canSaveSchedule = computed(
    () =>
      this.scheduleName().trim() !== '' &&
      this.steps().length > 0 &&
      this.steps().every(
        (step) =>
          step.source_center_id &&
          (step.driver_type !== 'FIXED_PERCENTAGE' || this.weightsSum(step) === 100),
      ),
  );

  ngOnInit(): void {
    void this.store.loadApportionment();
  }

  protected centerLabel(id: string): string {
    const center = this.store.centers().find((c) => c.id === id);
    return center ? `${center.code} ${center.name}` : id;
  }

  protected shareText(ratio: string): string {
    return `${(Number(ratio) * 100).toFixed(2)} %`;
  }

  protected selectSchedule(id: string | null): void {
    this.scheduleId.set(id);
    const schedule = this.store.schedules().find((s) => s.id === id);
    this.scheduleName.set(schedule?.name ?? '');
    this.steps.set(schedule ? schedule.steps.map((step) => ({ ...step })) : []);
  }

  protected addStep(): void {
    const next = Math.max(0, ...this.steps().map((s) => s.step_order)) + 1;
    this.steps.update((list) => [...list, { step_order: next, source_center_id: '', driver_type: 'AREA_SQM' as AllocationDriverType }]);
  }

  protected removeStep(index: number): void {
    this.steps.update((list) => list.filter((_, i) => i !== index));
  }

  protected patchStep(index: number, change: Partial<ScheduleStep>): void {
    this.steps.update((list) => list.map((step, i) => (i === index ? { ...step, ...change } : step)));
  }

  protected weightsText(step: ScheduleStep): string {
    return Object.entries(step.fixed_weights_json ?? {})
      .map(([id, weight]) => `${this.store.centers().find((c) => c.id === id)?.code ?? id}=${weight}`)
      .join(', ');
  }

  protected setWeights(index: number, text: string): void {
    const byCode = new Map(this.store.centers().map((c) => [c.code, c.id]));
    const weights: Record<string, number> = {};
    for (const part of text.split(',')) {
      const [code, value] = part.split('=').map((s) => s.trim());
      const id = byCode.get(code ?? '');
      if (id && value !== undefined && Number.isFinite(Number(value)) && Number(value) > 0) {
        weights[id] = Number(value);
      }
    }
    this.patchStep(index, { fixed_weights_json: weights });
  }

  protected weightsSum(step: ScheduleStep): number {
    const total = Object.values(step.fixed_weights_json ?? {}).reduce((sum, w) => sum + Math.round(w * 10_000), 0);
    return total / 10_000;
  }

  protected setValue(centerId: string, value: number | string | null): void {
    this.values.update((current) => ({ ...current, [centerId]: value === null || value === '' ? null : Number(value) }));
  }

  protected async saveSchedule(): Promise<void> {
    const outcome = await this.store.saveSchedule(this.scheduleId(), {
      name: this.scheduleName().trim(),
      steps: this.steps().map((step) => ({
        step_order: step.step_order,
        source_center_id: step.source_center_id,
        driver_type: step.driver_type,
        include_descendants: step.include_descendants ?? false,
        fixed_weights_json: step.driver_type === 'FIXED_PERCENTAGE' ? (step.fixed_weights_json ?? {}) : null,
        allocation_driver_id: step.allocation_driver_id ?? null,
      })),
    });
    this.report(outcome.ok, outcome.message);
  }

  protected async saveValues(): Promise<void> {
    const driver = this.driverId();
    if (!driver) {
      return;
    }
    const values = Object.entries(this.values())
      .filter((entry): entry is [string, number] => entry[1] !== null && entry[1] !== undefined)
      .map(([analytical_center_id, value]) => ({ analytical_center_id, value }));
    const outcome = await this.store.saveDriverValues(driver, this.period(), values);
    this.report(outcome.ok, outcome.message);
  }

  protected async preview(): Promise<void> {
    const schedule = this.scheduleId();
    if (schedule) {
      const outcome = await this.store.preview(schedule, this.period());
      this.report(outcome.ok, outcome.message);
    }
  }

  protected async consolidate(): Promise<void> {
    const outcome = await this.store.consolidate();
    this.report(outcome.ok, outcome.message);
  }

  protected async reverse(): Promise<void> {
    const outcome = await this.store.reverse(this.translate.instant('ANALYTICAL.REVERSE_REASON'));
    this.report(outcome.ok, outcome.message);
  }

  protected async open(id: string): Promise<void> {
    await this.store.openRun(id);
  }

  private report(ok: boolean, reason: string | null): void {
    if (ok) {
      this.message.success(this.translate.instant('ANALYTICAL.SAVED'));
    } else {
      this.message.error(this.translate.instant(reason ?? 'ANALYTICAL.SAVE_ERROR'));
    }
  }
}
