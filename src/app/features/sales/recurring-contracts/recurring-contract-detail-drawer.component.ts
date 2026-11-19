import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService } from '@core';
import { TranslatePipe } from '@shared';
import { RecurringContractsApiService } from '@core/api/recurring-contracts-api.service';
import {
  PriceIndexRate,
  RecurringContract,
} from '@core/models/recurring-contracts.model';

@Component({
  selector: 'app-recurring-contract-detail-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzDrawerModule,
    NzDescriptionsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzTabsModule,
    NzSpinModule,
    NzDividerModule,
    NzCardModule,
    NzAlertModule,
    NzPopconfirmModule,
    NzModalModule,
    NzInputModule,
    NzSelectModule,
    NzEmptyModule,
    NzBadgeModule,
    NzGridModule,
    NzIconModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="850"
      [nzTitle]="(contract() ? ('RC.DETAIL.TITLE' | translate) + ' ' + contract()?.contract_number : ('RC.DETAIL.TITLE' | translate))"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        <nz-spin [nzSpinning]="loading()">
          @if (contract(); as c) {
            <div>
              <!-- Header actions -->
              <div class="detail-actions mb-4">
                @if (c.status === 'draft' || c.status === 'suspended') {
                  <button
                    nz-button
                    nzType="primary"
                    (click)="activateContract()"
                    [nzLoading]="actionLoading()"
                  >
                    <i class="fa-solid fa-play me-1"></i> {{ 'RC.DETAIL.ACTIVATE' | translate }}
                  </button>
                }

                @if (c.status === 'active') {
                  <button
                    nz-button
                    nzType="default"
                    (click)="suspendContract()"
                    [nzLoading]="actionLoading()"
                  >
                    <i class="fa-solid fa-pause me-1"></i> {{ 'RC.DETAIL.SUSPEND' | translate }}
                  </button>

                  <button
                    nz-button
                    nzType="default"
                    (click)="showBillNowModal()"
                  >
                    <i class="fa-solid fa-bolt me-1"></i> {{ 'RC.DETAIL.BILL_NOW' | translate }}
                  </button>

                  @if (c.indexation_clause) {
                    <button
                      nz-button
                      nzType="default"
                      (click)="showIndexationModal()"
                    >
                      <i class="fa-solid fa-arrow-trend-up me-1"></i> {{ 'RC.DETAIL.APPLY_INDEX' | translate }}
                    </button>
                  }

                  <button
                    nz-button
                    nzType="dashed"
                    (click)="renewContract()"
                  >
                    <i class="fa-solid fa-arrows-rotate me-1"></i> {{ 'RC.DETAIL.RENEW' | translate }}
                  </button>
                }

                @if (c.status !== 'cancelled' && c.status !== 'expired') {
                  <button
                    nz-button
                    nzDanger
                    (click)="showCancelModal()"
                  >
                    <i class="fa-solid fa-ban me-1"></i> {{ 'RC.DETAIL.CANCEL' | translate }}
                  </button>
                }
              </div>

              <nz-tabs>
                <!-- TAB 1: Overview -->
                <nz-tab [nzTitle]="'RC.DETAIL.TAB_OVERVIEW' | translate">
                  <nz-descriptions nzBordered [nzColumn]="2" nzSize="small">
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.CONTRACT_NUMBER' | translate">
                      <strong>{{ c.contract_number }}</strong>
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.STATUS' | translate">
                      <nz-tag [nzColor]="statusColor(c.status)">{{ c.status.toUpperCase() }}</nz-tag>
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.TITLE_FIELD' | translate">
                      {{ c.title }}
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.TYPE' | translate">
                      {{ formatContractType(c.contract_type) }}
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.CUSTOMER' | translate">
                      {{ c.customer?.company_name || 'N/A' }}
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.CURRENCY' | translate">
                      {{ c.currency }}
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.FREQUENCY' | translate">
                      {{ c.billing_frequency }} ({{ c.billing_timing }})
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.NEXT_BILLING' | translate">
                      <strong>{{ c.next_billing_date }}</strong>
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.START_DATE' | translate">
                      {{ c.start_date }}
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.END_DATE' | translate">
                      {{ c.end_date || ('RC.DETAIL.OPEN_ENDED' | translate) }}
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.AUTO_RENEW' | translate">
                      {{ c.auto_renew ? (('COMMON.YES' | translate) + ' (' + (c.renewal_period_months || 12) + 'm)') : ('COMMON.NO' | translate) }}
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.LAST_BILLED' | translate">
                      {{ c.last_billed_date || ('COMMON.NONE' | translate) }}
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.SUBTOTAL' | translate">
                      {{ c.subtotal }} {{ c.currency }}
                    </nz-descriptions-item>
                    <nz-descriptions-item [nzTitle]="'RC.DETAIL.TOTAL' | translate">
                      <strong>{{ c.total }} {{ c.currency }}</strong>
                    </nz-descriptions-item>
                  </nz-descriptions>

                  @if (c.cancellation_reason) {
                    <div class="mt-4">
                      <nz-alert
                        nzType="error"
                        nzShowIcon
                        [nzMessage]="('RC.DETAIL.CANCELLED_ON' | translate) + ' ' + (c.cancelled_at || '')"
                        [nzDescription]="('RC.DETAIL.REASON' | translate) + ': ' + c.cancellation_reason"
                      ></nz-alert>
                    </div>
                  }
                </nz-tab>

                <!-- TAB 2: Lines -->
                <nz-tab [nzTitle]="'RC.DETAIL.TAB_LINES' | translate">
                  <nz-table
                    #linesTable
                    [nzData]="c.lines || []"
                    [nzShowPagination]="false"
                    nzBordered
                    nzSize="small"
                  >
                    <thead>
                      <tr>
                        <th>{{ 'RC.LINES.DESCRIPTION' | translate }}</th>
                        <th>{{ 'RC.LINES.QUANTITY' | translate }}</th>
                        <th>{{ 'RC.LINES.UNIT_PRICE' | translate }}</th>
                        <th>{{ 'RC.LINES.DISCOUNT' | translate }}</th>
                        <th>{{ 'RC.LINES.TAX_RATE' | translate }}</th>
                        <th>{{ 'RC.LINES.PRORATION' | translate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of linesTable.data; track line.id ?? $index) {
                        <tr>
                          <td>{{ line.description }}</td>
                          <td>{{ line.quantity }}</td>
                          <td>{{ line.unit_price }} {{ c.currency }}</td>
                          <td>{{ line.discount_percent }}%</td>
                          <td>{{ line.tax_rate }}%</td>
                          <td>
                            <nz-tag>{{ line.proration_mode }}</nz-tag>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </nz-table>
                </nz-tab>

                <!-- TAB 3: Indexation Clause & History -->
                <nz-tab [nzTitle]="'RC.DETAIL.TAB_INDEXATION' | translate">
                  @if (c.indexation_clause; as clause) {
                    <div>
                      <nz-card [nzTitle]="'RC.INDEXATION.ACTIVE_CLAUSE' | translate" nzType="inner" class="mb-4">
                        <nz-descriptions nzBordered [nzColumn]="2" nzSize="small">
                          <nz-descriptions-item [nzTitle]="'RC.INDEXATION.INDEX_TYPE' | translate">
                            <nz-tag [nzColor]="clause.index_type === 'swiss_ipc' ? 'red' : 'blue'">
                              {{ clause.index_type === 'swiss_ipc' ? 'Swiss IPC' : 'ISTAT FOI' }}
                            </nz-tag>
                          </nz-descriptions-item>
                          <nz-descriptions-item [nzTitle]="'RC.INDEXATION.BASE_PERIOD' | translate">
                            {{ clause.base_index_period }}
                          </nz-descriptions-item>
                          <nz-descriptions-item [nzTitle]="'RC.INDEXATION.BASE_VALUE' | translate">
                            {{ clause.base_index_value }}
                          </nz-descriptions-item>
                          <nz-descriptions-item [nzTitle]="'RC.INDEXATION.PASS_THROUGH' | translate">
                            {{ clause.pass_through_percent }}%
                          </nz-descriptions-item>
                          <nz-descriptions-item [nzTitle]="'RC.INDEXATION.FLOOR_CAP' | translate">
                            {{ clause.floor_percent || '—' }}% / {{ clause.cap_percent || '—' }}%
                          </nz-descriptions-item>
                          <nz-descriptions-item [nzTitle]="'RC.INDEXATION.NEXT_ADJUSTMENT' | translate">
                            {{ clause.next_adjustment_date || '—' }}
                          </nz-descriptions-item>
                        </nz-descriptions>
                      </nz-card>

                      <h6>{{ 'RC.INDEXATION.HISTORY' | translate }}</h6>
                      <nz-table
                        #logsTable
                        [nzData]="c.indexation_logs || []"
                        [nzShowPagination]="false"
                        nzBordered
                        nzSize="small"
                      >
                        <thead>
                          <tr>
                            <th>{{ 'RC.INDEXATION.APPLIED_AT' | translate }}</th>
                            <th>{{ 'RC.INDEXATION.PERIOD' | translate }}</th>
                            <th>{{ 'RC.INDEXATION.OLD_NEW_INDEX' | translate }}</th>
                            <th>{{ 'RC.INDEXATION.DELTA' | translate }}</th>
                            <th>{{ 'RC.INDEXATION.UPDATED_FEE' | translate }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (log of logsTable.data; track log.id) {
                            <tr>
                              <td>{{ log.applied_at | date: 'short' }}</td>
                              <td>{{ log.period_from }} &rarr; {{ log.period_to }}</td>
                              <td>{{ log.old_index_value }} &rarr; {{ log.new_index_value }}</td>
                              <td>
                                <strong>+{{ log.applied_delta_percent }}%</strong>
                                <span class="text-muted ms-1">({{ log.raw_delta_percent }}%)</span>
                              </td>
                              <td>
                                {{ log.old_recurring_total }} &rarr;
                                <strong>{{ log.new_recurring_total }} {{ c.currency }}</strong>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </nz-table>
                    </div>
                  } @else {
                    <nz-empty [nzNotFoundContent]="'RC.INDEXATION.NO_CLAUSE' | translate"></nz-empty>
                  }
                </nz-tab>
              </nz-tabs>
            </div>
          }
        </nz-spin>

        <!-- Modals for specific actions -->
        <nz-modal
          [nzVisible]="cancelModalVisible()"
          [nzTitle]="'RC.MODAL.CANCEL_TITLE' | translate"
          (nzOnCancel)="cancelModalVisible.set(false)"
          (nzOnOk)="confirmCancellation()"
          [nzOkLoading]="actionLoading()"
        >
          <ng-container *nzModalContent>
            <p>{{ 'RC.MODAL.CANCEL_PROMPT' | translate }}</p>
            <textarea
              nz-input
              rows="3"
              [placeholder]="'RC.MODAL.CANCEL_REASON_PLACEHOLDER' | translate"
              [(ngModel)]="cancellationReason"
            ></textarea>
          </ng-container>
        </nz-modal>

        <nz-modal
          [nzVisible]="indexationModalVisible()"
          [nzTitle]="'RC.MODAL.INDEXATION_TITLE' | translate"
          (nzOnCancel)="indexationModalVisible.set(false)"
          (nzOnOk)="confirmIndexation()"
          [nzOkLoading]="actionLoading()"
        >
          <ng-container *nzModalContent>
            <p>{{ 'RC.MODAL.INDEXATION_PROMPT' | translate }}</p>
            @if (availableIndexRates().length > 0) {
              <nz-select
                [(ngModel)]="selectedPriceIndexRateId"
                [nzPlaceHolder]="'RC.MODAL.INDEXATION_SELECT_PLACEHOLDER' | translate"
                style="width: 100%"
              >
                @for (r of availableIndexRates(); track r.id ?? r.period) {
                  <nz-option
                    [nzValue]="r.id"
                    [nzLabel]="r.index_type.toUpperCase() + ' — ' + r.period + ' (' + r.index_value + ')'"
                  ></nz-option>
                }
              </nz-select>
            } @else {
              <input
                nz-input
                [placeholder]="'RC.MODAL.INDEXATION_SELECT_PLACEHOLDER' | translate"
                [(ngModel)]="selectedPriceIndexRateId"
              />
            }
          </ng-container>
        </nz-modal>
      </ng-container>
    </nz-drawer>
  `,
  styles: [
    `
      .detail-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .mb-4 {
        margin-bottom: 16px;
      }
      .mt-4 {
        margin-top: 16px;
      }
      .me-1 {
        margin-right: 4px;
      }
      .ms-1 {
        margin-left: 4px;
      }
      .text-muted {
        color: #8c8c8c;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringContractDetailDrawerComponent {
  private readonly api = inject(RecurringContractsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  @Output() readonly changed = new EventEmitter<void>();

  readonly visible = signal(false);
  readonly loading = signal(false);
  readonly actionLoading = signal(false);
  readonly contract = signal<RecurringContract | null>(null);
  readonly availableIndexRates = signal<PriceIndexRate[]>([]);

  readonly cancelModalVisible = signal(false);
  readonly indexationModalVisible = signal(false);

  cancellationReason = '';
  selectedPriceIndexRateId = '';

  open(contractId: string): void {
    this.visible.set(true);
    this.loadContract(contractId);
  }

  close(): void {
    this.visible.set(false);
  }

  loadContract(id: string): void {
    this.loading.set(true);
    this.api.getContract(id).subscribe({
      next: (res) => {
        this.contract.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.message.error(this.i18n.translate('RC.MESSAGES.LOAD_ERROR'));
        this.loading.set(false);
      },
    });
  }

  activateContract(): void {
    const c = this.contract();
    if (!c) return;
    this.actionLoading.set(true);
    this.api.activateContract(c.id).subscribe({
      next: (res) => {
        this.message.success(this.i18n.translate('RC.MESSAGES.ACTIVATED'));
        this.contract.set(res.data);
        this.actionLoading.set(false);
        this.changed.emit();
      },
      error: () => {
        this.message.error(this.i18n.translate('RC.MESSAGES.ACTIVATE_ERROR'));
        this.actionLoading.set(false);
      },
    });
  }

  suspendContract(): void {
    const c = this.contract();
    if (!c) return;
    this.actionLoading.set(true);
    this.api.suspendContract(c.id).subscribe({
      next: (res) => {
        this.message.success(this.i18n.translate('RC.MESSAGES.SUSPENDED'));
        this.contract.set(res.data);
        this.actionLoading.set(false);
        this.changed.emit();
      },
      error: () => {
        this.message.error(this.i18n.translate('RC.MESSAGES.SUSPEND_ERROR'));
        this.actionLoading.set(false);
      },
    });
  }

  renewContract(): void {
    const c = this.contract();
    if (!c) return;
    this.actionLoading.set(true);
    this.api.renewContract(c.id, c.renewal_period_months ?? 12).subscribe({
      next: (res) => {
        this.message.success(this.i18n.translate('RC.MESSAGES.RENEWED'));
        this.contract.set(res.data);
        this.actionLoading.set(false);
        this.changed.emit();
      },
      error: () => {
        this.message.error(this.i18n.translate('RC.MESSAGES.RENEW_ERROR'));
        this.actionLoading.set(false);
      },
    });
  }

  showBillNowModal(): void {
    const c = this.contract();
    if (!c) return;
    this.api.billNow(c.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('RC.MESSAGES.BILLED_NOW'));
        this.loadContract(c.id);
        this.changed.emit();
      },
      error: () => {
        this.message.error(this.i18n.translate('RC.MESSAGES.BILL_NOW_ERROR'));
      },
    });
  }

  showCancelModal(): void {
    this.cancellationReason = '';
    this.cancelModalVisible.set(true);
  }

  confirmCancellation(): void {
    const c = this.contract();
    if (!c || !this.cancellationReason) {
      this.message.warning(this.i18n.translate('RC.MESSAGES.REASON_REQUIRED'));
      return;
    }
    this.actionLoading.set(true);
    this.api.cancelContract(c.id, this.cancellationReason).subscribe({
      next: (res) => {
        this.message.success(this.i18n.translate('RC.MESSAGES.CANCELLED'));
        this.contract.set(res.data);
        this.actionLoading.set(false);
        this.cancelModalVisible.set(false);
        this.changed.emit();
      },
      error: () => {
        this.message.error(this.i18n.translate('RC.MESSAGES.CANCEL_ERROR'));
        this.actionLoading.set(false);
      },
    });
  }

  showIndexationModal(): void {
    const c = this.contract();
    const indexType = c?.indexation_clause?.index_type;
    this.selectedPriceIndexRateId = '';
    this.indexationModalVisible.set(true);
    this.api
      .getPriceIndices(indexType && indexType !== 'none' ? { index_type: indexType } : undefined)
      .subscribe({
        next: (res) => {
          const list = res.data ?? [];
          this.availableIndexRates.set(list);
          if (list.length > 0 && list[0].id) {
            this.selectedPriceIndexRateId = list[0].id;
          }
        },
        error: () => {
          this.availableIndexRates.set([]);
        },
      });
  }

  confirmIndexation(): void {
    const c = this.contract();
    if (!c || !this.selectedPriceIndexRateId) return;

    this.actionLoading.set(true);
    this.api.applyIndexation(c.id, this.selectedPriceIndexRateId).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('RC.MESSAGES.INDEXATION_APPLIED'));
        this.actionLoading.set(false);
        this.indexationModalVisible.set(false);
        this.loadContract(c.id);
        this.changed.emit();
      },
      error: () => {
        this.message.error(this.i18n.translate('RC.MESSAGES.INDEXATION_ERROR'));
        this.actionLoading.set(false);
      },
    });
  }

  statusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'warning';
      case 'draft':
        return 'default';
      case 'expired':
        return 'purple';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  }

  formatContractType(type: string): string {
    switch (type) {
      case 'maintenance':
        return this.i18n.translate('RC.TYPES.MAINTENANCE');
      case 'rental':
        return this.i18n.translate('RC.TYPES.RENTAL');
      case 'software_license':
        return this.i18n.translate('RC.TYPES.SOFTWARE_LICENSE');
      case 'service_subscription':
        return this.i18n.translate('RC.TYPES.SERVICE_SUBSCRIPTION');
      default:
        return type;
    }
  }
}
