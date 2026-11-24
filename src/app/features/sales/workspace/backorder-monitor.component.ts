import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from '../cycle/shared/sales-api-helpers';
import { SalesWorkspaceApiService } from './sales-workspace-api.service';
import { atpBadge } from './sales-workspace.logic';
import { BackorderMonitorRow } from './sales-workspace.models';

/** Backorder and ATP shortage monitor for the supply chain planners, with one-click replenishment and ATP re-evaluation. */
@Component({
  selector: 'app-backorder-monitor',
  imports: [
    DecimalPipe,
    NzButtonModule,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'SWK.MON.TITLE' | translate"
      [subtitle]="'SWK.MON.SUBTITLE' | translate"
    />

    <nz-card>
      <nz-table
        #table
        nzSize="small"
        [nzData]="rows()"
        [nzLoading]="loading()"
        [nzShowPagination]="false"
      >
        <thead>
          <tr>
            <th>{{ 'SWK.COL.NUMBER' | translate }}</th>
            <th>{{ 'SWK.COL.CUSTOMER' | translate }}</th>
            <th>{{ 'SWK.COL.PRODUCT' | translate }}</th>
            <th class="num">{{ 'SWK.COL.OPEN' | translate }}</th>
            <th>{{ 'SWK.COL.ATP' | translate }}</th>
            <th>{{ 'SWK.MON.PROMISED' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (r of table.data; track r.sales_order_item_id) {
            <tr>
              <td>
                <a (click)="open(r)" (keydown.enter)="open(r)" tabindex="0" role="link"
                  ><code>{{ r.order_number }}</code></a
                >
                @if (r.is_backorder) {
                  <nz-tag nzColor="gold">{{ 'SWK.ORDERS.BACKORDER' | translate }}</nz-tag>
                }
              </td>
              <td>{{ r.customer_name }}</td>
              <td>{{ r.description }}</td>
              <td class="num">{{ r.open_quantity | number: '1.0-4' }}</td>
              <td>
                <nz-tag [nzColor]="badge(r).color">{{ badge(r).labelKey | translate }}</nz-tag>
              </td>
              <td>{{ r.atp_promised_date ?? '-' }}</td>
              <td class="row-actions">
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [disabled]="r.replenishment_triggered || working()"
                  (click)="replenish(r)"
                >
                  {{ 'SWK.MON.TRIGGER' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [disabled]="working()"
                  (click)="reevaluate(r)"
                >
                  {{ 'SWK.MON.REEVALUATE' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .row-actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
  `,
})
export class BackorderMonitorComponent {
  private readonly api = inject(SalesWorkspaceApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = signal<BackorderMonitorRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly working = signal(false);

  constructor() {
    this.load();
  }

  protected badge(row: BackorderMonitorRow) {
    return atpBadge(row.atp_status);
  }

  protected open(row: BackorderMonitorRow): void {
    void this.router.navigate(['/sales/workspace/orders', row.sales_order_id]);
  }

  protected replenish(row: BackorderMonitorRow): void {
    this.run(this.api.generateReplenishment(row.sales_order_id), 'SWK.MSG.REPLENISHED');
  }

  protected reevaluate(row: BackorderMonitorRow): void {
    this.run(this.api.reevaluateAtp(row.sales_order_id), 'SWK.MSG.ATP_REEVALUATED');
  }

  private run(
    call: ReturnType<SalesWorkspaceApiService['generateReplenishment']>,
    successKey: string,
  ): void {
    this.working.set(true);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.working.set(false);
        this.message.success(this.i18n.translate(successKey));
        this.load();
      },
      error: (err: unknown) => {
        this.working.set(false);
        this.message.error(apiErrorText(err) || this.i18n.translate('SWK.MSG.ERROR'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .backorders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.loading.set(false);
        },
        error: () => {
          this.rows.set([]);
          this.loading.set(false);
        },
      });
  }
}
