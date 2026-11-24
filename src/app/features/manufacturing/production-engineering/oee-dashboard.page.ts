import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  ManufacturingProductionApiService,
  MfgMachineDetail,
  MfgOeeGranularity,
  MfgOeeResult,
  MfgWorkCenterDetail,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { forkJoin } from 'rxjs';
import { apiErrorText, lossRows, OeeStatus, oeeStatus, toNum } from './production-engineering.utils';

const GRANULARITIES: readonly MfgOeeGranularity[] = ['real_time', 'shift', 'daily', 'weekly', 'monthly'];
const localInput = (date: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

interface Kpi {
  key: 'OEE' | 'AVAILABILITY' | 'PERFORMANCE' | 'QUALITY';
  value: number;
  target: number | null;
  status: OeeStatus;
}

const TELEMETRY_COLOR: Record<string, string> = { online: 'green', stale: 'orange', never: 'default' };

/** OEE dashboard of a work centre or a machine: KPI cards against the targets, six big losses, series and telemetry. */
@Component({
  selector: 'app-mfg-oee-dashboard',
  imports: [DatePipe, DecimalPipe, FormsModule, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzEmptyModule, NzInputModule, NzSelectModule, NzSpinModule, NzTableModule, NzTagModule],
  styles: `
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px 16px; margin-bottom: 16px; align-items: end }
    .filters .field { display: flex; flex-direction: column; gap: 4px; font-size: 13px }
    .filters nz-select { width: 100% }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 16px }
    .kpi { border: 1px solid var(--border-color, #d9d9d9); border-left-width: 6px; border-radius: 6px; padding: 12px 16px }
    .kpi b { display: block; font-size: 28px; font-variant-numeric: tabular-nums }
    .kpi.ok { border-left-color: #52c41a } .kpi.warn { border-left-color: #faad14 } .kpi.bad { border-left-color: #f5222d } .kpi.none { border-left-color: #bfbfbf }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; margin-bottom: 16px }
    .loss { display: grid; grid-template-columns: 160px 1fr 90px; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 13px }
    .track { height: 12px; background: #f5f5f5; border-radius: 3px; position: relative }
    .fill { position: absolute; inset: 0 auto 0 0; background: #fa541c; border-radius: 3px }
    .series { display: flex; align-items: flex-end; gap: 4px; height: 140px; border-bottom: 1px solid #d9d9d9; padding-top: 8px }
    .series .col { flex: 1; min-width: 6px; background: #1677ff; border-radius: 2px 2px 0 0 }
    .num { text-align: right; font-variant-numeric: tabular-nums }
    .muted { opacity: .7; font-size: 12px }
  `,
  template: `
    <app-page-header [title]="'MFG_PE.OEE_TITLE' | translate" [subtitle]="'MFG_PE.OEE_SUBTITLE' | translate"></app-page-header>

    <div class="filters">
      <div class="field"><span>{{ 'MFG_PE.WORK_CENTER' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.WORK_CENTER' | translate" nzShowSearch [ngModel]="workCenterId()" (ngModelChange)="setWorkCenter($event)" data-testid="oee-wc">
          @for (w of workCenters(); track w.id) {
            <nz-option [nzValue]="w.id" [nzLabel]="w.work_center_code + ' · ' + w.name"></nz-option>
          }
        </nz-select>
      </div>
      <div class="field"><span>{{ 'MFG_PE.MACHINE' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.MACHINE' | translate" nzAllowClear [ngModel]="machineId()" (ngModelChange)="machineId.set($event)" data-testid="oee-machine">
          @for (m of machineOptions(); track m.id) {
            <nz-option [nzValue]="m.id" [nzLabel]="m.machine_code + ' · ' + m.name"></nz-option>
          }
        </nz-select>
      </div>
      <div class="field"><span>{{ 'MFG_PE.FROM' | translate }}</span><input [attr.aria-label]="'MFG_PE.FROM' | translate" nz-input type="datetime-local" [ngModel]="from()" (ngModelChange)="from.set($event)" data-testid="oee-from" /></div>
      <div class="field"><span>{{ 'MFG_PE.TO' | translate }}</span><input [attr.aria-label]="'MFG_PE.TO' | translate" nz-input type="datetime-local" [ngModel]="to()" (ngModelChange)="to.set($event)" data-testid="oee-to" /></div>
      <div class="field"><span>{{ 'MFG_PE.GRANULARITY' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.GRANULARITY' | translate" [ngModel]="granularity()" (ngModelChange)="granularity.set($event)" data-testid="oee-granularity">
          @for (g of granularities; track g) {
            <nz-option [nzValue]="g" [nzLabel]="'MFG_PE.GRAN_' + g.toUpperCase() | translate"></nz-option>
          }
        </nz-select>
      </div>
      <button nz-button nzType="primary" type="button" data-testid="oee-apply" [disabled]="!canApply()" [nzLoading]="loading()" (click)="apply()">{{ 'MFG_PE.APPLY' | translate }}</button>
    </div>

    <nz-spin [nzSpinning]="loading()">
      @if (result(); as r) {
        <div class="kpis" data-testid="kpis">
          @for (k of kpis(); track k.key) {
            <div class="kpi" [class]="'kpi ' + k.status" [attr.data-testid]="'kpi-' + k.key" [attr.data-status]="k.status">
              <span>{{ 'MFG_PE.' + k.key | translate }}</span>
              <b>{{ k.value | number: '1.0-1' }}%</b>
              @if (k.target !== null) {
                <span class="muted">{{ 'MFG_PE.TARGET' | translate }} {{ k.target | number: '1.0-1' }}% ({{ k.value - k.target | number: '1.0-1' }})</span>
              } @else {
                <span class="muted">{{ 'MFG_PE.NO_TARGET' | translate }}</span>
              }
            </div>
          }
        </div>
        <p data-testid="oee-verdict">
          <nz-tag [nzColor]="r.meets_target ? 'green' : 'red'">{{ (r.meets_target ? 'MFG_PE.MEETS_TARGET' : 'MFG_PE.BELOW_TARGET') | translate }}</nz-tag>
          {{ 'MFG_PE.GOOD_UNITS' | translate }}: {{ r.summary.good_units | number: '1.0-2' }} ·
          {{ 'MFG_PE.SCRAP_UNITS' | translate }}: {{ r.summary.scrap_units | number: '1.0-2' }} ·
          {{ 'MFG_PE.OPERATING_MIN' | translate }}: {{ r.summary.operating_minutes | number: '1.0-0' }} / {{ r.summary.scheduled_minutes | number: '1.0-0' }}
        </p>

        <div class="cols">
          <nz-card [nzTitle]="'MFG_PE.SIX_BIG_LOSSES' | translate" data-testid="losses">
            @for (l of losses(); track l.category) {
              <div class="loss" [attr.data-testid]="'loss-' + l.category">
                <span>{{ 'MFG_PE.LOSS_' + l.category.toUpperCase() | translate }}</span>
                <div class="track"><div class="fill" [style.width.%]="l.share"></div></div>
                <span class="num">{{ l.minutes | number: '1.0-1' }} min</span>
              </div>
            }
          </nz-card>

          <nz-card [nzTitle]="'MFG_PE.TELEMETRY' | translate" data-testid="telemetry">
            @if (r.machines.length === 0) {
              <nz-empty [nzNotFoundContent]="'MFG_PE.NO_MACHINES' | translate"></nz-empty>
            } @else {
              <nz-table nzSize="small" [nzData]="r.machines" [nzFrontPagination]="false" [nzShowPagination]="false">
                <thead><tr>
                  <th scope="col">{{ 'MFG_PE.MACHINE' | translate }}</th>
                  <th scope="col">{{ 'MFG_PE.COL_BADGES' | translate }}</th>
                  <th scope="col">{{ 'MFG_PE.TELEMETRY_STATUS' | translate }}</th>
                  <th scope="col">{{ 'MFG_PE.LAST_SEEN' | translate }}</th>
                </tr></thead>
                <tbody>
                  @for (m of r.machines; track m.machine_center_id) {
                    <tr [attr.data-testid]="'tm-' + m.machine_code">
                      <td>{{ m.machine_code }}</td>
                      <td>
                        @if (m.industria_40) { <nz-tag nzColor="blue">{{ 'MFG_PE.BADGE_I40' | translate }}</nz-tag> }
                        @if (m.transizione_50) { <nz-tag nzColor="purple">{{ 'MFG_PE.BADGE_T50' | translate }}</nz-tag> }
                      </td>
                      <td><nz-tag [nzColor]="telemetryColor(m.telemetry_status)">{{ 'MFG_PE.TELEMETRY_' + m.telemetry_status.toUpperCase() | translate }}</nz-tag></td>
                      <td>{{ m.telemetry_last_seen_at ? (m.telemetry_last_seen_at | date: 'short') : '—' }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            }
          </nz-card>
        </div>

        <nz-card [nzTitle]="'MFG_PE.OEE_TREND' | translate" data-testid="trend">
          @if (points().length === 0) {
            <nz-empty></nz-empty>
          } @else {
            <div class="series" role="img" [attr.aria-label]="'MFG_PE.OEE_TREND' | translate">
              @for (p of points(); track p.from) {
                <div class="col" [style.height.%]="p.oee" [title]="(p.from | date: 'short') + ' · ' + p.oee + '%'"></div>
              }
            </div>
            <nz-table nzSize="small" [nzData]="points()" [nzPageSize]="10">
              <thead><tr>
                <th scope="col">{{ 'MFG_PE.FROM' | translate }}</th>
                <th scope="col" class="num">{{ 'MFG_PE.AVAILABILITY' | translate }}</th>
                <th scope="col" class="num">{{ 'MFG_PE.PERFORMANCE' | translate }}</th>
                <th scope="col" class="num">{{ 'MFG_PE.QUALITY' | translate }}</th>
                <th scope="col" class="num">{{ 'MFG_PE.OEE' | translate }}</th>
              </tr></thead>
              <tbody>
                @for (p of points(); track p.from) {
                  <tr>
                    <td>{{ p.from | date: 'short' }}</td>
                    <td class="num">{{ p.availability | number: '1.0-1' }}%</td>
                    <td class="num">{{ p.performance | number: '1.0-1' }}%</td>
                    <td class="num">{{ p.quality | number: '1.0-1' }}%</td>
                    <td class="num">{{ p.oee | number: '1.0-1' }}%</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </nz-card>
      } @else if (!loading()) {
        <nz-empty [nzNotFoundContent]="'MFG_PE.OEE_PICK' | translate"></nz-empty>
      }
    </nz-spin>
  `,
})
export class OeeDashboardComponent {
  private readonly api = inject(ManufacturingProductionApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly granularities = GRANULARITIES;
  protected readonly workCenters = signal<MfgWorkCenterDetail[]>([]);
  protected readonly machines = signal<MfgMachineDetail[]>([]);
  protected readonly workCenterId = signal<string | null>(null);
  protected readonly machineId = signal<string | null>(null);
  protected readonly from = signal(localInput(new Date(Date.now() - 7 * 86_400_000)));
  protected readonly to = signal(localInput(new Date()));
  protected readonly granularity = signal<MfgOeeGranularity>('daily');
  protected readonly loading = signal(false);
  protected readonly result = signal<MfgOeeResult | null>(null);

  protected readonly machineOptions = computed(() => this.machines().filter((m) => m.work_center_id === this.workCenterId()));
  protected readonly canApply = computed(() => !!this.workCenterId() && !!this.from() && !!this.to() && new Date(this.to()) > new Date(this.from()));
  protected readonly kpis = computed<Kpi[]>(() => {
    const r = this.result();
    if (!r) {
      return [];
    }
    const make = (key: Kpi['key'], value: number, target: number | null): Kpi => ({ key, value, target, status: oeeStatus(value, target) });

    return [
      make('OEE', r.summary.oee_percent, r.targets_percent.oee),
      make('AVAILABILITY', r.summary.availability_percent, r.targets_percent.availability),
      make('PERFORMANCE', r.summary.performance_percent, r.targets_percent.performance),
      make('QUALITY', r.summary.quality_percent, r.targets_percent.quality),
    ];
  });
  protected readonly losses = computed(() => lossRows(this.result()?.six_big_losses));
  protected readonly points = computed(() =>
    (this.result()?.series ?? []).map((p) => ({
      from: p.from,
      oee: toNum((p as { oee_percent?: number }).oee_percent),
      availability: toNum(p.availability_percent),
      performance: toNum(p.performance_percent),
      quality: toNum(p.quality_percent),
    })),
  );

  constructor() {
    forkJoin({ centers: this.api.listWorkCenters({ per_page: 200 }), machines: this.api.listMachines({ per_page: 500 }) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.workCenters.set(res.centers.data);
          this.machines.set(res.machines.data);
          if (res.centers.data.length > 0) {
            this.workCenterId.set(res.centers.data[0].id);
            this.apply();
          }
        },
        error: () => this.message.error(this.i18n.instant('MFG_PE.LOAD_ERROR')),
      });
  }

  protected telemetryColor = (status: string): string => TELEMETRY_COLOR[status] ?? 'default';

  protected setWorkCenter(id: string | null): void {
    this.workCenterId.set(id);
    this.machineId.set(null);
  }

  protected apply(): void {
    const workCenterId = this.workCenterId();
    if (!workCenterId || !this.canApply()) {
      return;
    }
    const query = {
      work_center_id: workCenterId,
      machine_center_id: this.machineId() ?? undefined,
      from_datetime: new Date(this.from()).toISOString(),
      to_datetime: new Date(this.to()).toISOString(),
      granularity: this.granularity(),
    };
    this.loading.set(true);
    forkJoin({ summary: this.api.oeeSummary(query), series: this.api.oeeTimeseries(query) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.result.set({ ...res.summary.data, series: res.series.data.series ?? [] });
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.message.error(apiErrorText(err) ?? this.i18n.instant('MFG_PE.ERROR'));
        },
      });
  }
}
