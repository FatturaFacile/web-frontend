import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { BenchmarkPanelComponent } from './benchmark-panel.component';
import {
  FRANCHISE_NETWORK_PORTAL_MODULE,
  findingColor,
  FrnOutcome,
  isPeriod,
  statementStatusColor,
  targetStatusColor,
} from './franchise-network.util';
import { PortalStore } from './portal.store';

/**
 * Franchisee portal: contract summary with exclusivity zone and obligations (minimum purchases, guarantee, mandate), the catalogue,
 * price, promotion and loyalty pushes received, the monthly sell-out with the royalty and marketing fund statements, and the
 * anonymous benchmark of the store against its peers.
 */
@Component({
  selector: 'app-frn-portal',
  imports: [
    BenchmarkPanelComponent,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [PortalStore],
  styleUrl: './franchise-network.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.FRANCHISE_NETWORK_PORTAL' | translate"></app-page-header>

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
      @if (store.loaded() && store.stores().length === 0) {
        <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.linkStore' | translate">
          <p>{{ 'franchiseNetwork.hint.linkStore' | translate }}</p>
          @if (canWrite) {
            <div class="toolbar">
              <label class="field" for="frn-link-code">
                <span>{{ 'franchiseNetwork.field.linkCode' | translate }}</span>
                <input nz-input id="frn-link-code" [ngModel]="code()" (ngModelChange)="code.set($event)" maxlength="40" />
              </label>
              <button nz-button nzType="primary" type="button" [nzLoading]="store.saving()" [disabled]="code() === ''" (click)="link()">
                {{ 'franchiseNetwork.action.linkStore' | translate }}
              </button>
            </div>
          }
        </nz-card>
      }

      @if (store.stores().length > 1) {
        <div class="toolbar">
          <label class="field" for="frn-portal-store">
            <span>{{ 'franchiseNetwork.field.store' | translate }}</span>
            <nz-select nzId="frn-portal-store" [ngModel]="store.storeId()" (ngModelChange)="store.selectStore($event)">
              @for (option of store.stores(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.code + ' ' + option.name"></nz-option>
              }
            </nz-select>
          </label>
        </div>
      }

      @if (store.contract(); as contract) {
        <nz-tabs>
          <nz-tab [nzTitle]="'franchiseNetwork.tab.contract' | translate">
            <nz-card class="main-card">
              <strong>{{ contract.store.code }} {{ contract.store.name }}</strong>
              <small class="muted">{{ contract.store.vat_number ?? contract.store.uid_number }}</small>
            </nz-card>
            @if (contract.agreement; as agreement) {
              <nz-card class="main-card" [nzTitle]="agreement.agreement_number">
                <nz-descriptions nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 2 }">
                  <nz-descriptions-item [nzTitle]="'franchiseNetwork.field.status' | translate">
                    {{ 'franchiseNetwork.agreementStatus.' + agreement.status | translate }}
                  </nz-descriptions-item>
                  <nz-descriptions-item [nzTitle]="'franchiseNetwork.field.term' | translate">
                    {{ agreement.start_date }} → {{ agreement.end_date }} ({{ agreement.term_months }} {{ 'franchiseNetwork.field.months' | translate }})
                  </nz-descriptions-item>
                  <nz-descriptions-item [nzTitle]="'franchiseNetwork.field.zoneLabel' | translate">
                    {{ agreement.exclusivity_zone?.label ?? '—' }}
                    {{ (agreement.exclusivity_zone?.postal_codes ?? []).join(', ') }}
                  </nz-descriptions-item>
                  <nz-descriptions-item [nzTitle]="'franchiseNetwork.field.entryFee' | translate">
                    {{ agreement.entry_fee }} {{ agreement.currency }} · {{ agreement.entry_fee_deferral_months }} {{ 'franchiseNetwork.field.months' | translate }}
                  </nz-descriptions-item>
                  <nz-descriptions-item [nzTitle]="'franchiseNetwork.field.minPurchaseAmount' | translate">
                    {{ agreement.min_purchase_amount }} {{ agreement.currency }} · {{ 'franchiseNetwork.purchaseSource.' + agreement.min_purchase_source | translate }}
                  </nz-descriptions-item>
                  <nz-descriptions-item [nzTitle]="'franchiseNetwork.field.guarantee' | translate">
                    {{ 'franchiseNetwork.guaranteeType.' + agreement.guarantee_type | translate }}
                    {{ agreement.guarantee_expires_on ?? '' }}
                  </nz-descriptions-item>
                  <nz-descriptions-item [nzTitle]="'franchiseNetwork.field.paymentMethod' | translate">
                    {{ 'franchiseNetwork.paymentMethod.' + agreement.payment_method | translate }}
                    {{ agreement.mandate_reference ?? '' }}
                  </nz-descriptions-item>
                  @if (contract.formula; as formula) {
                    <nz-descriptions-item [nzTitle]="'franchiseNetwork.field.formula' | translate">
                      {{ formula.label }}
                    </nz-descriptions-item>
                  }
                </nz-descriptions>
                <div class="tags">
                  @for (alert of agreement.alerts; track alert.code) {
                    <nz-tag [nzColor]="color(alert)">{{ 'franchiseNetwork.finding.' + alert.code | translate: alert.params }}</nz-tag>
                  }
                </div>
              </nz-card>

              <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.obligations' | translate">
                @if (contract.purchase_compliance; as compliance) {
                  <p>
                    {{ 'franchiseNetwork.field.compliantMonths' | translate }}:
                    {{ compliance.compliant_months }} / {{ compliance.months }} ·
                    {{ 'franchiseNetwork.field.shortfall' | translate }}: {{ compliance.shortfall }}
                  </p>
                }
                <nz-table #purchases nzSize="small" [nzData]="contract.purchases" [nzShowPagination]="false">
                  <thead>
                    <tr>
                      <th scope="col">{{ 'franchiseNetwork.field.period' | translate }}</th>
                      <th scope="col" class="num">{{ 'franchiseNetwork.field.purchased' | translate }}</th>
                      <th scope="col" class="num">{{ 'franchiseNetwork.field.required' | translate }}</th>
                      <th scope="col">{{ 'franchiseNetwork.field.status' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of purchases.data; track row.id) {
                      <tr>
                        <th scope="row">{{ row.period }}</th>
                        <td class="num">{{ row.purchased_amount }}</td>
                        <td class="num">{{ row.required_amount }}</td>
                        <td>
                          <nz-tag [nzColor]="row.compliant ? 'green' : 'red'">{{ (row.compliant ? 'franchiseNetwork.field.compliant' : 'franchiseNetwork.field.belowMinimum') | translate }}</nz-tag>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="4">
                          <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.purchases' | translate"></nz-empty>
                        </td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              </nz-card>
            } @else {
              <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.agreements' | translate"></nz-empty>
            }
          </nz-tab>

          <nz-tab [nzTitle]="'franchiseNetwork.tab.syncs' | translate">
            <nz-table #syncs nzSize="small" [nzData]="store.syncs()" [nzShowPagination]="false" [nzScroll]="{ x: '800px' }">
              <thead>
                <tr>
                  <th scope="col">{{ 'franchiseNetwork.field.title' | translate }}</th>
                  <th scope="col">{{ 'franchiseNetwork.field.pushType' | translate }}</th>
                  <th scope="col">{{ 'franchiseNetwork.field.effectiveFrom' | translate }}</th>
                  <th scope="col">{{ 'franchiseNetwork.field.status' | translate }}</th>
                  <th scope="col">{{ 'franchiseNetwork.section.content' | translate }}</th>
                  <th scope="col">{{ 'franchiseNetwork.field.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (sync of syncs.data; track sync.id) {
                  <tr>
                    <th scope="row">{{ sync.push?.title }}</th>
                    <td>{{ sync.push ? ('franchiseNetwork.pushType.' + sync.push.push_type | translate) : '' }}</td>
                    <td>{{ sync.push?.effective_from ?? '—' }}</td>
                    <td><nz-tag [nzColor]="targetColor(sync.status)">{{ 'franchiseNetwork.targetStatus.' + sync.status | translate }}</nz-tag></td>
                    <td>
                      @for (item of sync.push?.payload?.items ?? []; track item.sku) {
                        <div>
                          {{ item.sku }} · {{ item.name }} · {{ item.price }}
                          @if (item.non_binding) {
                            <nz-tag nzColor="blue">{{ 'franchiseNetwork.priceType.recommended' | translate }}</nz-tag>
                          } @else {
                            <nz-tag nzColor="purple">{{ 'franchiseNetwork.priceType.maximum' | translate }}</nz-tag>
                          }
                        </div>
                      }
                      @for (price of sync.push?.payload?.prices ?? []; track price.sku) {
                        <div>
                          {{ price.sku }} · {{ price.price }}
                          @if (price.non_binding) {
                            <nz-tag nzColor="blue">{{ 'franchiseNetwork.priceType.recommended' | translate }}</nz-tag>
                          } @else {
                            <nz-tag nzColor="purple">{{ 'franchiseNetwork.priceType.maximum' | translate }}</nz-tag>
                          }
                        </div>
                      }
                      @if (sync.push?.payload?.promotion; as promotion) {
                        <div>{{ promotion.name }} · {{ promotion.valid_from }} → {{ promotion.valid_to }} · {{ promotion.discount_percent }}%</div>
                      }
                      @if (sync.push?.payload?.loyalty; as loyalty) {
                        <div>{{ loyalty.name }} · ×{{ loyalty.points_multiplier }}</div>
                      }
                    </td>
                    <td>
                      @if (canWrite && sync.status === 'synced') {
                        <button nz-button nzSize="small" nzType="primary" type="button" [nzLoading]="store.saving()" (click)="acknowledge(sync.id)">
                          {{ 'franchiseNetwork.action.acknowledge' | translate }}
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">
                      <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.syncs' | translate"></nz-empty>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <nz-tab [nzTitle]="'franchiseNetwork.tab.statements' | translate">
            @if (store.statements(); as data) {
              <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.statements' | translate">
                <nz-table #statements nzSize="small" [nzData]="data.statements" [nzShowPagination]="false" [nzScroll]="{ x: '900px' }">
                  <thead>
                    <tr>
                      <th scope="col">{{ 'franchiseNetwork.field.period' | translate }}</th>
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
                        <th scope="row">{{ row.period }}</th>
                        <td class="num">{{ row.net_sales }}</td>
                        <td class="num">{{ row.royalty_after_startup }}</td>
                        <td class="num">{{ row.minimum_adjustment }}</td>
                        <td class="num">{{ row.marketing_fund }}</td>
                        <td class="num">{{ row.loyalty_settlement }}</td>
                        <td class="num">{{ row.total_net }}</td>
                        <td><nz-tag [nzColor]="statementColor(row.status)">{{ 'franchiseNetwork.statementStatus.' + row.status | translate }}</nz-tag></td>
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
              <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.sellOut' | translate">
                <nz-table #sellOut nzSize="small" [nzData]="data.sell_out" [nzShowPagination]="false">
                  <thead>
                    <tr>
                      <th scope="col">{{ 'franchiseNetwork.field.period' | translate }}</th>
                      <th scope="col" class="num">{{ 'franchiseNetwork.field.grossSales' | translate }}</th>
                      <th scope="col" class="num">{{ 'franchiseNetwork.field.netSales' | translate }}</th>
                      <th scope="col" class="num">{{ 'franchiseNetwork.field.tickets' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of sellOut.data; track row.id) {
                      <tr>
                        <th scope="row">{{ row.period }}</th>
                        <td class="num">{{ row.gross_sales }}</td>
                        <td class="num">{{ row.net_sales }}</td>
                        <td class="num">{{ row.tickets_count }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="4">
                          <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.sellOut' | translate"></nz-empty>
                        </td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              </nz-card>
            }
          </nz-tab>

          <nz-tab [nzTitle]="'franchiseNetwork.tab.benchmark' | translate">
            <div class="toolbar">
              <label class="field" for="frn-portal-period">
                <span>{{ 'franchiseNetwork.field.period' | translate }}</span>
                <input id="frn-portal-period" type="month" [ngModel]="store.benchmark()?.period" (ngModelChange)="onPeriod($event)" />
              </label>
            </div>
            <app-frn-benchmark-panel [benchmark]="store.benchmark()"></app-frn-benchmark-panel>
          </nz-tab>
        </nz-tabs>
      }
    </nz-spin>
  `,
})
export class PortalComponent implements OnInit {
  protected readonly store = inject(PortalStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(FRANCHISE_NETWORK_PORTAL_MODULE);
  protected readonly color = findingColor;
  protected readonly targetColor = targetStatusColor;
  protected readonly statementColor = statementStatusColor;

  protected readonly code = signal('');
  protected readonly feedback = signal<FrnOutcome | null>(null);

  ngOnInit(): void {
    void this.store.load();
  }

  protected async link(): Promise<void> {
    const outcome = await this.store.link(this.code().trim());
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.code.set('');
      this.message.success(this.i18n.instant('franchiseNetwork.notification.linked'));
    }
  }

  protected async acknowledge(id: string): Promise<void> {
    const outcome = await this.store.acknowledge(id);
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('franchiseNetwork.notification.acknowledged'));
    }
  }

  protected onPeriod(value: string | null): void {
    if (value !== null && isPeriod(value)) {
      void this.store.loadBenchmark(value);
    }
  }
}
