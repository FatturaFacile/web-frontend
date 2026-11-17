import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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
import { PriceIndexRate } from '@core/models/recurring-contracts.model';

@Component({
  selector: 'app-price-index-registry-drawer',
  standalone: true,
  imports: [
    CommonModule,
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
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="640"
      nzTitle="Registro Indici di Rivalutazione (ISTAT FOI & Swiss IPC)"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        <div class="drawer-header-actions mb-4">
          <button nz-button nzType="primary" (click)="showCreateModal()">
            <i class="fa-solid fa-plus me-1"></i> Nuovo Valore Indice
          </button>
          <button nz-button nzType="default" (click)="loadIndices()" [nzLoading]="loading()">
            <i class="fa-solid fa-arrows-rotate me-1"></i> Ricarica
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
              <th>Indice</th>
              <th>Periodo (YYYY-MM)</th>
              <th>Valore</th>
              <th>Data Pubblicazione</th>
              <th>Fonte / Note</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let rate of indicesTable.data">
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
          </tbody>
        </nz-table>

        <nz-modal
          [nzVisible]="createModalVisible()"
          nzTitle="Registra Tasso Indice dei Prezzi"
          (nzOnCancel)="createModalVisible.set(false)"
          (nzOnOk)="saveNewRate()"
          [nzOkLoading]="saving()"
        >
          <ng-container *nzModalContent>
            <form nz-form nzLayout="vertical">
              <nz-form-item>
                <nz-form-label nzRequired>Tipo Indice</nz-form-label>
                <nz-form-control>
                  <nz-select [(ngModel)]="newRate.index_type" name="index_type">
                    <nz-option nzValue="istat_foi" nzLabel="ISTAT FOI (Italia)"></nz-option>
                    <nz-option nzValue="swiss_ipc" nzLabel="Swiss IPC (Svizzera)"></nz-option>
                  </nz-select>
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label nzRequired>Periodo di Riferimento (YYYY-MM)</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    placeholder="es. 2026-01"
                    [(ngModel)]="newRate.period"
                    name="period"
                  />
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label nzRequired>Valore Indice (Base / Quota)</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    type="number"
                    step="0.0001"
                    placeholder="es. 104.2500"
                    [(ngModel)]="newRate.index_value"
                    name="index_value"
                  />
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label>Data Pubblicazione Gazzetta / UST</nz-form-label>
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
                <nz-form-label>Riferimento Bollettino / Fonte Ufficiale</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    placeholder="es. GU n. 15 / UST Statistiche"
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
export class PriceIndexRegistryDrawerComponent implements OnInit {
  private readonly api = inject(RecurringContractsApiService);
  private readonly message = inject(NzMessageService);

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

  ngOnInit(): void {
    // Loaded on open
  }

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
        this.message.error('Errore durante il caricamento del registro indici.');
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
      this.message.warning('Compila periodo e valore indice prima di salvare.');
      return;
    }

    this.saving.set(true);
    this.api.storePriceIndexRate(this.newRate).subscribe({
      next: () => {
        this.message.success('Valore indice registrato con successo.');
        this.saving.set(false);
        this.createModalVisible.set(false);
        this.loadIndices();
      },
      error: () => {
        this.message.error('Errore durante il salvataggio del tasso indice.');
        this.saving.set(false);
      },
    });
  }
}
