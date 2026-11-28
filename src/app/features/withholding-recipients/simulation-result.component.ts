import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { WrSimulation } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { ThresholdBarsComponent } from './threshold-bars.component';
import {
  formatRate,
  isNonZero,
  noteKey,
  toNumber,
  warningKey,
} from './withholding-recipients.util';

/**
 * The figures of a compensation calculation: gross, flat-rate deduction, taxable base, withholdings, contributions split
 * between the worker and the company, the net payable and the cost for the company, with the warnings and notes the engine
 * reports (translated) and the threshold progress. Shared by the simulator and the posting form.
 */
@Component({
  selector: 'app-wr-simulation-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, NzAlertModule, ThresholdBarsComponent, TranslatePipe],
  template: `
    <table class="figures">
      <tbody>
        <tr>
          <th scope="row">{{ 'withholdingRecipients.result.gross' | translate }}</th>
          <td>{{ result().gross_amount | money: result().currency }}</td>
        </tr>
        @if (flatRatePercent(); as percent) {
          <tr>
            <th scope="row">
              {{ 'withholdingRecipients.result.flatRate' | translate: { percent: percent } }}
            </th>
            <td>− {{ result().flat_rate_deduction | money: result().currency }}</td>
          </tr>
        }
        <tr>
          <th scope="row">{{ 'withholdingRecipients.result.taxableBase' | translate }}</th>
          <td>{{ result().taxable_base | money: result().currency }}</td>
        </tr>
        @if (nonZero(result().irpef_withholding)) {
          <tr>
            <th scope="row">
              {{ 'withholdingRecipients.result.irpefWithholding' | translate }}
              <small class="muted">{{ rate(result().withholding_rate) }}</small>
              <small class="muted">
                {{ 'withholdingRecipients.result.effectiveRate' | translate }}
                {{ rate(result().effective_withholding_rate) }}
              </small>
            </th>
            <td class="neg">− {{ result().irpef_withholding | money: result().currency }}</td>
          </tr>
        }
        @if (nonZero(result().stamp_duty)) {
          <tr>
            <th scope="row">{{ 'withholdingRecipients.result.stampDuty' | translate }}</th>
            <td class="neg">− {{ result().stamp_duty | money: result().currency }}</td>
          </tr>
        }
        @if (nonZero(result().inps_total)) {
          <tr>
            <th scope="row">
              {{ 'withholdingRecipients.result.inpsTotal' | translate }}
              <small class="muted">
                {{ 'withholdingRecipients.result.inpsBase' | translate }}
                {{ result().inps_base | money: result().currency }}
              </small>
            </th>
            <td>{{ result().inps_total | money: result().currency }}</td>
          </tr>
          <tr class="sub">
            <th scope="row">{{ 'withholdingRecipients.result.inpsWorker' | translate }}</th>
            <td class="neg">− {{ result().inps_worker | money: result().currency }}</td>
          </tr>
          <tr class="sub">
            <th scope="row">{{ 'withholdingRecipients.result.inpsCompany' | translate }}</th>
            <td>{{ result().inps_company | money: result().currency }}</td>
          </tr>
        }
        @if (nonZero(result().enasarco_agent) || nonZero(result().enasarco_company)) {
          <tr>
            <th scope="row">
              {{ 'withholdingRecipients.result.enasarcoAgent' | translate }}
              <small class="muted">
                {{ 'withholdingRecipients.result.enasarcoBase' | translate }}
                {{ result().enasarco_base | money: result().currency }}
              </small>
            </th>
            <td class="neg">− {{ result().enasarco_agent | money: result().currency }}</td>
          </tr>
          <tr class="sub">
            <th scope="row">{{ 'withholdingRecipients.result.enasarcoCompany' | translate }}</th>
            <td>{{ result().enasarco_company | money: result().currency }}</td>
          </tr>
        }
        @if (nonZero(result().firr_accrual)) {
          <tr>
            <th scope="row">{{ 'withholdingRecipients.result.firr' | translate }}</th>
            <td>{{ result().firr_accrual | money: result().currency }}</td>
          </tr>
        }
        @if (nonZero(result().avs_employee) || nonZero(result().avs_employer)) {
          <tr>
            <th scope="row">
              {{ 'withholdingRecipients.result.avsEmployee' | translate }}
              <small class="muted">
                {{ 'withholdingRecipients.result.avsBase' | translate }}
                {{ result().avs_base | money: result().currency }}
              </small>
            </th>
            <td class="neg">− {{ result().avs_employee | money: result().currency }}</td>
          </tr>
          <tr class="sub">
            <th scope="row">{{ 'withholdingRecipients.result.avsEmployer' | translate }}</th>
            <td>{{ result().avs_employer | money: result().currency }}</td>
          </tr>
        }
        @if (nonZero(result().acquisition_expenses)) {
          <tr>
            <th scope="row">
              {{ 'withholdingRecipients.result.acquisitionExpenses' | translate }}
            </th>
            <td>{{ result().acquisition_expenses | money: result().currency }}</td>
          </tr>
        }
        @if (nonZero(result().source_tax)) {
          <tr>
            <th scope="row">{{ 'withholdingRecipients.result.sourceTax' | translate }}</th>
            <td class="neg">− {{ result().source_tax | money: result().currency }}</td>
          </tr>
        }
        @if (nonZero(result().non_taxable_amount)) {
          <tr>
            <th scope="row">
              {{ 'withholdingRecipients.result.nonTaxable' | translate }}
              @if (result().non_taxable_code) {
                <small class="muted">
                  {{ 'withholdingRecipients.result.nonTaxableCode' | translate }}
                  {{ result().non_taxable_code }}
                </small>
              }
            </th>
            <td>{{ result().non_taxable_amount | money: result().currency }}</td>
          </tr>
        }
        @if (result().cu_causal; as causal) {
          <tr>
            <th scope="row">{{ 'withholdingRecipients.field.cuCausal' | translate }}</th>
            <td>{{ 'withholdingRecipients.causal.' + causal | translate }}</td>
          </tr>
        }
        <tr class="total">
          <th scope="row">{{ 'withholdingRecipients.result.netPayable' | translate }}</th>
          <td>{{ result().net_payable | money: result().currency }}</td>
        </tr>
        <tr class="total">
          <th scope="row">{{ 'withholdingRecipients.result.companyCost' | translate }}</th>
          <td>{{ result().company_cost | money: result().currency }}</td>
        </tr>
      </tbody>
    </table>

    @for (code of result().warnings; track code) {
      <nz-alert
        class="message"
        nzType="warning"
        nzShowIcon
        [nzMessage]="warningKey(code) | translate"
      ></nz-alert>
    }
    @for (code of result().notes; track code) {
      <nz-alert
        class="message"
        nzType="info"
        nzShowIcon
        [nzMessage]="noteKey(code) | translate"
      ></nz-alert>
    }

    @if (result().thresholds.length > 0) {
      <h4 class="title">{{ 'withholdingRecipients.result.thresholds' | translate }}</h4>
      <app-wr-threshold-bars
        [thresholds]="result().thresholds"
        [currency]="result().currency"
      ></app-wr-threshold-bars>
    }
  `,
  styles: `
    .figures {
      width: 100%;
      border-collapse: collapse;
    }

    .figures th,
    .figures td {
      padding: 6px 4px;
      border-bottom: 1px solid var(--ant-border-color-split, #f0f0f0);
      text-align: left;
      font-weight: normal;
      vertical-align: top;
    }

    .figures td {
      text-align: right;
      white-space: nowrap;
    }

    .sub th {
      padding-left: 20px;
      font-size: 12px;
    }

    .total th,
    .total td {
      font-weight: 600;
      font-size: 15px;
    }

    .neg {
      color: var(--ant-error-color, #cf1322);
    }

    .muted {
      display: block;
      font-size: 11px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .message {
      margin-top: 8px;
    }

    .title {
      margin: 16px 0 8px;
    }
  `,
})
export class SimulationResultComponent {
  readonly result = input.required<WrSimulation>();

  readonly nonZero = isNonZero;
  readonly rate = formatRate;
  readonly warningKey = warningKey;
  readonly noteKey = noteKey;

  /** The flat-rate deduction as a share of the gross (25, 40 or 50 percent), null when there is none. */
  readonly flatRatePercent = computed<string | null>(() => {
    const result = this.result();
    const gross = toNumber(result.gross_amount);
    const deduction = toNumber(result.flat_rate_deduction);
    if (gross === null || gross <= 0 || deduction === null || deduction === 0) {
      return null;
    }
    return String(Math.round((deduction / gross) * 1000) / 10);
  });
}
