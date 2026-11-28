import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { BondedDashboardStore, BondedLookupStore } from './bonded-warehouses.stores';
import { toNumber, utilizationColor, utilizationStatus } from './bonded-warehouses.util';

/**
 * Overview of the bonded warehouses: the KPI cards (total CGU ceiling, utilized amount = suspended duties and VAT, available plafond,
 * expiring authorizations, AEO compliance score), a progress gauge of the guarantee per authorization with the 80 % / 95 % alert colours
 * and the append-only CGU ledger.
 */
@Component({
  selector: 'app-bonded-dashboard',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [BondedDashboardStore],
  styleUrl: './bonded-warehouses.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.BONDED_WAREHOUSES_DASHBOARD' | translate"
      [subtitle]="'bondedWarehouses.section.dashboardSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.overview(); as overview) {
        <div class="kpi-grid">
          @for (money of overview.cgu; track money.currency) {
            <nz-card [attr.data-test]="'kpi-cgu-' + money.currency">
              <nz-statistic
                [nzTitle]="'bondedWarehouses.kpi.cguCeiling' | translate"
                [nzValue]="(num(money.ceiling) | currency: money.currency)!"
              ></nz-statistic>
              <nz-statistic
                [nzTitle]="'bondedWarehouses.kpi.cguUtilized' | translate"
                [nzValue]="(num(money.utilized) | currency: money.currency)!"
              ></nz-statistic>
              <nz-statistic
                [nzTitle]="'bondedWarehouses.kpi.cguAvailable' | translate"
                [nzValue]="(num(money.available) | currency: money.currency)!"
              ></nz-statistic>
            </nz-card>
          }
          <nz-card data-test="kpi-expiring">
            <nz-statistic
              [nzTitle]="'bondedWarehouses.kpi.expiring' | translate"
              [nzValue]="overview.expiring_authorizations.length"
            ></nz-statistic>
          </nz-card>
          <nz-card data-test="kpi-aeo-score">
            <nz-statistic
              [nzTitle]="'bondedWarehouses.kpi.aeoScore' | translate"
              [nzValue]="overview.aeo_compliance_score"
              nzSuffix="%"
            ></nz-statistic>
          </nz-card>
          <nz-card data-test="kpi-open-lots">
            <nz-statistic
              [nzTitle]="'bondedWarehouses.kpi.openLots' | translate"
              [nzValue]="overview.open_lots"
            ></nz-statistic>
            <nz-statistic
              [nzTitle]="'bondedWarehouses.kpi.usualHandling' | translate"
              [nzValue]="overview.usual_handling_in_progress"
            ></nz-statistic>
          </nz-card>
        </div>

        @if (overview.expiring_authorizations.length > 0) {
          <nz-alert
            class="feedback"
            data-test="expiring-alert"
            nzType="warning"
            nzShowIcon
            [nzMessage]="
              'bondedWarehouses.alert.expiring'
                | translate: { count: overview.expiring_authorizations.length }
            "
            [nzDescription]="expiringList"
          ></nz-alert>
          <ng-template #expiringList>
            @for (item of overview.expiring_authorizations; track item.authorization_id) {
              <nz-tag
                >{{ item.authorization_code }} — {{ item.valid_to | date: 'shortDate' }}</nz-tag
              >
            }
          </ng-template>
        }

        <h3 class="section-title">{{ 'bondedWarehouses.section.cguMonitor' | translate }}</h3>
        <div class="gauge-grid">
          @for (row of overview.plafond; track row.authorization_id) {
            <nz-card [attr.data-test]="'gauge-' + row.authorization_id">
              <div class="gauge">
                <strong>{{ row.authorization_code }}</strong>
                <nz-tag>{{ 'bondedWarehouses.regime.' + row.regime_type | translate }}</nz-tag>
                <nz-progress
                  nzType="dashboard"
                  [nzPercent]="row.utilization_percent"
                  [nzStatus]="status(row.utilization_percent)"
                  [nzStrokeColor]="color(row.utilization_percent)"
                ></nz-progress>
                <span>
                  {{ 'bondedWarehouses.column.available' | translate }}:
                  {{ num(row.available) | currency: row.currency }} /
                  {{ num(row.ceiling) | currency: row.currency }}
                </span>
                @if (row.utilization_percent >= 95) {
                  <nz-tag nzColor="red">{{
                    'bondedWarehouses.alert.cguCritical' | translate
                  }}</nz-tag>
                } @else if (row.utilization_percent >= 80) {
                  <nz-tag nzColor="orange">{{
                    'bondedWarehouses.alert.cguWarning' | translate
                  }}</nz-tag>
                }
              </div>
            </nz-card>
          } @empty {
            <nz-empty
              [nzNotFoundContent]="'bondedWarehouses.empty.authorizations' | translate"
            ></nz-empty>
          }
        </div>

        <h3 class="section-title">{{ 'bondedWarehouses.section.cguLedger' | translate }}</h3>
        <div class="toolbar">
          <label class="field" for="bw-d-auth">
            <span>{{ 'bondedWarehouses.filter.authorization' | translate }}</span>
            <nz-select
              nzId="bw-d-auth"
              nzAllowClear
              [(ngModel)]="authorizationId"
              (ngModelChange)="reloadLedger()"
            >
              @for (item of lookup.authorizations(); track item.id) {
                <nz-option [nzValue]="item.id" [nzLabel]="item.authorization_code"></nz-option>
              }
            </nz-select>
          </label>
          <span class="spacer"></span>
          <a nz-button routerLink="../mrn-ledger">{{
            'NAV.BONDED_WAREHOUSES_MRN_LEDGER' | translate
          }}</a>
        </div>
        <nz-table #ledger nzSize="small" [nzData]="store.ledger()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ 'bondedWarehouses.column.recordedAt' | translate }}</th>
              <th scope="col">{{ 'bondedWarehouses.column.reference' | translate }}</th>
              <th scope="col">{{ 'bondedWarehouses.column.direction' | translate }}</th>
              <th scope="col" class="numeric">{{ 'bondedWarehouses.column.duty' | translate }}</th>
              <th scope="col" class="numeric">{{ 'bondedWarehouses.column.vat' | translate }}</th>
              <th scope="col" class="numeric">{{ 'bondedWarehouses.column.delta' | translate }}</th>
              <th scope="col" class="numeric">
                {{ 'bondedWarehouses.column.runningBalance' | translate }}
              </th>
              <th scope="col" class="numeric">
                {{ 'bondedWarehouses.column.remainingPlafond' | translate }}
              </th>
            </tr>
          </thead>
          <tbody>
            @for (row of ledger.data; track row.id) {
              <tr [attr.data-test]="'ledger-' + row.id">
                <td>{{ row.recorded_at | date: 'short' }}</td>
                <td>{{ 'bondedWarehouses.cguReference.' + row.reference_type | translate }}</td>
                <td>
                  <nz-tag [nzColor]="row.movement_direction === 'Engage' ? 'orange' : 'green'">
                    {{ 'bondedWarehouses.cguDirection.' + row.movement_direction | translate }}
                  </nz-tag>
                </td>
                <td class="numeric">
                  {{ num(row.duty_amount) | currency: currencyOf(row.authorization_id) }}
                </td>
                <td class="numeric">
                  {{ num(row.vat_amount) | currency: currencyOf(row.authorization_id) }}
                </td>
                <td class="numeric">
                  {{ num(row.total_cgu_delta) | currency: currencyOf(row.authorization_id) }}
                </td>
                <td class="numeric">
                  {{
                    num(row.running_utilized_balance) | currency: currencyOf(row.authorization_id)
                  }}
                </td>
                <td class="numeric">
                  {{ num(row.remaining_plafond) | currency: currencyOf(row.authorization_id) }}
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8">
                  <nz-empty
                    [nzNotFoundContent]="'bondedWarehouses.empty.ledger' | translate"
                  ></nz-empty>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-spin>
  `,
})
export class BondedDashboardComponent implements OnInit {
  protected readonly store = inject(BondedDashboardStore);
  protected readonly lookup = inject(BondedLookupStore);
  protected readonly authorizationId = signal<string | null>(null);

  protected readonly num = toNumber;
  protected readonly status = utilizationStatus;
  protected readonly color = utilizationColor;

  ngOnInit(): void {
    void this.lookup.load();
    void this.store.load();
    void this.store.loadLedger(null);
  }

  protected reloadLedger(): void {
    void this.store.loadLedger(this.authorizationId());
  }

  protected currencyOf(authorizationId: string): string {
    return (
      this.lookup.authorizations().find((item) => item.id === authorizationId)?.currency ?? 'EUR'
    );
  }
}
