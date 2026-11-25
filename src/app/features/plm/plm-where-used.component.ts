import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, of } from 'rxjs';
import { PlmApiService, PlmOption, PlmWhereUsedImpactResult, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/**
 * Multi-Level Where-Used Impact Analyzer: displays upward parent assemblies,
 * open Purchase Orders, open Production Orders, and Warehouse Stock & Lots.
 */
@Component({
  selector: 'app-plm-where-used',
  styleUrl: './plm.scss',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'PLM.WHERE_USED_TITLE' | translate" [subtitle]="'PLM.WHERE_USED_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select style="width: 340px" nzShowSearch [ngModel]="itemId()" (ngModelChange)="itemId.set($event)" [nzPlaceHolder]="'PLM.ITEM' | translate">
        @for (item of items(); track item.id) {
          <nz-option [nzValue]="item.id" [nzLabel]="item.label"></nz-option>
        }
      </nz-select>
      <button nz-button nzType="primary" type="button" [disabled]="!itemId()" [nzLoading]="loading()" (click)="analyze()">
        {{ 'PLM.ANALYZE_IMPACT' | translate }}
      </button>
    </div>

    @if (impact(); as current) {
      <nz-card class="main-card" [nzTitle]="'PLM.WHERE_USED_PARENTS' | translate">
        <nz-table [nzData]="current.parents" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLM.ITEM' | translate }}</th>
              <th>{{ 'PLM.BOM' | translate }}</th>
              <th>{{ 'PLM.REVISION' | translate }}</th>
              <th class="num">{{ 'PLM.AFFECTED' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (parent of current.parents; track $index) {
              <tr>
                <td>
                  <span [style.padding-left.px]="(parent.level - 1) * 18">
                    {{ parent.parent_item_code }} — {{ parent.parent_item_name }}
                  </span>
                </td>
                <td>{{ parent.bom_number }}</td>
                <td>{{ parent.revision }}</td>
                <td class="num">{{ parent.cumulative_coefficient }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'PLM.WHERE_USED_OPEN_POS' | translate">
        <nz-table [nzData]="current.open_purchase_orders" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLM.CODE' | translate }}</th>
              <th>{{ 'PLM.ITEM' | translate }}</th>
              <th>{{ 'PLM.STATUS' | translate }}</th>
              <th class="num">{{ 'PLM.AFFECTED' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (po of current.open_purchase_orders; track po.purchase_order_id) {
              <tr>
                <td>{{ po.order_number }}</td>
                <td>{{ po.item_code }} — {{ po.item_name }}</td>
                <td><nz-tag nzColor="blue">{{ po.status }}</nz-tag></td>
                <td class="num">{{ po.open_quantity }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'PLM.WHERE_USED_OPEN_MOS' | translate">
        <nz-table [nzData]="current.open_production_orders" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLM.CODE' | translate }}</th>
              <th>{{ 'PLM.ITEM' | translate }}</th>
              <th>{{ 'PLM.STATUS' | translate }}</th>
              <th class="num">{{ 'PLM.AFFECTED' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (mo of current.open_production_orders; track mo.production_order_id) {
              <tr>
                <td>{{ mo.order_number }}</td>
                <td>{{ mo.item_code }} — {{ mo.item_name }}</td>
                <td><nz-tag nzColor="orange">{{ mo.status }}</nz-tag></td>
                <td class="num">{{ mo.remaining_quantity }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'PLM.WHERE_USED_STOCK_LOTS' | translate">
        <nz-table [nzData]="current.warehouse_stock_lots" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLM.ITEM' | translate }}</th>
              <th>{{ 'PLM.CUTOVER_LOT' | translate }}</th>
              <th>{{ 'PLM.STATUS' | translate }}</th>
              <th class="num">{{ 'PLM.AFFECTED' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (lot of current.warehouse_stock_lots; track lot.stock_quant_id) {
              <tr>
                <td>{{ lot.item_code }} — {{ lot.item_name }}</td>
                <td>{{ lot.lot_code ?? '-' }}</td>
                <td>
                  @if (lot.is_quarantined) {
                    <nz-tag nzColor="red">{{ 'PLM.QUARANTINED' | translate }}</nz-tag>
                  } @else {
                    <nz-tag nzColor="green">{{ 'PLM.STATUS_APPROVED' | translate }}</nz-tag>
                  }
                </td>
                <td class="num">{{ lot.quantity_available }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    } @else {
      <nz-empty [nzNotFoundContent]="'PLM.WHERE_USED_SUBTITLE' | translate"></nz-empty>
    }
  `,
})
export class PlmWhereUsedComponent implements OnInit {
  private readonly api = inject(PlmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly items = signal<PlmOption[]>([]);
  readonly itemId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly impact = signal<PlmWhereUsedImpactResult | null>(null);

  ngOnInit(): void {
    this.api
      .getItemOptions()
      .pipe(catchError(() => of([])))
      .subscribe((items) => this.items.set(items));
  }

  analyze(): void {
    const id = this.itemId();
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.api.getWhereUsedImpact(id).subscribe({
      next: (res) => {
        this.impact.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PLM.ACTION_ERROR'));
      },
    });
  }
}
