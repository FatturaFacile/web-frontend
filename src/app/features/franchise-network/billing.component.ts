import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FRN_SELL_OUT_SOURCES,
  FrnSellOutPayload,
  FrnStatement,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { BillingStore } from './billing.store';
import {
  FRANCHISE_NETWORK_MANAGE_MODULE,
  FrnOutcome,
  isPeriod,
  statementStatusColor,
} from './franchise-network.util';

/**
 * Monthly royalty and marketing fund billing: the net sell-out reported by the stores' POS and fiscal printers, the run with the
 * statement of every store (progressive royalty, start-up relief, minimum guarantee, marketing fund, cross-store loyalty
 * settlement), the invoices of the franchisor and the SEPA SDD / LSV+ collection batches.
 */
@Component({
  selector: 'app-frn-billing',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [BillingStore],
  styleUrl: './franchise-network.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.FRANCHISE_NETWORK_BILLING' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="frn-b-period">
        <span>{{ 'franchiseNetwork.field.period' | translate }}</span>
        <input id="frn-b-period" type="month" [ngModel]="store.period()" (ngModelChange)="onPeriod($event)" />
      </label>
      <span class="spacer"></span>
      @if (canManage) {
        <button nz-button type="button" (click)="openSellOut()">
          {{ 'franchiseNetwork.action.recordSellOut' | translate }}
        </button>
        <button nz-button type="button" [nzLoading]="store.saving()" (click)="run(store.calculate())">
          {{ 'franchiseNetwork.action.calculateRun' | translate }}
        </button>
        @if (store.run(); as current) {
          @if (current.status === 'calculated') {
            <button
              nz-button
              nzType="primary"
              type="button"
              nz-popconfirm
              [nzPopconfirmTitle]="'franchiseNetwork.confirm.invoiceRun' | translate"
              [nzOkText]="'franchiseNetwork.action.confirm' | translate"
              [nzCancelText]="'franchiseNetwork.action.cancel' | translate"
              (nzOnConfirm)="run(store.invoice())"
            >
              {{ 'franchiseNetwork.action.invoiceRun' | translate }}
            </button>
          }
        }
      }
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
        [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.run(); as current) {
        <div class="stats-grid">
          <nz-card class="main-card" [nzTitle]="'franchiseNetwork.field.royalty' | translate">
            <span class="kpi-value">{{ current.total_royalty }}</span> {{ current.currency }}
          </nz-card>
          <nz-card class="main-card" [nzTitle]="'franchiseNetwork.field.marketingFund' | translate">
            <span class="kpi-value">{{ current.total_marketing }}</span> {{ current.currency }}
          </nz-card>
          <nz-card class="main-card" [nzTitle]="'franchiseNetwork.field.minimumAdjustment' | translate">
            <span class="kpi-value">{{ current.total_minimum_adjustment }}</span> {{ current.currency }}
          </nz-card>
          <nz-card class="main-card" [nzTitle]="'franchiseNetwork.field.loyaltySettlement' | translate">
            <span class="kpi-value">{{ current.total_loyalty_settlement }}</span> {{ current.currency }}
          </nz-card>
          <nz-card class="main-card" [nzTitle]="'franchiseNetwork.field.totalNet' | translate">
            <span class="kpi-value">{{ current.total_net }}</span> {{ current.currency }}
            <nz-tag [nzColor]="current.status === 'invoiced' ? 'green' : 'blue'">{{
              'franchiseNetwork.runStatus.' + current.status | translate
            }}</nz-tag>
          </nz-card>
        </div>

        <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.statements' | translate">
          <nz-table #statements nzSize="small" [nzData]="current.statements ?? []" [nzShowPagination]="false" [nzScroll]="{ x: '1200px' }">
            <thead>
              <tr>
                <th scope="col">{{ 'franchiseNetwork.field.store' | translate }}</th>
                <th scope="col" class="num">{{ 'franchiseNetwork.field.netSales' | translate }}</th>
                <th scope="col" class="num">{{ 'franchiseNetwork.field.royaltyAfterStartup' | translate }}</th>
                <th scope="col" class="num">{{ 'franchiseNetwork.field.minimumAdjustment' | translate }}</th>
                <th scope="col" class="num">{{ 'franchiseNetwork.field.marketingFund' | translate }}</th>
                <th scope="col" class="num">{{ 'franchiseNetwork.field.loyaltySettlement' | translate }}</th>
                <th scope="col" class="num">{{ 'franchiseNetwork.field.totalNet' | translate }}</th>
                <th scope="col">{{ 'franchiseNetwork.field.status' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of statements.data; track row.id) {
                <tr>
                  <th scope="row">
                    {{ row.store_code }} <small class="muted">{{ row.store_name }}</small>
                    @if (row.status === 'calculated' && factor(row) < 1) {
                      <nz-tag nzColor="gold">{{ 'franchiseNetwork.field.startupFactor' | translate }} {{ row.startup_factor }}</nz-tag>
                    }
                  </th>
                  <td class="num">{{ row.net_sales }}</td>
                  <td class="num">{{ row.royalty_after_startup }}</td>
                  <td class="num">{{ row.minimum_adjustment }}</td>
                  <td class="num">{{ row.marketing_fund }}</td>
                  <td class="num">{{ row.loyalty_settlement }}</td>
                  <td class="num">{{ row.total_net }}</td>
                  <td>
                    <nz-tag [nzColor]="statementColor(row.status)">{{ 'franchiseNetwork.statementStatus.' + row.status | translate }}</nz-tag>
                    @if (row.skip_reason) {
                      <small class="muted">{{ 'franchiseNetwork.skip.' + row.skip_reason | translate }}</small>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.statements' | translate"></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>

        @for (batch of current.batches ?? []; track batch.id) {
          <nz-card class="main-card" [nzTitle]="('franchiseNetwork.scheme.' + batch.scheme | translate) + ' · ' + batch.collection_date">
            <p>
              {{ 'franchiseNetwork.field.totalNet' | translate }}: {{ batch.total_amount }} {{ batch.currency }}
              <nz-tag [nzColor]="batch.status === 'ready' ? 'green' : 'default'">{{ 'franchiseNetwork.batchStatus.' + batch.status | translate }}</nz-tag>
            </p>
            <nz-table #items nzSize="small" [nzData]="batch.items" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'franchiseNetwork.field.store' | translate }}</th>
                  <th scope="col">{{ 'franchiseNetwork.field.invoice' | translate }}</th>
                  <th scope="col">{{ 'franchiseNetwork.field.mandateReference' | translate }}</th>
                  <th scope="col" class="num">{{ 'franchiseNetwork.field.amount' | translate }}</th>
                  <th scope="col">{{ 'franchiseNetwork.field.status' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (item of items.data; track item.invoice_id) {
                  <tr>
                    <th scope="row">{{ item.store_code }}</th>
                    <td>{{ item.invoice_number ?? '—' }}</td>
                    <td>{{ item.mandate_reference ?? '—' }}</td>
                    <td class="num">{{ item.amount }}</td>
                    <td>
                      @if (item.excluded_reason) {
                        <nz-tag nzColor="orange">{{ 'franchiseNetwork.finding.' + item.excluded_reason | translate }}</nz-tag>
                      } @else {
                        <nz-tag nzColor="green">{{ 'franchiseNetwork.batchStatus.ready' | translate }}</nz-tag>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>
        }
      } @else {
        <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.runForPeriod' | translate"></nz-empty>
      }

      <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.sellOut' | translate">
        <nz-table #sellOut nzSize="small" [nzData]="store.sellOut()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ 'franchiseNetwork.field.store' | translate }}</th>
              <th scope="col" class="num">{{ 'franchiseNetwork.field.grossSales' | translate }}</th>
              <th scope="col" class="num">{{ 'franchiseNetwork.field.netSales' | translate }}</th>
              <th scope="col" class="num">{{ 'franchiseNetwork.field.tickets' | translate }}</th>
              <th scope="col">{{ 'franchiseNetwork.field.source' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of sellOut.data; track row.id) {
              <tr>
                <th scope="row">{{ storeLabel(row.store_id) }}</th>
                <td class="num">{{ row.gross_sales }}</td>
                <td class="num">{{ row.net_sales }}</td>
                <td class="num">{{ row.tickets_count }}</td>
                <td>{{ 'franchiseNetwork.sellOutSource.' + row.source | translate }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5">
                  <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.sellOut' | translate"></nz-empty>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.loyaltySettlement' | translate">
        <nz-table #loyalty nzSize="small" [nzData]="store.loyalty()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ 'franchiseNetwork.field.store' | translate }}</th>
              <th scope="col" class="num">{{ 'franchiseNetwork.field.owed' | translate }}</th>
              <th scope="col" class="num">{{ 'franchiseNetwork.field.receivable' | translate }}</th>
              <th scope="col" class="num">{{ 'franchiseNetwork.field.net' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of loyalty.data; track row.store_id) {
              <tr>
                <th scope="row">{{ row.store_code }} <small class="muted">{{ row.store_name }}</small></th>
                <td class="num">{{ row.owed }}</td>
                <td class="num">{{ row.receivable }}</td>
                <td class="num">{{ row.net }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">
                  <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.loyalty' | translate"></nz-empty>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    </nz-spin>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="520"
      [nzTitle]="'franchiseNetwork.section.recordSellOut' | translate"
      (nzOnClose)="drawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <form [formGroup]="form" class="form" (ngSubmit)="submit()">
          <label class="field" for="frn-b-store">
            <span>{{ 'franchiseNetwork.field.store' | translate }}</span>
            <nz-select nzId="frn-b-store" formControlName="store_id" nzShowSearch>
              @for (option of store.stores(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.code + ' ' + option.name"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-b-gross">
            <span>{{ 'franchiseNetwork.field.grossSales' | translate }}</span>
            <nz-input-number nzId="frn-b-gross" formControlName="gross_sales" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-b-returns">
            <span>{{ 'franchiseNetwork.field.returns' | translate }}</span>
            <nz-input-number nzId="frn-b-returns" formControlName="returns" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-b-discounts">
            <span>{{ 'franchiseNetwork.field.discounts' | translate }}</span>
            <nz-input-number nzId="frn-b-discounts" formControlName="discounts" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-b-tickets">
            <span>{{ 'franchiseNetwork.field.tickets' | translate }}</span>
            <nz-input-number nzId="frn-b-tickets" formControlName="tickets_count" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-b-visitors">
            <span>{{ 'franchiseNetwork.field.visitors' | translate }}</span>
            <nz-input-number nzId="frn-b-visitors" formControlName="visitors_count" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-b-cogs">
            <span>{{ 'franchiseNetwork.field.costOfGoodsSold' | translate }}</span>
            <nz-input-number nzId="frn-b-cogs" formControlName="cost_of_goods_sold" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-b-inventory">
            <span>{{ 'franchiseNetwork.field.averageInventory' | translate }}</span>
            <nz-input-number nzId="frn-b-inventory" formControlName="average_inventory_value" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-b-source">
            <span>{{ 'franchiseNetwork.field.source' | translate }}</span>
            <nz-select nzId="frn-b-source" formControlName="source">
              @for (source of sources; track source) {
                <nz-option [nzValue]="source" [nzLabel]="'franchiseNetwork.sellOutSource.' + source | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-b-pos">
            <span>{{ 'franchiseNetwork.field.posReference' | translate }}</span>
            <input nz-input id="frn-b-pos" formControlName="pos_reference" maxlength="80" />
          </label>
          <div class="actions">
            <button nz-button nzType="primary" type="submit" [nzLoading]="store.saving()" [disabled]="form.invalid">
              {{ 'franchiseNetwork.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="drawerOpen.set(false)">
              {{ 'franchiseNetwork.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class BillingComponent implements OnInit {
  protected readonly store = inject(BillingStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canManage = inject(PermissionsService).canWrite(FRANCHISE_NETWORK_MANAGE_MODULE);
  protected readonly sources = FRN_SELL_OUT_SOURCES;
  protected readonly statementColor = statementStatusColor;

  protected readonly drawerOpen = signal(false);
  protected readonly feedback = signal<FrnOutcome | null>(null);
  protected readonly formError = signal<FrnOutcome | null>(null);

  protected readonly form = this.fb.group({
    store_id: ['', Validators.required],
    gross_sales: [0, Validators.required],
    returns: [0],
    discounts: [0],
    tickets_count: [0],
    visitors_count: [0],
    cost_of_goods_sold: [0],
    average_inventory_value: [0],
    source: ['pos' as FrnSellOutPayload['source']],
    pos_reference: [''],
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected onPeriod(value: string): void {
    if (isPeriod(value)) {
      void this.store.setPeriod(value);
    }
  }

  protected factor(row: FrnStatement): number {
    return Number.parseFloat(String(row.startup_factor));
  }

  protected storeLabel(id: string): string {
    const found = this.store.stores().find((option) => option.id === id);
    return found ? `${found.code} ${found.name}` : id;
  }

  protected async run(call: Promise<FrnOutcome>): Promise<void> {
    const outcome = await call;
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected openSellOut(): void {
    this.form.reset({ gross_sales: 0, source: 'pos' });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  protected async submit(): Promise<void> {
    const { store_id, pos_reference, ...rest } = this.form.getRawValue();
    const outcome = await this.store.saveSellOut(store_id, { ...rest, pos_reference: pos_reference || null });
    if (outcome.ok) {
      this.message.success(this.i18n.instant('franchiseNetwork.notification.saved'));
      this.drawerOpen.set(false);
    } else {
      this.formError.set(outcome);
    }
  }
}
