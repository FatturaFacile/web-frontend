import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PermissionsService, WR_JURISDICTIONS, WR_REGIMES } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { AnnualPanelComponent } from './annual-panel.component';
import { BatchPanelComponent } from './batch-panel.component';
import { FlowsPanelComponent } from './flows-panel.component';
import { PostPanelComponent } from './post-panel.component';
import { SettlementsStore } from './settlements.store';
import {
  isNonZero,
  noteKey,
  selectableYears,
  warningKey,
  WITHHOLDING_RECIPIENTS_SETTLE_MODULE,
} from './withholding-recipients.util';

/**
 * Settlement and export center (Mod 356): the tax register of the posted compensations for everyone who can read the module;
 * the posting of payments (single and batch), the F24 and UniEmens flows and the annual CU / AVS records for the `settle`
 * ability (owners, administrators and accountants).
 */
@Component({
  selector: 'app-wr-settlement-center',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AnnualPanelComponent,
    BatchPanelComponent,
    FlowsPanelComponent,
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    PostPanelComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  providers: [SettlementsStore],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.WITHHOLDING_RECIPIENTS_SETTLEMENTS' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    @if (!canSettle) {
      <nz-alert
        class="feedback"
        nzType="info"
        nzShowIcon
        [nzMessage]="'withholdingRecipients.settle.readOnly' | translate"
      ></nz-alert>
    }

    <nz-tabs>
      <nz-tab [nzTitle]="'withholdingRecipients.tab.register' | translate">
        <div class="toolbar">
          <label class="field" for="wr-reg-recipient">
            <span>{{ 'withholdingRecipients.field.recipient' | translate }}</span>
            <nz-select
              nzId="wr-reg-recipient"
              nzAllowClear
              nzShowSearch
              [nzPlaceHolder]="'withholdingRecipients.action.all' | translate"
              [ngModel]="store.filterRecipient()"
              (ngModelChange)="store.setRegisterFilters({ filterRecipient: $event ?? null })"
            >
              @for (entry of store.recipients(); track entry.id) {
                <nz-option [nzValue]="entry.id" [nzLabel]="entry.display_name"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="wr-reg-regime">
            <span>{{ 'withholdingRecipients.field.regime' | translate }}</span>
            <nz-select
              nzId="wr-reg-regime"
              nzAllowClear
              [nzPlaceHolder]="'withholdingRecipients.action.all' | translate"
              [ngModel]="store.filterRegime()"
              (ngModelChange)="store.setRegisterFilters({ filterRegime: $event ?? null })"
            >
              @for (regime of regimes; track regime) {
                <nz-option
                  [nzValue]="regime"
                  [nzLabel]="'withholdingRecipients.regime.' + regime | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="wr-reg-jurisdiction">
            <span>{{ 'withholdingRecipients.field.jurisdiction' | translate }}</span>
            <nz-select
              nzId="wr-reg-jurisdiction"
              nzAllowClear
              [nzPlaceHolder]="'withholdingRecipients.action.all' | translate"
              [ngModel]="store.filterJurisdiction()"
              (ngModelChange)="store.setRegisterFilters({ filterJurisdiction: $event ?? null })"
            >
              @for (jurisdiction of jurisdictions; track jurisdiction) {
                <nz-option
                  [nzValue]="jurisdiction"
                  [nzLabel]="'withholdingRecipients.jurisdiction.' + jurisdiction | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="wr-reg-year">
            <span>{{ 'withholdingRecipients.field.taxYear' | translate }}</span>
            <nz-select
              nzId="wr-reg-year"
              nzAllowClear
              [nzPlaceHolder]="'withholdingRecipients.action.all' | translate"
              [ngModel]="store.filterYear()"
              (ngModelChange)="store.setRegisterFilters({ filterYear: $event ?? null })"
            >
              @for (year of years; track year) {
                <nz-option [nzValue]="year" [nzLabel]="'' + year"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="wr-reg-month">
            <span>{{ 'withholdingRecipients.field.accrualMonth' | translate }}</span>
            <input
              nz-input
              id="wr-reg-month"
              type="month"
              [ngModel]="store.filterMonth()"
              (ngModelChange)="store.setRegisterFilters({ filterMonth: $event || null })"
            />
          </label>
          <button nz-button type="button" (click)="store.loadRegister()">
            {{ 'withholdingRecipients.action.refresh' | translate }}
          </button>
        </div>

        <nz-spin [nzSpinning]="store.loading()">
          <nz-table
            #table
            nzSize="small"
            [nzData]="store.rows()"
            [nzTotal]="store.meta()?.total ?? 0"
            [nzPageIndex]="store.page()"
            [nzPageSize]="store.meta()?.per_page ?? 20"
            [nzFrontPagination]="false"
            (nzPageIndexChange)="store.setPage($event)"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'withholdingRecipients.field.paymentDate' | translate }}</th>
                <th scope="col">{{ 'withholdingRecipients.field.recipient' | translate }}</th>
                <th scope="col">{{ 'withholdingRecipients.field.regime' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'withholdingRecipients.result.gross' | translate }}
                </th>
                <th scope="col" class="num">
                  {{ 'withholdingRecipients.register.withheld' | translate }}
                </th>
                <th scope="col" class="num">
                  {{ 'withholdingRecipients.result.inpsTotal' | translate }}
                </th>
                <th scope="col" class="num">
                  {{ 'withholdingRecipients.result.netPayable' | translate }}
                </th>
                <th scope="col">{{ 'withholdingRecipients.register.f24Due' | translate }}</th>
                <th scope="col">{{ 'withholdingRecipients.field.status' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of table.data; track row.id) {
                <tr>
                  <td>
                    {{ row.payment_date }}
                    <small class="muted">{{ row.accrual_month }}</small>
                  </td>
                  <th scope="row">
                    {{ row.recipient_name }}
                    @if (row.document_number) {
                      <small class="muted">{{ row.document_number }}</small>
                    }
                  </th>
                  <td>{{ 'withholdingRecipients.regime.' + row.regime | translate }}</td>
                  <td class="num">{{ row.gross_amount | money: row.currency }}</td>
                  <td class="num">
                    {{ withheld(row.irpef_withholding, row.source_tax) | money: row.currency }}
                  </td>
                  <td class="num">
                    @if (nonZero(row.inps_total)) {
                      {{ row.inps_total | money: row.currency }}
                    }
                  </td>
                  <td class="num">{{ row.net_payable | money: row.currency }}</td>
                  <td>{{ row.f24_due_date ?? '' }}</td>
                  <td>
                    <nz-tag>{{
                      'withholdingRecipients.settlementStatus.' + row.status | translate
                    }}</nz-tag>
                    @for (code of row.warnings; track code) {
                      <nz-tag nzColor="orange">{{ warningKey(code) | translate }}</nz-tag>
                    }
                    @for (code of row.notes; track code) {
                      <nz-tag nzColor="blue">{{ noteKey(code) | translate }}</nz-tag>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (!store.loading() && store.rows().length === 0) {
            <nz-empty
              [nzNotFoundContent]="'withholdingRecipients.register.empty' | translate"
            ></nz-empty>
          }
        </nz-spin>
      </nz-tab>

      @if (canSettle) {
        <nz-tab [nzTitle]="'withholdingRecipients.tab.post' | translate">
          <app-wr-post-panel></app-wr-post-panel>
        </nz-tab>
        <nz-tab [nzTitle]="'withholdingRecipients.tab.batch' | translate">
          <app-wr-batch-panel></app-wr-batch-panel>
        </nz-tab>
        <nz-tab [nzTitle]="'withholdingRecipients.tab.flows' | translate">
          <app-wr-flows-panel></app-wr-flows-panel>
        </nz-tab>
        <nz-tab [nzTitle]="'withholdingRecipients.tab.annual' | translate">
          <app-wr-annual-panel></app-wr-annual-panel>
        </nz-tab>
      }
    </nz-tabs>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 150px;
      font-size: 12px;
    }

    .feedback {
      margin-bottom: 12px;
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .muted {
      display: block;
      font-weight: normal;
      color: var(--ant-text-color-secondary, #595959);
    }
  `,
})
export class SettlementCenterComponent implements OnInit {
  readonly store = inject(SettlementsStore);

  /** Posting, the F24 / UniEmens flows and the annual records are the `settle` ability of owners, admins and accountants. */
  readonly canSettle = inject(PermissionsService).canWrite(WITHHOLDING_RECIPIENTS_SETTLE_MODULE);

  readonly years = selectableYears();
  readonly regimes = WR_REGIMES;
  readonly jurisdictions = WR_JURISDICTIONS;
  readonly nonZero = isNonZero;
  readonly warningKey = warningKey;
  readonly noteKey = noteKey;

  ngOnInit(): void {
    void this.store.init();
    void this.store.loadRegister();
  }

  /** The tax withheld on a payment: the IRPEF withholding of the Italian regimes or the source tax of the Swiss ones. */
  withheld(irpef: string, sourceTax: string): string {
    return String((Number(irpef) || 0) + (Number(sourceTax) || 0));
  }
}
