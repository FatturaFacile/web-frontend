import { Component, inject, model, output, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AccountingApiService, CreateLedgerEntryPayload } from '@core';

@Component({
  selector: 'app-ledger-entry-form-drawer',
  imports: [
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzDatePickerModule,
    NzButtonModule,
    NzIconModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      nzTitle="Nuova Registrazione Prima Nota"
      [nzWidth]="640"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="entry_number">Numero Registrazione</nz-form-label>
            <nz-form-control nzErrorTip="Il numero è obbligatorio">
              <input
                nz-input
                id="entry_number"
                formControlName="entry_number"
                placeholder="Es. GL-2026-0042"
              />
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired nzFor="date">Data Contabile</nz-form-label>
            <nz-form-control nzErrorTip="La data è obbligatoria">
              <nz-date-picker id="date" formControlName="date" style="width: 100%;" />
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired nzFor="description">Descrizione / Causale</nz-form-label>
            <nz-form-control nzErrorTip="La descrizione è obbligatoria">
              <input
                nz-input
                id="description"
                formControlName="description"
                placeholder="Es. Rilevazione giroconto bancario..."
              />
            </nz-form-control>
          </nz-form-item>

          <!-- Dynamic Lines Section -->
          <div class="lines-header">
            <h4>Righe Contabili (Dare / Avere)</h4>
            <button nz-button nzType="dashed" nzSize="small" type="button" (click)="addLine()">
              <nz-icon nzType="plus" /> Aggiungi Riga
            </button>
          </div>

          <div formArrayName="lines" class="lines-container">
            @for (line of linesArray.controls; track $index) {
              <div [formGroupName]="$index" class="line-row">
                <div class="field-account">
                  <input
                    nz-input
                    placeholder="ID / Codice Conto"
                    formControlName="account_id"
                  />
                </div>
                <div class="field-amount">
                  <nz-input-number
                    formControlName="debit"
                    placeholder="Dare"
                    [nzMin]="0"
                    style="width: 100%;"
                  />
                </div>
                <div class="field-amount">
                  <nz-input-number
                    formControlName="credit"
                    placeholder="Avere"
                    [nzMin]="0"
                    style="width: 100%;"
                  />
                </div>
                <button
                  nz-button
                  nzType="text"
                  nzDanger
                  nzSize="small"
                  type="button"
                  (click)="removeLine($index)"
                  [disabled]="linesArray.length <= 2"
                >
                  <nz-icon nzType="delete" />
                </button>
              </div>
            }
          </div>

          <div class="totals-summary">
            <div>Totale Dare: <strong>€ {{ totalDebit() }}</strong></div>
            <div>Totale Avere: <strong>€ {{ totalCredit() }}</strong></div>
            @if (totalDebit() !== totalCredit()) {
              <div class="imbalance-warning">
                La registrazione non è in pareggio (sbilancio: € {{ totalDebit() - totalCredit() }})
              </div>
            }
          </div>

          <div class="footer-actions">
            <button nz-button type="button" (click)="open.set(false)">Annulla</button>
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="isSaving()"
              [disabled]="totalDebit() !== totalCredit() || totalDebit() === 0"
            >
              Registra a Libro Giornale
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .lines-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 16px 0 8px;
    }
    .lines-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }
    .line-row {
      display: flex;
      gap: 8px;
      align-items: center;
      background: #fafafa;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #f0f0f0;
    }
    .field-account {
      flex: 2;
    }
    .field-amount {
      flex: 1;
    }
    .totals-summary {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      display: flex;
      gap: 24px;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .imbalance-warning {
      color: #cf1322;
      font-weight: 500;
      width: 100%;
    }
    .footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;
    }
  `,
})
export class LedgerEntryFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(AccountingApiService);
  private readonly message = inject(NzMessageService);

  readonly open = model.required<boolean>();
  readonly saved = output<void>();

  protected readonly isSaving = signal(false);

  protected readonly form = this.fb.group({
    entry_number: this.fb.control<string>(`GL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`, [Validators.required]),
    date: this.fb.control<Date | string>(new Date(), [Validators.required]),
    description: this.fb.control<string>('', [Validators.required]),
    lines: this.fb.array([
      this.createLine('1010-Cassa', 100, 0),
      this.createLine('2010-Fornitori', 0, 100),
    ]),
  });

  get linesArray(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  createLine(accountId = '', debit = 0, credit = 0): FormGroup {
    return this.fb.group({
      account_id: this.fb.control<string>(accountId, [Validators.required]),
      debit: this.fb.control<number>(debit, [Validators.min(0)]),
      credit: this.fb.control<number>(credit, [Validators.min(0)]),
      description: this.fb.control<string>(''),
    });
  }

  addLine(): void {
    this.linesArray.push(this.createLine());
  }

  removeLine(index: number): void {
    if (this.linesArray.length > 2) {
      this.linesArray.removeAt(index);
    }
  }

  totalDebit(): number {
    return this.linesArray.value.reduce(
      (sum: number, line: { debit?: number }) => sum + (Number(line.debit) || 0),
      0
    );
  }

  totalCredit(): number {
    return this.linesArray.value.reduce(
      (sum: number, line: { credit?: number }) => sum + (Number(line.credit) || 0),
      0
    );
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.totalDebit() !== this.totalCredit()) {
      this.message.error('La scrittura deve essere in pareggio: Dare = Avere');
      return;
    }

    this.isSaving.set(true);
    const val = this.form.getRawValue();
    const dateStr = val.date instanceof Date ? val.date.toISOString().split('T')[0] : String(val.date);

    const rawLines = val.lines as Array<{ account_id: string; debit: number; credit: number; description?: string }>;
    const payload: CreateLedgerEntryPayload = {
      entry_number: val.entry_number,
      date: dateStr,
      description: val.description,
      lines: rawLines.map((l) => ({
        account_id: l.account_id,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || undefined,
      })),
    };

    this.api.createLedgerEntry(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.message.success('Registrazione a libro giornale completata');
        this.open.set(false);
        this.saved.emit();
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }
}
