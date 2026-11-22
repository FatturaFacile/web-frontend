import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  GelatoApiService,
  GelatoGanacheResult,
  GelatoIngredient,
  GelatoOrder,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { gelatoProblem, localizedName } from './gelato.util';

interface GanacheLine {
  ingredient_id: string | null;
  grams: number;
}

/** Reference tempering curves [melt, pre-crystallize, work] in °C. */
export const TEMPERING_CURVES: Readonly<Record<string, readonly [string, string, string]>> = {
  dark: ['45–50', '27–28', '31–32'],
  milk: ['40–45', '26–27', '29–30.5'],
  white: ['40–45', '25–26', '28–29'],
};

/** Ganache studio (water activity and shelf life), tempering guide and the praline box / cake / tub pre-orders. */
@Component({
  selector: 'app-gelato-ganache',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'GELATO.GANACHE.TITLE' | translate" />

    <nz-card>
      @for (line of lines(); track $index; let i = $index) {
        <div class="ganache-line">
          <nz-select nzShowSearch class="ganache-ingredient" [ngModel]="line.ingredient_id" (ngModelChange)="setIngredient(i, $event)">
            @for (ingredient of ingredients(); track ingredient.id) {
              <nz-option [nzValue]="ingredient.id" [nzLabel]="label(ingredient)" />
            }
          </nz-select>
          <nz-input-number [ngModel]="line.grams" (ngModelChange)="setGrams(i, $event)" [nzMin]="0" />
        </div>
      }
      <button nz-button nzType="dashed" (click)="addLine()">{{ 'GELATO.ADD_LINE' | translate }}</button>
      <button nz-button nzType="primary" (click)="calculate()">{{ 'GELATO.AUTO_BALANCE.RUN' | translate }}</button>

      @if (result(); as r) {
        <dl class="ganache-result">
          <dt>{{ 'GELATO.GANACHE.AW' | translate }}</dt>
          <dd>{{ r.water_activity }}</dd>
          <dt>{{ 'GELATO.GANACHE.SHELF_LIFE' | translate }}</dt>
          <dd>{{ r.shelf_life_days }} <nz-tag>{{ 'GELATO.RISK.' + r.risk_band | translate }}</nz-tag></dd>
        </dl>
      }
    </nz-card>

    <nz-card [nzTitle]="'GELATO.GANACHE.TEMPERING' | translate">
      <nz-table #curves [nzData]="curveRows" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th></th>
            <th>{{ 'GELATO.GANACHE.MELT' | translate }} °C</th>
            <th>{{ 'GELATO.GANACHE.COOL' | translate }} °C</th>
            <th>{{ 'GELATO.GANACHE.WORK' | translate }} °C</th>
          </tr>
        </thead>
        <tbody>
          @for (row of curveRows; track row.type) {
            <tr>
              <td>{{ 'GELATO.GANACHE.' + row.type.toUpperCase() | translate }}</td>
              <td>{{ row.curve[0] }}</td>
              <td>{{ row.curve[1] }}</td>
              <td>{{ row.curve[2] }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card [nzTitle]="'GELATO.ORDERS.TITLE' | translate">
      <nz-table #orders [nzData]="orderList()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>#</th>
            <th>{{ 'GELATO.ORDERS.CUSTOMER' | translate }}</th>
            <th>{{ 'GELATO.ORDERS.PRICE' | translate }}</th>
            <th>{{ 'GELATO.ORDERS.PICKUP' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (order of orderList(); track order.id) {
            <tr>
              <td>{{ order.order_number }} <nz-tag>{{ 'GELATO.ORDERS.' + order.kind.toUpperCase() | translate }}</nz-tag></td>
              <td>{{ order.customer_name }}</td>
              <td>{{ order.total_price }}</td>
              <td>{{ order.pickup_at }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .ganache-line { display: flex; gap: 12px; margin-bottom: 8px; }
    .ganache-ingredient { min-width: 280px; }
    .ganache-result { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; margin-top: 12px; }
    .ganache-result dd { margin: 0; font-weight: 600; }
  `,
})
export class GelatoGanacheComponent implements OnInit {
  private readonly api = inject(GelatoApiService);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);

  readonly curveRows = Object.entries(TEMPERING_CURVES).map(([type, curve]) => ({ type, curve }));
  readonly ingredients = signal<GelatoIngredient[]>([]);
  readonly lines = signal<GanacheLine[]>([{ ingredient_id: null, grams: 0 }]);
  readonly result = signal<GelatoGanacheResult | null>(null);
  readonly orderList = signal<GelatoOrder[]>([]);

  ngOnInit(): void {
    this.api.getIngredients().subscribe({
      next: (response) => this.ingredients.set(response.data),
      error: () => this.message.error(this.translate.instant('GELATO.LOAD_ERROR')),
    });
    this.api.getOrders().subscribe({ next: (response) => this.orderList.set(response.data) });
  }

  label(ingredient: GelatoIngredient): string {
    return `${localizedName(ingredient.name, this.translate.currentLanguage() as 'it')} (${ingredient.code})`;
  }

  addLine(): void {
    this.lines.update((lines) => [...lines, { ingredient_id: null, grams: 0 }]);
  }

  setIngredient(index: number, id: string | null): void {
    this.lines.update((lines) => lines.map((line, i) => (i === index ? { ...line, ingredient_id: id } : line)));
  }

  setGrams(index: number, grams: number | null): void {
    this.lines.update((lines) => lines.map((line, i) => (i === index ? { ...line, grams: grams ?? 0 } : line)));
  }

  calculate(): void {
    const usable = this.lines()
      .filter((line) => line.ingredient_id && line.grams > 0)
      .map((line) => ({ ingredient_id: line.ingredient_id, grams: line.grams }));
    if (usable.length === 0) return;
    this.api.calculateGanache(usable).subscribe({
      next: (response) => this.result.set(response.data),
      error: (error) => this.message.error(gelatoProblem(error, this.translate.instant('GELATO.LOAD_ERROR'))),
    });
  }
}
