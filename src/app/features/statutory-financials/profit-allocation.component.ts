import { Component, computed, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { SfHiddenReservesState, SfJurisdiction, SfProfitAllocation } from '@core';
import { TranslatePipe } from '@shared';
import { formatAmount } from './statutory-financials.util';

/** The profit allocation proposal (legal reserve, dividends, carry forward) and, for the Swiss standards, the hidden reserves. */
@Component({
  selector: 'app-sf-profit-allocation',
  imports: [
    NzAlertModule,
    NzCardModule,
    NzDescriptionsModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  styleUrl: './statutory-financials.scss',
  template: `
    @if (proposal(); as p) {
      <nz-card
        class="main-card"
        [nzTitle]="'statutoryFinancials.section.profitAllocation' | translate"
      >
        <nz-descriptions nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 2, xl: 3 }">
          <nz-descriptions-item [nzTitle]="'statutoryFinancials.allocation.article' | translate">{{
            p.article
          }}</nz-descriptions-item>
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.allocation.netProfit' | translate"
            >{{ amount(p.net_profit) }}</nz-descriptions-item
          >
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.allocation.carriedForwardIn' | translate"
            >{{ amount(p.carried_forward_in) }}</nz-descriptions-item
          >
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.allocation.balanceSheetProfit' | translate"
            >{{ amount(p.balance_sheet_profit) }}</nz-descriptions-item
          >
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.allocation.shareCapital' | translate"
            >{{ amount(p.share_capital) }}</nz-descriptions-item
          >
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.allocation.legalReserveCap' | translate"
            >{{ amount(p.legal_reserve_cap) }}</nz-descriptions-item
          >
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.allocation.legalReserveExisting' | translate"
            >{{ amount(p.legal_reserve_existing) }}</nz-descriptions-item
          >
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.allocation.legalReserveRoom' | translate"
            >{{ amount(p.legal_reserve_room) }}</nz-descriptions-item
          >
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.allocation.legalReserveAllocation' | translate"
          >
            {{ amount(p.legal_reserve_allocation) }}
            @if (p.legal_reserve_cap_reached) {
              <nz-tag nzColor="gold">{{
                'statutoryFinancials.allocation.capReached' | translate
              }}</nz-tag>
            }
          </nz-descriptions-item>
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.allocation.dividends' | translate"
            >{{ amount(p.dividends) }}</nz-descriptions-item
          >
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.allocation.otherReserves' | translate"
            >{{ amount(p.other_reserves) }}</nz-descriptions-item
          >
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.allocation.carriedForwardOut' | translate"
            >{{ amount(p.carried_forward_out) }}</nz-descriptions-item
          >
        </nz-descriptions>
        @for (warning of p.warnings; track warning) {
          <nz-alert class="feedback" nzType="warning" nzShowIcon [nzMessage]="warning"></nz-alert>
        }
      </nz-card>
    }

    @if (result(); as r) {
      <nz-card
        class="main-card"
        [nzTitle]="'statutoryFinancials.section.hiddenReserves' | translate"
      >
        <nz-descriptions nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 2, xl: 3 }">
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.hidden.totalReserves' | translate"
            >{{ amount(r.total_hidden_reserves) }}</nz-descriptions-item
          >
          <nz-descriptions-item [nzTitle]="'statutoryFinancials.hidden.deferredTax' | translate">{{
            amount(r.deferred_tax_on_reserves)
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'statutoryFinancials.hidden.netRelease' | translate">{{
            amount(r.net_release)
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'statutoryFinancials.hidden.statutoryView' | translate">
            {{ 'statutoryFinancials.hidden.equity' | translate }}
            {{ amount(r.statutory_view.equity) }} ·
            {{ 'statutoryFinancials.hidden.profit' | translate }}
            {{ amount(r.statutory_view.profit) }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'statutoryFinancials.hidden.ferView' | translate">
            {{ 'statutoryFinancials.hidden.equity' | translate }} {{ amount(r.fer_view.equity) }} ·
            {{ 'statutoryFinancials.hidden.profit' | translate }} {{ amount(r.fer_view.profit) }}
          </nz-descriptions-item>
          <nz-descriptions-item
            [nzTitle]="'statutoryFinancials.hidden.anhangDisclosure' | translate"
          >
            <nz-tag [nzColor]="r.anhang_disclosure_required ? 'orange' : 'default'">
              {{
                (r.anhang_disclosure_required
                  ? 'statutoryFinancials.hidden.required'
                  : 'statutoryFinancials.hidden.notRequired'
                ) | translate
              }}
            </nz-tag>
          </nz-descriptions-item>
        </nz-descriptions>
        @if (r.items.length > 0) {
          <nz-table
            class="feedback"
            nzSize="small"
            [nzData]="r.items"
            [nzFrontPagination]="false"
            [nzShowPagination]="false"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'statutoryFinancials.field.itemLabel' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'statutoryFinancials.field.bookValue' | translate }}
                </th>
                <th scope="col" class="num">
                  {{ 'statutoryFinancials.field.ferValue' | translate }}
                </th>
                <th scope="col" class="num">
                  {{ 'statutoryFinancials.hidden.reserve' | translate }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (item of r.items; track $index) {
                <tr>
                  <th scope="row">{{ item.label }}</th>
                  <td class="num">{{ amount(item.book_value) }}</td>
                  <td class="num">{{ amount(item.fer_value) }}</td>
                  <td class="num">{{ amount(item.hidden_reserve) }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
        @for (warning of r.warnings; track warning) {
          <nz-alert class="feedback" nzType="warning" nzShowIcon [nzMessage]="warning"></nz-alert>
        }
      </nz-card>
    }
  `,
})
export class ProfitAllocationComponent {
  readonly proposal = input<SfProfitAllocation | null>(null);
  readonly hiddenReserves = input<SfHiddenReservesState | null>(null);
  readonly jurisdiction = input<SfJurisdiction>('IT');
  readonly scale = input<number>(2);

  /** The hidden reserves result, only when the Swiss standard enabled the calculation. */
  protected readonly result = computed(() => {
    const result = this.hiddenReserves()?.result;
    return result?.enabled ? result : null;
  });

  protected amount(value: string | null | undefined): string {
    return formatAmount(value, this.jurisdiction(), this.scale());
  }
}
