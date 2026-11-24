import { Component, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { MoneyPipe, TranslatePipe } from '@shared';
import { isNonZero, StatementSummaryView } from './agent-commissions.util';

/**
 * The breakdown of a commission statement: commissions, VAT, Enasarco (agent and company share), FIRR, withholding and
 * the net payable, with the notice when the yearly Enasarco ceiling was reached. Shared by the preview of the generate
 * dialog and the detail of a saved statement.
 */
@Component({
  selector: 'app-statement-summary',
  imports: [MoneyPipe, TranslatePipe, NzAlertModule, NzDescriptionsModule],
  template: `
    @if (summary(); as view) {
      @if (view.massimale_reached) {
        <nz-alert
          class="notice"
          nzType="info"
          nzShowIcon
          [nzMessage]="'agentCommissions.statements.massimaleReached' | translate"
        ></nz-alert>
      }
      <nz-descriptions
        nzBordered
        nzSize="small"
        [nzColumn]="1"
        [nzTitle]="'agentCommissions.statements.summary' | translate"
      >
        @if (view.lines_count !== null) {
          <nz-descriptions-item [nzTitle]="'agentCommissions.statements.linesCount' | translate">
            {{ view.lines_count }}
          </nz-descriptions-item>
        }
        <nz-descriptions-item [nzTitle]="'agentCommissions.statements.baseTotal' | translate">
          {{ view.base_total | money: view.currency }}
        </nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'agentCommissions.statements.ownCommission' | translate">
          {{ view.own_commission_total | money: view.currency }}
        </nz-descriptions-item>
        @if (nonZero(view.override_commission_total)) {
          <nz-descriptions-item
            [nzTitle]="'agentCommissions.statements.overrideCommission' | translate"
          >
            {{ view.override_commission_total | money: view.currency }}
          </nz-descriptions-item>
        }
        @if (nonZero(view.clawback_total)) {
          <nz-descriptions-item [nzTitle]="'agentCommissions.statements.clawback' | translate">
            {{ view.clawback_total | money: view.currency }}
          </nz-descriptions-item>
        }
        <nz-descriptions-item [nzTitle]="'agentCommissions.statements.gross' | translate">
          <strong>{{ view.gross_commission | money: view.currency }}</strong>
        </nz-descriptions-item>
        @if (nonZero(view.vat_amount)) {
          <nz-descriptions-item [nzTitle]="'agentCommissions.statements.vat' | translate">
            {{ view.vat_amount | money: view.currency }}
          </nz-descriptions-item>
        }
        @if (nonZero(view.enasarco_base) || nonZero(view.enasarco_agent)) {
          <nz-descriptions-item [nzTitle]="'agentCommissions.statements.enasarcoBase' | translate">
            {{ view.enasarco_base | money: view.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'agentCommissions.statements.enasarcoAgent' | translate">
            {{ view.enasarco_agent | money: view.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item
            [nzTitle]="'agentCommissions.statements.enasarcoCompany' | translate"
          >
            {{ view.enasarco_company | money: view.currency }}
          </nz-descriptions-item>
        }
        @if (nonZero(view.firr)) {
          <nz-descriptions-item [nzTitle]="'agentCommissions.statements.firr' | translate">
            {{ view.firr | money: view.currency }}
          </nz-descriptions-item>
        }
        @if (nonZero(view.withholding)) {
          <nz-descriptions-item
            [nzTitle]="'agentCommissions.statements.withholdingBase' | translate"
          >
            {{ view.withholding_base | money: view.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'agentCommissions.statements.withholding' | translate">
            {{ view.withholding | money: view.currency }}
          </nz-descriptions-item>
        }
        <nz-descriptions-item [nzTitle]="'agentCommissions.statements.netPayable' | translate">
          <strong class="net">{{ view.net_payable | money: view.currency }}</strong>
        </nz-descriptions-item>
        @if (nonZero(view.blocked_amount)) {
          <nz-descriptions-item [nzTitle]="'agentCommissions.statements.blocked' | translate">
            <span class="blocked">
              <i class="fa-solid fa-lock" aria-hidden="true"></i>
              {{ view.blocked_amount | money: view.currency }}
            </span>
          </nz-descriptions-item>
        }
      </nz-descriptions>
    }
  `,
  styles: `
    .notice {
      margin-bottom: 12px;
    }

    .net {
      font-size: 16px;
    }

    .blocked {
      color: var(--ant-warning-color, #d48806);
      font-weight: 600;
    }
  `,
})
export class StatementSummaryComponent {
  readonly summary = input<StatementSummaryView | null>(null);

  readonly nonZero = isNonZero;
}
