import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { map } from 'rxjs';
import { I18nService, PermissionsService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { EvmChartComponent } from './evm-chart.component';
import { ProjectEvmApiService } from './project-evm-api.service';
import {
  BreakdownRow,
  EvmGranularity,
  OverheadDriver,
  Scurve,
  Waterfall,
  WbsBreakdown,
} from './project-evm.models';
import {
  absorptionWarning,
  breachCount,
  flattenWbs,
  GRANULARITY_KEYS,
  indexLight,
  LIGHT_KEYS,
  lightColor,
  parentIds,
  scurveOption,
  waterfallOption,
} from './project-evm.utils';

/** The node (or the project) whose manual bottom-up ETC is being edited. */
interface EtcTarget {
  nodeId: string | null;
  label: string;
  current: string | null;
}

/**
 * Project profitability and earned value dashboard (Mod 082): KPI traffic lights, S-curve, profitability waterfall,
 * WBS drill-down with the manual bottom-up ETC, and the reconciliation with cost accounting and the statutory
 * valuation (OIC 23, Swiss GAAP FER 22).
 */
@Component({
  selector: 'app-project-evm-dashboard',
  styleUrl: './project-evm-dashboard.component.scss',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    EvmChartComponent,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'PROJECT_EVM.TITLE' | translate" [subtitle]="'PROJECT_EVM.SUBTITLE' | translate" />
    <p><a routerLink="/projects">{{ 'PRJ.BACK_TO_PROJECTS' | translate }}</a></p>

    <div class="evm-actions">
      @if (breakdown(); as data) {
        @if (data.snapshot_date) {
          <span class="evm-muted">{{ 'PROJECT_EVM.SNAPSHOT_DATE' | translate: { date: data.snapshot_date } }}</span>
        }
      }
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" data-testid="evm-recompute" [nzLoading]="busy()" (click)="recompute()">
          {{ 'PROJECT_EVM.RECOMPUTE' | translate }}
        </button>
        <button nz-button type="button" data-testid="evm-overhead" (click)="overheadOpen.set(true)">
          {{ 'PROJECT_EVM.ALLOCATE_OVERHEAD' | translate }}
        </button>
      }
    </div>

    @if (error()) {
      <nz-alert class="mb-4" nzType="error" nzShowIcon [nzMessage]="'PROJECT_EVM.LOAD_ERROR' | translate" />
    }

    <nz-spin [nzSpinning]="loading()">
      @if (project(); as p) {
        @if (!p.has_snapshot) {
          <nz-empty data-testid="evm-empty" [nzNotFoundContent]="'PROJECT_EVM.NO_SNAPSHOT' | translate" />
        } @else {
          <div class="evm-kpis" data-testid="evm-kpis">
            <nz-card nzSize="small" [nzTitle]="'PROJECT_EVM.KPI_BAC' | translate">
              <div class="evm-kpi">{{ p.bac | money: currency() }}</div>
            </nz-card>
            <nz-card nzSize="small" [nzTitle]="'PROJECT_EVM.KPI_CPI' | translate">
              <div class="evm-kpi" data-testid="evm-cpi">{{ p.cpi ?? '-' }}</div>
              <nz-tag [nzColor]="lightColor(p.cpi_light)">{{ lightKey(p.cpi_light) | translate }}</nz-tag>
            </nz-card>
            <nz-card nzSize="small" [nzTitle]="'PROJECT_EVM.KPI_SPI' | translate">
              <div class="evm-kpi" data-testid="evm-spi">{{ p.spi ?? '-' }}</div>
              <nz-tag [nzColor]="lightColor(p.spi_light)">{{ lightKey(p.spi_light) | translate }}</nz-tag>
            </nz-card>
            <nz-card nzSize="small" [nzTitle]="'PROJECT_EVM.KPI_EAC' | translate">
              <div class="evm-kpi">{{ p.eac | money: currency() }}</div>
              <span class="evm-muted">{{ 'PROJECT_EVM.KPI_VAC' | translate }}: {{ p.vac | money: currency() }}</span>
              @if (p.manual_etc_override) {
                <nz-tag nzColor="blue">{{ 'PROJECT_EVM.MANUAL_ETC' | translate }}</nz-tag>
              }
            </nz-card>
            <nz-card nzSize="small" [nzTitle]="'PROJECT_EVM.KPI_MARGIN' | translate">
              <div class="evm-kpi">{{ p.gross_margin_amount | money: currency() }}</div>
              <span class="evm-muted">{{ p.gross_margin_percent ?? '-' }}%</span>
            </nz-card>
            <nz-card nzSize="small" [nzTitle]="'PROJECT_EVM.KPI_ABSORPTION' | translate">
              <nz-progress
                [nzPercent]="absorptionPercent()"
                [nzStatus]="absorptionWarning(p.budget_absorption_percent) ? 'exception' : 'normal'"
                nzSize="small"
              />
              @if (absorptionWarning(p.budget_absorption_percent)) {
                <nz-tag nzColor="orange" data-testid="evm-absorption-warning">{{ 'PROJECT_EVM.ABSORPTION_WARNING' | translate }}</nz-tag>
              }
              @if (alerts() === 0) {
                <div class="evm-muted">{{ 'PROJECT_EVM.ALERTS_OK' | translate }}</div>
              } @else {
                <nz-tag nzColor="red" data-testid="evm-alerts">{{ 'PROJECT_EVM.ALERTS_BREACHED' | translate: { count: alerts() } }}</nz-tag>
              }
            </nz-card>
          </div>
        }
      }

      <nz-card nzSize="small" class="mb-4" [nzTitle]="'PROJECT_EVM.SCURVE_TITLE' | translate">
        <div class="evm-toolbar">
          <nz-select class="evm-granularity" [ngModel]="scope()" (ngModelChange)="setScope($event)" nzSize="small" data-testid="evm-scope">
            <nz-option nzValue="project" [nzLabel]="'PROJECT_EVM.SCOPE_PROJECT' | translate" />
            <nz-option nzValue="portfolio" [nzLabel]="'PROJECT_EVM.SCOPE_PORTFOLIO' | translate" />
          </nz-select>
          <nz-select class="evm-granularity" [ngModel]="granularity()" (ngModelChange)="setGranularity($event)" nzSize="small" [nzPlaceHolder]="'PROJECT_EVM.GRANULARITY' | translate">
            @for (option of granularities; track option) {
              <nz-option [nzValue]="option" [nzLabel]="granularityKey(option) | translate" />
            }
          </nz-select>
        </div>
        <app-evm-chart [option]="scurveChart()" [label]="'PROJECT_EVM.SCURVE_TITLE' | translate" testId="evm-scurve" />
      </nz-card>

      <nz-card nzSize="small" class="mb-4" [nzTitle]="'PROJECT_EVM.WATERFALL_TITLE' | translate">
        <app-evm-chart [option]="waterfallChart()" [label]="'PROJECT_EVM.WATERFALL_TITLE' | translate" testId="evm-waterfall" />
      </nz-card>

      <nz-card nzSize="small" class="mb-4" [nzTitle]="'PROJECT_EVM.WBS_TITLE' | translate">
        <div class="evm-toolbar">
          <button nz-button nzSize="small" type="button" (click)="toggleAll()">{{ allExpanded() ? '−' : '+' }}</button>
        </div>
        <nz-table nzSize="small" [nzData]="rows()" [nzShowPagination]="false" [nzScroll]="{ x: '1500px' }" data-testid="evm-wbs">
          <thead>
            <tr>
              <th nzLeft>{{ 'PROJECT_EVM.COL_WBS' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_BAC' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_COMMITTED' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_ACTUAL' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_EXPOSURE' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_EV' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_PV' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_CV' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_SV' | translate }}</th>
              <th>{{ 'PROJECT_EVM.COL_CPI' | translate }}</th>
              <th>{{ 'PROJECT_EVM.COL_SPI' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_EAC' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_ETC' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_VAC' | translate }}</th>
              <th nzAlign="right">{{ 'PROJECT_EVM.COL_MARGIN' | translate }}</th>
              <th>{{ 'PROJECT_EVM.COL_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @if (project(); as p) {
              @if (p.has_snapshot) {
                <tr class="evm-total-row">
                  <td nzLeft>{{ 'PROJECT_EVM.PROJECT_TOTAL' | translate }}</td>
                  <ng-container *ngTemplateOutlet="figures; context: { $implicit: p, nodeId: null, label: 'PROJECT_EVM.PROJECT_TOTAL' | translate }" />
                </tr>
              }
            }
            @for (row of rows(); track row.node.wbs_node_id) {
              <tr [attr.data-testid]="'evm-row-' + row.node.wbs_code">
                <td nzLeft [style.padding-left.px]="12 + row.depth * 20">
                  @if (row.node.children.length > 0) {
                    <button class="evm-toggle" type="button" (click)="toggle(row.node.wbs_node_id)" [attr.aria-expanded]="expanded().has(row.node.wbs_node_id)">
                      {{ expanded().has(row.node.wbs_node_id) ? '▾' : '▸' }}
                    </button>
                  }
                  <strong>{{ row.node.wbs_code }}</strong> {{ row.node.title }}
                </td>
                <ng-container *ngTemplateOutlet="figures; context: { $implicit: row.node, nodeId: row.node.wbs_node_id, label: row.node.wbs_code + ' ' + row.node.title }" />
              </tr>
            } @empty {
              <tr>
                <td colspan="16">{{ 'PROJECT_EVM.NO_NODES' | translate }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <ng-template #figures let-r let-nodeId="nodeId" let-label="label">
        @if (r.has_snapshot) {
          <td nzAlign="right">{{ r.bac | money: currency() }}</td>
          <td nzAlign="right">{{ r.committed | money: currency() }}</td>
          <td nzAlign="right">{{ r.actual | money: currency() }}</td>
          <td nzAlign="right">{{ r.total_exposure | money: currency() }}</td>
          <td nzAlign="right">{{ r.ev | money: currency() }}</td>
          <td nzAlign="right">{{ r.pv | money: currency() }}</td>
          <td nzAlign="right">{{ r.cv | money: currency() }}</td>
          <td nzAlign="right">{{ r.sv | money: currency() }}</td>
          <td><nz-tag [nzColor]="lightColor(r.cpi_light)">{{ r.cpi ?? '-' }}</nz-tag></td>
          <td><nz-tag [nzColor]="lightColor(r.spi_light)">{{ r.spi ?? '-' }}</nz-tag></td>
          <td nzAlign="right">
            {{ r.eac | money: currency() }}
            @if (r.manual_etc_override) {
              <nz-tag nzColor="blue">{{ 'PROJECT_EVM.MANUAL_ETC' | translate }}</nz-tag>
            }
          </td>
          <td nzAlign="right">{{ r.etc | money: currency() }}</td>
          <td nzAlign="right">{{ r.vac | money: currency() }}</td>
          <td nzAlign="right">{{ r.gross_margin_amount | money: currency() }} ({{ r.gross_margin_percent ?? '-' }}%)</td>
          <td>
            @if (canWrite) {
              <button nz-button nzSize="small" type="button" (click)="openEtc(nodeId, label, r.manual_etc_override)">{{ 'PROJECT_EVM.EDIT_ETC' | translate }}</button>
            }
          </td>
        } @else {
          <td colspan="15" class="evm-muted">{{ 'PROJECT_EVM.NO_SNAPSHOT' | translate }}</td>
        }
      </ng-template>

      @if (breakdown()?.reconciliation; as rec) {
        <nz-card nzSize="small" class="mb-4" [nzTitle]="'PROJECT_EVM.RECON_TITLE' | translate" data-testid="evm-reconciliation">
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 2 }">
            <nz-descriptions-item [nzTitle]="'PROJECT_EVM.RECON_STANDARD' | translate">{{ rec.standard ?? '-' }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'PROJECT_EVM.RECON_MANAGERIAL_COST' | translate">{{ rec.managerial_actual_cost | money: currency() }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'PROJECT_EVM.RECON_STATUTORY_COST' | translate">{{ rec.statutory_cumulative_cost | money: currency() }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'PROJECT_EVM.RECON_STATUTORY_REVENUE' | translate">{{ rec.statutory_cumulative_revenue | money: currency() }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'PROJECT_EVM.RECON_DIFFERENCE' | translate">{{ rec.cost_difference | money: currency() }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'PROJECT_EVM.RECON_OVERHEAD' | translate">{{ rec.cost_center_overhead | money: currency() }}</nz-descriptions-item>
          </nz-descriptions>
          @if (rec.last_recognition_date === null) {
            <p class="evm-muted">{{ 'PROJECT_EVM.RECON_NONE' | translate }}</p>
          } @else {
            <nz-tag [nzColor]="rec.is_reconciled ? 'green' : 'orange'">{{ (rec.is_reconciled ? 'PROJECT_EVM.RECON_OK' : 'PROJECT_EVM.RECON_GAP') | translate }}</nz-tag>
          }
        </nz-card>
      }
    </nz-spin>

    <nz-modal
      [nzVisible]="etcTarget() !== null"
      [nzTitle]="'PROJECT_EVM.ETC_TITLE' | translate"
      (nzOnCancel)="etcTarget.set(null)"
      [nzFooter]="etcFooter"
    >
      <ng-container *nzModalContent>
        @if (etcTarget(); as target) {
          <p>{{ target.label }}</p>
          <label for="evm-etc">{{ 'PROJECT_EVM.ETC_LABEL' | translate }}</label>
          <nz-input-number id="evm-etc" class="evm-input" [nzMin]="0" [nzStep]="100" [ngModel]="etcValue()" (ngModelChange)="etcValue.set($event)" />
          <label for="evm-etc-reason">{{ 'PROJECT_EVM.ETC_REASON' | translate }}</label>
          <input id="evm-etc-reason" nz-input maxlength="500" [ngModel]="etcReason()" (ngModelChange)="etcReason.set($event)" />
          <p class="evm-muted">{{ 'PROJECT_EVM.ETC_HINT' | translate }}</p>
        }
      </ng-container>
      <ng-template #etcFooter>
        <button nz-button type="button" (click)="saveEtc(true)">{{ 'PROJECT_EVM.ETC_RESET' | translate }}</button>
        <button nz-button type="button" (click)="etcTarget.set(null)">{{ 'PROJECT_EVM.CANCEL' | translate }}</button>
        <button nz-button nzType="primary" type="button" [disabled]="etcValue() === null" (click)="saveEtc(false)">{{ 'PROJECT_EVM.SAVE' | translate }}</button>
      </ng-template>
    </nz-modal>

    <nz-modal
      [nzVisible]="overheadOpen()"
      [nzTitle]="'PROJECT_EVM.OVERHEAD_TITLE' | translate"
      (nzOnCancel)="overheadOpen.set(false)"
      (nzOnOk)="allocateOverhead()"
      [nzOkText]="'PROJECT_EVM.OH_SUBMIT' | translate"
      [nzCancelText]="'PROJECT_EVM.CANCEL' | translate"
      [nzOkDisabled]="!overheadValid()"
    >
      <ng-container *nzModalContent>
        <label for="evm-oh-run">{{ 'PROJECT_EVM.OH_RUN_KEY' | translate }}</label>
        <input id="evm-oh-run" nz-input maxlength="40" [ngModel]="ohRunKey()" (ngModelChange)="ohRunKey.set($event)" />
        <label for="evm-oh-cc">{{ 'PROJECT_EVM.OH_COST_CENTER' | translate }}</label>
        <input id="evm-oh-cc" nz-input [ngModel]="ohCostCenter()" (ngModelChange)="ohCostCenter.set($event)" />
        <label for="evm-oh-pool">{{ 'PROJECT_EVM.OH_POOL' | translate }}</label>
        <nz-input-number id="evm-oh-pool" class="evm-input" [nzMin]="0" [nzStep]="100" [ngModel]="ohPool()" (ngModelChange)="ohPool.set($event)" />
        <label for="evm-oh-start">{{ 'PROJECT_EVM.OH_PERIOD' | translate }}</label>
        <div class="evm-period">
          <input id="evm-oh-start" nz-input type="date" [ngModel]="ohStart()" (ngModelChange)="ohStart.set($event)" />
          <input nz-input type="date" [attr.aria-label]="'PROJECT_EVM.OH_PERIOD' | translate" [ngModel]="ohEnd()" (ngModelChange)="ohEnd.set($event)" />
        </div>
        <label for="evm-oh-driver">{{ 'PROJECT_EVM.OH_DRIVER' | translate }}</label>
        <nz-select id="evm-oh-driver" class="evm-input" [ngModel]="ohDriver()" (ngModelChange)="ohDriver.set($event)">
          <nz-option nzValue="labor_hours" [nzLabel]="'PROJECT_EVM.DRIVER_LABOR_HOURS' | translate" />
          <nz-option nzValue="direct_cost" [nzLabel]="'PROJECT_EVM.DRIVER_DIRECT_COST' | translate" />
        </nz-select>
      </ng-container>
    </nz-modal>
  `,
})
export class ProjectEvmDashboardComponent implements OnInit {
  private readonly api = inject(ProjectEvmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  protected readonly projectId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), { initialValue: '' });
  protected readonly granularities: EvmGranularity[] = ['day', 'week', 'month'];

  protected readonly breakdown = signal<WbsBreakdown | null>(null);
  protected readonly waterfall = signal<Waterfall | null>(null);
  protected readonly scurve = signal<Scurve | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal(false);
  protected readonly scope = signal<'project' | 'portfolio'>('project');
  protected readonly granularity = signal<EvmGranularity>('month');
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly etcTarget = signal<EtcTarget | null>(null);
  protected readonly etcValue = signal<number | null>(null);
  protected readonly etcReason = signal('');

  protected readonly overheadOpen = signal(false);
  protected readonly ohRunKey = signal('');
  protected readonly ohCostCenter = signal('');
  protected readonly ohPool = signal<number | null>(null);
  protected readonly ohStart = signal('');
  protected readonly ohEnd = signal('');
  protected readonly ohDriver = signal<OverheadDriver>('direct_cost');

  protected readonly project = computed<BreakdownRow | null>(() => this.breakdown()?.project ?? null);
  protected readonly currency = computed(() => this.breakdown()?.currency ?? this.waterfall()?.currency ?? 'EUR');
  protected readonly rows = computed(() => flattenWbs(this.breakdown()?.nodes ?? [], this.expanded()));
  protected readonly allExpanded = computed(() => parentIds(this.breakdown()?.nodes ?? []).every((id) => this.expanded().has(id)));
  protected readonly absorptionPercent = computed(() => Math.min(100, Number(this.project()?.budget_absorption_percent ?? 0)));
  protected readonly alerts = computed(() => {
    const p = this.project();

    return breachCount({ cpi: p?.cpi, spi: p?.spi, absorption: p?.budget_absorption_percent });
  });
  protected readonly overheadValid = computed(
    () => this.ohRunKey().trim() !== '' && this.ohCostCenter().trim() !== '' && (this.ohPool() ?? 0) > 0 && this.ohStart() !== '' && this.ohEnd() !== '' && this.ohEnd() >= this.ohStart(),
  );

  protected readonly scurveChart = computed(() => {
    const curve = this.scurve();

    return curve === null || curve.points.length === 0
      ? null
      : scurveOption(curve, {
          pv: this.i18n.translate('PROJECT_EVM.SERIES_PV'),
          ev: this.i18n.translate('PROJECT_EVM.SERIES_EV'),
          ac: this.i18n.translate('PROJECT_EVM.SERIES_AC'),
          eac: this.i18n.translate('PROJECT_EVM.SERIES_EAC'),
        });
  });
  protected readonly waterfallChart = computed(() => {
    const waterfall = this.waterfall();

    return waterfall === null || waterfall.snapshot_date === null ? null : waterfallOption(waterfall, (key) => this.i18n.translate(key));
  });

  protected readonly lightColor = lightColor;
  protected readonly absorptionWarning = absorptionWarning;

  ngOnInit(): void {
    this.load();
  }

  protected lightKey(light: Parameters<typeof lightColor>[0]): string {
    return LIGHT_KEYS[light ?? indexLight(null)];
  }

  protected granularityKey(option: EvmGranularity): string {
    return GRANULARITY_KEYS[option];
  }

  protected toggle(id: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);

      if (!next.delete(id)) {
        next.add(id);
      }

      return next;
    });
  }

  protected toggleAll(): void {
    this.expanded.set(this.allExpanded() ? new Set() : new Set(parentIds(this.breakdown()?.nodes ?? [])));
  }

  protected setScope(scope: 'project' | 'portfolio'): void {
    this.scope.set(scope);
    this.loadScurve();
  }

  protected setGranularity(granularity: EvmGranularity): void {
    this.granularity.set(granularity);
    this.loadScurve();
  }

  protected recompute(): void {
    this.busy.set(true);
    this.api.compute(this.projectId()).subscribe({
      next: () => {
        this.busy.set(false);
        this.message.success(this.i18n.translate('PROJECT_EVM.RECOMPUTED'));
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.message.error(this.i18n.translate('PROJECT_EVM.SAVE_ERROR'));
      },
    });
  }

  protected openEtc(nodeId: string | null, label: string, current: string | null | undefined): void {
    this.etcTarget.set({ nodeId, label, current: current ?? null });
    this.etcValue.set(current === null || current === undefined ? null : Number(current));
    this.etcReason.set('');
  }

  /** Saves the manual ETC, or drops it (`reset`) so the forecast goes back to BAC / CPI. */
  protected saveEtc(reset: boolean): void {
    const target = this.etcTarget();

    if (target === null) {
      return;
    }

    this.api
      .setManualEtc(this.projectId(), {
        wbs_node_id: target.nodeId,
        estimate_to_complete: reset ? null : this.etcValue(),
        reason: reset ? null : this.etcReason() || null,
      })
      .subscribe({
        next: () => {
          this.etcTarget.set(null);
          this.message.success(this.i18n.translate('PROJECT_EVM.ETC_SAVED'));
          this.load();
        },
        error: () => this.message.error(this.i18n.translate('PROJECT_EVM.SAVE_ERROR')),
      });
  }

  protected allocateOverhead(): void {
    if (!this.overheadValid()) {
      return;
    }

    this.api
      .allocateOverhead({
        run_key: this.ohRunKey().trim(),
        cost_center_id: this.ohCostCenter().trim(),
        pool_amount: this.ohPool() ?? 0,
        period_start: this.ohStart(),
        period_end: this.ohEnd(),
        driver: this.ohDriver(),
      })
      .subscribe({
        next: (response) => {
          this.overheadOpen.set(false);
          this.message.success(this.i18n.translate('PROJECT_EVM.OH_DONE', { count: response.data.allocations.length }));
          this.load();
        },
        error: () => this.message.error(this.i18n.translate('PROJECT_EVM.SAVE_ERROR')),
      });
  }

  private load(): void {
    const id = this.projectId();
    this.loading.set(true);
    this.error.set(false);

    this.api.wbsBreakdown(id).subscribe({
      next: (response) => {
        this.breakdown.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
    this.api.waterfall(id).subscribe({ next: (response) => this.waterfall.set(response.data), error: () => this.error.set(true) });
    this.loadScurve();
  }

  private loadScurve(): void {
    this.api
      .scurve({ granularity: this.granularity(), projectIds: this.scope() === 'project' ? [this.projectId()] : [] })
      .subscribe({ next: (response) => this.scurve.set(response.data), error: () => this.error.set(true) });
  }
}
