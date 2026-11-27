import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GC_KPIS } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { GreenCareDashboardStore } from './green-care.stores';
import { licenseColor, licenseState } from './green-care.util';

/**
 * Green care dashboard: the season KPI cards (active contracts, passages executed against contracted, extra passages to invoice,
 * routes hit by weather, phytosanitary treatments logged, green waste disposed in kg) and the licences about to expire.
 */
@Component({
  selector: 'app-green-care-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzProgressModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [GreenCareDashboardStore],
  styleUrl: './green-care.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.GREEN_CARE_DASHBOARD' | translate"
      [subtitle]="'greenCare.section.dashboardSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <div class="kpi-grid">
        @for (kpi of kpis; track kpi) {
          <div class="kpi" [attr.data-test]="'kpi-' + kpi">
            <div class="kpi-title">{{ 'greenCare.kpi.' + kpi | translate }}</div>
            <div class="kpi-value">{{ valueOf(kpi) | number: '1.0-0' }}</div>
            @if (kpi === 'passages') {
              <nz-progress nzSize="small" [nzPercent]="passagePercent()" [nzShowInfo]="false"></nz-progress>
              <div class="kpi-sub">
                {{ 'greenCare.kpi.passagesOf' | translate: { done: data()?.passages_executed ?? 0, total: data()?.passages_contracted ?? 0 } }}
              </div>
            }
            @if (kpi === 'weather_impacted_routes') {
              <div class="kpi-sub">{{ 'greenCare.kpi.upcomingRoutes' | translate: { count: data()?.upcoming_routes ?? 0 } }}</div>
            }
          </div>
        }
      </div>

      <h3 class="section-title">{{ 'greenCare.section.expiringLicenses' | translate }}</h3>
      <nz-table #licenses nzSize="small" [nzData]="data()?.expiring_licenses ?? []" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'greenCare.field.operator' | translate }}</th>
            <th>{{ 'greenCare.field.licenseType' | translate }}</th>
            <th>{{ 'greenCare.field.expiryDate' | translate }}</th>
            <th>{{ 'greenCare.field.daysToExpiry' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of licenses.data; track row.license_id) {
            <tr [attr.data-test]="'license-' + row.license_id">
              <td>{{ row.operator_name }}</td>
              <td>{{ 'greenCare.enum.licenseType.' + row.license_type | translate }}</td>
              <td>{{ row.expiry_date | date: 'mediumDate' }}</td>
              <td>
                <nz-tag [nzColor]="color(row.days_to_expiry)">{{ row.days_to_expiry }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if ((data()?.expiring_licenses ?? []).length === 0) {
        <nz-empty [nzNotFoundContent]="'greenCare.empty.licenses' | translate"></nz-empty>
      }

      <div class="actions">
        <a nz-button nzType="primary" routerLink="/green-care/planner">{{ 'greenCare.action.openPlanner' | translate }}</a>
        <a nz-button routerLink="/green-care/contracts">{{ 'greenCare.action.openContracts' | translate }}</a>
        <a nz-button routerLink="/green-care/treatments">{{ 'greenCare.action.openTreatments' | translate }}</a>
      </div>
    </nz-spin>
  `,
})
export class GreenCareDashboardComponent implements OnInit {
  protected readonly store = inject(GreenCareDashboardStore);

  protected readonly kpis = GC_KPIS;
  protected readonly data = computed(() => this.store.dashboard());
  protected readonly passagePercent = computed(() => {
    const dashboard = this.data();
    if (!dashboard || dashboard.passages_contracted <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((dashboard.passages_executed / dashboard.passages_contracted) * 100));
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected valueOf(kpi: (typeof GC_KPIS)[number]): number {
    const dashboard = this.data();
    if (!dashboard) {
      return 0;
    }
    return kpi === 'passages' ? dashboard.passages_executed : dashboard[kpi];
  }

  protected color(days: number): string {
    return licenseColor(licenseState(days, days >= 0));
  }
}
