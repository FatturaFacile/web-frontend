import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AllocationPreview,
  AllocationRule,
  AllocationRun,
  AnalyticalJob,
  ControllingApiService,
  CostCenterNode,
  JobPnl,
  TranslateService,
} from '@core';
import { TranslatePipe } from '@shared';
import { ControllingFilters } from './controlling-filters.service';

interface TreeRow {
  node: CostCenterNode;
  depth: number;
}

function errorText(error: unknown): string | null {
  const body = (error as { error?: { message?: unknown; errors?: Record<string, unknown> } })
    ?.error;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  return typeof body?.message === 'string' ? body.message : null;
}

/** Tab 3 — cost center tree with overhead allocations, job costing tracker and the allocation wizard (preview, post, reverse). */
@Component({
  selector: 'app-controlling-cost-centers',
  styleUrl: './controlling.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <nz-card [nzTitle]="'CONTROLLING.CC_TREE' | translate" class="main-card">
      <nz-table
        [nzData]="visibleRows()"
        [nzLoading]="loading()"
        nzSize="small"
        [nzShowPagination]="false"
      >
        <thead>
          <tr>
            <th>{{ 'CONTROLLING.COST_CENTER' | translate }}</th>
            <th class="num">{{ 'CONTROLLING.DIRECT_REVENUE' | translate }}</th>
            <th class="num">{{ 'CONTROLLING.DIRECT_COSTS' | translate }}</th>
            <th class="num">{{ 'CONTROLLING.ALLOC_IN' | translate }}</th>
            <th class="num">{{ 'CONTROLLING.ALLOC_OUT' | translate }}</th>
            <th class="num">{{ 'CONTROLLING.NET_RESULT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of visibleRows(); track row.node.id) {
            <tr>
              <td [style.padding-left.px]="12 + row.depth * 20">
                @if (row.node.children.length) {
                  <a
                    (click)="toggle(row.node.id)"
                    (keydown.enter)="toggle(row.node.id)"
                    tabindex="0"
                    [attr.aria-expanded]="expanded().has(row.node.id)"
                    >{{ expanded().has(row.node.id) ? '▾' : '▸' }}</a
                  >
                }
                <strong>{{ row.node.code }}</strong> {{ row.node.name }}
                <nz-tag>{{ row.node.center_type }}</nz-tag>
              </td>
              <td class="num">{{ figures(row).revenue | number: '1.0-0' }}</td>
              <td class="num">{{ figures(row).direct_costs | number: '1.0-0' }}</td>
              <td class="num">{{ figures(row).allocations_in | number: '1.0-0' }}</td>
              <td class="num">{{ figures(row).allocations_out | number: '1.0-0' }}</td>
              <td class="num" [class]="+figures(row).net_result < 0 ? 'badge-down' : 'badge-up'">
                {{ figures(row).net_result | number: '1.0-0' }}
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card [nzTitle]="'CONTROLLING.JOB_TRACKER' | translate" class="main-card">
      @for (pnl of jobPnls(); track pnl.job_id) {
        <div class="kpi" style="margin-bottom: 12px">
          <div class="label">{{ pnl.code }} — {{ pnl.name }}</div>
          <div class="bar-track">
            <span
              [style.width.%]="clamp(+pnl.cost_consumed_percent)"
              [style.background]="+pnl.cost_consumed_percent > 100 ? '#cf1322' : '#1677ff'"
            ></span>
          </div>
          <div class="muted">
            {{ 'CONTROLLING.COST_CONSUMED' | translate }}
            {{ pnl.cost_consumed_percent | number: '1.0-1' }} % ·
            {{ 'CONTROLLING.CONTRACT_VALUE' | translate }}
            {{ pnl.contract_value | number: '1.0-0' }} · {{ 'CONTROLLING.BILLED' | translate }}
            {{ pnl.invoiced_to_date | number: '1.0-0' }} ·
            {{ 'CONTROLLING.OPEN_COMMITMENTS' | translate }}
            {{ pnl.open_commitments | number: '1.0-0' }} ·
            {{ 'CONTROLLING.PROJECTED_MARGIN' | translate }}
            {{ pnl.projected_final_margin | number: '1.0-0' }}
          </div>
        </div>
      } @empty {
        <nz-empty [nzNotFoundContent]="'CONTROLLING.NO_DATA' | translate"></nz-empty>
      }
    </nz-card>

    <nz-card [nzTitle]="'CONTROLLING.ALLOC_WIZARD' | translate" class="main-card">
      <div class="toolbar">
        <nz-select
          style="width: 160px"
          [ngModel]="month()"
          (ngModelChange)="month.set($event); preview.set(null)"
          [attr.aria-label]="'CONTROLLING.MONTH' | translate"
        >
          @for (m of months; track m) {
            <nz-option [nzValue]="m" [nzLabel]="'' + m"></nz-option>
          }
        </nz-select>
        <button nz-button (click)="runPreview()">{{ 'CONTROLLING.PREVIEW' | translate }}</button>
        <button
          nz-button
          nzType="primary"
          [disabled]="!preview()?.transfers?.length"
          nz-popconfirm
          [nzPopconfirmTitle]="'CONTROLLING.CONFIRM_POST' | translate"
          (nzOnConfirm)="post()"
        >
          {{ 'CONTROLLING.POST_RUN' | translate }}
        </button>
      </div>
      <p class="muted">
        {{ 'CONTROLLING.RULES' | translate }}:
        @for (rule of rules(); track rule.id) {
          <nz-tag>{{ rule.step_order }}. {{ rule.name }} ({{ rule.driver_type }})</nz-tag>
        }
      </p>
      @if (preview(); as p) {
        <nz-table [nzData]="p.transfers" nzSize="small" [nzPageSize]="20">
          <thead>
            <tr>
              <th>{{ 'CONTROLLING.SOURCE' | translate }}</th>
              <th>{{ 'CONTROLLING.TARGET' | translate }}</th>
              <th>{{ 'CONTROLLING.DRIVER' | translate }}</th>
              <th class="num">{{ 'CONTROLLING.AMOUNT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (t of p.transfers; track $index) {
              <tr>
                <td>{{ name(t.source_cost_center_id) }}</td>
                <td>{{ name(t.recipient_id) }}</td>
                <td>{{ t.driver_type }}</td>
                <td class="num">{{ t.amount | number: '1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        <p class="num">
          <strong
            >{{ 'CONTROLLING.TOTAL' | translate }}:
            {{ p.total_allocated | number: '1.2-2' }}</strong
          >
        </p>
      }
      <nz-table [nzData]="runs()" nzSize="small" [nzPageSize]="10">
        <thead>
          <tr>
            <th>{{ 'CONTROLLING.PERIOD' | translate }}</th>
            <th>{{ 'CONTROLLING.STATUS' | translate }}</th>
            <th class="num">{{ 'CONTROLLING.AMOUNT' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (run of runs(); track run.id) {
            <tr>
              <td>{{ run.fiscal_year }}-{{ run.fiscal_month }}</td>
              <td>
                <nz-tag [nzColor]="run.status === 'posted' ? 'green' : 'default'">{{
                  run.status
                }}</nz-tag>
              </td>
              <td class="num">{{ run.total_allocated_amount | number: '1.2-2' }}</td>
              <td>
                @if (run.status === 'posted') {
                  <button
                    nz-button
                    nzDanger
                    nz-popconfirm
                    [nzPopconfirmTitle]="'CONTROLLING.CONFIRM_REVERSE' | translate"
                    (nzOnConfirm)="reverse(run.id)"
                  >
                    {{ 'CONTROLLING.REVERSE' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class ControllingCostCentersComponent implements OnInit {
  private readonly api = inject(ControllingApiService);
  private readonly filters = inject(ControllingFilters);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly months = Array.from({ length: 12 }, (_, i) => i + 1);
  protected readonly month = signal(this.filters.lastMonth());
  protected readonly loading = signal(false);
  protected readonly tree = signal<CostCenterNode[]>([]);
  protected readonly expanded = signal<Set<string>>(new Set());
  protected readonly jobs = signal<AnalyticalJob[]>([]);
  protected readonly jobPnls = signal<JobPnl[]>([]);
  protected readonly rules = signal<AllocationRule[]>([]);
  protected readonly runs = signal<AllocationRun[]>([]);
  protected readonly preview = signal<AllocationPreview | null>(null);

  protected readonly visibleRows = computed<TreeRow[]>(() => {
    const open = this.expanded();
    const walk = (nodes: CostCenterNode[], depth: number): TreeRow[] =>
      nodes.flatMap((node) => [
        { node, depth },
        ...(open.has(node.id) ? walk(node.children, depth + 1) : []),
      ]);
    return walk(this.tree(), 0);
  });

  private readonly names = computed(() => {
    const map = new Map<string, string>();
    const walk = (nodes: CostCenterNode[]): void =>
      nodes.forEach((node) => {
        map.set(node.id, node.code);
        walk(node.children);
      });
    walk(this.tree());
    this.jobs().forEach((job) => map.set(job.id, job.code));
    return map;
  });

  ngOnInit(): void {
    this.load();
  }

  protected figures(row: TreeRow) {
    return this.expanded().has(row.node.id) || !row.node.children.length
      ? row.node.own
      : row.node.rollup;
  }

  protected name(id: string): string {
    return this.names().get(id) ?? id.slice(0, 8);
  }

  protected toggle(id: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  protected runPreview(): void {
    this.api.previewAllocation(this.filters.fiscalYear(), this.month()).subscribe({
      next: (response) => this.preview.set(response.data),
      error: (error) =>
        this.message.error(errorText(error) ?? this.translate.instant('CONTROLLING.ACTION_FAILED')),
    });
  }

  protected post(): void {
    this.api.executeAllocation(this.filters.fiscalYear(), this.month()).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONTROLLING.RUN_POSTED'));
        this.preview.set(null);
        this.load();
      },
      error: (error) =>
        this.message.error(errorText(error) ?? this.translate.instant('CONTROLLING.ACTION_FAILED')),
    });
  }

  protected reverse(runId: string): void {
    this.api.reverseAllocation(runId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONTROLLING.RUN_REVERSED'));
        this.load();
      },
      error: (error) =>
        this.message.error(errorText(error) ?? this.translate.instant('CONTROLLING.ACTION_FAILED')),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.getCostCenterTree(this.filters.fiscalYear()).subscribe({
      next: (response) => {
        this.tree.set(response.data);
        this.expanded.set(new Set(response.data.map((node) => node.id)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.getJobs().subscribe({
      next: (response) => {
        this.jobs.set(response.data);
        this.jobPnls.set([]);
        response.data.forEach((job) =>
          this.api
            .getJobPnl(job.id)
            .subscribe({ next: (pnl) => this.jobPnls.update((list) => [...list, pnl.data]) }),
        );
      },
    });
    this.api.getAllocationRules().subscribe({ next: (response) => this.rules.set(response.data) });
    this.api.getAllocationRuns().subscribe({ next: (response) => this.runs.set(response.data) });
  }
}
