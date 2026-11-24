import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PermissionsService, TranslateService } from '@core';
import { downloadBlob, MoneyPipe, TranslatePipe } from '@shared';
import {
  AGENT_COMMISSIONS_SETTLE_MODULE,
  AgcOutcome,
  canApproveStatement,
  canPayStatement,
  canPrepareSelfBilling,
  canSendStatement,
  canVoidStatement,
  formatRate,
  statementStatusColor,
  summaryOfStatement,
  todayParam,
} from './agent-commissions.util';
import { StatementSummaryComponent } from './statement-summary.component';
import { StatementsStore } from './statements.store';

export type StatementDialog = 'pay' | 'send' | 'selfBilling';

/**
 * One commission statement: data, the breakdown, the lines (invoices and collections), the prepared invoice and the
 * workflow actions (approve, prepare the invoice, pay, send, void, PDF), each enabled by the status and the role.
 */
@Component({
  selector: 'app-statement-detail-drawer',
  imports: [
    FormsModule,
    MoneyPipe,
    StatementSummaryComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      [nzWidth]="880"
      [nzTitle]="store.detail()?.number ?? ('agentCommissions.action.details' | translate)"
      (nzOnClose)="store.closeDetail()"
    >
      <ng-container *nzDrawerContent>
        @if (actionError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure | translate"
          ></nz-alert>
        }

        <nz-spin [nzSpinning]="store.loadingDetail() || store.saving()">
          @if (store.detail(); as statement) {
            <div class="actions" role="toolbar">
              @if (canSettle) {
                @if (canApprove(statement)) {
                  <button
                    nz-button
                    nzType="primary"
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'agentCommissions.statements.confirmApprove' | translate"
                    [nzOkText]="'agentCommissions.action.approve' | translate"
                    [nzCancelText]="'agentCommissions.action.cancel' | translate"
                    (nzOnConfirm)="approve(statement.id)"
                  >
                    {{ 'agentCommissions.action.approve' | translate }}
                  </button>
                }
                @if (canInvoice(statement)) {
                  <button nz-button type="button" (click)="openDialog('selfBilling')">
                    {{ 'agentCommissions.action.selfBilling' | translate }}
                  </button>
                }
                @if (canPay(statement)) {
                  <button nz-button nzType="primary" type="button" (click)="openDialog('pay')">
                    {{ 'agentCommissions.action.pay' | translate }}
                  </button>
                }
                @if (canSend(statement)) {
                  <button nz-button type="button" (click)="openDialog('send')">
                    {{ 'agentCommissions.action.send' | translate }}
                  </button>
                }
              }
              <button nz-button type="button" (click)="downloadPdf()">
                {{ 'agentCommissions.action.downloadPdf' | translate }}
              </button>
              @if (canSettle && canVoid(statement)) {
                <button
                  nz-button
                  nzDanger
                  type="button"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'agentCommissions.statements.confirmVoid' | translate"
                  [nzOkText]="'agentCommissions.action.void' | translate"
                  [nzCancelText]="'agentCommissions.action.cancel' | translate"
                  (nzOnConfirm)="voidStatement(statement.id)"
                >
                  {{ 'agentCommissions.action.void' | translate }}
                </button>
              }
            </div>

            <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.status' | translate">
                <nz-tag [nzColor]="statusColor(statement.status)">{{
                  'agentCommissions.statementStatus.' + statement.status | translate
                }}</nz-tag>
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.agent' | translate">
                {{ statement.agent_name }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.statements.period' | translate">
                {{ statement.period_start }} – {{ statement.period_end }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.periodType' | translate">
                {{ 'agentCommissions.periodType.' + statement.period_type | translate }}
              </nz-descriptions-item>
              @if (statement.settlement_channel) {
                <nz-descriptions-item
                  [nzTitle]="'agentCommissions.field.settlementChannel' | translate"
                >
                  {{
                    'agentCommissions.settlementChannel.' + statement.settlement_channel | translate
                  }}
                </nz-descriptions-item>
              }
              @if (statement.approved_at) {
                <nz-descriptions-item
                  [nzTitle]="'agentCommissions.statements.approvedAt' | translate"
                >
                  {{ statement.approved_at }}
                </nz-descriptions-item>
              }
              @if (statement.paid_at) {
                <nz-descriptions-item [nzTitle]="'agentCommissions.statements.paidAt' | translate">
                  {{ statement.paid_at }}
                </nz-descriptions-item>
              }
              @if (statement.payment_reference) {
                <nz-descriptions-item [nzTitle]="'agentCommissions.field.reference' | translate">
                  {{ statement.payment_reference }}
                </nz-descriptions-item>
              }
              @if (statement.sent_at) {
                <nz-descriptions-item [nzTitle]="'agentCommissions.statements.sentAt' | translate">
                  {{ statement.sent_at }}
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'agentCommissions.statements.sentTo' | translate">
                  {{ statement.sent_to }} ({{ statement.sent_count }})
                </nz-descriptions-item>
              }
            </nz-descriptions>

            <div class="block">
              <app-statement-summary [summary]="summary()"></app-statement-summary>
            </div>

            @if (statement.self_billing_payload; as billing) {
              <nz-descriptions
                class="block"
                nzBordered
                nzSize="small"
                [nzColumn]="2"
                [nzTitle]="'agentCommissions.statements.selfBillingTitle' | translate"
              >
                <nz-descriptions-item
                  [nzTitle]="'agentCommissions.statements.selfBillingNumber' | translate"
                >
                  {{ billing.number }}
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'agentCommissions.field.billingDate' | translate">
                  {{ billing.date }}
                </nz-descriptions-item>
                <nz-descriptions-item
                  [nzTitle]="'agentCommissions.statements.taxableAmount' | translate"
                >
                  {{ billing.taxable_amount | money: billing.currency }}
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'agentCommissions.statements.vat' | translate">
                  {{ billing.vat_amount | money: billing.currency }}
                  @if (billing.vat_rate) {
                    ({{ rate(billing.vat_rate) }})
                  }
                </nz-descriptions-item>
                <nz-descriptions-item
                  [nzTitle]="'agentCommissions.statements.documentTotal' | translate"
                >
                  <strong>{{ billing.document_total | money: billing.currency }}</strong>
                </nz-descriptions-item>
                <nz-descriptions-item
                  [nzTitle]="'agentCommissions.statements.enasarcoAgent' | translate"
                >
                  {{ billing.enasarco_agent | money: billing.currency }}
                </nz-descriptions-item>
                <nz-descriptions-item
                  [nzTitle]="'agentCommissions.statements.withholding' | translate"
                >
                  {{ billing.withholding_amount | money: billing.currency }}
                  @if (billing.withholding_rate) {
                    ({{ rate(billing.withholding_rate) }})
                  }
                </nz-descriptions-item>
                <nz-descriptions-item
                  [nzTitle]="'agentCommissions.statements.netPayable' | translate"
                >
                  <strong>{{ billing.net_payable | money: billing.currency }}</strong>
                </nz-descriptions-item>
              </nz-descriptions>
            }

            <h4 class="block">{{ 'agentCommissions.statements.lines' | translate }}</h4>
            <nz-table
              nzSize="small"
              [nzData]="statement.lines ?? []"
              [nzShowPagination]="false"
              [nzFrontPagination]="false"
            >
              <thead>
                <tr>
                  <th scope="col">{{ 'agentCommissions.field.invoice' | translate }}</th>
                  <th scope="col">{{ 'agentCommissions.field.invoiceDate' | translate }}</th>
                  <th scope="col">{{ 'agentCommissions.field.customer' | translate }}</th>
                  <th scope="col">{{ 'agentCommissions.field.role' | translate }}</th>
                  <th scope="col">{{ 'agentCommissions.field.accrualBasis' | translate }}</th>
                  <th scope="col" class="num">{{ 'agentCommissions.field.base' | translate }}</th>
                  <th scope="col" class="num">{{ 'agentCommissions.field.rate' | translate }}</th>
                  <th scope="col" class="num">
                    {{ 'agentCommissions.field.commission' | translate }}
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (line of statement.lines ?? []; track line.id) {
                  <tr>
                    <th scope="row">{{ line.invoice_number }}</th>
                    <td>{{ line.invoice_date }}</td>
                    <td>{{ line.customer_name }}</td>
                    <td>{{ 'agentCommissions.role.' + line.role | translate }}</td>
                    <td>{{ 'agentCommissions.accrualBasis.' + line.accrual_basis | translate }}</td>
                    <td class="num">{{ line.base_amount | money: statement.currency }}</td>
                    <td class="num">{{ rate(line.rate) }}</td>
                    <td class="num">{{ line.commission_amount | money: statement.currency }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </nz-spin>
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="dialog() !== null"
      [nzTitle]="dialogTitle() | translate"
      [nzOkText]="dialogTitle() | translate"
      [nzCancelText]="'agentCommissions.action.cancel' | translate"
      [nzOkLoading]="store.saving()"
      (nzOnOk)="confirmDialog()"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        @switch (dialog()) {
          @case ('pay') {
            <p>{{ 'agentCommissions.statements.confirmPay' | translate }}</p>
            <p class="hint">{{ 'agentCommissions.statements.payoutBlockedHint' | translate }}</p>
            <div class="editor">
              <label class="field" for="agc-pay-reference">
                <span>{{ 'agentCommissions.field.reference' | translate }}</span>
                <input
                  nz-input
                  id="agc-pay-reference"
                  maxlength="120"
                  [ngModel]="payReference()"
                  (ngModelChange)="payReference.set($event)"
                />
              </label>
              <label class="field" for="agc-pay-date">
                <span>{{ 'agentCommissions.field.paidOn' | translate }}</span>
                <input
                  nz-input
                  id="agc-pay-date"
                  type="date"
                  [ngModel]="paidOn()"
                  (ngModelChange)="paidOn.set($event)"
                />
              </label>
            </div>
          }
          @case ('send') {
            <p>{{ 'agentCommissions.statements.confirmSend' | translate }}</p>
            <label class="field" for="agc-send-recipient">
              <span>{{ 'agentCommissions.field.recipient' | translate }}</span>
              <input
                nz-input
                id="agc-send-recipient"
                type="email"
                maxlength="190"
                [ngModel]="recipient()"
                (ngModelChange)="recipient.set($event)"
              />
            </label>
          }
          @case ('selfBilling') {
            <p>{{ 'agentCommissions.statements.confirmSelfBilling' | translate }}</p>
            <label class="field" for="agc-billing-date">
              <span>{{ 'agentCommissions.field.billingDate' | translate }}</span>
              <input
                nz-input
                id="agc-billing-date"
                type="date"
                [ngModel]="billingDate()"
                (ngModelChange)="billingDate.set($event)"
              />
            </label>
          }
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .feedback {
      margin-bottom: 12px;
    }

    .block {
      display: block;
      margin-top: 24px;
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .editor {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .hint {
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }
  `,
})
export class StatementDetailDrawerComponent {
  readonly store = inject(StatementsStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  /** Approve, invoice, pay, send and void are the `settle` ability: owners, administrators and accountants. */
  readonly canSettle = inject(PermissionsService).canWrite(AGENT_COMMISSIONS_SETTLE_MODULE);

  readonly open = computed(() => this.store.detail() !== null || this.store.loadingDetail());
  readonly summary = computed(() => {
    const statement = this.store.detail();
    return statement ? summaryOfStatement(statement) : null;
  });

  readonly dialog = signal<StatementDialog | null>(null);
  readonly payReference = signal('');
  readonly paidOn = signal(todayParam());
  readonly recipient = signal('');
  readonly billingDate = signal(todayParam());
  readonly actionError = signal<string | null>(null);

  readonly canApprove = canApproveStatement;
  readonly canVoid = canVoidStatement;
  readonly canInvoice = canPrepareSelfBilling;
  readonly canPay = canPayStatement;
  readonly canSend = canSendStatement;
  readonly statusColor = statementStatusColor;
  readonly rate = formatRate;

  readonly dialogTitle = computed(() => {
    switch (this.dialog()) {
      case 'pay':
        return 'agentCommissions.action.pay';
      case 'send':
        return 'agentCommissions.action.send';
      default:
        return 'agentCommissions.action.selfBilling';
    }
  });

  openDialog(dialog: StatementDialog): void {
    this.actionError.set(null);
    this.dialog.set(dialog);
  }

  /** Reports the outcome of a workflow action: the success message, or the translated refusal. */
  private report(outcome: AgcOutcome, successKey: string): void {
    if (outcome.ok) {
      this.message.success(this.translate.instant(successKey));
    } else {
      this.actionError.set(outcome.errorKey);
    }
  }

  async approve(id: string): Promise<void> {
    this.actionError.set(null);
    this.report(await this.store.approve(id), 'agentCommissions.message.approved');
  }

  async voidStatement(id: string): Promise<void> {
    this.actionError.set(null);
    this.report(await this.store.void(id), 'agentCommissions.message.voided');
  }

  /** Confirms the open dialog: pay, send or prepare the invoice. The dialog closes on success only. */
  async confirmDialog(): Promise<void> {
    const dialog = this.dialog();
    const id = this.store.detail()?.id;
    if (dialog === null || !id) {
      return;
    }
    this.actionError.set(null);
    let outcome: AgcOutcome;
    let successKey: string;
    if (dialog === 'pay') {
      outcome = await this.store.pay(id, {
        reference: this.payReference().trim() || null,
        paid_on: this.paidOn() || null,
      });
      successKey = 'agentCommissions.message.paid';
    } else if (dialog === 'send') {
      outcome = await this.store.send(id, { recipient: this.recipient().trim() || null });
      successKey = 'agentCommissions.message.sent';
    } else {
      outcome = await this.store.prepareSelfBilling(id, this.billingDate() || null);
      successKey = 'agentCommissions.message.invoiced';
    }
    this.report(outcome, successKey);
    this.dialog.set(null);
  }

  async downloadPdf(): Promise<void> {
    const statement = this.store.detail();
    if (!statement) {
      return;
    }
    this.actionError.set(null);
    const result = await this.store.pdf(statement);
    if (result.ok && result.blob) {
      downloadBlob(result.blob, result.filename);
    } else {
      this.actionError.set(result.errorKey);
    }
  }
}
