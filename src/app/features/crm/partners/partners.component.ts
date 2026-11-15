import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CRM_PARTNER_TYPES,
  CrmDealRegistration,
  CrmExtensionApiService,
  CrmMdfClaim,
  CrmMdfFund,
  CrmPartner,
  CrmPartnerType,
  I18nService,
  PermissionsService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';

type ReasonTarget = { kind: 'deal'; id: string } | { kind: 'claim'; id: string };

/** Partner relationship management: partners and tiers, deal registrations and market development funds. */
@Component({
  selector: 'app-crm-partners',
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
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'CRMEXT.PARTNERS.TITLE' | translate" [subtitle]="'CRMEXT.PARTNERS.SUBTITLE' | translate">
      @if (canWrite()) {
        <button nz-button type="button" (click)="evaluateTiers()">{{ 'CRMEXT.PARTNERS.EVALUATE_TIERS' | translate }}</button>
        <button nz-button nzType="primary" type="button" appIconAction="create" (click)="openPartnerModal()"></button>
      }
    </app-page-header>

    <nz-card>
      <nz-tabset>
        <nz-tab [nzTitle]="'CRMEXT.PARTNERS.PARTNERS' | translate">
          <nz-table [nzData]="partners()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
            <thead>
              <tr>
                <th>{{ 'CRMEXT.COMMON.NAME' | translate }}</th>
                <th>{{ 'CRMEXT.PARTNERS.TYPE' | translate }}</th>
                <th>{{ 'CRMEXT.PARTNERS.TIER' | translate }}</th>
                <th>{{ 'CRMEXT.PARTNERS.CLOSED_REVENUE' | translate }}</th>
                <th>{{ 'CRMEXT.COMMON.STATUS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (partner of partners(); track partner.id) {
                <tr>
                  <td>{{ partner.name }}</td>
                  <td>{{ 'CRMEXT.PARTNERS.TYPE_' + partner.partner_type | translate }}</td>
                  <td>{{ partner.tier?.name ?? '-' }}</td>
                  <td>{{ partner.closed_revenue }}</td>
                  <td><nz-tag>{{ 'CRMEXT.PARTNERS.STATUS_' + partner.status | translate }}</nz-tag></td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'CRMEXT.DEALS.TITLE' | translate">
          <nz-table [nzData]="deals()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
            <thead>
              <tr>
                <th>{{ 'CRMEXT.DEALS.CUSTOMER' | translate }}</th>
                <th>{{ 'CRMEXT.DEALS.PARTNER' | translate }}</th>
                <th>{{ 'CRMEXT.DEALS.AMOUNT' | translate }}</th>
                <th>{{ 'CRMEXT.DEALS.EXPIRES' | translate }}</th>
                <th>{{ 'CRMEXT.COMMON.STATUS' | translate }}</th>
                <th>{{ 'COMMON.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (deal of deals(); track deal.id) {
                <tr>
                  <td>
                    {{ deal.customer_name }}
                    @if (deal.conflicts_with_id) {
                      <nz-tag nzColor="orange">{{ 'CRMEXT.DEALS.CONFLICT' | translate }}</nz-tag>
                    }
                  </td>
                  <td>{{ deal.partner?.name }}</td>
                  <td>{{ deal.expected_amount }} {{ deal.currency }}</td>
                  <td>{{ deal.expires_on }}</td>
                  <td><nz-tag>{{ 'CRMEXT.DEALS.STATUS_' + deal.status | translate }}</nz-tag></td>
                  <td>
                    @if (canWrite()) {
                      @if (deal.status === 'pending') {
                        <button nz-button nzSize="small" type="button" (click)="approveDeal(deal)">{{ 'CRMEXT.COMMON.APPROVE' | translate }}</button>
                      }
                      @if (deal.status === 'pending' || deal.status === 'approved') {
                        <button nz-button nzSize="small" nzDanger type="button" (click)="askReason({ kind: 'deal', id: deal.id })">{{ 'CRMEXT.COMMON.REJECT' | translate }}</button>
                      }
                      @if (deal.status === 'approved') {
                        <button nz-button nzSize="small" type="button" (click)="markWon(deal)">{{ 'CRMEXT.DEALS.MARK_WON' | translate }}</button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'CRMEXT.MDF.TITLE' | translate">
          <nz-table [nzData]="funds()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
            <thead>
              <tr>
                <th>{{ 'CRMEXT.MDF.YEAR' | translate }}</th>
                <th>{{ 'CRMEXT.MDF.ALLOCATED' | translate }}</th>
                <th>{{ 'CRMEXT.MDF.COMMITTED' | translate }}</th>
                <th>{{ 'CRMEXT.MDF.REMAINING' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (fund of funds(); track fund.id) {
                <tr>
                  <td>{{ fund.fiscal_year }}</td>
                  <td>{{ fund.summary?.allocated }} {{ fund.currency }}</td>
                  <td>{{ fund.summary?.committed }}</td>
                  <td>{{ fund.summary?.remaining }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          <nz-table [nzData]="claims()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
            <thead>
              <tr>
                <th>{{ 'CRMEXT.MDF.ACTIVITY' | translate }}</th>
                <th>{{ 'CRMEXT.MDF.AMOUNT' | translate }}</th>
                <th>{{ 'CRMEXT.COMMON.STATUS' | translate }}</th>
                <th>{{ 'COMMON.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (claim of claims(); track claim.id) {
                <tr>
                  <td>{{ claim.activity }}</td>
                  <td>{{ claim.amount }}</td>
                  <td><nz-tag>{{ 'CRMEXT.MDF.STATUS_' + claim.status | translate }}</nz-tag></td>
                  <td>
                    @if (canWrite()) {
                      @if (claim.status === 'submitted') {
                        <button nz-button nzSize="small" type="button" (click)="approveClaim(claim)">{{ 'CRMEXT.COMMON.APPROVE' | translate }}</button>
                        <button nz-button nzSize="small" nzDanger type="button" (click)="askReason({ kind: 'claim', id: claim.id })">{{ 'CRMEXT.COMMON.REJECT' | translate }}</button>
                      }
                      @if (claim.status === 'approved') {
                        <button nz-button nzSize="small" type="button" (click)="payClaim(claim)">{{ 'CRMEXT.MDF.MARK_PAID' | translate }}</button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabset>
    </nz-card>

    <nz-modal okAction="save" [nzVisible]="partnerModalOpen()" [nzTitle]="'CRMEXT.PARTNERS.NEW' | translate" [nzOkLoading]="saving()" [nzOkDisabled]="partnerName.trim().length === 0" (nzOnCancel)="partnerModalOpen.set(false)" (nzOnOk)="savePartner()">
      <ng-container *nzModalContent>
        <label for="partner-name">{{ 'CRMEXT.COMMON.NAME' | translate }}</label>
        <input nz-input id="partner-name" maxlength="200" [(ngModel)]="partnerName" />
        <label for="partner-type">{{ 'CRMEXT.PARTNERS.TYPE' | translate }}</label>
        <nz-select nzId="partner-type" [(ngModel)]="partnerType">
          @for (type of partnerTypes; track type) {
            <nz-option [nzValue]="type" [nzLabel]="'CRMEXT.PARTNERS.TYPE_' + type | translate"></nz-option>
          }
        </nz-select>
        <label for="partner-email">{{ 'CRMEXT.PARTNERS.EMAIL' | translate }}</label>
        <input nz-input id="partner-email" type="email" [(ngModel)]="partnerEmail" />
      </ng-container>
    </nz-modal>

    <nz-modal okAction="save" [nzVisible]="reasonTarget() !== null" [nzTitle]="'CRMEXT.COMMON.REJECT_REASON' | translate" [nzOkLoading]="saving()" [nzOkDisabled]="reason.trim().length === 0" (nzOnCancel)="reasonTarget.set(null)" (nzOnOk)="reject()">
      <ng-container *nzModalContent>
        <label for="reject-reason">{{ 'CRMEXT.COMMON.REASON' | translate }}</label>
        <input nz-input id="reject-reason" maxlength="2000" [(ngModel)]="reason" />
      </ng-container>
    </nz-modal>
  `,
})
export class PartnersComponent {
  private readonly api = inject(CrmExtensionApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('crm'));

  protected readonly partners = signal<CrmPartner[]>([]);
  protected readonly deals = signal<CrmDealRegistration[]>([]);
  protected readonly funds = signal<CrmMdfFund[]>([]);
  protected readonly claims = signal<CrmMdfClaim[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly partnerModalOpen = signal(false);
  protected readonly reasonTarget = signal<ReasonTarget | null>(null);
  protected readonly partnerTypes = CRM_PARTNER_TYPES;
  protected partnerName = '';
  protected partnerType: CrmPartnerType = 'reseller';
  protected partnerEmail = '';
  protected reason = '';

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getPartners().subscribe({ next: (res) => this.partners.set(res.data ?? []), error: () => this.loading.set(false) });
    this.api.getDealRegistrations().subscribe({ next: (res) => this.deals.set(res.data ?? []), error: () => this.loading.set(false) });
    this.api.getMdfFunds().subscribe({ next: (res) => this.funds.set(res.data ?? []), error: () => this.loading.set(false) });
    this.api.getMdfClaims().subscribe({
      next: (res) => {
        this.claims.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private done(key: string): void {
    this.message.success(this.i18n.translate(key));
    this.load();
  }

  protected openPartnerModal(): void {
    this.partnerName = '';
    this.partnerType = 'reseller';
    this.partnerEmail = '';
    this.partnerModalOpen.set(true);
  }

  protected savePartner(): void {
    this.saving.set(true);
    this.api
      .createPartner({ name: this.partnerName.trim(), partner_type: this.partnerType, status: 'active', contact_email: this.partnerEmail.trim() || null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.partnerModalOpen.set(false);
          this.done('CRMEXT.COMMON.SAVED');
        },
        error: () => this.saving.set(false),
      });
  }

  protected evaluateTiers(): void {
    this.api.evaluatePartnerTiers().subscribe({ next: () => this.done('CRMEXT.PARTNERS.TIERS_EVALUATED') });
  }

  protected approveDeal(deal: CrmDealRegistration): void {
    this.api.approveDealRegistration(deal.id).subscribe({ next: () => this.done('CRMEXT.COMMON.DONE') });
  }

  protected markWon(deal: CrmDealRegistration): void {
    this.api.markDealRegistrationWon(deal.id).subscribe({ next: () => this.done('CRMEXT.COMMON.DONE') });
  }

  protected approveClaim(claim: CrmMdfClaim): void {
    this.api.approveMdfClaim(claim.id).subscribe({ next: () => this.done('CRMEXT.COMMON.DONE') });
  }

  protected payClaim(claim: CrmMdfClaim): void {
    this.api.payMdfClaim(claim.id).subscribe({ next: () => this.done('CRMEXT.COMMON.DONE') });
  }

  protected askReason(target: ReasonTarget): void {
    this.reason = '';
    this.reasonTarget.set(target);
  }

  protected reject(): void {
    const target = this.reasonTarget();
    if (target === null) {
      return;
    }

    this.saving.set(true);
    const request = target.kind === 'deal' ? this.api.rejectDealRegistration(target.id, this.reason.trim()) : this.api.rejectMdfClaim(target.id, this.reason.trim());
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.reasonTarget.set(null);
        this.done('CRMEXT.COMMON.DONE');
      },
      error: () => this.saving.set(false),
    });
  }
}
