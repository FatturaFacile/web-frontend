import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { AnalyticsApiService, AnalyticsKpiSnapshot, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { analyticsErrorText } from './analytics-designer.util';

/** ISO `Y-m-d` date of a date picker value (local day, no timezone shift). */
export function toIsoDay(value: Date | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/** The daily KPI values stored by the nightly refresh: the fast, already calculated series behind the dashboards. */
@Component({
  selector: 'app-kpi-snapshots',
  styleUrl: './analytics-pages.scss',
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzDatePickerModule, NzEmptyModule, NzSelectModule, NzTableModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="'ANALYTICS_BI.SNAPSHOTS_TITLE' | translate" [subtitle]="'ANALYTICS_BI.SNAPSHOTS_SUBTITLE' | translate" />

    @if (errorText(); as text) {
      <nz-alert nzType="error" [nzMessage]="text" nzShowIcon class="block"></nz-alert>
    }

    <nz-card class="block">
      <div class="inline">
        <nz-date-picker [(ngModel)]="from" [nzPlaceHolder]="'ANALYTICS_BI.FROM' | translate" [attr.aria-label]="'ANALYTICS_BI.FROM' | translate"></nz-date-picker>
        <nz-date-picker [(ngModel)]="to" [nzPlaceHolder]="'ANALYTICS_BI.TO' | translate" [attr.aria-label]="'ANALYTICS_BI.TO' | translate"></nz-date-picker>
        <button nz-button nzType="primary" type="button" [nzLoading]="loading()" (click)="load()">{{ 'ANALYTICS_BI.APPLY' | translate }}</button>
        <nz-select [ngModel]="kpiFilter()" (ngModelChange)="kpiFilter.set($event)" nzAllowClear [nzPlaceHolder]="'ANALYTICS_BI.ALL_KPIS' | translate" [attr.aria-label]="'ANALYTICS_BI.KPI' | translate" style="min-width: 200px">
          @for (key of kpiKeys(); track key) {
            <nz-option [nzValue]="key" [nzLabel]="key"></nz-option>
          }
        </nz-select>
      </div>
    </nz-card>

    <nz-card class="block">
      <nz-table #table nzSize="small" [nzData]="visible()" [nzLoading]="loading()" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'ANALYTICS_BI.KPI' | translate }}</th>
            <th>{{ 'ANALYTICS_BI.SNAPSHOT_DATE' | translate }}</th>
            <th>{{ 'ANALYTICS_BI.PERIOD' | translate }}</th>
            <th class="num">{{ 'ANALYTICS_BI.VALUE' | translate }}</th>
            <th>{{ 'ANALYTICS_BI.COMPUTED_AT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.kpi + row.snapshot_date) {
            <tr>
              <td>{{ row.kpi }}</td>
              <td>{{ row.snapshot_date }}</td>
              <td>{{ row.period_from }} - {{ row.period_to }}</td>
              <td class="num">{{ row.value ?? '-' }}</td>
              <td>{{ row.computed_at }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && visible().length === 0) {
        <nz-empty [nzNotFoundContent]="'ANALYTICS_BI.NO_SNAPSHOTS' | translate"></nz-empty>
      }
    </nz-card>
  `,
})
export class KpiSnapshotsComponent implements OnInit {
  private readonly api = inject(AnalyticsApiService);
  private readonly translate = inject(TranslateService);

  readonly snapshots = signal<AnalyticsKpiSnapshot[]>([]);
  readonly kpiFilter = signal<string | null>(null);
  readonly loading = signal(false);
  readonly errorText = signal<string | null>(null);
  from: Date | null = null;
  to: Date | null = null;

  readonly kpiKeys = computed(() => [...new Set(this.snapshots().map((snapshot) => snapshot.kpi))].sort());
  readonly visible = computed(() => this.snapshots().filter((snapshot) => this.kpiFilter() === null || snapshot.kpi === this.kpiFilter()));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorText.set(null);
    this.api.getKpiSnapshots({ from: toIsoDay(this.from), to: toIsoDay(this.to) }).subscribe({
      next: (response) => {
        this.snapshots.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorText.set(analyticsErrorText(error) ?? this.translate.instant('ANALYTICS_BI.ACTION_ERROR'));
      },
    });
  }
}
