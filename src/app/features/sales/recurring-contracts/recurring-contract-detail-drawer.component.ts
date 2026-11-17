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
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { RecurringContractsApiService } from '@core/api/recurring-contracts-api.service';
import {
  ContractIndexationLog,
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
    NzEmptyModule,
    NzBadgeModule,
    NzGridModule,
    NzIconModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="850"
      [nzTitle]="contract() ? 'Dettaglio Contratto ' + contract()?.contract_number : 'Dettaglio Contratto'"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        <nz-spin [nzSpinning]="loading()">
          <div *ngIf="contract() as c">
            <!-- Header actions -->
            <div class="detail-actions mb-4">
              <button
                *ngIf="c.status === 'draft' || c.status === 'suspended'"
                nz-button
                nzType="primary"
                (click)="activateContract()"
                [nzLoading]="actionLoading()"
              >
                <i class="fa-solid fa-play me-1"></i> Attiva Contratto
              </button>

              <button
                *ngIf="c.status === 'active'"
                nz-button
                nzType="default"
                (click)="suspendContract()"
                [nzLoading]="actionLoading()"
              >
                <i class="fa-solid fa-pause me-1"></i> Sospendi
              </button>

              <button
                *ngIf="c.status === 'active'"
                nz-button
                nzType="default"
                (click)="showBillNowModal()"
              >
                <i class="fa-solid fa-bolt me-1"></i> Fattura Subito
              </button>

              <button
                *ngIf="c.status === 'active' && c.indexation_clause"
                nz-button
                nzType="default"
                (click)="showIndexationModal()"
              >
                <i class="fa-solid fa-arrow-trend-up me-1"></i> Applica Indice
              </button>

              <button
                *ngIf="c.status === 'active'"
                nz-button
                nzType="dashed"
                (click)="renewContract()"
              >
                <i class="fa-solid fa-arrows-rotate me-1"></i> Rinnova Periodo
              </button>

              <button
                *ngIf="c.status !== 'cancelled' && c.status !== 'expired'"
                nz-button
                nzDanger
                (click)="showCancelModal()"
              >
                <i class="fa-solid fa-ban me-1"></i> Disdici / Cancella
              </button>
            </div>

            <nz-tabs>
              <!-- TAB 1: Overview -->
              <nz-tab nzTitle="Informazioni Generali">
                <nz-descriptions nzBordered [nzColumn]="2" nzSize="small">
                  <nz-descriptions-item nzTitle="Numero Contratto">
                    <strong>{{ c.contract_number }}</strong>
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Stato">
                    <nz-tag [nzColor]="statusColor(c.status)">{{ c.status.toUpperCase() }}</nz-tag>
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Titolo">
                    {{ c.title }}
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Tipologia">
                    {{ formatContractType(c.contract_type) }}
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Cliente">
                    {{ c.customer?.company_name || 'N/A' }}
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Valuta">
                    {{ c.currency }}
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Frequenza Fatturazione">
                    {{ c.billing_frequency }} ({{ c.billing_timing }})
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Prossima Fattura">
                    <strong>{{ c.next_billing_date }}</strong>
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Data Inizio">
                    {{ c.start_date }}
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Data Fine">
                    {{ c.end_date || 'A tempo indeterminato' }}
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Rinnovo Automatico">
                    {{ c.auto_renew ? 'Sì (' + (c.renewal_period_months || 12) + ' mesi)' : 'No' }}
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Ultima Fatturazione">
                    {{ c.last_billed_date || 'Nessuna' }}
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Subtotale Ciclo">
                    {{ c.subtotal }} {{ c.currency }}
                  </nz-descriptions-item>
                  <nz-descriptions-item nzTitle="Totale Ciclo (IVA incl.)">
                    <strong>{{ c.total }} {{ c.currency }}</strong>
                  </nz-descriptions-item>
                </nz-descriptions>

                <div *ngIf="c.cancellation_reason" class="mt-4">
                  <nz-alert
                    nzType="error"
                    nzShowIcon
                    [nzMessage]="'Contratto Disdetto il ' + (c.cancelled_at || '')"
                    [nzDescription]="'Motivo: ' + c.cancellation_reason"
                  ></nz-alert>
                </div>
              </nz-tab>

              <!-- TAB 2: Lines -->
              <nz-tab nzTitle="Voci del Canone">
                <nz-table
                  #linesTable
                  [nzData]="c.lines || []"
                  [nzShowPagination]="false"
                  nzBordered
                  nzSize="small"
                >
                  <thead>
                    <tr>
                      <th>Descrizione</th>
                      <th>Quantità</th>
                      <th>Prezzo Unitario</th>
                      <th>Sconto %</th>
                      <th>IVA %</th>
                      <th>Prorata</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let line of linesTable.data">
                      <td>{{ line.description }}</td>
                      <td>{{ line.quantity }}</td>
                      <td>{{ line.unit_price }} {{ c.currency }}</td>
                      <td>{{ line.discount_percent }}%</td>
                      <td>{{ line.tax_rate }}%</td>
                      <td>
                        <nz-tag>{{ line.proration_mode }}</nz-tag>
                      </td>
                    </tr>
                  </tbody>
                </nz-table>
              </nz-tab>

              <!-- TAB 3: Indexation Clause & History -->
              <nz-tab nzTitle="Rivalutazione ISTAT / IPC">
                <div *ngIf="c.indexation_clause as clause; else noClause">
                  <nz-card nzTitle="Clausola Attiva" nzType="inner" class="mb-4">
                    <nz-descriptions nzBordered [nzColumn]="2" nzSize="small">
                      <nz-descriptions-item nzTitle="Indice Scelto">
                        <nz-tag [nzColor]="clause.index_type === 'swiss_ipc' ? 'red' : 'blue'">
                          {{ clause.index_type === 'swiss_ipc' ? 'Swiss IPC' : 'ISTAT FOI' }}
                        </nz-tag>
                      </nz-descriptions-item>
                      <nz-descriptions-item nzTitle="Periodo Base">
                        {{ clause.base_index_period }}
                      </nz-descriptions-item>
                      <nz-descriptions-item nzTitle="Valore Base">
                        {{ clause.base_index_value }}
                      </nz-descriptions-item>
                      <nz-descriptions-item nzTitle="Pass-Through %">
                        {{ clause.pass_through_percent }}%
                      </nz-descriptions-item>
                      <nz-descriptions-item nzTitle="Floor % / Cap %">
                        {{ clause.floor_percent || '—' }}% / {{ clause.cap_percent || '—' }}%
                      </nz-descriptions-item>
                      <nz-descriptions-item nzTitle="Prossimo Adeguamento">
                        {{ clause.next_adjustment_date || '—' }}
                      </nz-descriptions-item>
                    </nz-descriptions>
                  </nz-card>

                  <h6>Storico Adeguamenti di Prezzo</h6>
                  <nz-table
                    #logsTable
                    [nzData]="c.indexation_logs || []"
                    [nzShowPagination]="false"
                    nzBordered
                    nzSize="small"
                  >
                    <thead>
                      <tr>
                        <th>Data Applicazione</th>
                        <th>Periodo Dal / Al</th>
                        <th>Indice Vecchio &rarr; Nuovo</th>
                        <th>Variazione Applicata</th>
                        <th>Canone Aggiornato</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let log of logsTable.data">
                        <td>{{ log.applied_at | date: 'short' }}</td>
                        <td>{{ log.period_from }} &rarr; {{ log.period_to }}</td>
                        <td>{{ log.old_index_value }} &rarr; {{ log.new_index_value }}</td>
                        <td>
                          <strong>+{{ log.applied_delta_percent }}%</strong>
                          <span class="text-muted ms-1">(grezza: {{ log.raw_delta_percent }}%)</span>
                        </td>
                        <td>
                          {{ log.old_recurring_total }} &rarr;
                          <strong>{{ log.new_recurring_total }} {{ c.currency }}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </nz-table>
                </div>
                <ng-template #noClause>
                  <nz-empty nzNotFoundContent="Nessuna clausola di indicizzazione attiva su questo contratto."></nz-empty>
                </ng-template>
              </nz-tab>
            </nz-tabs>
          </div>
        </nz-spin>

        <!-- Modals for specific actions -->
        <nz-modal
          [nzVisible]="cancelModalVisible()"
          nzTitle="Conferma Disdetta Contratto"
          (nzOnCancel)="cancelModalVisible.set(false)"
          (nzOnOk)="confirmCancellation()"
          [nzOkLoading]="actionLoading()"
        >
          <ng-container *nzModalContent>
            <p>Sei sicuro di voler disdire questo contratto? Le future fatturazioni periodiche cesseranno.</p>
            <textarea
              nz-input
              rows="3"
              placeholder="Inserisci il motivo della disdetta..."
              [(ngModel)]="cancellationReason"
            ></textarea>
          </ng-container>
        </nz-modal>

        <nz-modal
          [nzVisible]="indexationModalVisible()"
          nzTitle="Applica Adeguamento ISTAT / Swiss IPC"
          (nzOnCancel)="indexationModalVisible.set(false)"
          (nzOnOk)="confirmIndexation()"
          [nzOkLoading]="actionLoading()"
        >
          <ng-container *nzModalContent>
            <p>Specifica il periodo dell'indice target da applicare al contratto (es. <code>2026-01</code>):</p>
            <input
              nz-input
              placeholder="YYYY-MM (es. 2026-01)"
              [(ngModel)]="targetIndexPeriod"
            />
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

  @Output() readonly changed = new EventEmitter<void>();

  readonly visible = signal(false);
  readonly loading = signal(false);
  readonly actionLoading = signal(false);
  readonly contract = signal<RecurringContract | null>(null);

  readonly cancelModalVisible = signal(false);
  readonly indexationModalVisible = signal(false);

  cancellationReason = '';
  targetIndexPeriod = '';

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
        this.message.error('Errore durante il caricamento del contratto.');
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
        this.message.success('Contratto attivato con successo.');
        this.contract.set(res.data);
        this.actionLoading.set(false);
        this.changed.emit();
      },
      error: () => {
        this.message.error("Impossibile attivare il contratto.");
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
        this.message.success('Contratto sospeso.');
        this.contract.set(res.data);
        this.actionLoading.set(false);
        this.changed.emit();
      },
      error: () => {
        this.message.error('Impossibile sospendere il contratto.');
        this.actionLoading.set(false);
      },
    });
  }

  renewContract(): void {
    const c = this.contract();
    if (!c) return;
    this.actionLoading.set(true);
    this.api.renewContract(c.id).subscribe({
      next: (res) => {
        this.message.success('Contratto rinnovato con successo.');
        this.contract.set(res.data);
        this.actionLoading.set(false);
        this.changed.emit();
      },
      error: () => {
        this.message.error('Impossibile rinnovare il contratto.');
        this.actionLoading.set(false);
      },
    });
  }

  showBillNowModal(): void {
    const c = this.contract();
    if (!c) return;
    this.api.billNow(c.id).subscribe({
      next: () => {
        this.message.success('Fattura creata con successo per il ciclo corrente.');
        this.loadContract(c.id);
        this.changed.emit();
      },
      error: () => {
        this.message.error('Errore durante la fatturazione immediata del contratto.');
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
      this.message.warning('Inserisci il motivo della cancellazione.');
      return;
    }
    this.actionLoading.set(true);
    this.api.cancelContract(c.id, this.cancellationReason).subscribe({
      next: (res) => {
        this.message.success('Contratto disdetto.');
        this.contract.set(res.data);
        this.actionLoading.set(false);
        this.cancelModalVisible.set(false);
        this.changed.emit();
      },
      error: () => {
        this.message.error('Errore durante la disdetta del contratto.');
        this.actionLoading.set(false);
      },
    });
  }

  showIndexationModal(): void {
    this.targetIndexPeriod = new Date().toISOString().substring(0, 7);
    this.indexationModalVisible.set(true);
  }

  confirmIndexation(): void {
    const c = this.contract();
    if (!c || !this.targetIndexPeriod) return;

    this.actionLoading.set(true);
    this.api.applyIndexation(c.id, this.targetIndexPeriod).subscribe({
      next: (res) => {
        this.message.success('Adeguamento indice applicato con successo alle linee di canone.');
        this.contract.set(res.data);
        this.actionLoading.set(false);
        this.indexationModalVisible.set(false);
        this.changed.emit();
      },
      error: () => {
        this.message.error('Errore durante l\'applicazione della rivalutazione.');
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
        return 'Manutenzione';
      case 'rental':
        return 'Noleggio / Locazione';
      case 'software_license':
        return 'Licenza Software / SaaS';
      case 'service_subscription':
        return 'Abbonamento Servizi';
      default:
        return type;
    }
  }
}
