import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DstInTransitFilters } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { formatQuantity } from './distribution.util';
import { InTransitStore } from './in-transit.store';

/** Goods in transit (merce in transito): live in-transit inventory by SKU, route, lot and expected arrival. */
@Component({
  selector: 'app-dst-in-transit',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [InTransitStore],
  styleUrl: './distribution.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.DISTRIBUTION_IN_TRANSIT' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="dst-i-item">
        <span>{{ 'distribution.field.item' | translate }}</span>
        <nz-select
          nzId="dst-i-item"
          nzShowSearch
          nzAllowClear
          [ngModel]="filters().stock_item_id ?? null"
          (ngModelChange)="patch({ stock_item_id: $event })"
        >
          @for (item of store.lookups()?.items ?? []; track item.id) {
            <nz-option [nzValue]="item.id" [nzLabel]="item.sku + ' ' + item.name"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="dst-i-source">
        <span>{{ 'distribution.field.source' | translate }}</span>
        <nz-select
          nzId="dst-i-source"
          nzShowSearch
          nzAllowClear
          [ngModel]="filters().source_warehouse_id ?? null"
          (ngModelChange)="patch({ source_warehouse_id: $event })"
        >
          @for (warehouse of store.lookups()?.warehouses ?? []; track warehouse.id) {
            <nz-option
              [nzValue]="warehouse.id"
              [nzLabel]="warehouse.code + ' ' + warehouse.name"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="dst-i-destination">
        <span>{{ 'distribution.field.destination' | translate }}</span>
        <nz-select
          nzId="dst-i-destination"
          nzShowSearch
          nzAllowClear
          [ngModel]="filters().destination_warehouse_id ?? null"
          (ngModelChange)="patch({ destination_warehouse_id: $event })"
        >
          @for (warehouse of store.lookups()?.warehouses ?? []; track warehouse.id) {
            <nz-option
              [nzValue]="warehouse.id"
              [nzLabel]="warehouse.code + ' ' + warehouse.name"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="dst-i-lot">
        <span>{{ 'distribution.field.lot' | translate }}</span>
        <input
          nz-input
          id="dst-i-lot"
          [ngModel]="filters().lot_id ?? ''"
          (ngModelChange)="patch({ lot_id: $event })"
        />
      </label>
      <label class="field" for="dst-i-eta">
        <span>{{ 'distribution.field.expectedTo' | translate }}</span>
        <input
          nz-input
          id="dst-i-eta"
          type="date"
          [ngModel]="filters().expected_to ?? ''"
          (ngModelChange)="patch({ expected_to: $event })"
        />
      </label>
      <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
      <label
        nz-checkbox
        [ngModel]="filters().overdue ?? false"
        (ngModelChange)="patch({ overdue: $event })"
        >{{ 'distribution.field.overdueOnly' | translate }}</label
      >
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <p class="muted">
      {{ 'distribution.kpi.unitsInTransit' | translate }}:
      <strong>{{ quantity(store.totalUnits()) }}</strong> ·
      {{ 'distribution.kpi.valueInTransit' | translate }}:
      <strong>{{ store.totalValue().toFixed(2) }}</strong>
    </p>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.lines()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '1000px' }"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'distribution.field.transfer' | translate }}</th>
            <th scope="col">{{ 'distribution.field.item' | translate }}</th>
            <th scope="col">{{ 'distribution.field.lot' | translate }}</th>
            <th scope="col">{{ 'distribution.field.route' | translate }}</th>
            <th scope="col" class="num">
              {{ 'distribution.field.quantityInTransit' | translate }}
            </th>
            <th scope="col" class="num">{{ 'distribution.field.value' | translate }}</th>
            <th scope="col">{{ 'distribution.field.expectedArrival' | translate }}</th>
            <th scope="col">{{ 'distribution.field.tracking' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.transfer_id + row.stock_item_id + (row.lot_id ?? '')) {
            <tr>
              <th scope="row">{{ row.transfer_number }}</th>
              <td>
                {{ row.sku }} <small class="muted">{{ row.name }}</small>
              </td>
              <td>{{ row.lot_number ?? '—' }}</td>
              <td>{{ row.source_warehouse.code }} → {{ row.destination_warehouse.code }}</td>
              <td class="num">{{ quantity(row.quantity_in_transit) }} {{ row.uom }}</td>
              <td class="num">{{ row.value }}</td>
              <td>
                <nz-tag [nzColor]="row.is_overdue ? 'red' : 'default'">{{
                  row.expected_arrival_date ?? '—'
                }}</nz-tag>
              </td>
              <td>{{ row.carrier ?? '' }} {{ row.tracking_number ?? '' }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8">
                <nz-empty
                  [nzNotFoundContent]="'distribution.empty.inTransit' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>
  `,
})
export class InTransitComponent implements OnInit {
  protected readonly store = inject(InTransitStore);
  protected readonly filters = signal<DstInTransitFilters>({});

  ngOnInit(): void {
    void this.store.init();
  }

  protected quantity(value: string | number): string {
    return formatQuantity(value);
  }

  protected patch(change: DstInTransitFilters): void {
    this.filters.update((current) => ({ ...current, ...change }));
    void this.store.setFilters(this.filters());
  }
}
