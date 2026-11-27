import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DP_CHAIN_STATUSES,
  DP_JURISDICTIONS,
  DP_SOURCE_TYPES,
  DpChainFilters,
  DpChainStatus,
  DpJurisdiction,
  DpSourceType,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { SalesLookupsService } from '../sales/cycle/shared/sales-lookups.service';
import { ChainsStore } from './chains.store';
import { chainStatusColor, jurisdictionColor } from './down-payments.util';

/** The down-payment chains: filter by customer, status, source and country, with the totals of the page, and open one. */
@Component({
  selector: 'app-dp-chain-list',
  imports: [
    DatePipe,
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [ChainsStore],
  styleUrl: './down-payments.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.DOWN_PAYMENTS_CHAINS' | translate"
      [subtitle]="'down_payments.list.subtitle' | translate"
    />

    <div class="toolbar">
      <label class="field" for="dp-f-customer">
        <span>{{ 'down_payments.field.customer' | translate }}</span>
        <nz-select
          nzId="dp-f-customer"
          nzAllowClear
          nzShowSearch
          [(ngModel)]="customerId"
          (ngModelChange)="reload()"
        >
          @for (contact of lookups.contacts(); track contact.id) {
            <nz-option [nzValue]="contact.id" [nzLabel]="lookups.contactLabel(contact)"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="dp-f-status">
        <span>{{ 'down_payments.field.status' | translate }}</span>
        <nz-select nzId="dp-f-status" nzAllowClear [(ngModel)]="status" (ngModelChange)="reload()">
          @for (item of statuses; track item) {
            <nz-option
              [nzValue]="item"
              [nzLabel]="'down_payments.status.' + item | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="dp-f-source">
        <span>{{ 'down_payments.field.source' | translate }}</span>
        <nz-select
          nzId="dp-f-source"
          nzAllowClear
          [(ngModel)]="sourceType"
          (ngModelChange)="reload()"
        >
          @for (item of sourceTypes; track item) {
            <nz-option
              [nzValue]="item"
              [nzLabel]="'down_payments.sourceType.' + item | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="dp-f-country">
        <span>{{ 'down_payments.field.country' | translate }}</span>
        <nz-select
          nzId="dp-f-country"
          nzAllowClear
          [(ngModel)]="country"
          (ngModelChange)="reload()"
        >
          @for (item of countries; track item) {
            <nz-option
              [nzValue]="item"
              [nzLabel]="'down_payments.jurisdiction.' + item | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="dp-f-search">
        <span>{{ 'down_payments.field.search' | translate }}</span>
        <input
          nz-input
          id="dp-f-search"
          maxlength="100"
          [(ngModel)]="search"
          (keyup.enter)="reload()"
          (blur)="reload()"
        />
      </label>
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    @if (store.totals().length > 0) {
      @for (total of store.totals(); track total.currency) {
        <div class="kpi-grid" [attr.data-test]="'totals-' + total.currency">
          <div class="kpi">
            <div class="kpi-label">
              {{ 'down_payments.kpi.contract' | translate }} ({{ total.currency }})
            </div>
            <div class="kpi-value">{{ total.contract | money: total.currency }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">{{ 'down_payments.kpi.advances' | translate }}</div>
            <div class="kpi-value">{{ total.advances | money: total.currency }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">{{ 'down_payments.kpi.deposits' | translate }}</div>
            <div class="kpi-value">{{ total.deposits | money: total.currency }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">{{ 'down_payments.kpi.residual' | translate }}</div>
            <div class="kpi-value">{{ total.residual | money: total.currency }}</div>
          </div>
        </div>
      }
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzFrontPagination]="false"
        [nzData]="store.chains()"
        [nzTotal]="store.meta()?.total ?? 0"
        [nzPageSize]="store.filters().per_page ?? 25"
        [nzPageIndex]="store.meta()?.current_page ?? 1"
        (nzPageIndexChange)="goTo($event)"
        [nzScroll]="{ x: '1100px' }"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'down_payments.field.chainNumber' | translate }}</th>
            <th scope="col">{{ 'down_payments.field.customer' | translate }}</th>
            <th scope="col">{{ 'down_payments.field.source' | translate }}</th>
            <th scope="col">{{ 'down_payments.field.country' | translate }}</th>
            <th scope="col" class="num">{{ 'down_payments.kpi.contract' | translate }}</th>
            <th scope="col" class="num">{{ 'down_payments.kpi.advances' | translate }}</th>
            <th scope="col" class="num">{{ 'down_payments.kpi.deposits' | translate }}</th>
            <th scope="col" class="num">{{ 'down_payments.kpi.residual' | translate }}</th>
            <th scope="col">{{ 'down_payments.field.status' | translate }}</th>
            <th scope="col">{{ 'down_payments.field.createdAt' | translate }}</th>
            <th scope="col">{{ 'down_payments.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (chain of table.data; track chain.id) {
            <tr [attr.data-test]="'chain-' + chain.id">
              <th scope="row">
                <a [routerLink]="['/down-payments/chains', chain.id]">{{ chain.chain_number }}</a>
              </th>
              <td>{{ chain.customer_name ?? chain.customer_id }}</td>
              <td>
                {{ 'down_payments.sourceType.' + chain.source_type | translate }}
                <small class="muted">{{ chain.source_number }}</small>
              </td>
              <td>
                <nz-tag [nzColor]="jurisdictionColor(chain.jurisdiction)">{{
                  chain.jurisdiction
                }}</nz-tag>
              </td>
              <td class="num">{{ chain.total_contract_gross | money: chain.currency }}</td>
              <td class="num">{{ chain.total_advance_invoiced_gross | money: chain.currency }}</td>
              <td class="num">
                {{
                  depositsOf(chain.total_earnest_deposits_held, chain.total_security_deposits_held)
                    | money: chain.currency
                }}
              </td>
              <td class="num">{{ chain.residual_order_gross | money: chain.currency }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(chain.status)">{{
                  'down_payments.status.' + chain.status | translate
                }}</nz-tag>
              </td>
              <td>{{ chain.created_at | date: 'mediumDate' }}</td>
              <td class="row-actions">
                <a nz-button nzSize="small" [routerLink]="['/down-payments/chains', chain.id]">{{
                  'down_payments.action.open' | translate
                }}</a>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.chains().length === 0) {
        <nz-empty [nzNotFoundContent]="'down_payments.empty.chains' | translate"></nz-empty>
      }
    </nz-spin>
  `,
})
export class ChainListComponent implements OnInit {
  protected readonly store = inject(ChainsStore);
  protected readonly lookups = inject(SalesLookupsService);

  protected readonly statuses = DP_CHAIN_STATUSES;
  protected readonly sourceTypes = DP_SOURCE_TYPES;
  protected readonly countries = DP_JURISDICTIONS;
  protected readonly statusColor = chainStatusColor;
  protected readonly jurisdictionColor = jurisdictionColor;

  protected customerId: string | null = null;
  protected status: DpChainStatus | null = null;
  protected sourceType: DpSourceType | null = null;
  protected country: DpJurisdiction | null = null;
  protected search = '';

  ngOnInit(): void {
    this.lookups.load();
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load(this.filters(1));
  }

  protected goTo(page: number): void {
    void this.store.load(this.filters(page));
  }

  protected depositsOf(earnest: string, security: string): string {
    return (Number(earnest) + Number(security)).toFixed(2);
  }

  private filters(page: number): DpChainFilters {
    return {
      per_page: this.store.filters().per_page ?? 25,
      page,
      ...(this.customerId ? { customer_id: this.customerId } : {}),
      ...(this.status ? { status: this.status } : {}),
      ...(this.sourceType ? { source_type: this.sourceType } : {}),
      ...(this.country ? { country: this.country } : {}),
      ...(this.search.trim() ? { search: this.search.trim() } : {}),
    };
  }
}
