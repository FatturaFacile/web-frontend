import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { RecurringContractsApiService } from '@core/api/recurring-contracts-api.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@shared';
import { PriceIndexRate } from '@core/models/recurring-contracts.model';

@Component({
  selector: 'app-price-index-registry-drawer',
  standalone: true,
  imports: [
    FormsModule,
    NzDrawerModule,
    NzTableModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzDatePickerModule,
    NzSpinModule,
    NzTagModule,
    NzModalModule,
    NzEmptyModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="640"
      [nzTitle]="'RC.INDEX_REGISTRY.TITLE' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        <div class="drawer-header-actions mb-4">
          <button nz-button nzType="primary" (click)="showCreateModal()">
            <i class="fa-solid fa-plus me-1"></i> {{ 'RC.INDEX_REGISTRY.NEW_RATE' | translate }}
          </button>
          <button nz-button nzType="default" (click)="loadIndices()" [nzLoading]="loading()">
            <i class="fa-solid fa-arrows-rotate me-1"></i> {{ 'RC.INDEX_REGISTRY.RELOAD' | translate }}
          </button>
        </div>

        <nz-table
          #indicesTable
          [nzData]="rates()"
          [nzLoading]="loading()"
          [nzPageSize]="10"
          nzBordered
          nzSize="small"
        >
          <thead>
            <tr>
              <th>{{ 'RC.INDEX_REGISTRY.COL_INDEX' | translate }}</th>
              <th>{{ 'RC.INDEX_REGISTRY.COL_PERIOD' | translate }}</th>
              <th>{{ 'RC.INDEX_REGISTRY.COL_VALUE' | translate }}</th>
              <th>{{ 'RC.INDEX_REGISTRY.COL_PUBLISHED_AT' | translate }}</th>
              <th>{{ 'RC.INDEX_REGISTRY.COL_SOURCE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (rate of indicesTable.data; track rate.id ?? rate.period) {
              <tr>
                <td>
                  <nz-tag [nzColor]="rate.index_type === 'swiss_ipc' ? 'red' : 'blue'">
                    {{ rate.index_type === 'swiss_ipc' ? 'Swiss IPC' : 'ISTAT FOI' }}
                  </nz-tag>
                </td>
                <td><strong>{{ rate.period }}</strong></td>
                <td>{{ rate.index_value }}</td>
                <td>{{ rate.published_at || '—' }}</td>
                <td>{{ rate.source_reference || '—' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>

        <nz-modal
          [nzVisible]="createModalVisible()"
          [nzTitle]="'RC.INDEX_REGISTRY.MODAL_TITLE' | translate"
          (nzOnCancel)="createModalVisible.set(false)"
          (nzOnOk)="saveNewRate()"
          [nzOkLoading]="saving()"
        >
          <ng-container *nzModalContent>
            <form nz-form nzLayout="vertical">
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'RC.INDEX_REGISTRY.INDEX_TYPE_LABEL' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select [(ngModel)]="newRate.index_type" name="index_type">
                    <nz-option nzValue="istat_foi" nzLabel="ISTAT FOI"></nz-option>
                    <nz-option nzValue="swiss_ipc" nzLabel="Swiss IPC"></nz-option>
                  </nz-select>
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label nzRequired>{{ 'RC.INDEX_REGISTRY.PERIOD_LABEL' | translate }}</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    placeholder="2026-01"
                    [(ngModel)]="newRate.period"
                    name="period"
                  />
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label nzRequired>{{ 'RC.INDEX_REGISTRY.VALUE_LABEL' | translate }}</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    type="number"
                    step="0.0001"
                    placeholder="104.2500"
                    [(ngModel)]="newRate.index_value"
                    name="index_value"
                  />
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label>{{ 'RC.INDEX_REGISTRY.PUBLISHED_AT_LABEL' | translate }}</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    type="date"
                    [(ngModel)]="newRate.published_at"
                    name="published_at"
                  />
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label>{{ 'RC.INDEX_REGISTRY.SOURCE_LABEL' | translate }}</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    [(ngModel)]="newRate.source_reference"
                    name="source_reference"
                  />
                </nz-form-control>
              </nz-form-item>
            </form>
          </ng-container>
        </nz-modal>
      </ng-container>
    </nz-drawer>
  `,
  styles: [
    `
      .drawer-header-actions {
        display: flex;
        gap: 8px;
      }
      .mb-4 {
        margin-bottom: 16px;
      }
      .me-1 {
        margin-right: 4px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceIndexRegistryDrawerComponent {
  private readonly api = inject(RecurringContractsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly visible = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly createModalVisible = signal(false);
  readonly rates = signal<PriceIndexRate[]>([]);

  newRate: PriceIndexRate = {
    index_type: 'istat_foi',
    period: '',
    index_value: '',
    published_at: null,
    source_reference: '',
  };

  open(): void {
    this.visible.set(true);
    this.loadIndices();
  }

  close(): void {
    this.visible.set(false);
  }

  loadIndices(): void {
    this.loading.set(true);
    this.api.getPriceIndices().subscribe({
      next: (res) => {
        this.rates.set(res.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.message.error(this.i18n.translate('RC.INDEX_REGISTRY.LOAD_ERROR'));
        this.loading.set(false);
      },
    });
  }

  showCreateModal(): void {
    this.newRate = {
      index_type: 'istat_foi',
      period: new Date().toISOString().substring(0, 7),
      index_value: '',
      published_at: new Date().toISOString().substring(0, 10),
      source_reference: '',
    };
    this.createModalVisible.set(true);
  }

  saveNewRate(): void {
    if (!this.newRate.period || !this.newRate.index_value) {
      this.message.warning(this.i18n.translate('RC.INDEX_REGISTRY.VALIDATION_WARNING'));
      return;
    }

    this.saving.set(true);
    this.api.storePriceIndexRate(this.newRate).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('RC.INDEX_REGISTRY.SAVE_SUCCESS'));
        this.saving.set(false);
        this.createModalVisible.set(false);
        this.loadIndices();
      },
      error: () => {
        this.message.error(this.i18n.translate('RC.INDEX_REGISTRY.SAVE_ERROR'));
        this.saving.set(false);
      },
    });
  }
}
