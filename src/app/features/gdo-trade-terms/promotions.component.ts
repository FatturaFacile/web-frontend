import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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
import { GDT_PROMOTION_STATUSES, GdtPromotion } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { promotionStatusColor } from './gdo-trade-terms.util';
import { PromotionsStore } from './promotions.store';

/** Trade promotions and contributions of every contract: flyer, sell-out, openings, listing, display and Ce.Di. logistics. */
@Component({
  selector: 'app-gdt-promotions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  providers: [PromotionsStore],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.GDO_TRADE_TERMS_PROMOTIONS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="gdt-pr-contract">
        <span>{{ 'gdoTradeTerms.field.contract' | translate }}</span>
        <nz-select
          nzId="gdt-pr-contract"
          nzAllowClear
          nzShowSearch
          [nzPlaceHolder]="'gdoTradeTerms.action.all' | translate"
          [ngModel]="store.filters().contract_id ?? null"
          (ngModelChange)="store.setFilters({ contract_id: $event ?? undefined })"
        >
          @for (contract of store.contracts(); track contract.id) {
            <nz-option [nzValue]="contract.id" [nzLabel]="contract.code + ' ' + contract.name"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gdt-pr-status">
        <span>{{ 'gdoTradeTerms.field.status' | translate }}</span>
        <nz-select
          nzId="gdt-pr-status"
          nzAllowClear
          [nzPlaceHolder]="'gdoTradeTerms.action.all' | translate"
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="store.setFilters({ status: $event ?? undefined })"
        >
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="'gdoTradeTerms.promotionStatus.' + status | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gdt-pr-search">
        <span>{{ 'gdoTradeTerms.field.search' | translate }}</span>
        <input
          nz-input
          id="gdt-pr-search"
          maxlength="60"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keyup.enter)="store.setFilters({ q: search() || undefined })"
        />
      </label>
      <button nz-button type="button" (click)="store.setFilters({ q: search() || undefined })">
        {{ 'gdoTradeTerms.action.search' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.promotions()"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzFrontPagination]="false"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'gdoTradeTerms.field.promotion' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.contract' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.promotionType' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.period' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.dateBasis' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.contribution' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.status' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (promotion of table.data; track promotion.id) {
            <tr>
              <th scope="row">
                {{ promotion.code }}
                <small class="muted">{{ promotion.name }}</small>
              </th>
              <td>
                @if (promotion.contract; as contract) {
                  <a [routerLink]="['/gdo-trade-terms/contracts', contract.id]">{{ contract.code }}</a>
                }
              </td>
              <td>{{ 'gdoTradeTerms.promotionType.' + promotion.promotion_type | translate }}</td>
              <td>{{ promotion.starts_on }} – {{ promotion.ends_on }}</td>
              <td>{{ 'gdoTradeTerms.dateBasis.' + promotion.date_basis | translate }}</td>
              <td>
                {{ 'gdoTradeTerms.contributionMode.' + promotion.contribution_mode | translate }}:
                {{ contribution(promotion) }}
              </td>
              <td>
                <nz-tag [nzColor]="color(promotion.status)">{{ 'gdoTradeTerms.promotionStatus.' + promotion.status | translate }}</nz-tag>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7"><nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.promotions' | translate"></nz-empty></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>
  `,
})
export class PromotionsComponent implements OnInit {
  protected readonly store = inject(PromotionsStore);
  protected readonly statuses = GDT_PROMOTION_STATUSES;
  protected readonly search = signal('');
  protected color = promotionStatusColor;

  ngOnInit(): void {
    void this.store.init();
  }

  /** The value of the contribution as it reads in the contract: a rate, a unit amount or a fixed amount. */
  protected contribution(promotion: GdtPromotion): string {
    if (promotion.contribution_mode === 'fixed_amount') {
      return String(promotion.fixed_amount ?? '');
    }
    if (promotion.contribution_mode === 'per_unit') {
      return String(promotion.unit_amount ?? '');
    }
    if (promotion.contribution_mode === 'percent_of_sell_out' && promotion.unit_amount) {
      return String(promotion.unit_amount);
    }
    return `${promotion.rate_percent ?? ''}%`;
  }
}
