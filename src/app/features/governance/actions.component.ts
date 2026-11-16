import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { GovAction, GovDashboard, GovernanceApiService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { GovActionListComponent } from './gov-action-list.component';
import { GOV_ACTION_TRANSITIONS } from './governance.shared';

/** Remediation actions across the findings, with overdue detection and the actions of the current member. */
@Component({
  selector: 'app-governance-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzCardModule,
    NzCheckboxModule,
    NzSelectModule,
    NzStatisticModule,
    PageHeaderComponent,
    TranslatePipe,
    GovActionListComponent,
  ],
  styles: `
    .gov-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
      align-items: center;
    }
    .toolbar nz-select {
      min-width: 180px;
    }
  `,
  template: `
    <app-page-header [title]="'GOVERNANCE.ACTIONS.TITLE' | translate" [subtitle]="'GOVERNANCE.ACTIONS.SUBTITLE' | translate"></app-page-header>

    @if (dashboard(); as board) {
      <div class="gov-kpis">
        <nz-card><nz-statistic [nzValue]="board.actions.open" [nzTitle]="'GOVERNANCE.ACTIONS.OPEN' | translate"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzValue]="board.actions.overdue" [nzTitle]="'GOVERNANCE.ACTIONS.OVERDUE' | translate"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzValue]="board.actions.due_next_30_days" [nzTitle]="'GOVERNANCE.ACTIONS.DUE_NEXT_30' | translate"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzValue]="board.actions.awaiting_verification" [nzTitle]="'GOVERNANCE.ACTIONS.AWAITING_VERIFICATION' | translate"></nz-statistic></nz-card>
      </div>
    }

    <nz-card>
      <div class="toolbar">
        <nz-select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" nzAllowClear [nzPlaceHolder]="'GOVERNANCE.COMMON.STATUS' | translate">
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="'GOVERNANCE.ACTION_STATUS.' + status.toUpperCase() | translate"></nz-option>
          }
        </nz-select>
        <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
        <label nz-checkbox [ngModel]="mine()" (ngModelChange)="mine.set($event); load()">{{ 'GOVERNANCE.ACTIONS.MINE' | translate }}</label>
        <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
        <label nz-checkbox [ngModel]="overdueOnly()" (ngModelChange)="overdueOnly.set($event); load()">{{ 'GOVERNANCE.ACTIONS.OVERDUE_ONLY' | translate }}</label>
      </div>
      <app-gov-action-list [actions]="actions()" [loading]="loading()" [showFinding]="true" [pageSize]="15" (changed)="reload()" />
    </nz-card>
  `,
})
export class GovernanceActionsComponent implements OnInit {
  private readonly api = inject(GovernanceApiService);

  protected readonly statuses = Object.keys(GOV_ACTION_TRANSITIONS);
  protected readonly actions = signal<GovAction[]>([]);
  protected readonly dashboard = signal<GovDashboard | null>(null);
  protected readonly loading = signal(false);
  protected readonly statusFilter = signal<string | null>(null);
  protected readonly mine = signal(false);
  protected readonly overdueOnly = signal(false);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.load();
    this.api.getDashboard().subscribe({ next: (res) => this.dashboard.set(res.data) });
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getActions({
        per_page: 100,
        status: this.statusFilter() ?? undefined,
        mine: this.mine() ? 1 : undefined,
        overdue: this.overdueOnly() ? 1 : undefined,
      })
      .subscribe({
        next: (res) => {
          this.actions.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
