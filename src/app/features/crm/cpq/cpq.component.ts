import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CRM_APPROVER_ROLES,
  CrmApproverRole,
  CrmDiscountThreshold,
  CrmExtensionApiService,
  CrmPricingRule,
  CrmQuoteConfiguration,
  CrmQuotePreview,
  I18nService,
  PermissionsService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';

/** CPQ: quote configurations with the discount approval flow, pricing rules and discount thresholds. */
@Component({
  selector: 'app-crm-cpq',
  imports: [
    FormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'CRMEXT.CPQ.TITLE' | translate" [subtitle]="'CRMEXT.CPQ.SUBTITLE' | translate">
      @if (canWrite()) {
        <button nz-button nzType="primary" type="button" appIconAction="create" (click)="openQuoteModal()"></button>
      }
    </app-page-header>

    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'CRMEXT.CPQ.QUOTES' | translate">
          <nz-table [nzData]="quotes()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
            <thead>
              <tr>
                <th>{{ 'CRMEXT.COMMON.NAME' | translate }}</th>
                <th>{{ 'CRMEXT.CPQ.QUANTITY' | translate }}</th>
                <th>{{ 'CRMEXT.CPQ.DISCOUNT' | translate }}</th>
                <th>{{ 'CRMEXT.CPQ.NET_TOTAL' | translate }}</th>
                <th>{{ 'CRMEXT.COMMON.STATUS' | translate }}</th>
                <th>{{ 'COMMON.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (quote of quotes(); track quote.id) {
                <tr>
                  <td>{{ quote.name }}</td>
                  <td>{{ quote.quantity }}</td>
                  <td>
                    {{ quote.discount_percent }}%
                    @if (quote.required_approver_role) {
                      <nz-tag nzColor="orange">{{ 'CRMEXT.CPQ.ROLE_' + quote.required_approver_role | translate }}</nz-tag>
                    }
                  </td>
                  <td>{{ quote.net_total }} {{ quote.currency }}</td>
                  <td><nz-tag>{{ 'CRMEXT.CPQ.STATUS_' + quote.status | translate }}</nz-tag></td>
                  <td>
                    @if (canWrite()) {
                      @if (quote.status === 'draft' || quote.status === 'rejected') {
                        <button nz-button nzSize="small" type="button" (click)="submitQuote(quote)">{{ 'CRMEXT.CPQ.SUBMIT' | translate }}</button>
                      }
                      @if (quote.status === 'pending_approval') {
                        <button nz-button nzSize="small" type="button" (click)="approveQuote(quote)">{{ 'CRMEXT.COMMON.APPROVE' | translate }}</button>
                        <button nz-button nzSize="small" nzDanger type="button" (click)="askReject(quote)">{{ 'CRMEXT.COMMON.REJECT' | translate }}</button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'CRMEXT.CPQ.RULES' | translate">
          <div class="inline-form">
            <input nz-input [placeholder]="'CRMEXT.COMMON.NAME' | translate" [(ngModel)]="ruleName" />
            <input nz-input type="number" min="0" [placeholder]="'CRMEXT.CPQ.MIN_QUANTITY' | translate" [(ngModel)]="ruleMinQuantity" />
            <input nz-input type="number" min="0" max="100" [placeholder]="'CRMEXT.CPQ.DISCOUNT' | translate" [(ngModel)]="ruleDiscount" />
            <button nz-button nzType="primary" type="button" [disabled]="!canWrite() || ruleName.trim().length === 0" (click)="addRule()">{{ 'CRMEXT.COMMON.ADD' | translate }}</button>
          </div>
          <nz-table [nzData]="rules()" [nzFrontPagination]="false" nzSize="middle">
            <thead>
              <tr>
                <th>{{ 'CRMEXT.COMMON.NAME' | translate }}</th>
                <th>{{ 'CRMEXT.CPQ.MIN_QUANTITY' | translate }}</th>
                <th>{{ 'CRMEXT.CPQ.DISCOUNT' | translate }}</th>
                <th>{{ 'COMMON.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (rule of rules(); track rule.id) {
                <tr>
                  <td>{{ rule.name }}</td>
                  <td>{{ rule.min_quantity }}</td>
                  <td>{{ rule.discount_percent }}%</td>
                  <td>
                    @if (canWrite()) {
                      <button nz-button nzType="text" nzDanger nzSize="small" type="button" appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'CRMEXT.COMMON.CONFIRM_DELETE' | translate" (nzOnConfirm)="removeRule(rule)"></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'CRMEXT.CPQ.THRESHOLDS' | translate">
          <div class="inline-form">
            <input nz-input type="number" min="0" max="100" [placeholder]="'CRMEXT.CPQ.FROM_DISCOUNT' | translate" [(ngModel)]="thresholdFrom" />
            <nz-select [(ngModel)]="thresholdRole">
              @for (role of approverRoles; track role) {
                <nz-option [nzValue]="role" [nzLabel]="'CRMEXT.CPQ.ROLE_' + role | translate"></nz-option>
              }
            </nz-select>
            <button nz-button nzType="primary" type="button" [disabled]="!canWrite() || thresholdFrom === null" (click)="addThreshold()">{{ 'CRMEXT.COMMON.ADD' | translate }}</button>
          </div>
          <nz-table [nzData]="thresholds()" [nzFrontPagination]="false" nzSize="middle">
            <thead>
              <tr>
                <th>{{ 'CRMEXT.CPQ.FROM_DISCOUNT' | translate }}</th>
                <th>{{ 'CRMEXT.CPQ.APPROVER' | translate }}</th>
                <th>{{ 'COMMON.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (threshold of thresholds(); track threshold.id) {
                <tr>
                  <td>{{ threshold.from_discount_percent }}%</td>
                  <td>{{ 'CRMEXT.CPQ.ROLE_' + threshold.approver_role | translate }}</td>
                  <td>
                    @if (canWrite()) {
                      <button nz-button nzType="text" nzDanger nzSize="small" type="button" appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'CRMEXT.COMMON.CONFIRM_DELETE' | translate" (nzOnConfirm)="removeThreshold(threshold)"></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-card>

    <nz-modal appModalActions okAction="save" [nzVisible]="quoteModalOpen()" [nzTitle]="'CRMEXT.CPQ.NEW_QUOTE' | translate" [nzOkLoading]="saving()" [nzOkDisabled]="quoteName.trim().length === 0" (nzOnCancel)="quoteModalOpen.set(false)" (nzOnOk)="saveQuote()">
      <ng-container *nzModalContent>
        <label for="quote-name">{{ 'CRMEXT.COMMON.NAME' | translate }}</label>
        <input nz-input id="quote-name" maxlength="200" [(ngModel)]="quoteName" (ngModelChange)="preview()" />
        <label for="quote-quantity">{{ 'CRMEXT.CPQ.QUANTITY' | translate }}</label>
        <input nz-input id="quote-quantity" type="number" min="0" [(ngModel)]="quoteQuantity" (ngModelChange)="preview()" />
        <label for="quote-price">{{ 'CRMEXT.CPQ.UNIT_PRICE' | translate }}</label>
        <input nz-input id="quote-price" type="number" min="0" [(ngModel)]="quoteUnitPrice" (ngModelChange)="preview()" />
        <label for="quote-extra">{{ 'CRMEXT.CPQ.EXTRA_DISCOUNT' | translate }}</label>
        <input nz-input id="quote-extra" type="number" min="0" max="100" [(ngModel)]="quoteExtraDiscount" (ngModelChange)="preview()" />
        @if (quotePreview(); as p) {
          <p class="hint">
            {{ 'CRMEXT.CPQ.PREVIEW' | translate: { discount: p.discount_percent, net: p.net_total } }}
            @if (p.required_approver_role) {
              ({{ 'CRMEXT.CPQ.NEEDS' | translate }} {{ 'CRMEXT.CPQ.ROLE_' + p.required_approver_role | translate }})
            }
          </p>
        }
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions okAction="save" [nzVisible]="rejecting() !== null" [nzTitle]="'CRMEXT.COMMON.REJECT_REASON' | translate" [nzOkLoading]="saving()" [nzOkDisabled]="reason.trim().length === 0" (nzOnCancel)="rejecting.set(null)" (nzOnOk)="reject()">
      <ng-container *nzModalContent>
        <label for="quote-reason">{{ 'CRMEXT.COMMON.REASON' | translate }}</label>
        <input nz-input id="quote-reason" maxlength="2000" [(ngModel)]="reason" />
      </ng-container>
    </nz-modal>
  `,
})
export class CpqComponent {
  private readonly api = inject(CrmExtensionApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('crm'));

  protected readonly quotes = signal<CrmQuoteConfiguration[]>([]);
  protected readonly rules = signal<CrmPricingRule[]>([]);
  protected readonly thresholds = signal<CrmDiscountThreshold[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly quoteModalOpen = signal(false);
  protected readonly quotePreview = signal<CrmQuotePreview | null>(null);
  protected readonly rejecting = signal<CrmQuoteConfiguration | null>(null);
  protected readonly approverRoles = CRM_APPROVER_ROLES;
  protected quoteName = '';
  protected quoteQuantity = 1;
  protected quoteUnitPrice = 0;
  protected quoteExtraDiscount = 0;
  protected ruleName = '';
  protected ruleMinQuantity = 0;
  protected ruleDiscount = 0;
  protected thresholdFrom: number | null = null;
  protected thresholdRole: CrmApproverRole = 'sales_manager';
  protected reason = '';

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getQuoteConfigurations().subscribe({ next: (res) => this.quotes.set(res.data ?? []), error: () => this.loading.set(false) });
    this.api.getPricingRules().subscribe({ next: (res) => this.rules.set(res.data ?? []) });
    this.api.getDiscountThresholds().subscribe({
      next: (res) => {
        this.thresholds.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private done(key: string): void {
    this.message.success(this.i18n.translate(key));
    this.load();
  }

  protected openQuoteModal(): void {
    this.quoteName = '';
    this.quoteQuantity = 1;
    this.quoteUnitPrice = 0;
    this.quoteExtraDiscount = 0;
    this.quotePreview.set(null);
    this.quoteModalOpen.set(true);
  }

  private quotePayload() {
    return {
      name: this.quoteName.trim() || '-',
      quantity: Number(this.quoteQuantity) || 1,
      unit_price: Number(this.quoteUnitPrice) || 0,
      extra_discount_percent: Number(this.quoteExtraDiscount) || 0,
    };
  }

  /** The API computes the rule discount, the total and the required approver; the form only shows it. */
  protected preview(): void {
    this.api.previewQuoteConfiguration(this.quotePayload()).subscribe({ next: (res) => this.quotePreview.set(res.data) });
  }

  protected saveQuote(): void {
    this.saving.set(true);
    this.api.createQuoteConfiguration(this.quotePayload()).subscribe({
      next: () => {
        this.saving.set(false);
        this.quoteModalOpen.set(false);
        this.done('CRMEXT.COMMON.SAVED');
      },
      error: () => this.saving.set(false),
    });
  }

  protected submitQuote(quote: CrmQuoteConfiguration): void {
    this.api.submitQuoteConfiguration(quote.id).subscribe({ next: () => this.done('CRMEXT.COMMON.DONE') });
  }

  protected approveQuote(quote: CrmQuoteConfiguration): void {
    this.api.approveQuoteConfiguration(quote.id).subscribe({ next: () => this.done('CRMEXT.COMMON.DONE') });
  }

  protected askReject(quote: CrmQuoteConfiguration): void {
    this.reason = '';
    this.rejecting.set(quote);
  }

  protected reject(): void {
    const quote = this.rejecting();
    if (quote === null) {
      return;
    }

    this.saving.set(true);
    this.api.rejectQuoteConfiguration(quote.id, this.reason.trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.rejecting.set(null);
        this.done('CRMEXT.COMMON.DONE');
      },
      error: () => this.saving.set(false),
    });
  }

  protected addRule(): void {
    this.api
      .createPricingRule({ name: this.ruleName.trim(), rule_type: 'volume_discount', min_quantity: Number(this.ruleMinQuantity) || 0, discount_percent: Number(this.ruleDiscount) || 0 })
      .subscribe({
        next: () => {
          this.ruleName = '';
          this.done('CRMEXT.COMMON.SAVED');
        },
      });
  }

  protected removeRule(rule: CrmPricingRule): void {
    this.api.deletePricingRule(rule.id).subscribe({ next: () => this.done('CRMEXT.COMMON.DELETED') });
  }

  protected addThreshold(): void {
    if (this.thresholdFrom === null) {
      return;
    }

    this.api.createDiscountThreshold({ from_discount_percent: Number(this.thresholdFrom), approver_role: this.thresholdRole }).subscribe({
      next: () => {
        this.thresholdFrom = null;
        this.done('CRMEXT.COMMON.SAVED');
      },
    });
  }

  protected removeThreshold(threshold: CrmDiscountThreshold): void {
    this.api.deleteDiscountThreshold(threshold.id).subscribe({ next: () => this.done('CRMEXT.COMMON.DELETED') });
  }
}
