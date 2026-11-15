import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { QualityApiService, QualityKpis } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

interface Breakdown {
  readonly key: string;
  readonly count: number;
}

const toBreakdown = (record: Record<string, number>): Breakdown[] =>
  Object.entries(record).map(([key, count]) => ({ key, count }));

/** Quality management indicators: open non-conformities, CAPA punctuality, audits and procedures due. */
@Component({
  selector: 'app-quality-kpis',
  styleUrl: './quality.scss',
  imports: [NzAlertModule, NzCardModule, NzSkeletonModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="'QUALITY.KPI_TITLE' | translate" [subtitle]="'QUALITY.KPI_SUBTITLE' | translate" />

    @if (error()) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="'QUALITY.ACTION_ERROR' | translate" />
    } @else if (loading()) {
      <nz-card class="main-card"><nz-skeleton [nzActive]="true" /></nz-card>
    } @else if (kpis(); as data) {
      <div class="stats-grid">
        <nz-card nzSize="small">
          <div class="muted">{{ 'QUALITY.KPI_OPEN_NC' | translate }}</div>
          <strong>{{ data.open_nonconformities.total }}</strong>
        </nz-card>
        <nz-card nzSize="small">
          <div class="muted">{{ 'QUALITY.KPI_OLDEST_DAYS' | translate }}</div>
          <strong>{{ data.open_nonconformities.oldest_days ?? '-' }}</strong>
        </nz-card>
        <nz-card nzSize="small">
          <div class="muted">{{ 'QUALITY.KPI_CAPA_OVERDUE' | translate }}</div>
          <strong>{{ data.capa.overdue }}</strong>
        </nz-card>
        <nz-card nzSize="small">
          <div class="muted">{{ 'QUALITY.KPI_ON_TIME_RATE' | translate }}</div>
          <strong>{{ data.capa.on_time_rate !== null ? data.capa.on_time_rate + '%' : '-' }}</strong>
        </nz-card>
      </div>

      <div class="kpi-grid">
        <nz-card class="main-card" [nzTitle]="'QUALITY.KPI_BY_AGE' | translate">
          @for (item of byAge(); track item.key) {
            <div class="kpi-row"><span>{{ item.key }}</span><nz-tag>{{ item.count }}</nz-tag></div>
          }
        </nz-card>
        <nz-card class="main-card" [nzTitle]="'QUALITY.KPI_BY_SOURCE' | translate">
          @for (item of bySource(); track item.key) {
            <div class="kpi-row"><span>{{ item.key }}</span><nz-tag>{{ item.count }}</nz-tag></div>
          }
        </nz-card>
        <nz-card class="main-card" [nzTitle]="'QUALITY.KPI_BY_SEVERITY' | translate">
          @for (item of bySeverity(); track item.key) {
            <div class="kpi-row"><span>{{ item.key }}</span><nz-tag>{{ item.count }}</nz-tag></div>
          }
        </nz-card>

        <nz-card class="main-card" [nzTitle]="'QUALITY.KPI_CAPA' | translate">
          <div class="kpi-row"><span>{{ 'QUALITY.KPI_CAPA_OPEN' | translate }}</span><nz-tag>{{ data.capa.open }}</nz-tag></div>
          <div class="kpi-row"><span>{{ 'QUALITY.KPI_CAPA_OVERDUE' | translate }}</span><nz-tag [nzColor]="data.capa.overdue > 0 ? 'red' : 'default'">{{ data.capa.overdue }}</nz-tag></div>
          <div class="kpi-row"><span>{{ 'QUALITY.KPI_INEFFECTIVE' | translate }}</span><nz-tag>{{ data.capa.ineffective }}</nz-tag></div>
        </nz-card>
        <nz-card class="main-card" [nzTitle]="'QUALITY.KPI_AUDITS' | translate">
          <div class="kpi-row"><span>{{ 'QUALITY.KPI_AUDITS_PLANNED' | translate }}</span><nz-tag>{{ data.audits.planned }}</nz-tag></div>
          <div class="kpi-row"><span>{{ 'QUALITY.KPI_AUDITS_IN_PROGRESS' | translate }}</span><nz-tag>{{ data.audits.in_progress }}</nz-tag></div>
          <div class="kpi-row"><span>{{ 'QUALITY.KPI_AUDITS_OVERDUE' | translate }}</span><nz-tag [nzColor]="data.audits.overdue_planned > 0 ? 'red' : 'default'">{{ data.audits.overdue_planned }}</nz-tag></div>
        </nz-card>
        <nz-card class="main-card" [nzTitle]="'QUALITY.KPI_PROCEDURES' | translate">
          <div class="kpi-row"><span>{{ 'QUALITY.KPI_PROCEDURES_APPROVED' | translate }}</span><nz-tag>{{ data.procedures.approved }}</nz-tag></div>
          <div class="kpi-row"><span>{{ 'QUALITY.KPI_PROCEDURES_PENDING' | translate }}</span><nz-tag>{{ data.procedures.pending_approval }}</nz-tag></div>
          <div class="kpi-row"><span>{{ 'QUALITY.KPI_PROCEDURES_REVIEW_OVERDUE' | translate }}</span><nz-tag [nzColor]="data.procedures.review_overdue > 0 ? 'red' : 'default'">{{ data.procedures.review_overdue }}</nz-tag></div>
        </nz-card>
      </div>
    }
  `,
})
export class QualityKpisComponent implements OnInit {
  private readonly api = inject(QualityApiService);

  readonly kpis = signal<QualityKpis | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly byAge = computed(() => toBreakdown(this.kpis()?.open_nonconformities.by_age ?? {}));
  readonly bySource = computed(() => toBreakdown(this.kpis()?.open_nonconformities.by_source ?? {}));
  readonly bySeverity = computed(() => toBreakdown(this.kpis()?.open_nonconformities.by_severity ?? {}));

  ngOnInit(): void {
    this.api.getKpis().subscribe({
      next: (response) => {
        this.kpis.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
