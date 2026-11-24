import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AGC_STATEMENT_STATUSES, AgcStatementStatus, PermissionsService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import {
  AGENT_COMMISSIONS_MODULE,
  isNonZero,
  selectableYears,
  statementStatusColor,
} from './agent-commissions.util';
import { StatementDetailDrawerComponent } from './statement-detail-drawer.component';
import { StatementGenerateModalComponent } from './statement-generate-modal.component';
import { StatementsStore } from './statements.store';

/**
 * Commission statements and settlement (Mod 041): the list with its filters, the dialog that generates a statement with a
 * live preview, and the detail drawer with the workflow actions.
 */
@Component({
  selector: 'app-statements',
  imports: [
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    StatementDetailDrawerComponent,
    StatementGenerateModalComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [StatementsStore],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.AGENT_COMMISSIONS_STATEMENTS' | translate"
    ></app-page-header>

    <div class="toolbar">
      <label class="field" for="agc-st-agent">
        <span>{{ 'agentCommissions.field.agent' | translate }}</span>
        <nz-select
          nzId="agc-st-agent"
          nzAllowClear
          [nzPlaceHolder]="'agentCommissions.action.all' | translate"
          [ngModel]="store.filters().agent_profile_id ?? null"
          (ngModelChange)="store.setFilters({ agent_profile_id: $event ?? undefined })"
        >
          @for (option of store.agentOptions(); track option.id) {
            <nz-option [nzValue]="option.id" [nzLabel]="option.name"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="agc-st-status">
        <span>{{ 'agentCommissions.field.status' | translate }}</span>
        <nz-select
          nzId="agc-st-status"
          nzAllowClear
          [nzPlaceHolder]="'agentCommissions.action.all' | translate"
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="store.setStatus($event ?? undefined)"
        >
          @for (status of statuses; track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'agentCommissions.statementStatus.' + status | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="agc-st-year">
        <span>{{ 'agentCommissions.field.year' | translate }}</span>
        <nz-select
          nzId="agc-st-year"
          nzAllowClear
          [nzPlaceHolder]="'agentCommissions.action.all' | translate"
          [ngModel]="store.filters().year ?? null"
          (ngModelChange)="store.setFilters({ year: $event ?? undefined })"
        >
          @for (year of years; track year) {
            <nz-option [nzValue]="year" [nzLabel]="'' + year"></nz-option>
          }
        </nz-select>
      </label>
      <button nz-button type="button" (click)="store.load()">
        {{ 'agentCommissions.action.refresh' | translate }}
      </button>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="generateOpen.set(true)">
          {{ 'agentCommissions.action.generate' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.statements()"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzFrontPagination]="false"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'agentCommissions.statements.number' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.agent' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.statements.period' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.status' | translate }}</th>
            <th scope="col" class="num">{{ 'agentCommissions.statements.gross' | translate }}</th>
            <th scope="col" class="num">
              {{ 'agentCommissions.statements.netPayable' | translate }}
            </th>
            <th scope="col" class="num">{{ 'agentCommissions.statements.blocked' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (statement of table.data; track statement.id) {
            <tr>
              <th scope="row">{{ statement.number }}</th>
              <td>{{ statement.agent_name }}</td>
              <td>{{ statement.period_start }} – {{ statement.period_end }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(statement.status)">{{
                  'agentCommissions.statementStatus.' + statement.status | translate
                }}</nz-tag>
              </td>
              <td class="num">{{ statement.gross_commission | money: statement.currency }}</td>
              <td class="num">{{ statement.net_payable | money: statement.currency }}</td>
              <td class="num">
                @if (nonZero(statement.blocked_amount)) {
                  <span class="lock">
                    <i class="fa-solid fa-lock" aria-hidden="true"></i>
                    {{ statement.blocked_amount | money: statement.currency }}
                  </span>
                }
              </td>
              <td>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  (click)="store.openDetail(statement.id)"
                >
                  {{ 'agentCommissions.action.details' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.statements().length === 0) {
        <nz-empty [nzNotFoundContent]="'agentCommissions.statements.empty' | translate"></nz-empty>
      }
    </nz-spin>

    <app-statement-generate-modal
      [visible]="generateOpen()"
      (closed)="generateOpen.set(false)"
      (generated)="onGenerated($event)"
    ></app-statement-generate-modal>

    <app-statement-detail-drawer></app-statement-detail-drawer>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 160px;
      font-size: 12px;
    }

    .feedback {
      margin-bottom: 12px;
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .lock {
      color: var(--ant-warning-color, #d48806);
      font-weight: 600;
    }
  `,
})
export class StatementsComponent implements OnInit {
  readonly store = inject(StatementsStore);

  /** Generating a statement is a `manage` action; approving and paying it are `settle` (the drawer). */
  readonly canWrite = inject(PermissionsService).canWrite(AGENT_COMMISSIONS_MODULE);

  readonly statuses: readonly AgcStatementStatus[] = AGC_STATEMENT_STATUSES;
  readonly years = selectableYears();
  readonly generateOpen = signal(false);

  readonly statusColor = statementStatusColor;
  readonly nonZero = isNonZero;

  ngOnInit(): void {
    void this.store.init();
  }

  /** The new statement opens in the drawer, ready for approval. */
  onGenerated(id: string): void {
    this.generateOpen.set(false);
    void this.store.openDetail(id);
  }
}
