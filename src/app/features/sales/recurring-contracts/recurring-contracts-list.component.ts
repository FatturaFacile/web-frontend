import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { RecurringContractsApiService } from '@core/api/recurring-contracts-api.service';
import {
  RecurringContract,
  RecurringContractsMetrics,
} from '@core/models/recurring-contracts.model';
import { PriceIndexRegistryDrawerComponent } from './price-index-registry-drawer.component';
import { RecurringBillingBatchDrawerComponent } from './recurring-billing-batch-drawer.component';
import { RecurringContractDetailDrawerComponent } from './recurring-contract-detail-drawer.component';
import { RecurringContractFormDrawerComponent } from './recurring-contract-form-drawer.component';

@Component({
  selector: 'app-recurring-contracts-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzCardModule,
    NzStatisticModule,
    NzGridModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzPopconfirmModule,
    NzDividerModule,
    NzEmptyModule,
    NzIconModule,
    RecurringContractFormDrawerComponent,
    RecurringContractDetailDrawerComponent,
    RecurringBillingBatchDrawerComponent,
    PriceIndexRegistryDrawerComponent,
  ],
  template: `
    <div class="recurring-contracts-container p-4">
      <!-- Title & Action Bar -->
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 class="mb-1">Contratti Ricorrenti & Abbonamenti</h2>
          <p class="text-muted mb-0">
            Gestione contratti periodici, clausole ISTAT / Swiss IPC e motore di fatturazione massiva
          </p>
        </div>
        <div class="actions-group">
          <button nz-button nzType="default" (click)="openPriceIndexRegistry()" class="me-2">
            <i class="fa-solid fa-chart-line me-1"></i> Registro Indici Prezzi
          </button>
          <button nz-button nzType="default" (click)="openBatchBilling()" class="me-2">
            <i class="fa-solid fa-bolt me-1"></i> Esegui Batch Fatturazione
          </button>
          <button nz-button nzType="primary" (click)="openCreateForm()">
            <i class="fa-solid fa-plus me-1"></i> Nuovo Contratto
          </button>
        </div>
      </div>

      <!-- KPI Metrics Cards -->
      <div nz-row [nzGutter]="16" class="mb-4">
        <div nz-col [nzSpan]="5">
          <nz-card>
            <nz-statistic
              [nzValue]="metrics()?.mrr || '0.00'"
              [nzTitle]="'MRR (Monthly Recurring Revenue)'"
              [nzPrefix]="mrrIcon"
            ></nz-statistic>
            <ng-template #mrrIcon><i class="fa-solid fa-sack-dollar text-primary me-2"></i></ng-template>
          </nz-card>
        </div>
        <div nz-col [nzSpan]="5">
          <nz-card>
            <nz-statistic
              [nzValue]="metrics()?.arr || '0.00'"
              [nzTitle]="'ARR (Annual Recurring Revenue)'"
              [nzPrefix]="arrIcon"
            ></nz-statistic>
            <ng-template #arrIcon><i class="fa-solid fa-vault text-success me-2"></i></ng-template>
          </nz-card>
        </div>
        <div nz-col [nzSpan]="4">
          <nz-card>
            <nz-statistic
              [nzValue]="metrics()?.active_contracts_count || 0"
              [nzTitle]="'Contratti Attivi'"
              [nzPrefix]="activeIcon"
            ></nz-statistic>
            <ng-template #activeIcon><i class="fa-solid fa-circle-check text-info me-2"></i></ng-template>
          </nz-card>
        </div>
        <div nz-col [nzSpan]="5">
          <nz-card>
            <nz-statistic
              [nzValue]="metrics()?.due_for_billing_count || 0"
              [nzTitle]="'Da Fatturare (Oggi/Scaduti)'"
              [nzValueStyle]="{ color: (metrics()?.due_for_billing_count || 0) > 0 ? '#cf1322' : '#3f8600' }"
              [nzPrefix]="dueIcon"
            ></nz-statistic>
            <ng-template #dueIcon><i class="fa-solid fa-clock text-warning me-2"></i></ng-template>
          </nz-card>
        </div>
        <div nz-col [nzSpan]="5">
          <nz-card>
            <nz-statistic
              [nzValue]="metrics()?.expiring_within_30_days_count || 0"
              [nzTitle]="'In Scadenza (30 gg)'"
              [nzPrefix]="expiringIcon"
            ></nz-statistic>
            <ng-template #expiringIcon><i class="fa-solid fa-calendar-xmark text-danger me-2"></i></ng-template>
          </nz-card>
        </div>
      </div>

      <!-- Filters Filter-bar -->
      <div class="filters-card p-3 mb-4 bg-white border rounded">
        <div nz-row [nzGutter]="16" class="align-items-center">
          <div nz-col [nzSpan]="8">
            <nz-input-group nzPrefixIcon="search">
              <input
                nz-input
                placeholder="Cerca per titolo, numero contratto..."
                [(ngModel)]="searchQuery"
                (ngModelChange)="applyFilters()"
              />
            </nz-input-group>
          </div>
          <div nz-col [nzSpan]="5">
            <nz-select
              [(ngModel)]="selectedStatus"
              (ngModelChange)="applyFilters()"
              nzPlaceHolder="Filtra per Stato"
              nzAllowClear
              class="w-100"
            >
              <nz-option nzValue="draft" nzLabel="Bozza"></nz-option>
              <nz-option nzValue="active" nzLabel="Attivo"></nz-option>
              <nz-option nzValue="suspended" nzLabel="Sospeso"></nz-option>
              <nz-option nzValue="expired" nzLabel="Scaduto"></nz-option>
              <nz-option nzValue="cancelled" nzLabel="Annullato"></nz-option>
            </nz-select>
          </div>
          <div nz-col [nzSpan]="5">
            <nz-select
              [(ngModel)]="selectedType"
              (ngModelChange)="applyFilters()"
              nzPlaceHolder="Tipologia Contratto"
              nzAllowClear
              class="w-100"
            >
              <nz-option nzValue="maintenance" nzLabel="Manutenzione"></nz-option>
              <nz-option nzValue="rental" nzLabel="Noleggio / Locazione"></nz-option>
              <nz-option nzValue="software_license" nzLabel="Licenza Software"></nz-option>
              <nz-option nzValue="service_subscription" nzLabel="Abbonamento Servizi"></nz-option>
            </nz-select>
          </div>
          <div nz-col [nzSpan]="6" class="text-end">
            <button nz-button nzType="default" (click)="resetFilters()">
              <i class="fa-solid fa-rotate-left me-1"></i> Ripristina
            </button>
          </div>
        </div>
      </div>

      <!-- Contracts Main Table -->
      <nz-card [nzBordered]="false">
        <nz-table
          #contractsTable
          [nzData]="contracts()"
          [nzLoading]="loading()"
          [nzTotal]="totalRecords()"
          [nzPageIndex]="pageIndex()"
          [nzPageSize]="pageSize()"
          [nzFrontPagination]="false"
          (nzPageIndexChange)="onPageIndexChange($event)"
          (nzPageSizeChange)="onPageSizeChange($event)"
          nzBordered
        >
          <thead>
            <tr>
              <th>Numero</th>
              <th>Titolo & Tipologia</th>
              <th>Cliente</th>
              <th>Frequenza</th>
              <th>Prossima Fatt.</th>
              <th>Subtotale Ciclo</th>
              <th>Rinnovo</th>
              <th>Stato</th>
              <th nzWidth="180px">Azioni</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let contract of contractsTable.data">
              <td>
                <a (click)="openDetail(contract.id)">
                  <strong>{{ contract.contract_number }}</strong>
                </a>
              </td>
              <td>
                <div>{{ contract.title }}</div>
                <small class="text-muted">{{ formatType(contract.contract_type) }}</small>
              </td>
              <td>
                {{ contract.customer?.company_name || 'N/A' }}
              </td>
              <td>
                <span class="badge-freq">{{ contract.billing_frequency }}</span>
                <small class="d-block text-muted">({{ contract.billing_timing }})</small>
              </td>
              <td>
                <span [class.text-danger]="isPastDue(contract.next_billing_date)">
                  {{ contract.next_billing_date }}
                </span>
              </td>
              <td>
                <strong>{{ contract.subtotal }} {{ contract.currency }}</strong>
              </td>
              <td>
                <nz-tag [nzColor]="contract.auto_renew ? 'green' : 'default'">
                  {{ contract.auto_renew ? 'Auto' : 'Manuale' }}
                </nz-tag>
              </td>
              <td>
                <nz-tag [nzColor]="statusColor(contract.status)">
                  {{ contract.status.toUpperCase() }}
                </nz-tag>
              </td>
              <td>
                <button
                  nz-button
                  nzType="text"
                  nzSize="small"
                  (click)="openDetail(contract.id)"
                  title="Dettagli e Operazioni"
                >
                  <i class="fa-solid fa-eye text-primary"></i>
                </button>
                <button
                  nz-button
                  nzType="text"
                  nzSize="small"
                  (click)="openEditForm(contract)"
                  title="Modifica"
                >
                  <i class="fa-solid fa-pen-to-square text-secondary"></i>
                </button>
                <button
                  *ngIf="contract.status === 'draft'"
                  nz-button
                  nzType="text"
                  nzDanger
                  nzSize="small"
                  nz-popconfirm
                  nzPopconfirmTitle="Sei sicuro di voler eliminare questo contratto?"
                  (nzOnConfirm)="deleteContract(contract.id)"
                  title="Elimina"
                >
                  <i class="fa-solid fa-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </nz-table>
      </nz-card>

      <!-- Drawers -->
      <app-recurring-contract-form-drawer
        #formDrawer
        (saved)="loadData()"
      ></app-recurring-contract-form-drawer>

      <app-recurring-contract-detail-drawer
        #detailDrawer
        (changed)="loadData()"
      ></app-recurring-contract-detail-drawer>

      <app-recurring-billing-batch-drawer
        #batchDrawer
        (runCompleted)="loadData()"
      ></app-recurring-billing-batch-drawer>

      <app-price-index-registry-drawer
        #indicesDrawer
      ></app-price-index-registry-drawer>
    </div>
  `,
  styles: [
    `
      .recurring-contracts-container {
        max-width: 1400px;
        margin: 0 auto;
      }
      .actions-group {
        display: flex;
        gap: 8px;
      }
      .badge-freq {
        font-weight: 500;
        text-transform: capitalize;
      }
      .w-100 {
        width: 100%;
      }
      .mb-0 {
        margin-bottom: 0;
      }
      .mb-1 {
        margin-bottom: 4px;
      }
      .mb-4 {
        margin-bottom: 16px;
      }
      .p-3 {
        padding: 12px;
      }
      .p-4 {
        padding: 16px;
      }
      .me-1 {
        margin-right: 4px;
      }
      .me-2 {
        margin-right: 8px;
      }
      .text-muted {
        color: #8c8c8c;
      }
      .text-danger {
        color: #ff4d4f;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringContractsListComponent implements OnInit {
  private readonly api = inject(RecurringContractsApiService);
  private readonly message = inject(NzMessageService);

  @ViewChild('formDrawer') formDrawer!: RecurringContractFormDrawerComponent;
  @ViewChild('detailDrawer') detailDrawer!: RecurringContractDetailDrawerComponent;
  @ViewChild('batchDrawer') batchDrawer!: RecurringBillingBatchDrawerComponent;
  @ViewChild('indicesDrawer') indicesDrawer!: PriceIndexRegistryDrawerComponent;

  readonly loading = signal(false);
  readonly contracts = signal<RecurringContract[]>([]);
  readonly totalRecords = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(15);
  readonly metrics = signal<RecurringContractsMetrics | null>(null);

  searchQuery = '';
  selectedStatus?: string;
  selectedType?: string;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.api
      .getContracts({
        page: this.pageIndex(),
        per_page: this.pageSize(),
        search: this.searchQuery,
        status: this.selectedStatus,
        contract_type: this.selectedType,
      })
      .subscribe({
        next: (res) => {
          this.contracts.set(res.data || []);
          this.totalRecords.set(res.meta?.total || 0);
          this.loading.set(false);
        },
        error: () => {
          this.message.error('Errore durante il caricamento dei contratti ricorrenti.');
          this.loading.set(false);
        },
      });

    this.api.getMetrics().subscribe({
      next: (m) => this.metrics.set(m),
      error: () => {},
    });
  }

  applyFilters(): void {
    this.pageIndex.set(1);
    this.loadData();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = undefined;
    this.selectedType = undefined;
    this.applyFilters();
  }

  onPageIndexChange(page: number): void {
    this.pageIndex.set(page);
    this.loadData();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.loadData();
  }

  openCreateForm(): void {
    this.formDrawer.openForCreate();
  }

  openEditForm(contract: RecurringContract): void {
    this.formDrawer.openForEdit(contract);
  }

  openDetail(contractId: string): void {
    this.detailDrawer.open(contractId);
  }

  openBatchBilling(): void {
    this.batchDrawer.open();
  }

  openPriceIndexRegistry(): void {
    this.indicesDrawer.open();
  }

  deleteContract(id: string): void {
    this.api.deleteContract(id).subscribe({
      next: () => {
        this.message.success('Contratto eliminato con successo.');
        this.loadData();
      },
      error: () => {
        this.message.error('Impossibile eliminare il contratto.');
      },
    });
  }

  isPastDue(dateStr: string): boolean {
    if (!dateStr) return false;
    const now = new Date().toISOString().substring(0, 10);
    return dateStr <= now;
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

  formatType(type: string): string {
    switch (type) {
      case 'maintenance':
        return 'Manutenzione';
      case 'rental':
        return 'Noleggio / Locazione';
      case 'software_license':
        return 'Licenza SaaS';
      case 'service_subscription':
        return 'Abbonamento';
      default:
        return type;
    }
  }
}
