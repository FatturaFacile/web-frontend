import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { CountryVatReturn, GeneralLedgerApiService, SpanishAnnualVatSummary } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import {
  currentYearEnd,
  currentYearStart,
  downloadBlob,
  rangeEndsBeforeStart,
} from '../shared/gl-dates';

type ReturnKey = 'ca3' | 'modelo303' | 'ustva';

/** The state of one periodic return panel: its period, the result of the last run and the running flags. */
interface ReturnPanel {
  key: ReturnKey;
  currency: string;
  hasCredit: boolean;
  from: string;
  to: string;
  previousCredit: number | null;
  result: CountryVatReturn | null;
  running: boolean;
  exporting: boolean;
}

/** Periodic VAT returns computed from the ledger: France CA3, Spain Modelo 303 and 390, Germany UStVA and the DATEV export. */
@Component({
  selector: 'app-gl-country-returns',
  styleUrl: './gl-localization.scss',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzTableModule,
    NzTabsModule,
    TranslatePipe,
  ],
  template: `
    <nz-tabs>
      @for (panel of panels(); track panel.key) {
        <nz-tab [nzTitle]="'GL.RET_TAB_' + panel.key.toUpperCase() | translate">
          <p>{{ 'GL.RET_HINT_' + panel.key.toUpperCase() | translate }}</p>
          <div class="filters">
            <label [attr.for]="'ret-from-' + panel.key">{{ 'GL.FROM' | translate }}</label>
            <input
              class="date-input"
              [id]="'ret-from-' + panel.key"
              nz-input
              type="date"
              [(ngModel)]="panel.from"
            />
            <label [attr.for]="'ret-to-' + panel.key">{{ 'GL.TO' | translate }}</label>
            <input
              class="date-input"
              [id]="'ret-to-' + panel.key"
              nz-input
              type="date"
              [(ngModel)]="panel.to"
            />
            @if (panel.hasCredit) {
              <nz-input-number
                [nzMin]="0"
                [nzPrecision]="2"
                [nzPlaceHolder]="'GL.RET_PREVIOUS_CREDIT' | translate"
                [(ngModel)]="panel.previousCredit"
              />
            }
            <button
              nz-button
              nzType="primary"
              type="button"
              [disabled]="rangeInvalid(panel)"
              [nzLoading]="panel.running"
              (click)="run(panel)"
            >
              {{ 'GL.RET_RUN' | translate }}
            </button>
            <button
              nz-button
              type="button"
              [disabled]="rangeInvalid(panel)"
              [nzLoading]="panel.exporting"
              (click)="exportReturn(panel)"
            >
              {{ 'GL.RET_EXPORT' | translate }}
            </button>
            @if (rangeInvalid(panel)) {
              <span class="ant-form-item-explain-error" role="alert">{{
                'COMMON.VALIDATION.END_AFTER_START' | translate
              }}</span>
            }
          </div>

          @if (panel.result; as result) {
            @for (warning of result.warnings; track warning) {
              <nz-alert nzType="warning" [nzMessage]="warning" nzShowIcon class="section" />
            }
            <nz-table nzSize="small" [nzData]="result.boxes" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'GL.RET_BOX' | translate }}</th>
                  <th>{{ 'GL.RET_BOX_LABEL' | translate }}</th>
                  <th class="num">{{ 'GL.RET_AMOUNT' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (box of result.boxes; track box.code) {
                  <tr>
                    <td>{{ box.code }}</td>
                    <td>
                      {{ 'GL.RET_' + result.form.toUpperCase() + '_' + box.code.toUpperCase() | translate }}
                    </td>
                    <td class="num">{{ box.amount | money: panel.currency }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <p class="num">
              <strong
                >{{ 'GL.RET_VAT_DUE' | translate }}: {{ result.vat_due | money: panel.currency }} -
                {{ 'GL.RET_VAT_CREDIT' | translate }}:
                {{ result.vat_credit | money: panel.currency }}</strong
              >
            </p>
          }

          @if (panel.key === 'modelo303') {
            <nz-card class="section" [nzTitle]="'GL.RET_390_TITLE' | translate">
              <p>{{ 'GL.RET_390_HINT' | translate }}</p>
              <div class="filters">
                <label for="ret-390-year">{{ 'GL.RET_YEAR' | translate }}</label>
                <nz-input-number
                  id="ret-390-year"
                  [nzMin]="2000"
                  [nzMax]="2100"
                  [nzPrecision]="0"
                  [(ngModel)]="annualYear"
                />
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  [disabled]="annualYear === null"
                  [nzLoading]="runningAnnual()"
                  (click)="runAnnual()"
                >
                  {{ 'GL.RET_RUN' | translate }}
                </button>
              </div>
              @if (annual(); as summary) {
                <nz-table nzSize="small" [nzData]="summary.quarters" [nzShowPagination]="false">
                  <thead>
                    <tr>
                      <th>{{ 'GL.RET_PERIOD' | translate }}</th>
                      <th class="num">{{ 'GL.RET_VAT_DUE' | translate }}</th>
                      <th class="num">{{ 'GL.RET_VAT_CREDIT' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (quarter of summary.quarters; track quarter.quarter) {
                      <tr>
                        <td>{{ 'GL.RET_QUARTER' | translate: { number: quarter.quarter } }}</td>
                        <td class="num">{{ quarter.vat_due | money: 'EUR' }}</td>
                        <td class="num">{{ quarter.vat_credit | money: 'EUR' }}</td>
                      </tr>
                    }
                    <tr>
                      <td>
                        <strong>{{ 'GL.RET_ANNUAL' | translate }}</strong>
                      </td>
                      <td class="num">
                        <strong>{{ summary.annual.vat_due | money: 'EUR' }}</strong>
                      </td>
                      <td class="num">
                        <strong>{{ summary.annual.vat_credit | money: 'EUR' }}</strong>
                      </td>
                    </tr>
                  </tbody>
                </nz-table>
              }
            </nz-card>
          }

          @if (panel.key === 'ustva') {
            <nz-card class="section" [nzTitle]="'GL.RET_DATEV_TITLE' | translate">
              <p>{{ 'GL.RET_DATEV_HINT' | translate }}</p>
              <div class="filters">
                <nz-input-number
                  [nzMin]="1"
                  [nzMax]="9999999"
                  [nzPrecision]="0"
                  [nzPlaceHolder]="'GL.RET_DATEV_CONSULTANT' | translate"
                  [(ngModel)]="datevConsultant"
                />
                <nz-input-number
                  [nzMin]="1"
                  [nzMax]="99999"
                  [nzPrecision]="0"
                  [nzPlaceHolder]="'GL.RET_DATEV_CLIENT' | translate"
                  [(ngModel)]="datevClient"
                />
                <nz-input-number
                  [nzMin]="4"
                  [nzMax]="8"
                  [nzPrecision]="0"
                  [nzPlaceHolder]="'GL.RET_DATEV_ACCOUNT_LENGTH' | translate"
                  [(ngModel)]="datevAccountLength"
                />
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  [disabled]="rangeInvalid(panel)"
                  [nzLoading]="exportingDatev()"
                  (click)="exportDatev(panel)"
                >
                  {{ 'GL.RET_DATEV_EXPORT' | translate }}
                </button>
              </div>
            </nz-card>
          }
        </nz-tab>
      }
    </nz-tabs>
  `,
})
export class GlCountryReturnsComponent {
  private readonly api = inject(GeneralLedgerApiService);

  protected readonly panels = signal<ReturnPanel[]>([
    this.newPanel('ca3', 'EUR', true),
    this.newPanel('modelo303', 'EUR', true),
    this.newPanel('ustva', 'EUR', false),
  ]);
  protected readonly annual = signal<SpanishAnnualVatSummary | null>(null);
  protected readonly runningAnnual = signal(false);
  protected readonly exportingDatev = signal(false);

  protected annualYear: number | null = new Date().getFullYear();
  protected datevConsultant: number | null = 1;
  protected datevClient: number | null = 1;
  protected datevAccountLength: number | null = 4;

  protected rangeInvalid(panel: ReturnPanel): boolean {
    return rangeEndsBeforeStart(panel.from, panel.to);
  }

  protected run(panel: ReturnPanel): void {
    if (this.rangeInvalid(panel)) {
      return;
    }
    panel.running = true;
    this.fetch(panel).subscribe({
      next: (res) => {
        panel.running = false;
        panel.result = res.data;
      },
      error: () => (panel.running = false),
    });
  }

  protected exportReturn(panel: ReturnPanel): void {
    if (this.rangeInvalid(panel)) {
      return;
    }
    const params = this.params(panel);
    const request =
      panel.key === 'ca3'
        ? this.api.exportFrenchCa3(params)
        : panel.key === 'modelo303'
          ? this.api.exportSpanishModelo303(params)
          : this.api.exportGermanUstva({ from: panel.from, to: panel.to });
    panel.exporting = true;
    request.subscribe({
      next: (blob) => {
        panel.exporting = false;
        downloadBlob(blob, `${panel.key}-${panel.from}-${panel.to}.csv`);
      },
      error: () => (panel.exporting = false),
    });
  }

  protected runAnnual(): void {
    if (this.annualYear === null) {
      return;
    }
    this.runningAnnual.set(true);
    this.api.getSpanishModelo390(this.annualYear).subscribe({
      next: (res) => {
        this.runningAnnual.set(false);
        this.annual.set(res.data);
      },
      error: () => this.runningAnnual.set(false),
    });
  }

  protected exportDatev(panel: ReturnPanel): void {
    if (this.rangeInvalid(panel)) {
      return;
    }
    this.exportingDatev.set(true);
    this.api
      .exportDatev({
        from: panel.from,
        to: panel.to,
        consultant_number: this.datevConsultant,
        client_number: this.datevClient,
        account_length: this.datevAccountLength,
      })
      .subscribe({
        next: (blob) => {
          this.exportingDatev.set(false);
          downloadBlob(blob, `EXTF_Buchungsstapel_${panel.from}_${panel.to}.csv`);
        },
        error: () => this.exportingDatev.set(false),
      });
  }

  private params(panel: ReturnPanel): { from: string; to: string; previous_credit: number | null } {
    return { from: panel.from, to: panel.to, previous_credit: panel.previousCredit };
  }

  private fetch(panel: ReturnPanel) {
    if (panel.key === 'ca3') {
      return this.api.getFrenchCa3(this.params(panel));
    }

    return panel.key === 'modelo303'
      ? this.api.getSpanishModelo303(this.params(panel))
      : this.api.getGermanUstva({ from: panel.from, to: panel.to });
  }

  private newPanel(key: ReturnKey, currency: string, hasCredit: boolean): ReturnPanel {
    return {
      key,
      currency,
      hasCredit,
      from: currentYearStart(),
      to: currentYearEnd(),
      previousCredit: null,
      result: null,
      running: false,
      exporting: false,
    };
  }
}
