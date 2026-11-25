import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { TranslatePipe } from '@shared';
import { IntercompanyContextStore } from './intercompany-context.store';

/** Frame of the intercompany area: the group and the consolidation run every page works on, and the page links. */
@Component({
  selector: 'app-intercompany-shell',
  styleUrl: './intercompany.scss',
  imports: [FormsModule, NzAlertModule, NzSelectModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  template: `
    <div class="toolbar">
      <label for="ic-group">{{ 'intercompany.common.group' | translate }}</label>
      <nz-select
        id="ic-group"
        class="select-md"
        [ngModel]="ctx.groupId()"
        (ngModelChange)="ctx.selectGroup($event)"
        [nzPlaceHolder]="'intercompany.common.group' | translate"
      >
        @for (group of ctx.groups(); track group.id) {
          <nz-option [nzValue]="group.id" [nzLabel]="group.name + ' (' + group.group_currency + ')'" />
        }
      </nz-select>
      <label for="ic-run">{{ 'intercompany.common.run' | translate }}</label>
      <nz-select
        id="ic-run"
        class="select-md"
        nzAllowClear
        [ngModel]="ctx.runId()"
        (ngModelChange)="ctx.selectRun($event)"
        [nzPlaceHolder]="'intercompany.common.run' | translate"
      >
        @for (run of ctx.runs(); track run.id) {
          <nz-option [nzValue]="run.id" [nzLabel]="run.period_start + ' / ' + run.period_end" />
        }
      </nz-select>
      <span class="spacer"></span>
      <a class="muted" routerLink="/general-ledger/consolidation">{{ 'intercompany.common.openLedgerConsolidation' | translate }}</a>
    </div>

    <nav class="toolbar" [attr.aria-label]="'NAV.INTERCOMPANY' | translate">
      @for (link of links; track link.path) {
        <a
          [routerLink]="link.path"
          routerLinkActive="ant-btn-primary"
          [routerLinkActiveOptions]="{ exact: link.exact }"
          class="ant-btn ant-btn-default"
          >{{ link.key | translate }}</a
        >
      }
    </nav>

    @if (ctx.error(); as key) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="key | translate" />
    }
    @if (!ctx.loading() && ctx.groups().length === 0) {
      <nz-alert nzType="info" nzShowIcon [nzMessage]="'intercompany.common.noGroups' | translate" />
    } @else {
      <router-outlet />
    }
  `,
})
export class IntercompanyShellComponent implements OnInit {
  protected readonly ctx = inject(IntercompanyContextStore);

  protected readonly links = [
    { path: '.', exact: true, key: 'NAV.INTERCOMPANY_STRUCTURE' },
    { path: 'transactions', exact: false, key: 'NAV.INTERCOMPANY_TRANSACTIONS' },
    { path: 'reconciliation', exact: false, key: 'NAV.INTERCOMPANY_RECONCILIATION' },
    { path: 'consolidation', exact: false, key: 'NAV.INTERCOMPANY_CONSOLIDATION' },
    { path: 'statements', exact: false, key: 'NAV.INTERCOMPANY_STATEMENTS' },
  ];

  ngOnInit(): void {
    void this.ctx.loadGroups();
    void this.ctx.loadLookups();
  }
}
