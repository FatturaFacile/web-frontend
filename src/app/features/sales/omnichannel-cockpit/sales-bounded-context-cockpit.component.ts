import { Component, OnInit, inject, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { SalesBoundedContextStore } from './sales-bounded-context.store';

@Component({
  selector: 'app-sales-bounded-context-cockpit',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzStatisticModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  styleUrl: './sales-bounded-context-cockpit.scss',
  template: `
    <div class="sbc-cockpit">
      <nz-card [nzTitle]="ui('page_title')" [nzLoading]="store.loading()">
        <p>{{ ui('page_subtitle') }}</p>

        @if (store.overview(); as ov) {
          <div class="sbc-kpi-grid">
            <nz-card nzSize="small">
              <nz-statistic [nzTitle]="ui('tab_mod033')" [nzValue]="ov.dossiers_count"></nz-statistic>
            </nz-card>
            <nz-card nzSize="small">
              <nz-statistic [nzTitle]="ui('tab_mod035')" [nzValue]="ov.weighted_pipeline" nzPrefix="CHF "></nz-statistic>
            </nz-card>
            <nz-card nzSize="small">
              <nz-statistic [nzTitle]="ui('tab_mod039')" [nzValue]="ov.active_mrr" nzPrefix="MRR "></nz-statistic>
            </nz-card>
            <nz-card nzSize="small">
              <nz-statistic [nzTitle]="ui('tab_mod041')" [nzValue]="ov.commissions_payable" nzPrefix="EUR "></nz-statistic>
            </nz-card>
          </div>
        }
      </nz-card>

      <nz-card>
        <nz-tabs [nzSelectedIndex]="activeTabIndex()" (nzSelectedIndexChange)="activeTabIndex.set($event)">
          <!-- Mod 033 -->
          <nz-tab [nzTitle]="ui('tab_mod033')">
            <div class="sbc-toolbar">
              <button nz-button nzType="primary" (click)="createSampleDossier()">
                {{ ui('create_dossier') }}
              </button>
            </div>
            <nz-table [nzData]="store.dossiers()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Company</th>
                  <th>Role</th>
                  <th>CH UID / IT P.IVA</th>
                  <th>Credit Limit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.dossiers(); track row.id) {
                  <tr>
                    <td>{{ row.customer_code }}</td>
                    <td>{{ row.company_name }}</td>
                    <td><nz-tag>{{ row.hierarchy_role }}</nz-tag></td>
                    <td>{{ row.uid_number ?? row.vat_number ?? '-' }}</td>
                    <td>{{ row.credit_limit }} {{ row.currency }}</td>
                    <td><nz-tag nzColor="blue">{{ row.insolvency_status }}</nz-tag></td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- Mod 034 -->
          <nz-tab [nzTitle]="ui('tab_mod034')">
            <div class="sbc-toolbar">
              <button nz-button nzType="primary" (click)="captureSampleLead()">
                {{ ui('capture_lead') }}
              </button>
            </div>
            <nz-table [nzData]="store.leads()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Channel</th>
                  <th>Score</th>
                  <th>Stage</th>
                  <th>Territory / Rep</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.leads(); track row.id) {
                  <tr>
                    <td>{{ row.lead_code }}</td>
                    <td>{{ row.full_name }}</td>
                    <td>{{ row.source_channel }}</td>
                    <td><nz-tag nzColor="green">{{ row.total_score }}</nz-tag></td>
                    <td>{{ row.lifecycle_stage }}</td>
                    <td>{{ row.assigned_territory }} · {{ row.assigned_rep_name }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- Mod 035 -->
          <nz-tab [nzTitle]="ui('tab_mod035')">
            <div class="sbc-toolbar">
              <button nz-button nzType="primary" (click)="saveSampleOpportunity()">
                {{ ui('save_opportunity') }}
              </button>
            </div>
            <nz-table [nzData]="store.opportunities()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Stage</th>
                  <th>Prob %</th>
                  <th>Weighted</th>
                  <th>Forecast</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.opportunities(); track row.id) {
                  <tr>
                    <td>{{ row.opportunity_code }}</td>
                    <td>{{ row.title }}</td>
                    <td><nz-tag>{{ row.kanban_stage }}</nz-tag></td>
                    <td>{{ row.win_probability_pct }}%</td>
                    <td>{{ row.weighted_amount }} {{ row.currency }}</td>
                    <td><nz-tag nzColor="purple">{{ row.forecast_category }}</nz-tag></td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- Mod 036 -->
          <nz-tab [nzTitle]="ui('tab_mod036')">
            <div class="sbc-toolbar">
              <button nz-button nzType="primary" (click)="createSampleQuote()">
                {{ ui('create_quote') }}
              </button>
            </div>
            <nz-table [nzData]="store.quotes()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Title</th>
                  <th>Total Gross</th>
                  <th>Signature</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.quotes(); track row.id) {
                  <tr>
                    <td>{{ row.quote_number }} v{{ row.version_number }}</td>
                    <td>{{ row.title }}</td>
                    <td>{{ row.total_gross }} {{ row.currency }}</td>
                    <td><nz-tag>{{ row.signature_standard }} ({{ row.signature_status }})</nz-tag></td>
                    <td>{{ row.status }}</td>
                    <td>
                      @if (row.signature_status !== 'signed') {
                        <button nz-button nzSize="small" (click)="signQuote(row.id)">
                          {{ ui('sign_quote') }}
                        </button>
                      }
                      @if (row.signature_status === 'signed' && !row.converted_order_id) {
                        <button nz-button nzSize="small" nzType="primary" (click)="convertQuote(row.id)">
                          {{ ui('convert_order') }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- Mod 037 -->
          <nz-tab [nzTitle]="ui('tab_mod037')">
            <div class="sbc-toolbar">
              <button nz-button nzType="primary" (click)="createSampleOrder()">
                {{ ui('create_order') }}
              </button>
            </div>
            <nz-table [nzData]="store.orders()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Kind</th>
                  <th>ATP / CTP</th>
                  <th>Shipped / Backorder</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.orders(); track row.id) {
                  <tr>
                    <td>{{ row.order_number }}</td>
                    <td><nz-tag>{{ row.order_kind }}</nz-tag></td>
                    <td>{{ row.atp_qty }} / {{ row.ctp_qty }}</td>
                    <td>{{ row.shipped_qty }} / {{ row.backorder_qty }}</td>
                    <td>{{ row.total_amount }} {{ row.currency }}</td>
                    <td><nz-tag nzColor="cyan">{{ row.fulfillment_status }}</nz-tag></td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- Mod 038 -->
          <nz-tab [nzTitle]="ui('tab_mod038')">
            <div class="sbc-toolbar">
              <button nz-button nzType="primary" (click)="evaluateSamplePricing()">
                {{ ui('evaluate_pricing') }}
              </button>
            </div>
            <nz-table [nzData]="store.pricingGuardrails()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Net Price</th>
                  <th>Margin %</th>
                  <th>Min %</th>
                  <th>Approval</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.pricingGuardrails(); track row.id) {
                  <tr>
                    <td>{{ row.name }}</td>
                    <td>{{ row.resolved_net_price }} {{ row.currency }}</td>
                    <td>{{ row.calculated_margin_pct }}%</td>
                    <td>{{ row.min_margin_pct }}%</td>
                    <td>
                      <nz-tag [nzColor]="row.guardrail_breached ? 'orange' : 'green'">
                        {{ row.approval_status }}
                      </nz-tag>
                    </td>
                    <td>
                      @if (row.approval_status === 'pending_manager_approval') {
                        <button nz-button nzSize="small" (click)="approveOverride(row.id)">
                          {{ ui('approve_override') }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- Mod 039 -->
          <nz-tab [nzTitle]="ui('tab_mod039')">
            <div class="sbc-toolbar">
              <button nz-button nzType="primary" (click)="createSampleSubscription()">
                {{ ui('create_subscription') }}
              </button>
            </div>
            <nz-table [nzData]="store.subscriptions()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Plan</th>
                  <th>Pro-Rata</th>
                  <th>Index</th>
                  <th>MRR / ARR</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.subscriptions(); track row.id) {
                  <tr>
                    <td>{{ row.contract_code }}</td>
                    <td>{{ row.plan_name }}</td>
                    <td>{{ row.pro_rata_adjustment_amount }} {{ row.currency }}</td>
                    <td>{{ row.indexation_type }}</td>
                    <td>{{ row.mrr_amount }} / {{ row.arr_amount }}</td>
                    <td>
                      <button nz-button nzSize="small" (click)="revalueSubscription(row.id)">
                        {{ ui('revalue_index') }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- Mod 040 -->
          <nz-tab [nzTitle]="ui('tab_mod040')">
            <div class="sbc-toolbar">
              <button nz-button nzType="primary" (click)="issueSampleDdtInvoice()">
                {{ ui('issue_document') }}
              </button>
            </div>
            <nz-table [nzData]="store.ddtInvoices()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Doc #</th>
                  <th>Kind</th>
                  <th>SDI / QR Ref</th>
                  <th>Gross</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.ddtInvoices(); track row.id) {
                  <tr>
                    <td>{{ row.document_number }}</td>
                    <td>{{ row.document_kind }}</td>
                    <td>{{ row.sdi_doc_type ?? row.qr_bill_reference ?? '-' }}</td>
                    <td>{{ row.total_gross }} {{ row.currency }}</td>
                    <td><nz-tag color="green">{{ row.status }}</nz-tag></td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- Mod 041 -->
          <nz-tab [nzTitle]="ui('tab_mod041')">
            <div class="sbc-toolbar">
              <button nz-button nzType="primary" (click)="calculateSampleCommission()">
                {{ ui('calculate_commission') }}
              </button>
            </div>
            <nz-table [nzData]="store.commissions()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Statement</th>
                  <th>Agent</th>
                  <th>Basis</th>
                  <th>Gross Comm.</th>
                  <th>Enasarco (Co/Ag)</th>
                  <th>Net Payable</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.commissions(); track row.id) {
                  <tr>
                    <td>{{ row.statement_number }}</td>
                    <td>{{ row.agent_name }}</td>
                    <td>{{ row.accrual_basis }}</td>
                    <td>{{ row.gross_commission_amount }} {{ row.currency }}</td>
                    <td>{{ row.enasarco_company_amount }} / {{ row.enasarco_agent_withholding }}</td>
                    <td>{{ row.net_payable_amount }} {{ row.currency }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- Mod 042 -->
          <nz-tab [nzTitle]="ui('tab_mod042')">
            <div class="sbc-toolbar">
              <button nz-button nzType="primary" (click)="executeSamplePortalPayment()">
                {{ ui('execute_portal_payment') }}
              </button>
            </div>
            <nz-table [nzData]="store.portalTransactions()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Tx #</th>
                  <th>Type</th>
                  <th>Provider</th>
                  <th>Amount</th>
                  <th>QR-Bill / Ref</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.portalTransactions(); track row.id) {
                  <tr>
                    <td>{{ row.transaction_code }}</td>
                    <td>{{ row.transaction_type }}</td>
                    <td><nz-tag nzColor="blue">{{ row.payment_provider }}</nz-tag></td>
                    <td>{{ row.amount }} {{ row.currency }}</td>
                    <td>{{ row.qr_bill_reference ?? row.payment_reference ?? '-' }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>
        </nz-tabs>
      </nz-card>
    </div>
  `,
})
export class SalesBoundedContextCockpitComponent implements OnInit {
  readonly store = inject(SalesBoundedContextStore);
  private readonly message = inject(NzMessageService);

  readonly activeTabIndex = signal(0);

  ngOnInit(): void {
    void this.store.loadAll();
  }

  ui(key: string): string {
    return this.store.ui()[key] ?? key;
  }

  async createSampleDossier(): Promise<void> {
    await this.store.createDossier({
      company_name: 'Ticino Precision SA',
      hierarchy_role: 'subsidiary',
      country: 'CH',
      currency: 'CHF',
      uid_number: 'CHE-116.281.710',
      credit_limit: 90000,
    });
    this.message.success('Mod 033');
  }

  async captureSampleLead(): Promise<void> {
    await this.store.captureLead({
      full_name: 'Luca Bernasconi',
      email: 'luca@ticinoprecision.ch',
      country: 'CH',
      source_channel: 'quote_request',
    });
    this.message.success('Mod 034');
  }

  async saveSampleOpportunity(): Promise<void> {
    await this.store.saveOpportunity({
      title: 'Cross-border ERP Deal',
      kanban_stage: 'proposal',
      gross_amount: 60000,
      currency: 'CHF',
    });
    this.message.success('Mod 035');
  }

  async createSampleQuote(): Promise<void> {
    await this.store.createQuote({
      title: 'CPQ Bundle Proposal',
      currency: 'CHF',
      signature_standard: 'zertes_qes',
      lines: [{ description: 'Core Suite', quantity: 1, unit_price: 25000, tax_rate: 8.1 }],
    });
    this.message.success('Mod 036');
  }

  async signQuote(id: string): Promise<void> {
    await this.store.signQuote(id, {
      signature_standard: 'zertes_qes',
      signer_name: 'Authorized Signer',
      signer_email: 'signer@ticinoprecision.ch',
    });
    this.message.success('eIDAS/ZertES');
  }

  async convertQuote(id: string): Promise<void> {
    await this.store.convertQuoteToOrder(id);
    this.message.success('1-Click Order');
  }

  async createSampleOrder(): Promise<void> {
    await this.store.createOrder({
      order_kind: 'sales_order',
      currency: 'CHF',
      atp_qty: 10,
      ctp_qty: 5,
      requested_qty: 12,
      shipped_qty: 10,
      total_amount: 12000,
    });
    this.message.success('Mod 037');
  }

  async evaluateSamplePricing(): Promise<void> {
    await this.store.evaluatePricing({
      name: 'Tiered Promo Check',
      currency: 'CHF',
      base_unit_price: 100,
      unit_cost: 75,
      cascading_discounts: [10, 10],
      min_margin_pct: 15,
    });
    this.message.success('Mod 038');
  }

  async approveOverride(id: string): Promise<void> {
    await this.store.approveMarginOverride(id, 'Approved by manager');
    this.message.success('Override approved');
  }

  async createSampleSubscription(): Promise<void> {
    await this.store.createSubscription({
      plan_name: 'Enterprise Cloud',
      billing_cycle: 'monthly',
      currency: 'CHF',
      base_recurring_amount: 1500,
      indexation_type: 'SWISS_LIK',
    });
    this.message.success('Mod 039');
  }

  async revalueSubscription(id: string): Promise<void> {
    await this.store.transitionSubscription(id, { action: 'revalue_index', index_rate_pct: 1.5 });
    this.message.success('LIK / ISTAT');
  }

  async issueSampleDdtInvoice(): Promise<void> {
    await this.store.issueDdtInvoice({
      document_kind: 'deferred_summary_invoice',
      grouped_ddt_numbers: ['DDT-2026-101'],
      currency: 'EUR',
      total_net: 5000,
      tax_rate: 22,
    });
    this.message.success('Mod 040');
  }

  async calculateSampleCommission(): Promise<void> {
    await this.store.calculateCommission({
      agent_name: 'Marco Rossi',
      agent_jurisdiction: 'IT',
      accrual_basis: 'collected',
      commissionable_base: 50000,
      currency: 'EUR',
    });
    this.message.success('Mod 041');
  }

  async executeSamplePortalPayment(): Promise<void> {
    await this.store.executePortalAction({
      transaction_type: 'online_payment',
      payment_provider: 'twint',
      amount: 1200,
      currency: 'CHF',
    });
    this.message.success('Mod 042');
  }
}
