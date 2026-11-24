import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  EsgInventory,
  EsgInventoryDelta,
  EsgReportingPeriod,
  EsgReportingPeriodRequest,
  SustainabilityApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, kgToTonnes } from './sustainability.util';

interface CategoryRow {
  scope: number;
  category: string;
  co2eKg: string;
  sharePercent: string;
  records: number;
}

/** GHG inventory of a reporting period: scope totals, categories, intensity, data quality and year-on-year change. */
@Component({
  selector: 'app-sustainability-dashboard',
  styleUrl: './sustainability.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'SUSTAINABILITY.INVENTORY_TITLE' | translate" [subtitle]="'SUSTAINABILITY.INVENTORY_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openPeriodModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select
        class="period-select"
        style="min-width: 240px"
        [ngModel]="selectedPeriodId()"
        (ngModelChange)="selectPeriod($event)"
        [nzPlaceHolder]="'SUSTAINABILITY.SELECT_PERIOD' | translate"
      >
        @for (period of periods(); track period.id) {
          <nz-option [nzValue]="period.id" [nzLabel]="period.name"></nz-option>
        }
      </nz-select>
      @if (selectedPeriod(); as period) {
        <nz-tag [nzColor]="period.status === 'open' ? 'green' : 'default'">{{ 'SUSTAINABILITY.PERIOD_' + period.status.toUpperCase() | translate }}</nz-tag>
        <span class="muted">{{ period.starts_on }} - {{ period.ends_on }}</span>
        <span class="spacer"></span>
        @if (period.status === 'open') {
          <button
            nz-button
            nz-popconfirm
            [nzPopconfirmTitle]="'SUSTAINABILITY.CLOSE_PERIOD_CONFIRM' | translate"
            (nzOnConfirm)="closePeriod(period)"
          >
            {{ 'SUSTAINABILITY.CLOSE_PERIOD' | translate }}
          </button>
        } @else {
          <button
            nz-button
            nz-popconfirm
            [nzPopconfirmTitle]="'SUSTAINABILITY.REOPEN_PERIOD_CONFIRM' | translate"
            (nzOnConfirm)="reopenPeriod(period)"
          >
            {{ 'SUSTAINABILITY.REOPEN_PERIOD' | translate }}
          </button>
        }
      }
    </div>

    @if (inventory(); as report) {
      <div class="stats-grid">
        <nz-card>
          <nz-statistic [nzValue]="(report.totals.total_tco2e | number: '1.0-3') ?? ''" [nzTitle]="'SUSTAINABILITY.TOTAL_TCO2E' | translate"></nz-statistic>
          @if (report.previous; as previous) {
            <span class="muted" [class.delta-up]="isUp(previous.delta.total)" [class.delta-down]="!isUp(previous.delta.total)">
              {{ deltaText(previous.delta.total) }} {{ 'SUSTAINABILITY.VS' | translate }} {{ previous.period_name }}
            </span>
          }
        </nz-card>
        @for (scope of report.scopes; track scope.scope) {
          <nz-card>
            <nz-statistic [nzValue]="(scope.tco2e | number: '1.0-3') ?? ''" [nzTitle]="('SUSTAINABILITY.SCOPE_' + scope.scope) | translate"></nz-statistic>
            <span class="muted">{{ scope.share_percent }}%</span>
            @if (report.previous; as previous) {
              <span class="muted" [class.delta-up]="isUp(scopeDelta(previous.delta, scope.scope))" [class.delta-down]="!isUp(scopeDelta(previous.delta, scope.scope))">
                {{ deltaText(scopeDelta(previous.delta, scope.scope)) }}
              </span>
            }
          </nz-card>
        }
      </div>

      <div class="stats-grid">
        <nz-card>
          <nz-statistic
            [nzValue]="report.intensity.tco2e_per_million_revenue ? (report.intensity.tco2e_per_million_revenue | number: '1.0-3') ?? '' : '-'"
            [nzTitle]="('SUSTAINABILITY.INTENSITY_REVENUE' | translate) + ' (' + report.intensity.currency + ')'"
          ></nz-statistic>
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzValue]="report.intensity.tco2e_per_fte ? (report.intensity.tco2e_per_fte | number: '1.0-3') ?? '' : '-'"
            [nzTitle]="'SUSTAINABILITY.INTENSITY_FTE' | translate"
          ></nz-statistic>
        </nz-card>
        <nz-card>
          <nz-statistic [nzValue]="report.data_quality.estimated_share_percent + '%'" [nzTitle]="'SUSTAINABILITY.ESTIMATED_SHARE' | translate"></nz-statistic>
          <span class="muted">{{ report.data_quality.estimated_records }} / {{ report.data_quality.records }} {{ 'SUSTAINABILITY.RECORDS' | translate }}</span>
        </nz-card>
      </div>

      @if (!report.intensity.tco2e_per_million_revenue && !report.intensity.tco2e_per_fte) {
        <nz-alert class="main-card" nzType="info" nzShowIcon [nzMessage]="'SUSTAINABILITY.INTENSITY_HINT' | translate"></nz-alert>
      }

      <nz-card class="main-card" [nzTitle]="'SUSTAINABILITY.BY_CATEGORY' | translate">
        <nz-table #table [nzData]="categoryRows()" [nzShowPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'SUSTAINABILITY.SCOPE' | translate }}</th>
              <th>{{ 'SUSTAINABILITY.CATEGORY' | translate }}</th>
              <th class="num">{{ 'SUSTAINABILITY.CO2E_KG' | translate }}</th>
              <th style="width: 220px">{{ 'SUSTAINABILITY.SHARE' | translate }}</th>
              <th class="num">{{ 'SUSTAINABILITY.RECORDS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.scope + row.category) {
              <tr>
                <td>{{ ('SUSTAINABILITY.SCOPE_' + row.scope) | translate }}</td>
                <td>{{ ('SUSTAINABILITY.CATEGORY_' + row.category.toUpperCase()) | translate }}</td>
                <td class="num">{{ row.co2eKg | number: '1.0-2' }}</td>
                <td><nz-progress [nzPercent]="toNumber(row.sharePercent)" nzSize="small"></nz-progress></td>
                <td class="num">{{ row.records }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (categoryRows().length === 0) {
          <nz-empty [nzNotFoundContent]="'SUSTAINABILITY.NO_DATA' | translate"></nz-empty>
        }
      </nz-card>
    } @else if (!loading()) {
      <nz-empty [nzNotFoundContent]="'SUSTAINABILITY.NO_PERIOD' | translate"></nz-empty>
    }

    <nz-modal appModalActions
      [(nzVisible)]="periodModalVisible"
      [nzTitle]="'SUSTAINABILITY.NEW_PERIOD' | translate"
      (nzOnCancel)="periodModalVisible.set(false)"
      (nzOnOk)="savePeriod()"
      okAction="save"
      [nzOkDisabled]="periodForm.invalid"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="periodForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUSTAINABILITY.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="name" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.STARTS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="date" formControlName="starts_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.ENDS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="date" formControlName="ends_on" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.REVENUE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="revenue" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="currency">
                  <nz-option nzValue="EUR" nzLabel="EUR"></nz-option>
                  <nz-option nzValue="CHF" nzLabel="CHF"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.EMPLOYEES_FTE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="employees_fte" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class SustainabilityDashboardComponent implements OnInit {
  private readonly api = inject(SustainabilityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly periods = signal<EsgReportingPeriod[]>([]);
  readonly selectedPeriodId = signal<string | null>(null);
  readonly inventory = signal<EsgInventory | null>(null);
  readonly loading = signal(false);
  readonly periodModalVisible = signal(false);

  readonly selectedPeriod = computed(() => this.periods().find((period) => period.id === this.selectedPeriodId()) ?? null);

  readonly categoryRows = computed<CategoryRow[]>(() =>
    (this.inventory()?.scopes ?? []).flatMap((scope) =>
      scope.categories.map((category) => ({
        scope: scope.scope,
        category: category.category,
        co2eKg: category.co2e_kg,
        sharePercent: category.share_percent,
        records: category.records,
      })),
    ),
  );

  readonly periodForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    starts_on: ['', [Validators.required]],
    ends_on: ['', [Validators.required]],
    revenue: [''],
    currency: ['EUR' as 'EUR' | 'CHF'],
    employees_fte: [''],
  });

  ngOnInit(): void {
    this.loadPeriods();
  }

  loadPeriods(selectId?: string): void {
    this.loading.set(true);
    this.api.getPeriods().subscribe({
      next: (response) => {
        this.periods.set(response.data);
        const id = selectId ?? this.selectedPeriodId() ?? response.data[0]?.id ?? null;
        this.selectedPeriodId.set(id);
        this.loadInventory();
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('SUSTAINABILITY.ACTION_ERROR'));
      },
    });
  }

  selectPeriod(id: string | null): void {
    this.selectedPeriodId.set(id);
    this.loadInventory();
  }

  private loadInventory(): void {
    const id = this.selectedPeriodId();
    if (id === null) {
      this.inventory.set(null);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.api.getInventory(id).subscribe({
      next: (response) => {
        this.inventory.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('SUSTAINABILITY.ACTION_ERROR'));
      },
    });
  }

  openPeriodModal(): void {
    const year = new Date().getFullYear();
    this.periodForm.reset({ name: `FY ${year}`, starts_on: `${year}-01-01`, ends_on: `${year}-12-31`, revenue: '', currency: 'EUR', employees_fte: '' });
    this.periodModalVisible.set(true);
  }

  savePeriod(): void {
    const value = this.periodForm.getRawValue();
    const payload: EsgReportingPeriodRequest = {
      name: value.name,
      starts_on: value.starts_on,
      ends_on: value.ends_on,
      revenue: value.revenue === '' ? null : String(value.revenue),
      currency: value.currency,
      employees_fte: value.employees_fte === '' ? null : String(value.employees_fte),
    };

    this.api.createPeriod(payload).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('SUSTAINABILITY.PERIOD_CREATED'));
        this.periodModalVisible.set(false);
        this.loadPeriods(response.data.id);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  closePeriod(period: EsgReportingPeriod): void {
    this.api.closePeriod(period.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('SUSTAINABILITY.PERIOD_CLOSED_DONE'));
        this.loadPeriods(period.id);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  reopenPeriod(period: EsgReportingPeriod): void {
    this.api.reopenPeriod(period.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('SUSTAINABILITY.PERIOD_REOPENED_DONE'));
        this.loadPeriods(period.id);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  scopeDelta(delta: { scope_1: EsgInventoryDelta; scope_2: EsgInventoryDelta; scope_3: EsgInventoryDelta }, scope: number): EsgInventoryDelta {
    return scope === 1 ? delta.scope_1 : scope === 2 ? delta.scope_2 : delta.scope_3;
  }

  isUp(delta: EsgInventoryDelta): boolean {
    return kgToTonnes(delta.absolute_kg) > 0;
  }

  /** "+12.50%" or "+1.2 t" when the previous period had no emissions to compare with. */
  deltaText(delta: EsgInventoryDelta): string {
    const sign = this.isUp(delta) ? '+' : '';
    return delta.percent !== null ? `${sign}${delta.percent}%` : `${sign}${kgToTonnes(delta.absolute_kg).toFixed(2)} t`;
  }

  toNumber(value: string): number {
    return Number(value) || 0;
  }
}
