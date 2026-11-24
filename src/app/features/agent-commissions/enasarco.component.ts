import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AgcEnasarcoRow } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { progressPercent, selectableYears } from './agent-commissions.util';
import { EnasarcoStore } from './enasarco.store';

/** The currency of the Enasarco and FIRR contributions: they are an Italian regime. */
const ENASARCO_CURRENCY = 'EUR';

/**
 * Enasarco and FIRR per agent and year (Mod 041): the contribution base against the ceiling (massimale), the
 * contributions against the floor (minimale) and the FIRR accrued so far.
 */
@Component({
  selector: 'app-enasarco',
  imports: [
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [EnasarcoStore],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.AGENT_COMMISSIONS_ENASARCO' | translate"
    ></app-page-header>

    <div class="toolbar">
      <label class="field" for="agc-enasarco-year">
        <span>{{ 'agentCommissions.field.year' | translate }}</span>
        <nz-select
          nzId="agc-enasarco-year"
          [ngModel]="store.year()"
          (ngModelChange)="store.setYear($event)"
        >
          @for (year of years; track year) {
            <nz-option [nzValue]="year" [nzLabel]="'' + year"></nz-option>
          }
        </nz-select>
      </label>
      <button nz-button type="button" (click)="store.init()">
        {{ 'agentCommissions.action.refresh' | translate }}
      </button>
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
        [nzData]="store.rows()"
        [nzFrontPagination]="false"
        [nzShowPagination]="false"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'agentCommissions.field.agent' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.mandate' | translate }}</th>
            <th scope="col" class="num">
              {{ 'agentCommissions.enasarco.commissionYtd' | translate }}
            </th>
            <th scope="col" class="bars">{{ 'agentCommissions.enasarco.baseYtd' | translate }}</th>
            <th scope="col" class="num">
              {{ 'agentCommissions.enasarco.massimaleRemaining' | translate }}
            </th>
            <th scope="col">{{ 'agentCommissions.enasarco.massimale' | translate }}</th>
            <th scope="col" class="num">{{ 'agentCommissions.enasarco.agentYtd' | translate }}</th>
            <th scope="col" class="num">
              {{ 'agentCommissions.enasarco.companyYtd' | translate }}
            </th>
            <th scope="col">{{ 'agentCommissions.enasarco.minimale' | translate }}</th>
            <th scope="col" class="num">{{ 'agentCommissions.enasarco.firrYtd' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.agent_profile_id) {
            <tr>
              <th scope="row">{{ row.agent_name }}</th>
              <td>{{ 'agentCommissions.enasarcoMandate.' + row.mandate | translate }}</td>
              <td class="num">{{ row.commission_ytd | money: currency }}</td>
              <td class="bars">
                <nz-progress
                  nzSize="small"
                  [nzPercent]="share(row)"
                  [nzStatus]="row.massimale_reached ? 'exception' : 'active'"
                  [nzShowInfo]="false"
                  [attr.aria-label]="'agentCommissions.enasarco.baseYtd' | translate"
                ></nz-progress>
                <small class="muted"
                  >{{ row.enasarco_base_ytd | money: currency }}
                  @if (row.massimale !== null) {
                    / {{ row.massimale | money: currency }}
                  }
                </small>
              </td>
              <td class="num">
                @if (row.massimale_remaining !== null) {
                  {{ row.massimale_remaining | money: currency }}
                }
              </td>
              <td>
                @if (row.massimale !== null) {
                  <nz-tag [nzColor]="row.massimale_reached ? 'red' : 'green'">{{
                    (row.massimale_reached
                      ? 'agentCommissions.enasarco.massimaleReached'
                      : 'agentCommissions.enasarco.massimaleOpen'
                    ) | translate
                  }}</nz-tag>
                }
              </td>
              <td class="num">{{ row.enasarco_agent_ytd | money: currency }}</td>
              <td class="num">{{ row.enasarco_company_ytd | money: currency }}</td>
              <td>
                @if (row.minimale !== null) {
                  <nz-tag [nzColor]="row.minimale_reached ? 'green' : 'orange'">{{
                    (row.minimale_reached
                      ? 'agentCommissions.enasarco.minimaleReached'
                      : 'agentCommissions.enasarco.minimaleShortfall'
                    ) | translate
                  }}</nz-tag>
                  @if (!row.minimale_reached && row.minimale_shortfall !== null) {
                    <small class="muted">{{ row.minimale_shortfall | money: currency }}</small>
                  }
                }
              </td>
              <td class="num">
                @if (row.firr_enabled) {
                  {{ row.firr_ytd | money: currency }}
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.rows().length === 0) {
        <nz-empty [nzNotFoundContent]="'agentCommissions.enasarco.empty' | translate"></nz-empty>
      }
    </nz-spin>
  `,
  styles: `
    .toolbar {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 120px;
      font-size: 12px;
    }

    .feedback {
      margin-bottom: 12px;
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .bars {
      min-width: 220px;
    }

    .muted {
      display: block;
      color: var(--ant-text-color-secondary, #595959);
    }
  `,
})
export class EnasarcoComponent implements OnInit {
  readonly store = inject(EnasarcoStore);

  readonly years = selectableYears();
  readonly currency = ENASARCO_CURRENCY;

  ngOnInit(): void {
    void this.store.init();
  }

  /** Share of the ceiling used by the contribution base, for the progress bar. */
  share(row: AgcEnasarcoRow): number {
    return progressPercent(row.enasarco_base_ytd, row.massimale);
  }
}
