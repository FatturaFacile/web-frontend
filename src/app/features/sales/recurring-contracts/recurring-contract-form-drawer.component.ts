import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { RecurringContractsApiService } from '@core/api/recurring-contracts-api.service';
import { RecurringContract } from '@core/models/recurring-contracts.model';

@Component({
  selector: 'app-recurring-contract-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzTableModule,
    NzTabsModule,
    NzGridModule,
    NzSpinModule,
    NzDividerModule,
    NzSwitchModule,
    NzCardModule,
    NzIconModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="900"
      [nzTitle]="isEditing() ? 'Modifica Contratto Ricorrente' : 'Nuovo Contratto Ricorrente'"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        <nz-spin [nzSpinning]="loading()">
          <form nz-form [formGroup]="form" (ngSubmit)="submitForm()" nzLayout="vertical">
            <nz-tabs>
              <!-- TAB 1: General Info & Terms -->
              <nz-tab nzTitle="Dati Generali & Sottoscrizione">
                <div nz-row [nzGutter]="16">
                  <div nz-col [nzSpan]="12">
                    <nz-form-item>
                      <nz-form-label nzRequired>Titolo Contratto</nz-form-label>
                      <nz-form-control nzErrorTip="Inserisci il titolo del contratto">
                        <input nz-input formControlName="title" placeholder="es. Canone Assistenza Server 2026" />
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                  <div nz-col [nzSpan]="12">
                    <nz-form-item>
                      <nz-form-label nzRequired>ID Cliente / Contatto (UUID)</nz-form-label>
                      <nz-form-control nzErrorTip="Seleziona o specifica il cliente">
                        <input nz-input formControlName="customer_id" placeholder="UUID del cliente" />
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                </div>

                <div nz-row [nzGutter]="16">
                  <div nz-col [nzSpan]="8">
                    <nz-form-item>
                      <nz-form-label nzRequired>Tipologia Contratto</nz-form-label>
                      <nz-form-control>
                        <nz-select formControlName="contract_type">
                          <nz-option nzValue="maintenance" nzLabel="Manutenzione"></nz-option>
                          <nz-option nzValue="rental" nzLabel="Noleggio / Locazione"></nz-option>
                          <nz-option nzValue="software_license" nzLabel="Licenza Software / SaaS"></nz-option>
                          <nz-option nzValue="service_subscription" nzLabel="Abbonamento Servizi"></nz-option>
                        </nz-select>
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                  <div nz-col [nzSpan]="8">
                    <nz-form-item>
                      <nz-form-label nzRequired>Valuta</nz-form-label>
                      <nz-form-control>
                        <nz-select formControlName="currency">
                          <nz-option nzValue="CHF" nzLabel="CHF (Franco Svizzero)"></nz-option>
                          <nz-option nzValue="EUR" nzLabel="EUR (Euro)"></nz-option>
                        </nz-select>
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                  <div nz-col [nzSpan]="8">
                    <nz-form-item>
                      <nz-form-label nzRequired>Frequenza Fatturazione</nz-form-label>
                      <nz-form-control>
                        <nz-select formControlName="billing_frequency">
                          <nz-option nzValue="monthly" nzLabel="Mensile"></nz-option>
                          <nz-option nzValue="quarterly" nzLabel="Trimestrale"></nz-option>
                          <nz-option nzValue="semi_annual" nzLabel="Semestrale"></nz-option>
                          <nz-option nzValue="annual" nzLabel="Annuale"></nz-option>
                          <nz-option nzValue="custom_days" nzLabel="Intervallo Personalizzato (gg)"></nz-option>
                        </nz-select>
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                </div>

                <div nz-row [nzGutter]="16">
                  <div nz-col [nzSpan]="8">
                    <nz-form-item>
                      <nz-form-label nzRequired>Tempistica Fatturazione</nz-form-label>
                      <nz-form-control>
                        <nz-select formControlName="billing_timing">
                          <nz-option nzValue="in_advance" nzLabel="Anticipata"></nz-option>
                          <nz-option nzValue="in_arrears" nzLabel="Posticipata"></nz-option>
                        </nz-select>
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                  <div nz-col [nzSpan]="8">
                    <nz-form-item>
                      <nz-form-label nzRequired>Data Inizio</nz-form-label>
                      <nz-form-control>
                        <input nz-input type="date" formControlName="start_date" />
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                  <div nz-col [nzSpan]="8">
                    <nz-form-item>
                      <nz-form-label>Data Fine (opzionale)</nz-form-label>
                      <nz-form-control>
                        <input nz-input type="date" formControlName="end_date" />
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                </div>

                <div nz-row [nzGutter]="16">
                  <div nz-col [nzSpan]="8">
                    <nz-form-item>
                      <nz-form-label nzRequired>Prossima Fatturazione</nz-form-label>
                      <nz-form-control>
                        <input nz-input type="date" formControlName="next_billing_date" />
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                  <div nz-col [nzSpan]="8">
                    <nz-form-item>
                      <nz-form-label>Preavviso Disdetta (gg)</nz-form-label>
                      <nz-form-control>
                        <input nz-input type="number" formControlName="notice_period_days" />
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                  <div nz-col [nzSpan]="8">
                    <nz-form-item>
                      <nz-form-label>Emissione Automatica</nz-form-label>
                      <nz-form-control>
                        <nz-switch formControlName="invoice_auto_issue"></nz-switch>
                        <span class="ms-2 text-muted">Emetti fattura (anziché bozza)</span>
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                </div>

                <div nz-row [nzGutter]="16">
                  <div nz-col [nzSpan]="8">
                    <nz-form-item>
                      <nz-form-label>Rinnovo Automatico</nz-form-label>
                      <nz-form-control>
                        <nz-switch formControlName="auto_renew"></nz-switch>
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                  <div nz-col [nzSpan]="8" *ngIf="form.get('auto_renew')?.value">
                    <nz-form-item>
                      <nz-form-label>Mesi Rinnovo</nz-form-label>
                      <nz-form-control>
                        <input nz-input type="number" formControlName="renewal_period_months" placeholder="es. 12" />
                      </nz-form-control>
                    </nz-form-item>
                  </div>
                </div>
              </nz-tab>

              <!-- TAB 2: Contract Lines & Proration -->
              <nz-tab nzTitle="Voci di Canone & Ripartizione">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <span class="text-muted">Specifica le righe periodiche e il metodo di prorata</span>
                  <button nz-button nzType="dashed" (click)="addLine()" type="button">
                    <i class="fa-solid fa-plus me-1"></i> Aggiungi Voce
                  </button>
                </div>

                <div formArrayName="lines">
                  <div
                    *ngFor="let lineCtrl of linesArray.controls; let i = index"
                    [formGroupName]="i"
                    class="line-row-card mb-3 p-3 border rounded"
                  >
                    <div nz-row [nzGutter]="12">
                      <div nz-col [nzSpan]="8">
                        <nz-form-item>
                          <nz-form-label nzRequired>Descrizione Voce</nz-form-label>
                          <nz-form-control>
                            <input nz-input formControlName="description" placeholder="es. Canone Base" />
                          </nz-form-control>
                        </nz-form-item>
                      </div>
                      <div nz-col [nzSpan]="4">
                        <nz-form-item>
                          <nz-form-label nzRequired>Quantità</nz-form-label>
                          <nz-form-control>
                            <input nz-input type="number" step="0.0001" formControlName="quantity" />
                          </nz-form-control>
                        </nz-form-item>
                      </div>
                      <div nz-col [nzSpan]="4">
                        <nz-form-item>
                          <nz-form-label nzRequired>Prezzo Unitario</nz-form-label>
                          <nz-form-control>
                            <input nz-input type="number" step="0.0001" formControlName="unit_price" />
                          </nz-form-control>
                        </nz-form-item>
                      </div>
                      <div nz-col [nzSpan]="4">
                        <nz-form-item>
                          <nz-form-label>Sconto %</nz-form-label>
                          <nz-form-control>
                            <input nz-input type="number" step="0.01" formControlName="discount_percent" />
                          </nz-form-control>
                        </nz-form-item>
                      </div>
                      <div nz-col [nzSpan]="4">
                        <nz-form-item>
                          <nz-form-label>Aliquota IVA %</nz-form-label>
                          <nz-form-control>
                            <input nz-input type="number" step="0.1" formControlName="tax_rate" />
                          </nz-form-control>
                        </nz-form-item>
                      </div>
                    </div>

                    <div nz-row [nzGutter]="12" class="align-items-center">
                      <div nz-col [nzSpan]="10">
                        <nz-form-item class="mb-0">
                          <nz-form-label>Modalità Prorata Ciclo</nz-form-label>
                          <nz-form-control>
                            <nz-select formControlName="proration_mode">
                              <nz-option nzValue="none" nzLabel="Nessuna prorata (Canone intero)"></nz-option>
                              <nz-option nzValue="daily_exact" nzLabel="Giorni esatti effettivi (Actual/Actual)"></nz-option>
                              <nz-option nzValue="thirty_day_month" nzLabel="Mese commerciale (30/360)"></nz-option>
                            </nz-select>
                          </nz-form-control>
                        </nz-form-item>
                      </div>
                      <div nz-col [nzSpan]="14" class="text-end">
                        <button
                          nz-button
                          nzType="text"
                          nzDanger
                          (click)="removeLine(i)"
                          type="button"
                          [disabled]="linesArray.length <= 1"
                        >
                          <i class="fa-solid fa-trash me-1"></i> Rimuovi
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </nz-tab>

              <!-- TAB 3: Indexation Clause -->
              <nz-tab nzTitle="Clausola ISTAT / Swiss IPC" formGroupName="indexation_clause">
                <nz-card nzType="inner" nzTitle="Parametri di Rivalutazione Periodica">
                  <div nz-row [nzGutter]="16">
                    <div nz-col [nzSpan]="8">
                      <nz-form-item>
                        <nz-form-label>Indice di Riferimento</nz-form-label>
                        <nz-form-control>
                          <nz-select formControlName="index_type">
                            <nz-option nzValue="none" nzLabel="Nessuna Rivalutazione"></nz-option>
                            <nz-option nzValue="istat_foi" nzLabel="ISTAT FOI (Italia)"></nz-option>
                            <nz-option nzValue="swiss_ipc" nzLabel="Swiss IPC (Svizzera)"></nz-option>
                          </nz-select>
                        </nz-form-control>
                      </nz-form-item>
                    </div>
                    <div nz-col [nzSpan]="8">
                      <nz-form-item>
                        <nz-form-label>Periodo Base (YYYY-MM)</nz-form-label>
                        <nz-form-control>
                          <input nz-input placeholder="es. 2025-01" formControlName="base_index_period" />
                        </nz-form-control>
                      </nz-form-item>
                    </div>
                    <div nz-col [nzSpan]="8">
                      <nz-form-item>
                        <nz-form-label>Valore Indice Base</nz-form-label>
                        <nz-form-control>
                          <input nz-input type="number" step="0.0001" formControlName="base_index_value" />
                        </nz-form-control>
                      </nz-form-item>
                    </div>
                  </div>

                  <div nz-row [nzGutter]="16">
                    <div nz-col [nzSpan]="6">
                      <nz-form-item>
                        <nz-form-label>Pass-Through % (es. 75 o 100)</nz-form-label>
                        <nz-form-control>
                          <input nz-input type="number" step="0.01" formControlName="pass_through_percent" />
                        </nz-form-control>
                      </nz-form-item>
                    </div>
                    <div nz-col [nzSpan]="6">
                      <nz-form-item>
                        <nz-form-label>Floor % (Rivalutazione Minima)</nz-form-label>
                        <nz-form-control>
                          <input nz-input type="number" step="0.01" formControlName="floor_percent" placeholder="opzionale" />
                        </nz-form-control>
                      </nz-form-item>
                    </div>
                    <div nz-col [nzSpan]="6">
                      <nz-form-item>
                        <nz-form-label>Cap % (Tetto Massimo)</nz-form-label>
                        <nz-form-control>
                          <input nz-input type="number" step="0.01" formControlName="cap_percent" placeholder="opzionale" />
                        </nz-form-control>
                      </nz-form-item>
                    </div>
                    <div nz-col [nzSpan]="6">
                      <nz-form-item>
                        <nz-form-label>Frequenza Adeguamento (Mesi)</nz-form-label>
                        <nz-form-control>
                          <input nz-input type="number" formControlName="adjustment_frequency_months" />
                        </nz-form-control>
                      </nz-form-item>
                    </div>
                  </div>
                </nz-card>
              </nz-tab>
            </nz-tabs>

            <div class="drawer-actions mt-4">
              <button nz-button nzType="default" (click)="close()" type="button" class="me-2">
                Annulla
              </button>
              <button nz-button nzType="primary" [nzLoading]="saving()" type="submit">
                <i class="fa-solid fa-check me-1"></i>
                {{ isEditing() ? 'Salva Modifiche' : 'Crea Contratto' }}
              </button>
            </div>
          </form>
        </nz-spin>
      </ng-container>
    </nz-drawer>
  `,
  styles: [
    `
      .line-row-card {
        background-color: #fafafa;
      }
      .drawer-actions {
        display: flex;
        justify-content: flex-end;
      }
      .me-1 {
        margin-right: 4px;
      }
      .me-2 {
        margin-right: 8px;
      }
      .ms-2 {
        margin-left: 8px;
      }
      .mt-4 {
        margin-top: 16px;
      }
      .mb-3 {
        margin-bottom: 12px;
      }
      .text-muted {
        color: #8c8c8c;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringContractFormDrawerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RecurringContractsApiService);
  private readonly message = inject(NzMessageService);

  @Output() readonly saved = new EventEmitter<void>();

  readonly visible = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly isEditing = signal(false);
  readonly currentContractId = signal<string | null>(null);

  form!: FormGroup;

  get linesArray(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  ngOnInit(): void {
    this.buildForm();
  }

  buildForm(): void {
    this.form = this.fb.group({
      title: ['', Validators.required],
      customer_id: ['', Validators.required],
      contract_type: ['service_subscription', Validators.required],
      currency: ['EUR', Validators.required],
      billing_frequency: ['monthly', Validators.required],
      billing_timing: ['in_advance', Validators.required],
      start_date: [new Date().toISOString().substring(0, 10), Validators.required],
      end_date: [null],
      next_billing_date: [new Date().toISOString().substring(0, 10), Validators.required],
      notice_period_days: [30, [Validators.required, Validators.min(0)]],
      auto_renew: [true],
      renewal_period_months: [12],
      invoice_auto_issue: [false],
      lines: this.fb.array([]),
      indexation_clause: this.fb.group({
        index_type: ['none'],
        base_index_period: [''],
        base_index_value: ['100.0000'],
        pass_through_percent: ['100.00'],
        floor_percent: [null],
        cap_percent: [null],
        adjustment_frequency_months: [12],
      }),
    });

    this.addLine();
  }

  createLineGroup(): FormGroup {
    return this.fb.group({
      description: ['', Validators.required],
      quantity: ['1.0000', [Validators.required, Validators.min(0.0001)]],
      unit_price: ['0.0000', [Validators.required, Validators.min(0)]],
      discount_percent: ['0.00'],
      tax_rate: ['22.00'],
      proration_mode: ['none', Validators.required],
    });
  }

  addLine(): void {
    this.linesArray.push(this.createLineGroup());
  }

  removeLine(index: number): void {
    if (this.linesArray.length > 1) {
      this.linesArray.removeAt(index);
    }
  }

  openForCreate(): void {
    this.isEditing.set(false);
    this.currentContractId.set(null);
    this.buildForm();
    this.visible.set(true);
  }

  openForEdit(contract: RecurringContract): void {
    this.isEditing.set(true);
    this.currentContractId.set(contract.id);
    this.visible.set(true);
    this.loading.set(true);

    this.api.getContract(contract.id).subscribe({
      next: (res) => {
        const c = res.data;
        this.form.patchValue({
          title: c.title,
          customer_id: c.customer_id,
          contract_type: c.contract_type,
          currency: c.currency,
          billing_frequency: c.billing_frequency,
          billing_timing: c.billing_timing,
          start_date: c.start_date,
          end_date: c.end_date,
          next_billing_date: c.next_billing_date,
          notice_period_days: c.notice_period_days,
          auto_renew: c.auto_renew,
          renewal_period_months: c.renewal_period_months,
          invoice_auto_issue: c.invoice_auto_issue,
        });

        this.linesArray.clear();
        if (c.lines && c.lines.length > 0) {
          c.lines.forEach((l) => {
            const grp = this.createLineGroup();
            grp.patchValue({
              description: l.description,
              quantity: l.quantity,
              unit_price: l.unit_price,
              discount_percent: l.discount_percent,
              tax_rate: l.tax_rate,
              proration_mode: l.proration_mode,
            });
            this.linesArray.push(grp);
          });
        } else {
          this.addLine();
        }

        if (c.indexation_clause) {
          this.form.get('indexation_clause')?.patchValue(c.indexation_clause);
        }

        this.loading.set(false);
      },
      error: () => {
        this.message.error('Impossibile caricare il contratto.');
        this.loading.set(false);
      },
    });
  }

  close(): void {
    this.visible.set(false);
  }

  submitForm(): void {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((ctrl) => {
        ctrl.markAsDirty();
        ctrl.updateValueAndValidity({ onlySelf: true });
      });
      this.message.warning('Compila correttamente tutti i campi obbligatori.');
      return;
    }

    this.saving.set(true);
    const payload = this.form.value;

    const request$ = this.isEditing()
      ? this.api.updateContract(this.currentContractId()!, payload)
      : this.api.createContract(payload);

    request$.subscribe({
      next: () => {
        this.message.success(
          this.isEditing() ? 'Contratto modificato con successo.' : 'Contratto creato con successo.'
        );
        this.saving.set(false);
        this.close();
        this.saved.emit();
      },
      error: () => {
        this.message.error('Errore durante il salvataggio del contratto.');
        this.saving.set(false);
      },
    });
  }
}
