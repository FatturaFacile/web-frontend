import { DecimalPipe } from '@angular/common';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ChartOfAccount,
  ProcurementApiService,
  REBATE_EXECUTION_MODES,
  RebateAgreement,
  RebateExecutionMode,
  RebateProposalAction,
  RebateProposalRequest,
  RebateProposalTransitionRequest,
  RebateSettlementProposal,
  RebatesApiService,
  SupplierInvoice,
  TranslateService,
} from '@core';
import { TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, decimalOrNull, invoiceOpenBalance, PROPOSAL_STATUS_COLORS, proposalAllowedActions, todayIso } from './rebates.util';

/** Settlement proposals of a supplier agreement: the analytical breakdown and the propose, submit, approve, execute, cancel workflow. */
@Component({
  selector: 'app-rebates-settlement-proposals',
  styleUrl: './rebates.scss',
  imports: [DecimalPipe, FormsModule, TranslatePipe, NzButtonModule, NzCardModule, NzDrawerModule, NzEmptyModule, NzInputModule, NzModalModule, NzPopconfirmModule, NzSelectModule, NzTableModule, NzTagModule],
  template: `
    <nz-card class="main-card" [nzTitle]="'SUPPLIER_REBATES.PROPOSALS' | translate">
      @if (agreement().status === 'active' || agreement().status === 'closed') {
        <div class="toolbar">
          <button nz-button nzType="primary" type="button" (click)="openPropose()">{{ 'SUPPLIER_REBATES.PROPOSE' | translate }}</button>
        </div>
      }

      <nz-table #proposalTable [nzData]="proposals()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'SUPPLIER_REBATES.EXECUTION_MODE' | translate }}</th>
            <th class="num">{{ 'SUPPLIER_REBATES.NET' | translate }}</th>
            <th class="num">{{ 'SUPPLIER_REBATES.TAX' | translate }}</th>
            <th class="num">{{ 'SUPPLIER_REBATES.GROSS' | translate }}</th>
            <th>{{ 'REBATES.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of proposalTable.data; track row.id) {
            <tr>
              <td>{{ ('SUPPLIER_REBATES.EXEC_' + row.execution_mode.toUpperCase()) | translate }}</td>
              <td class="num">{{ row.amount | number: '1.2-2' }} {{ row.currency }}</td>
              <td class="num">{{ row.tax_amount | number: '1.2-2' }}</td>
              <td class="num">{{ row.gross_amount | number: '1.2-2' }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{ ('SUPPLIER_REBATES.SETTLEMENT_' + row.status.toUpperCase()) | translate }}</nz-tag>
              </td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" type="button" (click)="breakdown.set(row)">{{ 'SUPPLIER_REBATES.BREAKDOWN' | translate }}</button>
                  @for (action of actionsOf(row); track action) {
                    @switch (action) {
                      @case ('execute') {
                        <button nz-button nzType="text" type="button" (click)="openExecute(row)">{{ 'SUPPLIER_REBATES.EXECUTE' | translate }}</button>
                      }
                      @case ('cancel') {
                        <button nz-button nzType="text" nzDanger type="button" nz-popconfirm [nzPopconfirmTitle]="'SUPPLIER_REBATES.CONFIRM_CANCEL' | translate" (nzOnConfirm)="transition(row, 'cancel')">{{ 'SUPPLIER_REBATES.CANCEL' | translate }}</button>
                      }
                      @default {
                        <button nz-button nzType="text" type="button" (click)="transition(row, action)">{{ ('SUPPLIER_REBATES.' + action.toUpperCase()) | translate }}</button>
                      }
                    }
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (proposals().length === 0) {
        <nz-empty [nzNotFoundContent]="'SUPPLIER_REBATES.EMPTY' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [nzVisible]="proposeVisible()" [nzTitle]="'SUPPLIER_REBATES.PROPOSE' | translate" [nzOkText]="'SUPPLIER_REBATES.PROPOSE' | translate" [nzCancelText]="'SUPPLIER_REBATES.CANCEL' | translate" [nzOkDisabled]="!canPropose()" (nzOnCancel)="proposeVisible.set(false)" (nzOnOk)="propose()">
      <ng-container *nzModalContent>
        <label for="sp-mode">{{ 'SUPPLIER_REBATES.EXECUTION_MODE' | translate }}</label>
        <nz-select id="sp-mode" style="width: 100%" [ngModel]="mode()" (ngModelChange)="mode.set($event)">
          @for (item of modes; track item) {
            <nz-option [nzValue]="item" [nzLabel]="('SUPPLIER_REBATES.EXEC_' + item.toUpperCase()) | translate"></nz-option>
          }
        </nz-select>

        @if (mode() === 'ap_set_off') {
          <label for="sp-invoice">{{ 'SUPPLIER_REBATES.SELECT_INVOICE' | translate }}</label>
          <nz-select id="sp-invoice" style="width: 100%" nzShowSearch [ngModel]="invoiceId()" (ngModelChange)="invoiceId.set($event)">
            @for (invoice of openInvoices(); track invoice.id) {
              <nz-option [nzValue]="invoice.id" [nzLabel]="invoiceLabel(invoice)"></nz-option>
            }
          </nz-select>
        } @else {
          <label for="sp-tax">{{ 'SUPPLIER_REBATES.TAX_RATE' | translate }}</label>
          <input nz-input id="sp-tax" type="number" min="0" max="100" step="any" [ngModel]="taxRate()" (ngModelChange)="taxRate.set($event)" />
        }

        <label for="sp-notes">{{ 'SUPPLIER_REBATES.NOTES' | translate }}</label>
        <textarea nz-input id="sp-notes" rows="2" maxlength="2000" [ngModel]="notes()" (ngModelChange)="notes.set($event)"></textarea>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="executeTarget() !== null" [nzTitle]="'SUPPLIER_REBATES.EXECUTE' | translate" [nzOkText]="'SUPPLIER_REBATES.EXECUTE' | translate" [nzCancelText]="'SUPPLIER_REBATES.CANCEL' | translate" (nzOnCancel)="executeTarget.set(null)" (nzOnOk)="execute()">
      <ng-container *nzModalContent>
        <p>{{ 'SUPPLIER_REBATES.CONFIRM_EXECUTE' | translate }}</p>
        <label for="sp-executed">{{ 'SUPPLIER_REBATES.AS_OF' | translate }}</label>
        <input nz-input id="sp-executed" type="date" [ngModel]="executedOn()" (ngModelChange)="executedOn.set($event)" />
        @if (executeTarget()?.execution_mode === 'ap_set_off') {
          <label for="sp-payables">{{ 'SUPPLIER_REBATES.PAYABLES_ACCOUNT' | translate }}</label>
          <nz-select id="sp-payables" style="width: 100%" nzAllowClear nzShowSearch [ngModel]="payablesAccountId()" (ngModelChange)="payablesAccountId.set($event)">
            @for (account of accounts(); track account.id) {
              <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' - ' + account.name"></nz-option>
            }
          </nz-select>
          <label for="sp-vat">{{ 'SUPPLIER_REBATES.VAT_ACCOUNT' | translate }}</label>
          <nz-select id="sp-vat" style="width: 100%" nzAllowClear nzShowSearch [ngModel]="vatAccountId()" (ngModelChange)="vatAccountId.set($event)">
            @for (account of accounts(); track account.id) {
              <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' - ' + account.name"></nz-option>
            }
          </nz-select>
        }
      </ng-container>
    </nz-modal>

    <nz-drawer [nzVisible]="breakdown() !== null" nzPlacement="right" [nzWidth]="620" [nzTitle]="'SUPPLIER_REBATES.BREAKDOWN' | translate" (nzOnClose)="breakdown.set(null)">
      <ng-container *nzDrawerContent>
        @if (breakdown(); as proposal) {
          <nz-table [nzData]="proposal.lines ?? []" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'SUPPLIER_REBATES.INVOICE' | translate }}</th>
                <th>{{ 'SUPPLIER_REBATES.KIND' | translate }}</th>
                <th class="num">{{ 'SUPPLIER_REBATES.NET_AMOUNT' | translate }}</th>
                <th class="num">{{ 'SUPPLIER_REBATES.REBATE_SHARE' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (line of proposal.lines ?? []; track $index) {
                <tr>
                  <td>{{ line.reference }} <span class="muted">{{ line.reference_date }}</span></td>
                  <td>{{ ('SUPPLIER_REBATES.LINE_' + line.line_type.toUpperCase()) | translate }}</td>
                  <td class="num">{{ line.net_amount | number: '1.2-2' }}</td>
                  <td class="num">{{ line.rebate_amount | number: '1.2-2' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          <p class="num">
            {{ 'SUPPLIER_REBATES.NET' | translate }} {{ proposal.amount | number: '1.2-2' }} + {{ 'SUPPLIER_REBATES.TAX' | translate }} {{ proposal.tax_amount | number: '1.2-2' }} =
            {{ 'SUPPLIER_REBATES.GROSS' | translate }} {{ proposal.gross_amount | number: '1.2-2' }} {{ proposal.currency }}
          </p>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class RebatesSettlementProposalsComponent implements OnInit {
  private readonly api = inject(RebatesApiService);
  private readonly procurement = inject(ProcurementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly agreement = input.required<RebateAgreement>();
  readonly accounts = input<ChartOfAccount[]>([]);
  /** Emitted after a proposal changed state so the cockpit refreshes the accruals and the progress. */
  readonly changed = output<void>();

  readonly modes = REBATE_EXECUTION_MODES;
  readonly proposals = signal<RebateSettlementProposal[]>([]);
  readonly breakdown = signal<RebateSettlementProposal | null>(null);

  readonly proposeVisible = signal(false);
  readonly mode = signal<RebateExecutionMode>('credit_note_request');
  readonly taxRate = signal<number | null>(null);
  readonly invoiceId = signal<string | null>(null);
  readonly notes = signal('');
  readonly openInvoices = signal<SupplierInvoice[]>([]);

  readonly executeTarget = signal<RebateSettlementProposal | null>(null);
  readonly executedOn = signal(todayIso());
  readonly payablesAccountId = signal<string | null>(null);
  readonly vatAccountId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getSettlementProposals({ agreement_id: this.agreement().id, per_page: 100 }).subscribe({
      next: (response) => this.proposals.set(response.data),
      error: (error: unknown) => this.fail(error),
    });
  }

  statusColor(status: RebateSettlementProposal['status']): string {
    return PROPOSAL_STATUS_COLORS[status] ?? 'default';
  }

  actionsOf(proposal: RebateSettlementProposal): RebateProposalAction[] {
    return proposalAllowedActions(proposal.status);
  }

  invoiceLabel(invoice: SupplierInvoice): string {
    return `${invoice.invoice_number} - ${this.translate.instant('SUPPLIER_REBATES.OPEN_BALANCE')}: ${invoiceOpenBalance(invoice).toFixed(2)} ${invoice.currency}`;
  }

  /** An AP set-off needs the supplier invoice to offset. */
  canPropose(): boolean {
    return this.mode() !== 'ap_set_off' || this.invoiceId() !== null;
  }

  openPropose(): void {
    this.mode.set('credit_note_request');
    this.taxRate.set(null);
    this.invoiceId.set(null);
    this.notes.set('');
    this.proposeVisible.set(true);
    this.procurement.getSupplierInvoices({ supplier_id: this.agreement().contact_id, per_page: 100 }).subscribe({
      next: (response) => this.openInvoices.set(response.data.filter((invoice) => invoiceOpenBalance(invoice) > 0)),
      error: () => this.openInvoices.set([]),
    });
  }

  propose(): void {
    if (!this.canPropose()) {
      return;
    }

    const setOff = this.mode() === 'ap_set_off';
    const payload: RebateProposalRequest = {
      execution_mode: this.mode(),
      tax_rate: setOff ? null : decimalOrNull(this.taxRate()),
      passive_invoice_id: setOff ? this.invoiceId() : null,
      notes: blankToNull(this.notes()),
    };

    this.api.createSettlementProposal(this.agreement().id, payload).subscribe({
      next: () => {
        this.proposeVisible.set(false);
        this.message.success(this.translate.instant('SUPPLIER_REBATES.PROPOSE'));
        this.load();
        this.changed.emit();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  openExecute(proposal: RebateSettlementProposal): void {
    this.executedOn.set(todayIso());
    this.payablesAccountId.set(null);
    this.vatAccountId.set(null);
    this.executeTarget.set(proposal);
  }

  execute(): void {
    const target = this.executeTarget();
    if (!target) {
      return;
    }

    const setOff = target.execution_mode === 'ap_set_off';
    this.transition(target, 'execute', {
      executed_on: blankToNull(this.executedOn()),
      payables_account_id: setOff ? this.payablesAccountId() : null,
      vat_account_id: setOff ? this.vatAccountId() : null,
    });
  }

  /** Runs a workflow step with the version of the proposal so a concurrent change is refused instead of overwritten. */
  transition(proposal: RebateSettlementProposal, action: RebateProposalAction, extra: RebateProposalTransitionRequest = {}): void {
    this.api.transitionSettlementProposal(proposal.id, action, { version: proposal.version, ...extra }).subscribe({
      next: () => {
        this.executeTarget.set(null);
        if (action === 'execute') {
          this.message.success(this.translate.instant('SUPPLIER_REBATES.EXECUTED'));
        }
        this.load();
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.fail(error);
        this.load();
      },
    });
  }

  private fail(error: unknown): void {
    this.message.error(apiErrorText(error) ?? this.translate.instant('SUPPLIER_REBATES.SAVE_ERROR'));
  }
}
