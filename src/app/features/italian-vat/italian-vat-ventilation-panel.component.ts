import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { AuthStore, I18nService, VentilationBasisLine, VentilationRequest } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { reportProblem } from './italian-vat-feedback';
import { ItalianVatStore } from './italian-vat.store';
import { basisTotal, todayIso, ventilationIssues } from './italian-vat.util';

/** Ventilazione dei corrispettivi: the gross takings of a day are split across the VAT rates of the purchases of the period. */
@Component({
  selector: 'app-italian-vat-ventilation-panel',
  styleUrl: '../general-ledger/localization/gl-localization.scss',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzTableModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'italianVat.receipts.ventilation' | translate">
      <div class="filters">
        <label for="iv-vent-date">{{ 'GL.COL_DATE' | translate }}</label>
        <input
          class="date-input"
          id="iv-vent-date"
          nz-input
          type="date"
          [ngModel]="entryDate()"
          (ngModelChange)="entryDate.set($event)"
        />
        <label for="iv-vent-gross">{{ 'italianVat.receipts.grossTakings' | translate }}</label>
        <input
          id="iv-vent-gross"
          nz-input
          class="amount-input"
          inputmode="decimal"
          data-testid="gross"
          [ngModel]="gross()"
          (ngModelChange)="gross.set($event)"
        />
      </div>

      <h3>{{ 'italianVat.receipts.purchaseBasis' | translate }}</h3>
      @for (line of basis(); track $index) {
        <div class="filters">
          <input
            nz-input
            class="amount-input"
            inputmode="decimal"
            [attr.aria-label]="'GL.COL_VAT_RATE' | translate"
            [attr.data-testid]="'rate-' + $index"
            [ngModel]="line.rate"
            (ngModelChange)="update($index, { rate: $event })"
          />
          <input
            nz-input
            class="amount-input"
            inputmode="decimal"
            [attr.aria-label]="'italianVat.register.taxable' | translate"
            [attr.data-testid]="'amount-' + $index"
            [ngModel]="line.amount"
            (ngModelChange)="update($index, { amount: $event })"
          />
          <input
            nz-input
            class="nature-input"
            maxlength="6"
            [attr.aria-label]="'italianVat.ui.nature' | translate"
            [ngModel]="line.nature ?? ''"
            (ngModelChange)="update($index, { nature: $event })"
          />
          <button
            nz-button
            nzSize="small"
            type="button"
            [disabled]="basis().length === 1"
            (click)="remove($index)"
          >
            {{ 'italianVat.ui.removeLine' | translate }}
          </button>
        </div>
      }
      <div class="filters">
        <button nz-button type="button" data-testid="add-line" (click)="add()">
          {{ 'italianVat.ui.addLine' | translate }}
        </button>
        <span data-testid="basis-total"
          >{{ 'italianVat.ui.basisTotal' | translate }}: {{ total() | money: currency() }}</span
        >
      </div>

      @for (issue of issues(); track issue) {
        <div class="ant-form-item-explain-error" role="alert" data-testid="issue">
          {{ 'italianVat.ui.ventilationIssue_' + issue | translate }}
        </div>
      }

      <div class="filters">
        <button
          nz-button
          type="button"
          data-testid="preview"
          [disabled]="issues().length > 0"
          [nzLoading]="store.loading()"
          (click)="preview()"
        >
          {{ 'italianVat.ui.preview' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="register"
          [disabled]="issues().length > 0 || !store.ventilation()"
          [nzLoading]="store.saving()"
          (click)="register()"
        >
          {{ 'italianVat.ui.registerTakings' | translate }}
        </button>
      </div>

      @if (store.ventilation(); as preview) {
        <nz-table
          nzSize="small"
          [nzData]="preview.lines"
          [nzShowPagination]="false"
          data-testid="ventilation-lines"
        >
          <thead>
            <tr>
              <th>{{ 'GL.COL_VAT_RATE' | translate }}</th>
              <th>{{ 'italianVat.ui.nature' | translate }}</th>
              <th nzAlign="right">%</th>
              <th nzAlign="right">{{ 'italianVat.ui.gross' | translate }}</th>
              <th nzAlign="right">{{ 'italianVat.register.taxable' | translate }}</th>
              <th nzAlign="right">{{ 'italianVat.register.vat' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of preview.lines; track $index) {
              <tr>
                <td>{{ row.rate }}%</td>
                <td>{{ row.nature }}</td>
                <td nzAlign="right">{{ row.share }}</td>
                <td nzAlign="right">{{ row.gross | money: currency() }}</td>
                <td nzAlign="right">{{ row.taxable | money: currency() }}</td>
                <td nzAlign="right">{{ row.vat | money: currency() }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        <p class="totals">
          <strong data-testid="ventilation-totals"
            >{{ 'italianVat.register.taxable' | translate }}:
            {{ preview.total_taxable | money: currency() }} -
            {{ 'italianVat.register.vat' | translate }}:
            {{ preview.total_vat | money: currency() }}</strong
          >
        </p>
      }
    </nz-card>
  `,
  styles: `
    .amount-input {
      width: 140px;
    }
    .nature-input {
      width: 90px;
    }
  `,
})
export class ItalianVatVentilationPanelComponent {
  protected readonly store = inject(ItalianVatStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;

  protected readonly entryDate = signal(todayIso());
  protected readonly gross = signal('');
  protected readonly basis = signal<VentilationBasisLine[]>([
    { rate: '22', amount: '', nature: null },
  ]);
  protected readonly total = computed(() => basisTotal(this.basis()));
  protected readonly issues = computed(() => ventilationIssues(this.gross(), this.basis()));

  protected add(): void {
    this.basis.update((lines) => [...lines, { rate: '', amount: '', nature: null }]);
  }

  protected remove(index: number): void {
    this.basis.update((lines) => lines.filter((_, i) => i !== index));
  }

  protected update(index: number, patch: Partial<VentilationBasisLine>): void {
    this.basis.update((lines) =>
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  private request(): VentilationRequest {
    return {
      entry_date: this.entryDate(),
      gross_takings: this.gross(),
      purchase_basis: this.basis().map((line) => ({
        rate: line.rate,
        amount: line.amount,
        nature: line.nature || null,
      })),
    };
  }

  protected async preview(): Promise<void> {
    await this.store.previewVentilation(this.request());
    if (this.store.error()) {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }

  protected async register(): Promise<void> {
    if (await this.store.registerVentilation(this.request())) {
      this.message.success(this.i18n.translate('italianVat.ui.takingsRegistered'));
    } else {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }
}
