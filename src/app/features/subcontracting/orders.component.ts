import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PermissionsService,
  SCT_DIRECTIONS,
  SCT_STATUSES,
  SctDirection,
  SctOrder,
  SctOrderFilters,
  SctStatus,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { OrdersStore } from './orders.store';
import {
  directionColor,
  progressOf,
  SctOutcome,
  statusColor,
  SUBCONTRACTING_MODULE,
} from './subcontracting.util';

/** The subcontracting orders, passive and active: filter, open the workspace, confirm a draft or cancel an order not yet moved. */
@Component({
  selector: 'app-sct-orders',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [OrdersStore],
  styleUrl: './subcontracting.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.SUBCONTRACTING_ORDERS' | translate"
      [subtitle]="'subcontracting.orders.subtitle' | translate"
    >
      @if (canWrite) {
        <a
          nz-button
          nzType="primary"
          header-actions
          routerLink="/subcontracting/orders/new"
          data-test="new-order"
        >
          {{ 'subcontracting.action.newOrder' | translate }}
        </a>
      }
    </app-page-header>

    <div class="toolbar">
      <label class="field" for="sct-o-direction">
        <span>{{ 'subcontracting.field.direction' | translate }}</span>
        <nz-select nzId="sct-o-direction" nzAllowClear [(ngModel)]="direction" (ngModelChange)="reload()">
          @for (item of directions; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'subcontracting.direction.' + item | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="sct-o-status">
        <span>{{ 'subcontracting.field.status' | translate }}</span>
        <nz-select nzId="sct-o-status" nzAllowClear [(ngModel)]="status" (ngModelChange)="reload()">
          @for (item of statuses; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'subcontracting.status.' + item | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="sct-o-search">
        <span>{{ 'subcontracting.field.search' | translate }}</span>
        <input
          nz-input
          id="sct-o-search"
          maxlength="100"
          [(ngModel)]="search"
          (keyup.enter)="reload()"
          (blur)="reload()"
        />
      </label>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.errorKey ?? 'subcontracting.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzFrontPagination]="false"
        [nzData]="store.orders()"
        [nzTotal]="store.meta()?.total ?? 0"
        [nzPageSize]="store.filters().per_page ?? 25"
        [nzPageIndex]="store.meta()?.current_page ?? 1"
        (nzPageIndexChange)="goTo($event)"
        [nzScroll]="{ x: '1100px' }"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'subcontracting.field.orderNumber' | translate }}</th>
            <th scope="col">{{ 'subcontracting.field.direction' | translate }}</th>
            <th scope="col">{{ 'subcontracting.field.partner' | translate }}</th>
            <th scope="col">{{ 'subcontracting.field.outputProduct' | translate }}</th>
            <th scope="col" class="num">{{ 'subcontracting.field.plannedQuantity' | translate }}</th>
            <th scope="col">{{ 'subcontracting.field.progress' | translate }}</th>
            <th scope="col">{{ 'subcontracting.field.expectedReturnDate' | translate }}</th>
            <th scope="col">{{ 'subcontracting.field.status' | translate }}</th>
            <th scope="col">{{ 'subcontracting.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (order of table.data; track order.id) {
            <tr [attr.data-test]="'order-' + order.id">
              <th scope="row">
                <a [routerLink]="['/subcontracting/orders', order.id]">{{ order.order_number }}</a>
                <small class="muted">{{ 'subcontracting.type.' + order.subcontracting_type | translate }}</small>
              </th>
              <td>
                <nz-tag [nzColor]="directionColor(order.direction)">{{
                  'subcontracting.direction.' + order.direction | translate
                }}</nz-tag>
                @if (order.customs_regime !== 'none') {
                  <nz-tag nzColor="magenta">{{ 'subcontracting.customsRegime.' + order.customs_regime | translate }}</nz-tag>
                }
              </td>
              <td>{{ order.partner_name ?? order.partner_id }}</td>
              <td>
                {{ order.output_product_name ?? order.output_product_id }}
                <small class="muted">{{ order.output_product_sku }}</small>
              </td>
              <td class="num">{{ order.planned_quantity }}</td>
              <td>
                <nz-progress [nzPercent]="progress(order)" nzSize="small"></nz-progress>
              </td>
              <td>{{ order.expected_return_date | date: 'mediumDate' }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(order.status)">{{ 'subcontracting.status.' + order.status | translate }}</nz-tag>
              </td>
              <td class="row-actions">
                <a nz-button nzSize="small" [routerLink]="['/subcontracting/orders', order.id]">
                  {{ 'subcontracting.action.open' | translate }}
                </a>
                @if (canWrite && order.status === 'draft') {
                  <button nz-button nzSize="small" nzType="primary" type="button" data-test="confirm" (click)="confirm(order)">
                    {{ 'subcontracting.action.confirm' | translate }}
                  </button>
                }
                @if (canWrite && (order.status === 'draft' || order.status === 'confirmed')) {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    data-test="cancel"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'subcontracting.confirm.cancelOrder' | translate"
                    (nzOnConfirm)="cancel(order)"
                  >
                    {{ 'subcontracting.action.cancel' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.orders().length === 0) {
        <nz-empty [nzNotFoundContent]="'subcontracting.empty.orders' | translate"></nz-empty>
      }
    </nz-spin>
  `,
})
export class OrdersComponent implements OnInit {
  protected readonly store = inject(OrdersStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(SUBCONTRACTING_MODULE);
  protected readonly directions = SCT_DIRECTIONS;
  protected readonly statuses = SCT_STATUSES;
  protected readonly directionColor = directionColor;
  protected readonly statusColor = statusColor;
  protected readonly progress = progressOf;

  protected direction: SctDirection | null = null;
  protected status: SctStatus | null = null;
  protected search = '';

  protected readonly feedback = signal<SctOutcome | null>(null);

  ngOnInit(): void {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load(this.filters(1));
  }

  protected goTo(page: number): void {
    void this.store.load(this.filters(page));
  }

  private filters(page: number): SctOrderFilters {
    return {
      per_page: this.store.filters().per_page ?? 25,
      page,
      ...(this.direction ? { direction: this.direction } : {}),
      ...(this.status ? { status: this.status } : {}),
      ...(this.search.trim() ? { search: this.search.trim() } : {}),
    };
  }

  protected async confirm(order: SctOrder): Promise<void> {
    this.done(await this.store.confirm(order.id), 'subcontracting.message.confirmed');
  }

  protected async cancel(order: SctOrder): Promise<void> {
    this.done(await this.store.cancel(order.id), 'subcontracting.message.cancelled');
  }

  private done(outcome: SctOutcome, messageKey: string): void {
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant(messageKey));
    } else {
      this.feedback.set(outcome);
    }
  }
}
