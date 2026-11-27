import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AtpStore } from './atp.store';
import { formatQuantity, toNumber } from './distribution.util';

/** Available-to-promise per sales channel: the item x channel matrix and the breakdown of one item per channel and warehouse. */
@Component({
  selector: 'app-dst-atp',
  imports: [
    FormsModule,
    NzAlertModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [AtpStore],
  styleUrl: './distribution.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.DISTRIBUTION_ATP' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <h3>{{ 'distribution.section.atpMatrix' | translate }}</h3>
      @if (store.matrix(); as matrix) {
        <nz-table
          #table
          nzSize="small"
          [nzData]="matrix.rows"
          [nzShowPagination]="false"
          [nzScroll]="{ x: '700px' }"
        >
          <thead>
            <tr>
              <th scope="col">{{ 'distribution.field.item' | translate }}</th>
              @for (channel of matrix.channels; track channel.id) {
                <th scope="col" class="num">{{ channel.code }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.stock_item_id) {
              <tr>
                <th scope="row">
                  <a
                    role="button"
                    tabindex="0"
                    (click)="inspect(row.stock_item_id)"
                    (keydown.enter)="inspect(row.stock_item_id)"
                    >{{ row.sku }}</a
                  >
                  <small class="muted">{{ row.name }}</small>
                </th>
                @for (channel of matrix.channels; track channel.id) {
                  <td class="num" [class.atp-low]="toNumber(row.cells[channel.id]) <= 0">
                    {{ quantity(row.cells[channel.id] ?? 0) }}
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="matrix.channels.length + 1">
                  <nz-empty [nzNotFoundContent]="'distribution.empty.atp' | translate"></nz-empty>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }

      <h3>{{ 'distribution.section.atpBreakdown' | translate }}</h3>
      <div class="toolbar">
        <label class="field" for="dst-atp-item">
          <span>{{ 'distribution.field.item' | translate }}</span>
          <nz-select
            nzId="dst-atp-item"
            nzShowSearch
            nzAllowClear
            [ngModel]="store.stockItemId()"
            (ngModelChange)="inspect($event)"
          >
            @for (item of store.lookups()?.items ?? []; track item.id) {
              <nz-option [nzValue]="item.id" [nzLabel]="item.sku + ' ' + item.name"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="dst-atp-channel">
          <span>{{ 'distribution.field.channel' | translate }}</span>
          <nz-select
            nzId="dst-atp-channel"
            nzAllowClear
            [ngModel]="store.salesChannelId()"
            (ngModelChange)="inspect(store.stockItemId(), $event)"
          >
            @for (channel of store.channels(); track channel.id) {
              <nz-option
                [nzValue]="channel.id"
                [nzLabel]="channel.code + ' ' + channel.name"
              ></nz-option>
            }
          </nz-select>
        </label>
      </div>

      @if (store.breakdown(); as atp) {
        @for (channel of atp.channels; track channel.sales_channel_id) {
          <section class="main-card">
            <h4>
              {{ channel.code }} {{ channel.name }} —
              <strong [class.atp-low]="toNumber(channel.atp) <= 0"
                >{{ 'distribution.field.atp' | translate }}: {{ quantity(channel.atp) }}</strong
              >
            </h4>
            <nz-table
              #wTable
              nzSize="small"
              [nzData]="channel.warehouses"
              [nzShowPagination]="false"
              [nzScroll]="{ x: '700px' }"
            >
              <thead>
                <tr>
                  <th scope="col">{{ 'distribution.field.warehouse' | translate }}</th>
                  <th scope="col" class="num">{{ 'distribution.field.onHand' | translate }}</th>
                  <th scope="col" class="num">{{ 'distribution.field.reserved' | translate }}</th>
                  <th scope="col" class="num">
                    {{ 'distribution.field.inTransitInbound' | translate }}
                  </th>
                  <th scope="col" class="num">{{ 'distribution.field.ringFenced' | translate }}</th>
                  <th scope="col" class="num">{{ 'distribution.field.atp' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of wTable.data; track row.warehouse_id) {
                  <tr>
                    <th scope="row">{{ row.code }} {{ row.name }}</th>
                    <td class="num">{{ quantity(row.on_hand) }}</td>
                    <td class="num">{{ quantity(row.reserved) }}</td>
                    <td class="num">{{ quantity(row.in_transit_inbound) }}</td>
                    <td class="num">{{ quantity(row.ring_fenced) }}</td>
                    <td class="num">{{ quantity(row.atp) }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{{ 'distribution.field.total' | translate }}</th>
                  <td class="num">{{ quantity(channel.on_hand) }}</td>
                  <td class="num">{{ quantity(channel.reserved) }}</td>
                  <td class="num">{{ quantity(channel.in_transit_inbound) }}</td>
                  <td class="num">{{ quantity(channel.ring_fenced) }}</td>
                  <td class="num">{{ quantity(channel.atp) }}</td>
                </tr>
              </tfoot>
            </nz-table>
          </section>
        }
      } @else {
        <nz-empty [nzNotFoundContent]="'distribution.hint.pickItem' | translate"></nz-empty>
      }
    </nz-spin>
  `,
})
export class AtpComponent implements OnInit {
  protected readonly store = inject(AtpStore);
  protected readonly toNumber = toNumber;

  ngOnInit(): void {
    void this.store.init();
  }

  protected quantity(value: string | number): string {
    return formatQuantity(value);
  }

  protected inspect(stockItemId: string | null, salesChannelId: string | null = null): void {
    void this.store.inspect(stockItemId ?? null, salesChannelId ?? null);
  }
}
