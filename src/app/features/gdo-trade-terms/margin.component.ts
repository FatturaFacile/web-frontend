import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { GdtMarginRow } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { MarginStore } from './margin.store';
import { num, percentText } from './gdo-trade-terms.util';

/**
 * Net-net margin: the invoiced margin of the sales to GDO customers less the estimated off-invoice rebates (the year-end
 * projection of every scale) and the trade contributions earned, per product or per contract.
 */
@Component({
  selector: 'app-gdt-margin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [MarginStore],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.GDO_TRADE_TERMS_MARGIN' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="gdt-m-from">
        <span>{{ 'gdoTradeTerms.field.from' | translate }}</span>
        <input nz-input id="gdt-m-from" type="date" [ngModel]="store.filters().from" (ngModelChange)="store.setFilters({ from: $event })" />
      </label>
      <label class="field" for="gdt-m-to">
        <span>{{ 'gdoTradeTerms.field.to' | translate }}</span>
        <input nz-input id="gdt-m-to" type="date" [ngModel]="store.filters().to" (ngModelChange)="store.setFilters({ to: $event })" />
      </label>
      <label class="field" for="gdt-m-contract">
        <span>{{ 'gdoTradeTerms.field.contract' | translate }}</span>
        <nz-select
          nzId="gdt-m-contract"
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
      <label class="field" for="gdt-m-group">
        <span>{{ 'gdoTradeTerms.field.groupBy' | translate }}</span>
        <nz-select nzId="gdt-m-group" [ngModel]="store.filters().group_by ?? 'product'" (ngModelChange)="store.setFilters({ group_by: $event })">
          <nz-option nzValue="product" [nzLabel]="'gdoTradeTerms.groupBy.product' | translate"></nz-option>
          <nz-option nzValue="contract" [nzLabel]="'gdoTradeTerms.groupBy.contract' | translate"></nz-option>
        </nz-select>
      </label>
    </div>
    <p class="muted">{{ 'gdoTradeTerms.hint.marginEstimated' | translate }}</p>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.margin(); as margin) {
        <div class="stats-grid">
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.netSales' | translate }}</small>
            <strong>{{ margin.totals.net_sales | money }}</strong>
          </nz-card>
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.grossMargin' | translate }}</small>
            <strong>{{ margin.totals.gross_margin | money }} ({{ pct(margin.totals.gross_margin_percent) }})</strong>
          </nz-card>
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.offInvoiceRebates' | translate }}</small>
            <strong>{{ margin.totals.off_invoice_rebates | money }}</strong>
          </nz-card>
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.promotionContributions' | translate }}</small>
            <strong>{{ margin.totals.promotion_contributions | money }}</strong>
          </nz-card>
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.netNetMargin' | translate }}</small>
            <strong [class.negative]="negative(margin.totals)">{{ margin.totals.net_net_margin | money }} ({{ pct(margin.totals.net_net_margin_percent) }})</strong>
          </nz-card>
        </div>

        <nz-table #table nzSize="small" [nzData]="margin.rows" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ (margin.group_by === 'contract' ? 'gdoTradeTerms.field.contract' : 'gdoTradeTerms.field.product') | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.quantity' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.grossSales' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.onInvoiceDiscount' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.netSales' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.cost' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.grossMargin' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.offInvoiceRebates' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.promotionContributions' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.netNetMargin' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.key) {
              <tr>
                <th scope="row">{{ row.label }}</th>
                <td class="num">{{ row.quantity }}</td>
                <td class="num">{{ row.gross_sales | money }}</td>
                <td class="num">{{ row.on_invoice_discount | money }} <small class="muted">{{ pct(row.on_invoice_discount_percent) }}</small></td>
                <td class="num">{{ row.net_sales | money }}</td>
                <td class="num">{{ row.cost | money }}</td>
                <td class="num">{{ row.gross_margin | money }} <small class="muted">{{ pct(row.gross_margin_percent) }}</small></td>
                <td class="num">{{ row.off_invoice_rebates | money }}</td>
                <td class="num">{{ row.promotion_contributions | money }}</td>
                <td class="num" [class.negative]="negative(row)">{{ row.net_net_margin | money }} <small class="muted">{{ pct(row.net_net_margin_percent) }}</small></td>
              </tr>
            } @empty {
              <tr>
                <td colspan="10"><nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.margin' | translate"></nz-empty></td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-spin>
  `,
})
export class MarginComponent implements OnInit {
  protected readonly store = inject(MarginStore);
  protected pct = percentText;

  ngOnInit(): void {
    void this.store.init();
  }

  protected negative(row: GdtMarginRow): boolean {
    return num(row.net_net_margin) < 0;
  }
}
