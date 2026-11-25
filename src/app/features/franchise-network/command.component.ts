import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { CommandStore } from './command.store';
import {
  findingColor,
  isPeriod,
  pushStatusColor,
  statementStatusColor,
} from './franchise-network.util';

/**
 * Franchisor command view: network KPIs of the month (stores, net sell-out against the previous month and year, agreements that need
 * attention, the billing run, the sync health of the central pushes, the audit results and the purchase commitments).
 */
@Component({
  selector: 'app-frn-command',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [CommandStore],
  styleUrl: './franchise-network.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.FRANCHISE_NETWORK_COMMAND' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.lookups(); as lookups) {
        @if (!lookups.role.can_manage) {
          <nz-alert
            class="feedback"
            nzType="info"
            nzShowIcon
            [nzMessage]="'franchiseNetwork.hint.notFranchisor' | translate"
          ></nz-alert>
          @if (lookups.role.can_audit) {
            <a nz-button nzType="primary" routerLink="../audits">{{
              'NAV.FRANCHISE_NETWORK_AUDITS' | translate
            }}</a>
          } @else {
            <a nz-button nzType="primary" routerLink="../portal">{{
              'NAV.FRANCHISE_NETWORK_PORTAL' | translate
            }}</a>
          }
        }
      }

      @if (store.dashboard(); as board) {
        <div class="toolbar">
          <label class="field" for="frn-period">
            <span>{{ 'franchiseNetwork.field.period' | translate }}</span>
            <input
              id="frn-period"
              type="month"
              [ngModel]="store.period()"
              (ngModelChange)="onPeriod($event)"
            />
          </label>
        </div>

        <div class="stats-grid">
          <nz-card class="main-card">
            <nz-statistic
              [nzTitle]="'franchiseNetwork.kpi.stores' | translate"
              [nzValue]="board.stores.active + ' / ' + board.stores.total"
            ></nz-statistic>
            <small class="muted"
              >{{ 'franchiseNetwork.kpi.reporting' | translate }}: {{ board.stores.reporting }}</small
            >
            @if (board.stores.not_linked > 0) {
              <nz-tag nzColor="orange">{{
                'franchiseNetwork.kpi.notLinked' | translate: { count: board.stores.not_linked }
              }}</nz-tag>
            }
          </nz-card>

          <nz-card class="main-card">
            <nz-statistic
              [nzTitle]="'franchiseNetwork.kpi.netSellOut' | translate"
              [nzValue]="board.sell_out.net"
            ></nz-statistic>
            <small class="muted">
              {{ 'franchiseNetwork.kpi.momPercent' | translate }}:
              {{ board.sell_out.mom_percent ?? '—' }}% ·
              {{ 'franchiseNetwork.kpi.yoyPercent' | translate }}:
              {{ board.sell_out.yoy_percent ?? '—' }}%
            </small>
          </nz-card>

          <nz-card class="main-card">
            <nz-statistic
              [nzTitle]="'franchiseNetwork.kpi.agreements' | translate"
              [nzValue]="board.agreements.active"
            ></nz-statistic>
            @if (board.agreements.attention > 0) {
              <nz-tag nzColor="red">{{
                'franchiseNetwork.kpi.attention' | translate: { count: board.agreements.attention }
              }}</nz-tag>
            }
          </nz-card>

          <nz-card class="main-card">
            @if (board.billing; as billing) {
              <nz-statistic
                [nzTitle]="'franchiseNetwork.kpi.billing' | translate: { period: billing.period }"
                [nzValue]="billing.total_net"
                [nzSuffix]="billing.currency"
              ></nz-statistic>
              <nz-tag [nzColor]="statusColor(billing.status)">{{
                'franchiseNetwork.runStatus.' + billing.status | translate
              }}</nz-tag>
              <small class="muted"
                >{{ 'franchiseNetwork.field.royalty' | translate }} {{ billing.total_royalty }} ·
                {{ 'franchiseNetwork.field.marketingFund' | translate }}
                {{ billing.total_marketing }}</small
              >
            } @else {
              <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.runs' | translate"></nz-empty>
            }
          </nz-card>

          <nz-card class="main-card">
            <nz-statistic
              [nzTitle]="'franchiseNetwork.kpi.pushHealth' | translate"
              [nzValue]="board.pushes.failed_deliveries"
            ></nz-statistic>
            <small class="muted"
              >{{ 'franchiseNetwork.kpi.awaitingAck' | translate }}:
              {{ board.pushes.awaiting_acknowledgement }}</small
            >
          </nz-card>

          <nz-card class="main-card">
            <nz-statistic
              [nzTitle]="'franchiseNetwork.kpi.auditScore' | translate"
              [nzValue]="board.audits.average_score_percent ?? '—'"
              nzSuffix="%"
            ></nz-statistic>
            <small class="muted"
              >{{ 'franchiseNetwork.kpi.failedAudits' | translate }}: {{ board.audits.failed }} ·
              {{ 'franchiseNetwork.kpi.overdueActions' | translate }}:
              {{ board.audits.overdue_actions }}</small
            >
          </nz-card>

          <nz-card class="main-card">
            <nz-statistic
              [nzTitle]="'franchiseNetwork.kpi.purchasesBelowMinimum' | translate"
              [nzValue]="board.purchases.non_compliant"
            ></nz-statistic>
          </nz-card>
        </div>

        <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.alerts' | translate">
          <nz-table #alerts nzSize="small" [nzData]="store.alerts()" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'franchiseNetwork.field.store' | translate }}</th>
                <th scope="col">{{ 'franchiseNetwork.field.agreementNumber' | translate }}</th>
                <th scope="col">{{ 'franchiseNetwork.field.endDate' | translate }}</th>
                <th scope="col">{{ 'franchiseNetwork.section.alerts' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (agreement of alerts.data; track agreement.id) {
                <tr>
                  <th scope="row">{{ agreement.store_code }} {{ agreement.store_name }}</th>
                  <td>{{ agreement.agreement_number }}</td>
                  <td>{{ agreement.end_date }}</td>
                  <td class="tags">
                    @for (alert of agreement.alerts; track alert.code) {
                      <nz-tag [nzColor]="color(alert)">{{
                        'franchiseNetwork.finding.' + alert.code | translate: alert.params
                      }}</nz-tag>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">
                    <nz-empty
                      [nzNotFoundContent]="'franchiseNetwork.empty.alerts' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>

        <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.recentPushes' | translate">
          <div class="tags">
            @for (push of board.pushes.recent; track push.id) {
              <nz-tag [nzColor]="pushColor(push.status)"
                >{{ push.title }} · {{ 'franchiseNetwork.pushStatus.' + push.status | translate }}</nz-tag
              >
            } @empty {
              <span class="muted">{{ 'franchiseNetwork.empty.pushes' | translate }}</span>
            }
          </div>
        </nz-card>
      }
    </nz-spin>
  `,
})
export class CommandComponent implements OnInit {
  protected readonly store = inject(CommandStore);
  protected readonly color = findingColor;
  protected readonly pushColor = pushStatusColor;

  ngOnInit(): void {
    void this.store.load();
  }

  protected onPeriod(value: string): void {
    if (isPeriod(value)) {
      void this.store.load(value);
    }
  }

  protected statusColor(status: string): string {
    return statementStatusColor(status === 'invoiced' ? 'invoiced' : 'calculated');
  }
}
