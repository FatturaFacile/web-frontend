import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DP_PAYMENT_ACCOUNTS,
  DpDeposit,
  DpInstallment,
  DpLink,
  DpMatrixRow,
  DpPaymentAccount,
  DpSourceType,
  PermissionsService,
  TranslateService,
} from '@core';
import { ModalActionsDirective, MoneyPipe, TranslatePipe } from '@shared';
import { AdvanceCreditNoteModalComponent } from './advance-credit-note-modal.component';
import { ChainStore } from './chain.store';
import { DepositResolutionModalComponent } from './deposit-resolution-modal.component';
import {
  buildTimeline,
  canConfirmProforma,
  canCreditNote,
  canEmit,
  canSettle,
  chainStatusColor,
  depositStatusColor,
  DOWN_PAYMENTS_MODULE,
  DpOutcome,
  fromCents,
  installmentStatusColor,
  isChainClosed,
  isoDay,
  jurisdictionColor,
  linkStatusColor,
  progressOf,
  sumCents,
} from './down-payments.util';
import { DownPaymentWizardModalComponent } from './down-payment-wizard-modal.component';
import { DpFeedbackComponent } from './feedback.component';
import { FinalSettlementPreviewDrawerComponent } from './final-settlement-preview-drawer.component';
import { DpJurisdictionNoticeComponent } from './jurisdiction-notice.component';

/** One amount of the matrix row: `group` is contract, requested, invoiced, credited, settled or residual. */
function cell(row: DpMatrixRow, group: string, component: 'net' | 'vat' | 'gross'): string {
  return row[`${group}_${component}` as keyof DpMatrixRow];
}

interface MatrixLine {
  key: string;
  vatRate: string;
  component: 'net' | 'vat' | 'gross';
  first: boolean;
  contract: string;
  requested: string;
  invoiced: string;
  credited: string;
  settled: string;
  residual: string;
}

/**
 * The down-payment chain of an order, quote or contract: KPIs and progress bar, the chronological timeline of its documents, the
 * installments with their emission, the linked documents with their actions, the deposits, and the multi-VAT analytical matrix.
 * It is the detail page of a chain (`chainId`) and also the widget of the sales order and quote pages (`sourceType` + `sourceId`),
 * where it offers to open the chain when the source has none.
 */
@Component({
  selector: 'app-down-payment-chain',
  imports: [
    DatePipe,
    FormsModule,
    ModalActionsDirective,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzRadioModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    RouterLink,
    AdvanceCreditNoteModalComponent,
    DepositResolutionModalComponent,
    DownPaymentWizardModalComponent,
    DpFeedbackComponent,
    DpJurisdictionNoticeComponent,
    FinalSettlementPreviewDrawerComponent,
    TranslatePipe,
  ],
  providers: [ChainStore],
  styleUrl: './down-payments.scss',
  template: `
    @if (canRead) {
      <app-dp-feedback [outcome]="feedback()" (dismissed)="feedback.set(null)" />

      @if (store.error(); as error) {
        <nz-alert
          class="feedback"
          nzType="error"
          nzShowIcon
          [nzMessage]="error | translate"
        ></nz-alert>
      }

      <nz-spin [nzSpinning]="store.loading()">
        @if (store.chain(); as chain) {
          <div class="chain-header" data-test="header">
            <strong>{{ chain.chain_number }}</strong>
            <nz-tag [nzColor]="chainStatusColor(chain.status)" data-test="chain-status">{{
              'down_payments.status.' + chain.status | translate
            }}</nz-tag>
            <nz-tag [nzColor]="jurisdictionColor(chain.jurisdiction)">{{
              'down_payments.jurisdiction.' + chain.jurisdiction | translate
            }}</nz-tag>
            <span>{{ chain.customer_name }}</span>
            <span class="muted">
              {{ 'down_payments.sourceType.' + chain.source_type | translate }}
              @if (chain.source_type === 'sales_order') {
                <a
                  [routerLink]="[
                    '/sales/workspace/orders',
                    chain.sales_order_id ?? chain.source_id,
                  ]"
                  >{{ chain.source_number }}</a
                >
              } @else {
                {{ chain.source_number }}
              }
            </span>
            <span class="spacer"></span>
            <button nz-button type="button" data-test="refresh" (click)="reload()">
              {{ 'down_payments.action.refresh' | translate }}
            </button>
            @if (canWrite && canSettle(chain)) {
              <button
                nz-button
                nzType="primary"
                type="button"
                data-test="open-settlement"
                (click)="settlementOpen.set(true)"
              >
                {{ 'down_payments.action.finalSettlement' | translate }}
              </button>
            }
            @if (canWrite && cancellable()) {
              <button
                nz-button
                nzDanger
                type="button"
                data-test="cancel-chain"
                nz-popconfirm
                [nzPopconfirmTitle]="'down_payments.confirm.cancelChain' | translate"
                (nzOnConfirm)="cancelChain()"
              >
                {{ 'down_payments.action.cancelChain' | translate }}
              </button>
            }
          </div>

          <app-dp-jurisdiction-notice [jurisdiction]="chain.jurisdiction" />

          <div class="kpi-grid" data-test="kpis">
            <div class="kpi">
              <div class="kpi-label">{{ 'down_payments.kpi.contract' | translate }}</div>
              <div class="kpi-value" data-test="kpi-contract">
                {{ chain.total_contract_gross | money: chain.currency }}
              </div>
            </div>
            <div class="kpi">
              <div class="kpi-label">{{ 'down_payments.kpi.deposits' | translate }}</div>
              <div class="kpi-value" data-test="kpi-deposits">
                {{ depositsHeld() | money: chain.currency }}
              </div>
            </div>
            <div class="kpi">
              <div class="kpi-label">{{ 'down_payments.kpi.advances' | translate }}</div>
              <div class="kpi-value" data-test="kpi-advances">
                {{ chain.total_advance_invoiced_gross | money: chain.currency }}
              </div>
            </div>
            <div class="kpi" [class.warn]="creditedPositive()">
              <div class="kpi-label">{{ 'down_payments.kpi.credited' | translate }}</div>
              <div class="kpi-value">
                {{ chain.total_credited_advances_gross | money: chain.currency }}
              </div>
            </div>
            <div class="kpi">
              <div class="kpi-label">{{ 'down_payments.kpi.residual' | translate }}</div>
              <div class="kpi-value" data-test="kpi-residual">
                {{ chain.residual_order_gross | money: chain.currency }}
              </div>
            </div>
          </div>

          <div
            class="progress-bar"
            role="img"
            data-test="progress"
            [attr.aria-label]="'down_payments.section.progress' | translate"
          >
            <div class="segment deposits" [style.width.%]="progress().depositsPercent"></div>
            <div class="segment advances" [style.width.%]="progress().advancesPercent"></div>
            <div class="segment residual" [style.width.%]="progress().residualPercent"></div>
          </div>
          <div class="progress-legend">
            <span
              ><span class="dot deposits"></span>{{ 'down_payments.legend.deposits' | translate }}
              {{ depositsHeld() | money: chain.currency }}</span
            >
            <span
              ><span class="dot advances"></span>{{ 'down_payments.legend.advances' | translate }}
              {{ netAdvances() | money: chain.currency }}</span
            >
            <span
              ><span class="dot residual"></span>{{ 'down_payments.legend.residual' | translate }}
              {{ chain.residual_order_gross | money: chain.currency }}</span
            >
          </div>

          <h4 class="section-title">{{ 'down_payments.section.timeline' | translate }}</h4>
          <div class="timeline-scroll">
            <ol class="timeline" data-test="timeline">
              @for (item of timeline(); track item.key) {
                <li [attr.data-test]="'timeline-' + item.kind">
                  <div class="step">{{ item.labelKey | translate }}</div>
                  <div>{{ item.number ?? '-' }}</div>
                  <div class="muted">{{ item.date | date: 'mediumDate' }}</div>
                  @if (item.statusKey; as statusKey) {
                    <nz-tag [nzColor]="item.statusColor">{{ statusKey | translate }}</nz-tag>
                  }
                  @if (item.gross) {
                    <div class="num">{{ item.gross | money: chain.currency }}</div>
                  }
                </li>
              }
            </ol>
          </div>

          <h4 class="section-title">{{ 'down_payments.section.installments' | translate }}</h4>
          <nz-table
            nzSize="small"
            [nzData]="chain.installments"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '960px' }"
            data-test="installments"
          >
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{{ 'down_payments.field.milestone' | translate }}</th>
                <th scope="col">{{ 'down_payments.field.instrument' | translate }}</th>
                <th scope="col">{{ 'down_payments.field.dueDate' | translate }}</th>
                <th scope="col" class="num">{{ 'down_payments.field.net' | translate }}</th>
                <th scope="col" class="num">{{ 'down_payments.field.vat' | translate }}</th>
                <th scope="col" class="num">{{ 'down_payments.field.gross' | translate }}</th>
                <th scope="col">{{ 'down_payments.field.status' | translate }}</th>
                <th scope="col">{{ 'down_payments.field.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of chain.installments; track row.id) {
                <tr [attr.data-test]="'installment-' + row.sequence">
                  <td>{{ row.sequence }}</td>
                  <td>
                    {{ row.milestone_label }}
                    <small class="muted">{{
                      'down_payments.trigger.' + row.trigger_type | translate
                    }}</small>
                  </td>
                  <td>{{ 'down_payments.instrument.' + row.instrument_type | translate }}</td>
                  <td>{{ row.due_date | date: 'mediumDate' }}</td>
                  <td class="num">{{ row.amount_net | money: chain.currency }}</td>
                  <td class="num">{{ row.amount_vat | money: chain.currency }}</td>
                  <td class="num">{{ row.amount_gross | money: chain.currency }}</td>
                  <td>
                    <nz-tag [nzColor]="installmentStatusColor(row.status)">{{
                      'down_payments.installmentStatus.' + row.status | translate
                    }}</nz-tag>
                  </td>
                  <td class="row-actions">
                    @if (canWrite && canEmitRow(row)) {
                      <button
                        nz-button
                        nzSize="small"
                        nzType="primary"
                        type="button"
                        data-test="emit"
                        nz-popconfirm
                        [nzPopconfirmTitle]="'down_payments.confirm.emit' | translate"
                        (nzOnConfirm)="emit(row)"
                      >
                        {{ 'down_payments.action.emit' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          <h4 class="section-title">{{ 'down_payments.section.links' | translate }}</h4>
          <nz-table
            nzSize="small"
            [nzData]="chain.links"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '900px' }"
            data-test="links"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'down_payments.field.document' | translate }}</th>
                <th scope="col">{{ 'down_payments.field.date' | translate }}</th>
                <th scope="col" class="num">{{ 'down_payments.field.gross' | translate }}</th>
                <th scope="col" class="num">{{ 'down_payments.field.credited' | translate }}</th>
                <th scope="col" class="num">{{ 'down_payments.field.settled' | translate }}</th>
                <th scope="col">{{ 'down_payments.field.status' | translate }}</th>
                <th scope="col">{{ 'down_payments.field.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (link of chain.links; track link.id) {
                <tr [attr.data-test]="'link-' + link.id">
                  <td>
                    {{ link.document_number ?? '-' }}
                    <small class="muted">{{
                      'down_payments.linkType.' + link.link_type | translate
                    }}</small>
                  </td>
                  <td>{{ link.document_date | date: 'mediumDate' }}</td>
                  <td class="num">{{ link.gross_amount | money: chain.currency }}</td>
                  <td class="num">{{ link.credited_gross_amount | money: chain.currency }}</td>
                  <td class="num">{{ link.settled_gross_amount | money: chain.currency }}</td>
                  <td>
                    <nz-tag [nzColor]="linkStatusColor(link.status)">{{
                      'down_payments.linkStatus.' + link.status | translate
                    }}</nz-tag>
                  </td>
                  <td class="row-actions">
                    @if (canWrite && canConfirmRow(link)) {
                      <button
                        nz-button
                        nzSize="small"
                        nzType="primary"
                        type="button"
                        data-test="confirm-proforma"
                        (click)="openProforma(link)"
                      >
                        {{ 'down_payments.action.confirmPayment' | translate }}
                      </button>
                    }
                    @if (canWrite && canCreditRow(link)) {
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        data-test="credit-note"
                        (click)="creditLinkId.set(link.id)"
                      >
                        {{ 'down_payments.action.creditNote' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (chain.links.length === 0) {
            <nz-empty [nzNotFoundContent]="'down_payments.empty.links' | translate"></nz-empty>
          }

          <h4 class="section-title">{{ 'down_payments.section.deposits' | translate }}</h4>
          <nz-table
            nzSize="small"
            [nzData]="chain.deposits"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '860px' }"
            data-test="deposits"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'down_payments.field.receiptNumber' | translate }}</th>
                <th scope="col">{{ 'down_payments.field.type' | translate }}</th>
                <th scope="col">{{ 'down_payments.field.vatExemption' | translate }}</th>
                <th scope="col" class="num">{{ 'down_payments.field.amount' | translate }}</th>
                <th scope="col">{{ 'down_payments.field.status' | translate }}</th>
                <th scope="col">{{ 'down_payments.field.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (deposit of chain.deposits; track deposit.id) {
                <tr [attr.data-test]="'deposit-' + deposit.id">
                  <td>{{ deposit.receipt_number ?? '-' }}</td>
                  <td>{{ 'down_payments.depositType.' + deposit.deposit_type | translate }}</td>
                  <td>{{ deposit.vat_exemption_code ?? '-' }}</td>
                  <td class="num">{{ deposit.amount | money: deposit.currency }}</td>
                  <td>
                    <nz-tag [nzColor]="depositStatusColor(deposit.status)">{{
                      'down_payments.depositStatus.' + deposit.status | translate
                    }}</nz-tag>
                  </td>
                  <td class="row-actions">
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      data-test="open-deposit"
                      (click)="depositId.set(deposit.id)"
                    >
                      {{
                        (canWrite &&
                        (deposit.status === 'issued_unpaid' || deposit.status === 'held_active')
                          ? 'down_payments.action.manageDeposit'
                          : 'down_payments.action.viewReceipt'
                        ) | translate
                      }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (chain.deposits.length === 0) {
            <nz-empty [nzNotFoundContent]="'down_payments.empty.deposits' | translate"></nz-empty>
          }

          <h4 class="section-title">{{ 'down_payments.section.matrix' | translate }}</h4>
          <div class="matrix-scroll">
            <nz-table
              nzSize="small"
              [nzData]="matrix()"
              [nzShowPagination]="false"
              data-test="matrix"
            >
              <thead>
                <tr>
                  <th scope="col">{{ 'down_payments.field.vatRate' | translate }}</th>
                  <th scope="col"></th>
                  <th scope="col" class="num">{{ 'down_payments.matrix.contract' | translate }}</th>
                  <th scope="col" class="num">
                    {{ 'down_payments.matrix.requested' | translate }}
                  </th>
                  <th scope="col" class="num">{{ 'down_payments.matrix.invoiced' | translate }}</th>
                  <th scope="col" class="num">{{ 'down_payments.matrix.credited' | translate }}</th>
                  <th scope="col" class="num">{{ 'down_payments.matrix.settled' | translate }}</th>
                  <th scope="col" class="num">{{ 'down_payments.matrix.residual' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of matrix(); track line.key) {
                  <tr [attr.data-test]="'matrix-' + line.key">
                    <th scope="row">{{ line.first ? line.vatRate + '%' : '' }}</th>
                    <td>{{ 'down_payments.matrix.' + line.component | translate }}</td>
                    <td class="num">{{ line.contract | money: chain.currency }}</td>
                    <td class="num">{{ line.requested | money: chain.currency }}</td>
                    <td class="num">{{ line.invoiced | money: chain.currency }}</td>
                    <td class="num">{{ line.credited | money: chain.currency }}</td>
                    <td class="num">{{ line.settled | money: chain.currency }}</td>
                    <td class="num">{{ line.residual | money: chain.currency }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </div>
          @if (chain.vat_matrix.length === 0) {
            <nz-empty [nzNotFoundContent]="'down_payments.empty.matrix' | translate"></nz-empty>
          }
        } @else if (store.missing()) {
          <nz-empty
            data-test="no-chain"
            [nzNotFoundContent]="'down_payments.empty.noChain' | translate"
          >
          </nz-empty>
          @if (canWrite && sourceType() && sourceId()) {
            <p class="actions-bar">
              <button
                nz-button
                nzType="primary"
                type="button"
                data-test="open-wizard"
                (click)="wizardOpen.set(true)"
              >
                {{ 'down_payments.action.openChain' | translate }}
              </button>
            </p>
          }
        }
      </nz-spin>

      @if (sourceType(); as type) {
        @if (sourceId(); as id) {
          <app-dp-wizard-modal
            [visible]="wizardOpen()"
            [sourceType]="type"
            [sourceId]="id"
            [sourceLabel]="sourceLabel()"
            (closed)="wizardOpen.set(false)"
          />
        }
      }

      @if (selectedDeposit(); as deposit) {
        <app-dp-deposit-modal [deposit]="deposit" [visible]="true" (closed)="depositId.set(null)" />
      }

      @if (selectedLink(); as link) {
        <app-dp-credit-note-modal
          [link]="link"
          [visible]="true"
          (closed)="creditLinkId.set(null)"
        />
      }

      <app-dp-settlement-drawer [visible]="settlementOpen()" (closed)="settlementOpen.set(false)" />

      <nz-modal
        appModalActions
        [nzVisible]="proformaLink() !== null"
        [nzWidth]="520"
        [nzTitle]="'down_payments.modal.confirmProforma' | translate"
        [nzFooter]="null"
        (nzOnCancel)="proformaLink.set(null)"
      >
        <ng-container *nzModalContent>
          <p class="muted">{{ 'down_payments.hint.confirmProforma' | translate }}</p>
          <div class="form-grid">
            <label class="field" for="dp-p-paid">
              <span>{{ 'down_payments.field.paidAt' | translate }}</span>
              <nz-date-picker
                nzId="dp-p-paid"
                [ngModel]="paidAt()"
                (ngModelChange)="paidAt.set($event)"
              ></nz-date-picker>
            </label>
            <label class="field" for="dp-p-reference">
              <span>{{ 'down_payments.field.reference' | translate }}</span>
              <input
                nz-input
                id="dp-p-reference"
                maxlength="100"
                [ngModel]="reference()"
                (ngModelChange)="reference.set($event)"
              />
            </label>
            <div class="field">
              <span id="dp-p-account-label">{{
                'down_payments.field.paymentAccount' | translate
              }}</span>
              <nz-radio-group
                aria-labelledby="dp-p-account-label"
                [ngModel]="account()"
                (ngModelChange)="account.set($event)"
              >
                @for (item of accounts; track item) {
                  <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                  <label nz-radio [nzValue]="item">{{
                    'down_payments.paymentAccount.' + item | translate
                  }}</label>
                }
              </nz-radio-group>
            </div>
          </div>
          <p class="actions-bar">
            <button
              nz-button
              nzType="primary"
              type="button"
              data-test="proforma-submit"
              [disabled]="paidAt() === null"
              [nzLoading]="store.saving()"
              (click)="confirmProforma()"
            >
              {{ 'down_payments.action.confirmPayment' | translate }}
            </button>
            <button nz-button type="button" (click)="proformaLink.set(null)">
              {{ 'down_payments.action.close' | translate }}
            </button>
          </p>
        </ng-container>
      </nz-modal>
    }
  `,
})
export class DownPaymentChainComponent {
  /** Chain to show; when null the chain of the source is looked up. */
  readonly chainId = input<string | null>(null);
  readonly sourceType = input<DpSourceType | null>(null);
  readonly sourceId = input<string | null>(null);
  /** Number of the order or quote, for the wizard. */
  readonly sourceLabel = input<string | null>(null);

  protected readonly store = inject(ChainStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  private readonly permissions = inject(PermissionsService);
  protected readonly canRead = this.permissions.canRead(DOWN_PAYMENTS_MODULE);
  protected readonly canWrite = this.permissions.canWrite(DOWN_PAYMENTS_MODULE);
  protected readonly accounts = DP_PAYMENT_ACCOUNTS;
  protected readonly chainStatusColor = chainStatusColor;
  protected readonly installmentStatusColor = installmentStatusColor;
  protected readonly linkStatusColor = linkStatusColor;
  protected readonly depositStatusColor = depositStatusColor;
  protected readonly jurisdictionColor = jurisdictionColor;
  protected readonly canSettle = canSettle;

  protected readonly feedback = signal<DpOutcome | null>(null);
  protected readonly wizardOpen = signal(false);
  protected readonly settlementOpen = signal(false);
  protected readonly depositId = signal<string | null>(null);
  protected readonly creditLinkId = signal<string | null>(null);
  protected readonly proformaLink = signal<DpLink | null>(null);
  protected readonly paidAt = signal<Date | null>(null);
  protected readonly reference = signal('');
  protected readonly account = signal<DpPaymentAccount>('bank');

  protected readonly progress = computed(() => {
    const chain = this.store.chain();
    return chain ? progressOf(chain) : progressOf(EMPTY_CHAIN);
  });

  protected readonly timeline = computed(() => {
    const chain = this.store.chain();
    return chain ? buildTimeline(chain) : [];
  });

  protected readonly depositsHeld = computed(() => fromCents(this.progress().deposits));

  protected readonly netAdvances = computed(() => fromCents(this.progress().advances));

  protected readonly creditedPositive = computed(
    () => Number(this.store.chain()?.total_credited_advances_gross ?? 0) > 0,
  );

  protected readonly cancellable = computed(() => {
    const chain = this.store.chain();
    return (
      chain !== null &&
      !isChainClosed(chain) &&
      chain.links.length === 0 &&
      chain.deposits.length === 0 &&
      chain.installments.every((row) => row.status === 'planned')
    );
  });

  protected readonly selectedDeposit = computed<DpDeposit | null>(
    () => this.store.chain()?.deposits.find((deposit) => deposit.id === this.depositId()) ?? null,
  );

  protected readonly selectedLink = computed<DpLink | null>(
    () => this.store.chain()?.links.find((link) => link.id === this.creditLinkId()) ?? null,
  );

  /** One block of three lines (net, VAT, gross) per VAT rate, then the totals of all the rates. */
  protected readonly matrix = computed<MatrixLine[]>(() => {
    const rows = this.store.chain()?.vat_matrix ?? [];
    const lines: MatrixLine[] = [];
    const components: MatrixLine['component'][] = ['net', 'vat', 'gross'];
    const sumOf = (group: string, component: MatrixLine['component']): string =>
      fromCents(sumCents(rows.map((row) => cell(row, group, component))));

    for (const row of rows) {
      components.forEach((component, index) => {
        lines.push({
          key: `${row.vat_rate}-${component}`,
          vatRate: row.vat_rate,
          component,
          first: index === 0,
          contract: cell(row, 'contract', component),
          requested: cell(row, 'requested', component),
          invoiced: cell(row, 'invoiced', component),
          credited: cell(row, 'credited', component),
          settled: cell(row, 'settled', component),
          residual: cell(row, 'residual', component),
        });
      });
    }

    if (rows.length > 1) {
      components.forEach((component, index) => {
        lines.push({
          key: `total-${component}`,
          vatRate: '',
          component,
          first: index === 0,
          contract: sumOf('contract', component),
          requested: sumOf('requested', component),
          invoiced: sumOf('invoiced', component),
          credited: sumOf('credited', component),
          settled: sumOf('settled', component),
          residual: sumOf('residual', component),
        });
      });
    }

    return lines;
  });

  constructor() {
    effect(() => {
      const id = this.chainId();
      const type = this.sourceType();
      const source = this.sourceId();
      untracked(() => {
        if (!this.canRead) {
          return;
        }
        if (id) {
          void this.store.load(id);
        } else if (type && source) {
          void this.store.loadBySource(type, source);
        }
      });
    });
  }

  protected canEmitRow(row: DpInstallment): boolean {
    const chain = this.store.chain();
    return chain !== null && canEmit(chain, row);
  }

  protected canConfirmRow(link: DpLink): boolean {
    const chain = this.store.chain();
    return chain !== null && canConfirmProforma(chain, link);
  }

  protected canCreditRow(link: DpLink): boolean {
    const chain = this.store.chain();
    return chain !== null && canCreditNote(chain, link);
  }

  protected reload(): void {
    this.feedback.set(null);
    void this.store.reload();
  }

  private done(outcome: DpOutcome, messageKey: string): boolean {
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant(messageKey));
    } else {
      this.feedback.set(outcome);
    }
    return outcome.ok;
  }

  protected async emit(row: DpInstallment): Promise<void> {
    this.done(await this.store.emit(row.id), 'down_payments.message.emitted');
  }

  protected async cancelChain(): Promise<void> {
    this.done(await this.store.cancel(), 'down_payments.message.cancelled');
  }

  protected openProforma(link: DpLink): void {
    this.paidAt.set(new Date());
    this.reference.set('');
    this.account.set('bank');
    this.proformaLink.set(link);
  }

  protected async confirmProforma(): Promise<void> {
    const link = this.proformaLink();
    const paid = isoDay(this.paidAt());
    if (link === null || paid === null) {
      return;
    }
    const outcome = await this.store.confirmProforma(link.id, {
      paid_at: paid,
      payment_account: this.account(),
      ...(this.reference().trim() ? { reference: this.reference().trim() } : {}),
    });
    if (this.done(outcome, 'down_payments.message.proformaConverted')) {
      this.proformaLink.set(null);
    }
  }
}

/** Zero chain for the progress bar before the chain is loaded. */
const EMPTY_CHAIN = {
  total_contract_gross: '0',
  total_earnest_deposits_held: '0',
  total_security_deposits_held: '0',
  total_advance_invoiced_gross: '0',
  total_credited_advances_gross: '0',
  residual_order_gross: '0',
} as Parameters<typeof progressOf>[0];
