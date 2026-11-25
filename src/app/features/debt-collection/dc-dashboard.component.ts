import { Component, inject, OnInit } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DC_LEVELS } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { levelColor } from './debt-collection.util';
import { WorkbenchStore } from './workbench.store';

/** KPI cards of the dunning workbench: overdue exposure, the proposal queue by level, the dispatch results and the legal pipeline. */
@Component({
  selector: 'app-dc-dashboard',
  imports: [
    MoneyPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSpinModule,
    NzStatisticModule,
    NzTagModule,
  ],
  styleUrl: './debt-collection.scss',
  template: `
    <div class="toolbar">
      <button nz-button type="button" (click)="store.loadDashboard()">
        {{ 'debtCollection.action.refresh' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate" />
    }

    <nz-spin [nzSpinning]="store.loadingDashboard()">
      @if (store.dashboard(); as dash) {
        <section class="stats" [attr.aria-label]="'debtCollection.tab.dashboard' | translate">
          <nz-card class="stat-card" [nzTitle]="'debtCollection.dashboard.overdue' | translate">
            @for (row of dash.overdue; track row.currency + row.jurisdiction) {
              <nz-statistic
                [nzValue]="row.amount | money: row.currency"
                [nzTitle]="
                  ('debtCollection.jurisdiction.' + row.jurisdiction | translate) +
                  ' · ' +
                  ('debtCollection.dashboard.items' | translate: { count: row.items })
                "
              />
            } @empty {
              <nz-empty [nzNotFoundContent]="'debtCollection.dashboard.noOverdue' | translate" />
            }
          </nz-card>

          <nz-card class="stat-card" [nzTitle]="'debtCollection.dashboard.proposals' | translate">
            <nz-statistic [nzValue]="dash.proposals.total" />
            <div class="inline-tags">
              @for (level of levels; track level) {
                <nz-tag [nzColor]="color(level)">
                  {{ 'debtCollection.level.' + level | translate }}:
                  {{ dash.proposals.by_level[level] ?? 0 }}
                </nz-tag>
              }
            </div>
          </nz-card>

          <nz-card class="stat-card" [nzTitle]="'debtCollection.dashboard.notices30d' | translate">
            <div class="inline-tags">
              <nz-tag nzColor="blue">
                {{ 'debtCollection.noticeStatus.sent' | translate }}: {{ dash.notices_30d.sent }}
              </nz-tag>
              <nz-tag nzColor="green">
                {{ 'debtCollection.noticeStatus.delivered' | translate }}:
                {{ dash.notices_30d.delivered }}
              </nz-tag>
              <nz-tag nzColor="red">
                {{ 'debtCollection.noticeStatus.failed' | translate }}:
                {{ dash.notices_30d.failed }}
              </nz-tag>
            </div>
          </nz-card>

          <nz-card class="stat-card">
            <nz-statistic
              [nzValue]="dash.excluded"
              [nzTitle]="'debtCollection.dashboard.excluded' | translate"
            />
          </nz-card>

          <nz-card class="stat-card">
            <nz-statistic
              [nzValue]="dash.enforcement_open"
              [nzTitle]="'debtCollection.dashboard.enforcementOpen' | translate"
            />
          </nz-card>

          <nz-card class="stat-card">
            <nz-statistic
              [nzValue]="dash.pec_awaiting_receipts"
              [nzTitle]="'debtCollection.dashboard.pecAwaiting' | translate"
            />
          </nz-card>

          <nz-card class="stat-card">
            <nz-statistic
              [nzValue]="dash.batches_running"
              [nzTitle]="'debtCollection.dashboard.batchesRunning' | translate"
            />
          </nz-card>

          <nz-card
            class="stat-card"
            [nzTitle]="'debtCollection.dashboard.interestAccrued' | translate"
          >
            @for (row of dash.interest_accrued; track row.currency) {
              <nz-statistic [nzValue]="row.amount | money: row.currency" />
            } @empty {
              <span class="muted">{{ 'debtCollection.dashboard.none' | translate }}</span>
            }
          </nz-card>
        </section>
      }
    </nz-spin>
  `,
})
export class DcDashboardComponent implements OnInit {
  protected readonly store = inject(WorkbenchStore);
  protected readonly levels = DC_LEVELS;

  ngOnInit(): void {
    void this.store.loadDashboard();
  }

  protected color = levelColor;
}
