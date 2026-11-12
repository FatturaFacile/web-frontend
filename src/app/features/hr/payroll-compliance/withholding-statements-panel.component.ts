import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AuthStore,
  I18nService,
  PayrollComplianceApiService,
  WithholdingPeriodType,
  WithholdingStatementQuery,
  WithholdingStatementReport,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError } from '../shared/hr-http.util';

const CANTONS = [
  'AG',
  'AI',
  'AR',
  'BE',
  'BL',
  'BS',
  'FR',
  'GE',
  'GL',
  'GR',
  'JU',
  'LU',
  'NE',
  'NW',
  'OW',
  'SG',
  'SH',
  'SO',
  'SZ',
  'TG',
  'TI',
  'UR',
  'VD',
  'VS',
  'ZG',
  'ZH',
];

/** Withholding tax statement of a period, by canton: preview with the missing data, then closing (409/422 from the server). */
@Component({
  selector: 'app-withholding-statements-panel',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <div class="flex items-end gap-2 mb-3 flex-wrap">
      <div>
        <label for="ws-year">{{ 'hrmCommon.year' | translate }}</label>
        <input
          nz-input
          id="ws-year"
          type="number"
          [ngModel]="year()"
          (ngModelChange)="year.set($event)"
        />
      </div>
      <div>
        <label for="ws-type">{{ 'hrmCompliance.statements.periodType' | translate }}</label>
        <nz-select
          id="ws-type"
         
          [ngModel]="periodType()"
          (ngModelChange)="periodType.set($event)"
        >
          @for (type of periodTypes; track type) {
            <nz-option
              [nzValue]="type"
              [nzLabel]="'hrmCompliance.statements.periodTypes.' + type | translate"
            />
          }
        </nz-select>
      </div>
      <div>
        <label for="ws-period">{{ 'hrmCompliance.statements.period' | translate }}</label>
        <input
          nz-input
          id="ws-period"
          type="number"
          min="1"
          max="12"
          [ngModel]="period()"
          (ngModelChange)="period.set($event)"
        />
      </div>
      <div>
        <label for="ws-canton">{{ 'hrmPayroll.canton' | translate }}</label>
        <nz-select
          id="ws-canton"
         
          nzAllowClear
          [ngModel]="canton()"
          (ngModelChange)="canton.set($event)"
        >
          @for (code of cantons; track code) {
            <nz-option [nzValue]="code" [nzLabel]="code" />
          }
        </nz-select>
      </div>
      <button nz-button type="button" [nzLoading]="loading()" (click)="load()">
        {{ 'hrmCompliance.statements.preview' | translate }}
      </button>
      <button
        nz-button
        nzType="primary"
        type="button"
        [disabled]="!canWrite() || !report()"
        (click)="confirmOpen.set(true)"
      >
        {{ 'hrmCompliance.statements.close' | translate }}
      </button>
    </div>

    @if (report(); as r) {
      @for (warning of warnings(); track $index) {
        <nz-alert class="mb-2" nzType="warning" nzShowIcon [nzMessage]="warning" />
      }
      @for (statement of r.statements; track statement.canton) {
        <h4>
          {{ statement.canton }}
          <nz-tag [nzColor]="statement.is_closed ? 'green' : 'blue'">
            {{
              (statement.is_closed
                ? 'hrmCompliance.statements.closed'
                : 'hrmCompliance.statements.open'
              ) | translate
            }}
          </nz-tag>
        </h4>
        <nz-table #lines [nzData]="statement.lines" [nzFrontPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'hrmCommon.employee' | translate }}</th>
              <th>{{ 'hrmLeave.month' | translate }}</th>
              <th>{{ 'hrmCompliance.statements.tariff' | translate }}</th>
              <th>{{ 'hrmPayroll.gross' | translate }}</th>
              <th>{{ 'hrmCompliance.statements.basis' | translate }}</th>
              <th>%</th>
              <th>{{ 'hrmPayroll.withholdingTax' | translate }}</th>
              <th>{{ 'hrmCompliance.statements.missing' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of lines.data; track $index) {
              <tr>
                <td>{{ line.last_name }} {{ line.first_name }}</td>
                <td>{{ line.month }}</td>
                <td>{{ line.tariff_code }}</td>
                <td>{{ line.gross | money: currency() }}</td>
                <td>{{ line.basis | money: currency() }}</td>
                <td>{{ line.rate_percent }}</td>
                <td>{{ line.tax | money: currency() }}</td>
                <td>{{ line.missing.length || '' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        <p class="mt-2">
          <strong>{{ 'hrmCompliance.statements.totalTax' | translate }}:</strong>
          {{ statement.total_tax | money: currency() }} &middot;
          {{ 'hrmCompliance.statements.commission' | translate }}:
          {{ statement.collection_commission_electronic | money: currency() }}
        </p>
      }
    }

    <nz-modal
      [nzVisible]="confirmOpen()"
      [nzTitle]="'hrmCompliance.statements.close' | translate"
      [nzOkText]="'hrmCommon.confirm' | translate"
      [nzCancelText]="'hrmCommon.cancel' | translate"
      [nzOkLoading]="closing()"
      (nzOnOk)="closeStatement()"
      (nzOnCancel)="confirmOpen.set(false)"
    >
      <ng-container *nzModalContent>{{
        'hrmCompliance.statements.closeConfirm' | translate
      }}</ng-container>
    </nz-modal>
  `,
})
export class WithholdingStatementsPanelComponent {
  readonly canWrite = input(false);

  private readonly api = inject(PayrollComplianceApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);

  protected readonly cantons = CANTONS;
  protected readonly periodTypes: WithholdingPeriodType[] = ['monthly', 'quarterly', 'annual'];
  protected readonly year = signal<number>(new Date().getFullYear());
  protected readonly periodType = signal<WithholdingPeriodType>('monthly');
  protected readonly period = signal<number>(1);
  protected readonly canton = signal<string | null>(null);
  protected readonly report = signal<WithholdingStatementReport | null>(null);
  protected readonly loading = signal(false);
  protected readonly closing = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly currency = computed(() => this.authStore.activeCurrency() || 'CHF');
  protected readonly warnings = computed(() =>
    (this.report()?.warnings ?? []).map((w) => (typeof w === 'string' ? w : JSON.stringify(w))),
  );

  private query(): WithholdingStatementQuery {
    return {
      year: this.year(),
      period_type: this.periodType(),
      period: this.period(),
      canton: this.canton(),
    };
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getWithholdingStatements(this.query()).subscribe({
      next: (res) => {
        this.report.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }

  protected closeStatement(): void {
    this.closing.set(true);
    this.api.closeWithholdingStatement(this.query()).subscribe({
      next: () => {
        this.closing.set(false);
        this.confirmOpen.set(false);
        this.message.success(this.i18n.translate('hrmCompliance.statements.closedToast'));
        this.load();
      },
      error: (err: unknown) => {
        this.closing.set(false);
        this.confirmOpen.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
