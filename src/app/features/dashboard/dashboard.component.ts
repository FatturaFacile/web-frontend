import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { AuthStore } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    NzCardModule,
    NzGridModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzAlertModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'DASHBOARD.TITLE' | translate"
      [subtitle]="('DASHBOARD.SUBTITLE' | translate) + ' (' + authStore.activeTenant().name + ' - ' + authStore.activeJurisdiction() + ')'"
    />

    <nz-alert
      nzType="info"
      nzShowIcon
      [nzMessage]="alertTitle"
      [nzDescription]="alertDesc"
      class="jurisdiction-banner"
    >
      <ng-template #alertTitle>
        {{ 'DASHBOARD.ACTIVE_REGIME' | translate }}
        <strong>{{ authStore.activeJurisdiction() === 'IT' ? ('DASHBOARD.REGIME_IT_LABEL' | translate) : ('DASHBOARD.REGIME_CH_LABEL' | translate) }}</strong>
      </ng-template>
      <ng-template #alertDesc>
        {{ 'DASHBOARD.REGIME_DESC' | translate }}
      </ng-template>
    </nz-alert>

    <!-- Top KPI cards -->
    <div nz-row [nzGutter]="16" class="stats-grid">
      <div nz-col [nzXs]="24" [nzSm]="12" [nzLg]="6">
        <nz-card>
          <nz-statistic
            [nzValue]="authStore.activeJurisdiction() === 'IT' ? '€ 142.850' : 'CHF 184.200'"
            [nzTitle]="'DASHBOARD.KPI_REVENUE' | translate"
            [nzValueStyle]="{ color: 'var(--primary-color, #0d9488)' }"
          />
        </nz-card>
      </div>
      <div nz-col [nzXs]="24" [nzSm]="12" [nzLg]="6">
        <nz-card>
          <nz-statistic
            [nzValue]="authStore.activeJurisdiction() === 'IT' ? '€ 28.450' : 'CHF 32.100'"
            [nzTitle]="'DASHBOARD.KPI_PENDING' | translate"
            [nzValueStyle]="{ color: '#f59e0b' }"
          />
        </nz-card>
      </div>
      <div nz-col [nzXs]="24" [nzSm]="12" [nzLg]="6">
        <nz-card>
          <nz-statistic
            [nzValue]="48"
            [nzTitle]="'DASHBOARD.KPI_ORDERS' | translate"
            [nzValueStyle]="{ color: '#10b981' }"
          />
        </nz-card>
      </div>
      <div nz-col [nzXs]="24" [nzSm]="12" [nzLg]="6">
        <nz-card>
          <nz-statistic
            [nzValue]="'99.8%'"
            [nzTitle]="'DASHBOARD.KPI_COMPLIANCE' | translate"
            [nzValueStyle]="{ color: '#8b5cf6' }"
          />
        </nz-card>
      </div>
    </div>

    <!-- Quick Shortcuts & Recent Activity -->
    <div nz-row [nzGutter]="16">
      <div nz-col [nzXs]="24" [nzLg]="14">
        <nz-card [nzTitle]="'DASHBOARD.RECENT_DOCS' | translate">
          <nz-table #recentTable [nzData]="recentItems" [nzFrontPagination]="false" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'DASHBOARD.COL_REF' | translate }}</th>
                <th>{{ 'DASHBOARD.COL_TYPE' | translate }}</th>
                <th>{{ 'DASHBOARD.COL_PARTY' | translate }}</th>
                <th>{{ 'DASHBOARD.COL_AMOUNT' | translate }}</th>
                <th>{{ 'DASHBOARD.COL_STATUS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of recentTable.data; track item.ref) {
                <tr>
                  <td><strong>{{ item.ref }}</strong></td>
                  <td>{{ item.type }}</td>
                  <td>{{ item.party }}</td>
                  <td>{{ item.amount }}</td>
                  <td>
                    <nz-tag [nzColor]="item.color">{{ item.status }}</nz-tag>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      </div>

      <div nz-col [nzXs]="24" [nzLg]="10">
        <nz-card [nzTitle]="'DASHBOARD.SHOWCASE_TITLE' | translate">
          <div class="shortcut-list">
            <a nz-button nzType="primary" nzBlock routerLink="/sales/qr-bill" class="shortcut-btn">
              <i class="fa-solid fa-qrcode fa-icon-spaced"></i> {{ 'DASHBOARD.BTN_QR' | translate }}
            </a>
            <a nz-button nzType="default" nzBlock routerLink="/time-attendance" class="shortcut-btn">
              <i class="fa-solid fa-clock fa-icon-spaced"></i> {{ 'DASHBOARD.BTN_ATTENDANCE' | translate }}
            </a>
            <a nz-button nzType="default" nzBlock routerLink="/crm/clients" class="shortcut-btn">
              <i class="fa-solid fa-address-book fa-icon-spaced"></i> {{ 'DASHBOARD.BTN_CLIENTS' | translate }}
            </a>
            <a nz-button nzType="default" nzBlock routerLink="/automotive/tire-hotel" class="shortcut-btn">
              <i class="fa-solid fa-circle-dot fa-icon-spaced"></i> {{ 'DASHBOARD.BTN_TIRES' | translate }}
            </a>
          </div>
        </nz-card>
      </div>
    </div>
  `,
  styles: `
    .jurisdiction-banner {
      margin-bottom: 20px;
    }

    .stats-grid {
      margin-bottom: 20px;
    }

    .shortcut-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .shortcut-btn {
      text-align: left;
      height: 42px;
      font-size: 13px;
      display: flex;
      align-items: center;
      border-radius: 6px;
    }
  `,
})
export class DashboardComponent {
  readonly authStore = inject(AuthStore);

  readonly recentItems = [
    { ref: 'QR-2026-0042', type: 'Swiss QR-Bill', party: 'Bernasconi SA', amount: '1\'450.85 CHF', status: 'Pagata', color: 'success' },
    { ref: 'FPR 12/2026', type: 'Fattura SDI', party: 'Lombarda Manifatture', amount: '€ 5.490,00', status: 'Inviata SDI', color: 'blue' },
    { ref: 'ODP-891', type: 'Ordine Prod.', party: 'Reparto Assemblaggio', amount: '120 Pz', status: 'In corso', color: 'processing' },
    { ref: 'HOTEL-002', type: 'Hotel Pneumatici', party: 'Sara Riva (Golf 8)', amount: '4 Ruote Estive', status: 'Stoccato', color: 'purple' },
  ];
}
