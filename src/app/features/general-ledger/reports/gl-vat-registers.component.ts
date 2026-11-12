import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { AuthStore, GeneralLedgerApiService, VatRegister } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { currentYearEnd, currentYearStart } from '../shared/gl-dates';

/** Sales or purchases VAT register of a date range. */
@Component({
  selector: 'app-gl-vat-registers',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzSelectModule, NzTableModule, MoneyPipe, TranslatePipe],
  template: `
    <div>
      <nz-select [attr.aria-label]="'GL.VAT_REGISTER_TYPE' | translate" [(ngModel)]="type">
        <nz-option nzValue="sales" [nzLabel]="'GL.VAT_SALES' | translate" />
        <nz-option nzValue="purchases" [nzLabel]="'GL.VAT_PURCHASES' | translate" />
      </nz-select>
      <label for="vr-from">{{ 'GL.FROM' | translate }}</label>
      <input id="vr-from" nz-input type="date" [(ngModel)]="from" />
      <label for="vr-to">{{ 'GL.TO' | translate }}</label>
      <input id="vr-to" nz-input type="date" [(ngModel)]="to" />
      <button nz-button nzType="primary" type="button" [nzLoading]="loading()" (click)="load()">{{ 'GL.RUN_REPORT' | translate }}</button>
    </div>
    @if (register(); as r) {
      <nz-table nzSize="small" [nzData]="r.data" [nzPageSize]="50">
        <thead>
          <tr>
            <th>{{ 'GL.COL_PROTOCOL' | translate }}</th>
            <th>{{ 'GL.COL_DATE' | translate }}</th>
            <th>{{ 'GL.COL_DOCUMENT' | translate }}</th>
            <th>{{ 'GL.COL_PARTNER' | translate }}</th>
            <th nzAlign="right">{{ 'GL.COL_TAXABLE' | translate }}</th>
            <th nzAlign="right">{{ 'GL.COL_VAT_RATE' | translate }}</th>
            <th nzAlign="right">{{ 'GL.COL_VAT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of r.data; track $index) {
            <tr>
              <td>{{ row.protocol_number }}</td>
              <td>{{ row.posting_date }}</td>
              <td>{{ row.document_number }}</td>
              <td>{{ row.partner_name }}</td>
              <td nzAlign="right">{{ row.taxable_amount | money: currency() }}</td>
              <td nzAlign="right">{{ row.vat_rate }}%</td>
              <td nzAlign="right">{{ row.vat_amount | money: currency() }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      <p>
        <strong>{{ 'GL.COL_TAXABLE' | translate }}: {{ r.totals.taxable | money: currency() }} -
          {{ 'GL.COL_VAT' | translate }}: {{ r.totals.tax | money: currency() }}</strong>
      </p>
    }
  `,
})
export class GlVatRegistersComponent {
  private readonly api = inject(GeneralLedgerApiService);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly register = signal<VatRegister | null>(null);
  protected readonly loading = signal(false);
  protected type: 'sales' | 'purchases' = 'sales';
  protected from = currentYearStart();
  protected to = currentYearEnd();

  protected load(): void {
    this.loading.set(true);
    this.api.getVatRegister(this.type, { from: this.from, to: this.to }).subscribe({
      next: (res) => {
        this.register.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
