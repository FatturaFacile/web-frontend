import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  AnalyticalJob,
  COMPARE_MODES,
  ControllingApiService,
  CostCenterNode,
  MARGIN_TIERS,
  MarginTier,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  ControllingFilters,
  FacetKey,
  PERIOD_PRESETS,
  PeriodPreset,
} from './controlling-filters.service';

interface Option {
  id: string;
  label: string;
}

function flatten(nodes: CostCenterNode[]): Option[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${node.code} ${node.name}` },
    ...flatten(node.children),
  ]);
}

/** Controlling cockpit: the sticky control bar (period, baseline, margin tier, facets, export) and the five workspace tabs. */
@Component({
  selector: 'app-controlling-shell',
  styleUrl: './controlling.scss',
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzInputModule,
    NzRadioModule,
    NzSelectModule,
  ],
  template: `
    <app-page-header
      [title]="'CONTROLLING.TITLE' | translate"
      [subtitle]="'CONTROLLING.SUBTITLE' | translate"
    ></app-page-header>

    <div
      class="control-bar"
      role="search"
      [attr.aria-label]="'CONTROLLING.CONTROL_BAR' | translate"
    >
      <nz-select
        style="width: 170px"
        [ngModel]="filters.preset()"
        (ngModelChange)="filters.applyPreset($event)"
        [attr.aria-label]="'CONTROLLING.PERIOD' | translate"
      >
        @for (preset of presets; track preset) {
          <nz-option
            [nzValue]="preset"
            [nzLabel]="'CONTROLLING.PRESET_' + preset.toUpperCase() | translate"
          ></nz-option>
        }
      </nz-select>
      <input
        nz-input
        style="width: 150px"
        type="date"
        [ngModel]="filters.dateFrom()"
        (ngModelChange)="filters.setRange($event, filters.dateTo())"
        [attr.aria-label]="'CONTROLLING.DATE_FROM' | translate"
      />
      <input
        nz-input
        style="width: 150px"
        type="date"
        [ngModel]="filters.dateTo()"
        (ngModelChange)="filters.setRange(filters.dateFrom(), $event)"
        [attr.aria-label]="'CONTROLLING.DATE_TO' | translate"
      />
      <nz-select
        style="width: 190px"
        [ngModel]="filters.compareMode()"
        (ngModelChange)="filters.compareMode.set($event)"
        [attr.aria-label]="'CONTROLLING.COMPARE' | translate"
      >
        @for (mode of compareModes; track mode) {
          <nz-option
            [nzValue]="mode"
            [nzLabel]="'CONTROLLING.COMPARE_' + mode.toUpperCase() | translate"
          ></nz-option>
        }
      </nz-select>
      <nz-radio-group
        [ngModel]="filters.tier()"
        (ngModelChange)="setTier($event)"
        [attr.aria-label]="'CONTROLLING.TIER' | translate"
      >
        @for (tier of tiers; track tier) {
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-radio-button [nzValue]="tier">{{
            'CONTROLLING.TIER_' + tier.toUpperCase() | translate
          }}</label>
        }
      </nz-radio-group>
      <nz-select
        style="width: 200px"
        nzAllowClear
        [ngModel]="filters.facets().cost_center_id ?? null"
        (ngModelChange)="filters.setFacet('cost_center_id', $event)"
        [nzPlaceHolder]="'CONTROLLING.COST_CENTER' | translate"
        [attr.aria-label]="'CONTROLLING.COST_CENTER' | translate"
      >
        @for (option of costCenters(); track option.id) {
          <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
        }
      </nz-select>
      <nz-select
        style="width: 200px"
        nzAllowClear
        [ngModel]="filters.facets().job_id ?? null"
        (ngModelChange)="filters.setFacet('job_id', $event)"
        [nzPlaceHolder]="'CONTROLLING.JOB' | translate"
        [attr.aria-label]="'CONTROLLING.JOB' | translate"
      >
        @for (option of jobs(); track option.id) {
          <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
        }
      </nz-select>
      <nz-select
        style="width: 120px"
        nzAllowClear
        [ngModel]="filters.facets().country_code ?? null"
        (ngModelChange)="setFacet('country_code', $event)"
        [nzPlaceHolder]="'CONTROLLING.GEO_AREA' | translate"
        [attr.aria-label]="'CONTROLLING.GEO_AREA' | translate"
      >
        @for (code of countries; track code) {
          <nz-option [nzValue]="code" [nzLabel]="code"></nz-option>
        }
      </nz-select>
      <button nz-button (click)="exportXlsx()" [disabled]="exporting()">
        {{ 'CONTROLLING.EXPORT_XLSX' | translate }}
      </button>
    </div>

    <nav class="tabs" [attr.aria-label]="'CONTROLLING.TITLE' | translate">
      @for (tab of tabs; track tab.route) {
        <a [routerLink]="tab.route" routerLinkActive="active">{{ tab.key | translate }}</a>
      }
    </nav>

    <router-outlet />
  `,
})
export class ControllingShellComponent implements OnInit {
  protected readonly filters = inject(ControllingFilters);
  private readonly api = inject(ControllingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly presets: readonly PeriodPreset[] = PERIOD_PRESETS;
  protected readonly compareModes = COMPARE_MODES;
  protected readonly tiers = MARGIN_TIERS;
  protected readonly countries = ['CH', 'IT', 'DE', 'FR', 'AT'];
  protected readonly costCenters = signal<Option[]>([]);
  protected readonly jobs = signal<Option[]>([]);
  protected readonly exporting = signal(false);
  protected readonly tabs = [
    { route: 'margins', key: 'NAV.CONTROLLING_MARGINS' },
    { route: 'working-capital', key: 'NAV.CONTROLLING_WORKING_CAPITAL' },
    { route: 'cost-centers', key: 'NAV.CONTROLLING_COST_CENTERS' },
    { route: 'variance', key: 'NAV.CONTROLLING_VARIANCE' },
    { route: 'budgets', key: 'NAV.CONTROLLING_BUDGETS' },
    { route: 'ledger', key: 'NAV.CONTROLLING_LEDGER' },
  ];

  ngOnInit(): void {
    this.api
      .getCostCenterTree(this.filters.fiscalYear())
      .subscribe({ next: (response) => this.costCenters.set(flatten(response.data)) });
    this.api
      .getJobs()
      .subscribe({
        next: (response) =>
          this.jobs.set(
            response.data.map((job: AnalyticalJob) => ({
              id: job.id,
              label: `${job.code} ${job.name}`,
            })),
          ),
      });
  }

  protected setTier(tier: MarginTier): void {
    this.filters.tier.set(tier);
  }

  protected setFacet(key: FacetKey, value: string | null): void {
    this.filters.setFacet(key, value);
  }

  protected exportXlsx(): void {
    this.exporting.set(true);
    this.api.exportMargins({ ...this.filters.query(), group_by: 'product' }, 'xlsx').subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `margins-${this.filters.dateTo()}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
        this.message.error(this.translate.instant('CONTROLLING.EXPORT_FAILED'));
      },
    });
  }
}
