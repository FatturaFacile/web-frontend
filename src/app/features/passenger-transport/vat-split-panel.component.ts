import { Component, computed, input } from '@angular/core';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { PtrJurisdiction, PtrQuote } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { kmShares, toNumber } from './passenger-transport.util';

/**
 * The live breakdown of a cross-border fare before saving: the kilometres driven in Italy, in Switzerland and elsewhere, and the
 * VAT split line by line (10 % Italian VAT, outside the Italian territory under Art. 7-quater, 8.1 % Swiss MWST, exemptions).
 */
@Component({
  selector: 'app-ptr-vat-split-panel',
  imports: [MoneyPipe, NzEmptyModule, NzSpinModule, NzTableModule, TranslatePipe],
  styleUrl: './passenger-transport.scss',
  template: `
    <nz-spin [nzSpinning]="quoting()">
      @if (quote(); as current) {
        <div class="section-title">{{ 'passengerTransport.section.kilometres' | translate }}</div>
        <div
          class="km-bar"
          role="img"
          [attr.aria-label]="'passengerTransport.hint.kmBar' | translate: kmLabels()"
        >
          @if (shares().it > 0) {
            <span class="it" [style.width.%]="shares().it">IT {{ shares().it }}%</span>
          }
          @if (shares().ch > 0) {
            <span class="ch" [style.width.%]="shares().ch">CH {{ shares().ch }}%</span>
          }
          @if (shares().other > 0) {
            <span class="other" [style.width.%]="shares().other">{{ shares().other }}%</span>
          }
        </div>
        <div class="legend">
          <span
            >{{ 'passengerTransport.field.itKm' | translate }}:
            {{ current.route.it_territory_km }}</span
          >
          <span
            >{{ 'passengerTransport.field.chKm' | translate }}:
            {{ current.route.ch_territory_km }}</span
          >
          @if (otherKm() > 0) {
            <span
              >{{ 'passengerTransport.field.otherKm' | translate }}:
              {{ current.route.other_eu_territory_km }}</span
            >
          }
          <span
            >{{ 'passengerTransport.field.totalKm' | translate }}:
            {{ current.route.total_distance_km }}</span
          >
          <span
            >{{ 'passengerTransport.field.borderCrossing' | translate }}:
            {{
              'passengerTransport.borderCrossing.' + current.route.border_crossing_point | translate
            }}</span
          >
        </div>

        <div class="section-title">{{ 'passengerTransport.section.vatSplit' | translate }}</div>
        <nz-table #table nzSize="small" [nzData]="current.vat.lines" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ 'passengerTransport.field.territory' | translate }}</th>
              <th scope="col" class="num">{{ 'passengerTransport.field.km' | translate }}</th>
              <th scope="col" class="num">{{ 'passengerTransport.field.net' | translate }}</th>
              <th scope="col" class="num">{{ 'passengerTransport.field.vatRate' | translate }}</th>
              <th scope="col" class="num">{{ 'passengerTransport.field.vat' | translate }}</th>
              <th scope="col">{{ 'passengerTransport.field.nature' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of table.data; track line.kind) {
              <tr>
                <th scope="row">
                  {{ 'passengerTransport.vatLineKind.' + line.kind | translate }}
                  <small class="muted">{{ line.legal_reference }}</small>
                </th>
                <td class="num">{{ line.km }}</td>
                <td class="num">{{ line.net | money: current.vat.currency }}</td>
                <td class="num">{{ line.rate }} %</td>
                <td class="num">{{ line.tax | money: current.vat.currency }}</td>
                <td>{{ line.nature ?? '—' }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colspan="2">{{ 'passengerTransport.field.total' | translate }}</th>
              <td class="num">{{ current.vat.total_net | money: current.vat.currency }}</td>
              <td></td>
              <td class="num">{{ current.vat.total_tax | money: current.vat.currency }}</td>
              <td class="num">{{ current.vat.total_gross | money: current.vat.currency }}</td>
            </tr>
          </tfoot>
        </nz-table>
        @if (commission() > 0) {
          <p class="muted">
            {{ 'passengerTransport.field.conciergeCommission' | translate }}:
            {{ current.hotel_concierge_commission_amount | money: current.vat.currency }}
          </p>
        }
        @if (jurisdiction() === 'IT') {
          <p class="muted">{{ 'passengerTransport.hint.vatItaly' | translate }}</p>
        } @else {
          <p class="muted">{{ 'passengerTransport.hint.vatSwitzerland' | translate }}</p>
        }
      } @else {
        <nz-empty [nzNotFoundContent]="'passengerTransport.empty.quote' | translate"></nz-empty>
      }
    </nz-spin>
  `,
})
export class VatSplitPanelComponent {
  readonly quote = input<PtrQuote | null>(null);
  readonly quoting = input(false);
  readonly jurisdiction = input<PtrJurisdiction>('IT');

  protected readonly shares = computed(() => {
    const route = this.quote()?.route;
    return kmShares(route?.it_territory_km, route?.ch_territory_km, route?.other_eu_territory_km);
  });
  protected readonly otherKm = computed(() => toNumber(this.quote()?.route.other_eu_territory_km));
  protected readonly commission = computed(() =>
    toNumber(this.quote()?.hotel_concierge_commission_amount),
  );
  protected readonly kmLabels = computed(() => ({
    it: this.shares().it,
    ch: this.shares().ch,
    other: this.shares().other,
  }));
}
