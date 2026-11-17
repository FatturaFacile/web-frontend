import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, inject, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { RecurringContractsApiService } from '@core/api/recurring-contracts-api.service';
import { BillingPreviewItem } from '@core/models/recurring-contracts.model';

@Component({
  selector: 'app-recurring-billing-batch-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzDrawerModule,
    NzTableModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzSpinModule,
    NzTagModule,
    NzAlertModule,
    NzCheckboxModule,
    NzEmptyModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="850"
      nzTitle="Elaborazione Massiva Fatturazione Periodica (Billing Engine)"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        <div class="batch-controls mb-4">
          <form nz-form nzLayout="inline" (ngSubmit)="fetchPreview()">
            <nz-form-item>
              <nz-form-label>Data Limite (Cutoff)</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  type="date"
                  [(ngModel)]="cutoffDate"
                  name="cutoffDate"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-control>
                <button nz-button nzType="primary" (click)="fetchPreview()" [nzLoading]="loading()">
                  <i class="fa-solid fa-magnifying-glass me-1"></i> Calcola Anteprima
                </button>
              </nz-form-control>
            </nz-form-item>
          </form>
        </div>

        <nz-alert
          *ngIf="previewItems().length > 0"
          nzType="info"
          nzShowIcon
          [nzMessage]="'Trovati ' + previewItems().length + ' contratti pronti per la fatturazione.'"
          nzDescription="Seleziona i contratti da fatturare. Il motore genererà le fatture garantendo l'idempotenza e aggiornando le scadenze."
          class="mb-4"
        ></nz-alert>

        <nz-table
          #previewTable
          [nzData]="previewItems()"
          [nzLoading]="loading()"
          [nzPageSize]="10"
          nzBordered
          nzSize="small"
        >
          <thead>
            <tr>
              <th
                [nzChecked]="isAllSelected()"
                [nzIndeterminate]="isIndeterminate()"
                (nzCheckedChange)="toggleSelectAll($event)"
                nzWidth="40px"
              ></th>
              <th>Contratto</th>
              <th>Cliente</th>
              <th>Periodo di Competenza</th>
              <th>Prossima Fatt.</th>
              <th>Subtotale</th>
              <th>Totale</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of previewTable.data">
              <td
                [nzChecked]="selectedContractIds.has(item.contract_id)"
                [nzDisabled]="item.is_already_billed"
                (nzCheckedChange)="toggleSelect(item.contract_id, $event)"
              ></td>
              <td><strong>{{ item.contract_number }}</strong></td>
              <td>{{ item.customer_name }}</td>
              <td>
                <span class="badge-period">
                  {{ item.period_start }} &rarr; {{ item.period_end }}
                </span>
              </td>
              <td>{{ item.next_billing_date }}</td>
              <td>{{ item.subtotal }} {{ item.currency }}</td>
              <td><strong>{{ item.total }} {{ item.currency }}</strong></td>
              <td>
                <nz-tag [nzColor]="item.is_already_billed ? 'orange' : 'green'">
                  {{ item.is_already_billed ? 'Già Emessa' : 'Da Emettere' }}
                </nz-tag>
              </td>
            </tr>
          </tbody>
        </nz-table>

        <div class="drawer-footer mt-4">
          <button nz-button nzType="default" (click)="close()" class="me-2">
            Annulla
          </button>
          <button
            nz-button
            nzType="primary"
            (click)="executeRun()"
            [nzLoading]="executing()"
            [disabled]="selectedContractIds.size === 0"
          >
            <i class="fa-solid fa-bolt me-1"></i>
            Esegui Fatturazione ({{ selectedContractIds.size }} contratti)
          </button>
        </div>
      </ng-container>
    </nz-drawer>
  `,
  styles: [
    `
      .batch-controls {
        background: #fbfbfb;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #e8e8e8;
      }
      .badge-period {
        font-size: 11px;
        color: #595959;
      }
      .drawer-footer {
        display: flex;
        justify-content: flex-end;
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
      .me-2 {
        margin-right: 8px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringBillingBatchDrawerComponent {
  private readonly api = inject(RecurringContractsApiService);
  private readonly message = inject(NzMessageService);

  @Output() readonly runCompleted = new EventEmitter<void>();

  readonly visible = signal(false);
  readonly loading = signal(false);
  readonly executing = signal(false);
  readonly previewItems = signal<BillingPreviewItem[]>([]);

  cutoffDate = new Date().toISOString().substring(0, 10);
  selectedContractIds = new Set<string>();

  open(): void {
    this.visible.set(true);
    this.fetchPreview();
  }

  close(): void {
    this.visible.set(false);
  }

  fetchPreview(): void {
    if (!this.cutoffDate) return;
    this.loading.set(true);
    this.selectedContractIds.clear();

    this.api.getBillingPreview(this.cutoffDate).subscribe({
      next: (res) => {
        this.previewItems.set(res.preview || []);
        // Automatically preselect all not already billed
        res.preview.forEach((item) => {
          if (!item.is_already_billed) {
            this.selectedContractIds.add(item.contract_id);
          }
        });
        this.loading.set(false);
      },
      error: () => {
        this.message.error("Errore durante il calcolo dell'anteprima di fatturazione.");
        this.loading.set(false);
      },
    });
  }

  isAllSelected(): boolean {
    const unbilled = this.previewItems().filter((i) => !i.is_already_billed);
    return unbilled.length > 0 && unbilled.every((i) => this.selectedContractIds.has(i.contract_id));
  }

  isIndeterminate(): boolean {
    const unbilled = this.previewItems().filter((i) => !i.is_already_billed);
    const selectedCount = unbilled.filter((i) => this.selectedContractIds.has(i.contract_id)).length;
    return selectedCount > 0 && selectedCount < unbilled.length;
  }

  toggleSelectAll(checked: boolean): void {
    const unbilled = this.previewItems().filter((i) => !i.is_already_billed);
    if (checked) {
      unbilled.forEach((i) => this.selectedContractIds.add(i.contract_id));
    } else {
      unbilled.forEach((i) => this.selectedContractIds.delete(i.contract_id));
    }
  }

  toggleSelect(contractId: string, checked: boolean): void {
    if (checked) {
      this.selectedContractIds.add(contractId);
    } else {
      this.selectedContractIds.delete(contractId);
    }
  }

  executeRun(): void {
    if (this.selectedContractIds.size === 0) {
      this.message.warning('Nessun contratto selezionato per la fatturazione.');
      return;
    }

    this.executing.set(true);
    this.api
      .executeBillingRun({
        cutoff_date: this.cutoffDate,
        run_type: 'manual',
        contract_ids: Array.from(this.selectedContractIds),
      })
      .subscribe({
        next: (res) => {
          this.message.success(
            `Elaborazione completata: ${res.run.invoices_generated} fatture generate con successo.`
          );
          this.executing.set(false);
          this.close();
          this.runCompleted.emit();
        },
        error: () => {
          this.message.error("Errore durante l'esecuzione del batch di fatturazione.");
          this.executing.set(false);
        },
      });
  }
}
