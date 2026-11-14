import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  SupplierOnboardingStatus,
  SupplierPortalApiService,
  SupplierPortalSummary,
  SupplierRiskProfile,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  ONBOARDING_STATUS_COLORS,
  ONBOARDING_STATUS_LABELS,
  reasonLabel,
  RISK_LEVEL_COLORS,
  RISK_LEVEL_LABELS,
} from './supplier-portal.utils';

/** Dashboard of the supplier lifecycle: what waits for a decision, and the suppliers flagged as risky. */
@Component({
  selector: 'app-supplier-overview',
  imports: [
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'SUPPLIER_PORTAL.TITLE' | translate" [subtitle]="'SUPPLIER_PORTAL.SUBTITLE' | translate">
      <button nz-button [nzLoading]="recalculating()" (click)="recalculate()">
        {{ 'SUPPLIER_PORTAL.RECALCULATE_RISK' | translate }}
      </button>
    </app-page-header>

    @if (summary(); as data) {
      <div class="stats-grid">
        <nz-card>
          <a routerLink="/supplier-portal/onboardings">
            <nz-statistic [nzValue]="underReview()" [nzTitle]="'SUPPLIER_PORTAL.STAT_UNDER_REVIEW' | translate"></nz-statistic>
          </a>
        </nz-card>
        <nz-card>
          <a routerLink="/supplier-portal/documents">
            <nz-statistic [nzValue]="data.documents_to_review" [nzTitle]="'SUPPLIER_PORTAL.STAT_DOCUMENTS_TO_REVIEW' | translate"></nz-statistic>
          </a>
        </nz-card>
        <nz-card>
          <a routerLink="/supplier-portal/documents">
            <nz-statistic [nzValue]="data.documents_expiring" [nzTitle]="'SUPPLIER_PORTAL.STAT_DOCUMENTS_EXPIRING' | translate"></nz-statistic>
          </a>
        </nz-card>
        <nz-card>
          <a routerLink="/supplier-portal/bank-changes">
            <nz-statistic [nzValue]="data.bank_changes_pending" [nzTitle]="'SUPPLIER_PORTAL.STAT_BANK_CHANGES' | translate"></nz-statistic>
          </a>
        </nz-card>
      </div>

      <nz-card [nzTitle]="'SUPPLIER_PORTAL.ONBOARDING_PIPELINE' | translate" class="section-card">
        <div class="pipeline">
          @for (status of statuses; track status) {
            <nz-tag [nzColor]="statusColors[status]">{{ statusLabels[status] | translate }}: {{ data.onboardings_by_status[status] }}</nz-tag>
          }
        </div>
      </nz-card>
    }

    <nz-card [nzTitle]="'SUPPLIER_PORTAL.RISKY_SUPPLIERS' | translate" class="section-card">
      <nz-table #riskTable [nzData]="risks()" [nzLoading]="loading()" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'SUPPLIER_PORTAL.SUPPLIER' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.RISK' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.SCORE' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.REASONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (risk of riskTable.data; track risk.id) {
            <tr>
              <td>{{ risk.supplier_name }}</td>
              <td>
                <nz-tag [nzColor]="levelColors[risk.level]">{{ levelLabels[risk.level] | translate }}</nz-tag>
              </td>
              <td>{{ risk.score }}</td>
              <td>
                @for (reason of risk.reasons; track $index) {
                  <nz-tag>{{ reasonLabel(reason.code) | translate }}@if (reason.detail) { ({{ reason.detail }}) }</nz-tag>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && risks().length === 0) {
        <nz-empty [nzNotFoundContent]="'SUPPLIER_PORTAL.NO_RISKY_SUPPLIERS' | translate"></nz-empty>
      }
    </nz-card>
  `,
  styles: `
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .section-card {
      margin-bottom: 16px;
    }
    .pipeline {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class SupplierOverviewComponent implements OnInit {
  private readonly api = inject(SupplierPortalApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly summary = signal<SupplierPortalSummary | null>(null);
  readonly risks = signal<SupplierRiskProfile[]>([]);
  readonly loading = signal(false);
  readonly recalculating = signal(false);
  readonly underReview = computed(() => this.summary()?.onboardings_by_status.under_review ?? 0);

  readonly statuses = Object.keys(ONBOARDING_STATUS_LABELS) as SupplierOnboardingStatus[];
  readonly statusLabels = ONBOARDING_STATUS_LABELS;
  readonly statusColors = ONBOARDING_STATUS_COLORS;
  readonly levelLabels = RISK_LEVEL_LABELS;
  readonly levelColors = RISK_LEVEL_COLORS;
  readonly reasonLabel = reasonLabel;

  ngOnInit(): void {
    this.load();
  }

  recalculate(): void {
    this.recalculating.set(true);
    this.api
      .recalculateRisk()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.recalculating.set(false);
          this.message.success(this.translate.instant('SUPPLIER_PORTAL.RISK_RECALCULATED', { value: result.evaluated }));
          this.load();
        },
        error: () => {
          this.recalculating.set(false);
          this.message.error(this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR'));
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (response) => this.summary.set(response.data), error: () => this.summary.set(null) });
    this.api
      .getRiskProfiles({ min_level: 'medium' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.risks.set(response.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
