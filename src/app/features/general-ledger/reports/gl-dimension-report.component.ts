import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DimensionReport, GeneralLedgerApiService, ReportDimension } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { currentYearEnd, currentYearStart } from '../shared/gl-dates';

/** Result by cost centre, profit centre or project, in the accounting currency. */
@Component({
  selector: 'app-gl-dimension-report',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzSelectModule, NzTableModule, NzTagModule, MoneyPipe, TranslatePipe],
  template: `
    <div>
      <nz-select [attr.aria-label]="'GL.DIMENSION' | translate" [(ngModel)]="dimension">
        @for (option of dimensions; track option) {
          <nz-option [nzValue]="option" [nzLabel]="'GL.DIMENSION_' + option.toUpperCase() | translate" />
        }
      </nz-select>
      <label for="dr-from">{{ 'GL.FROM' | translate }}</label>
      <input id="dr-from" nz-input type="date" [(ngModel)]="from" />
      <label for="dr-to">{{ 'GL.TO' | translate }}</label>
      <input id="dr-to" nz-input type="date" [(ngModel)]="to" />
      <button nz-button nzType="primary" type="button" [nzLoading]="loading()" (click)="load()">{{ 'GL.RUN_REPORT' | translate }}</button>
    </div>
    @if (report(); as r) {
      <p>
        <nz-tag>{{ 'GL.REPORT_CURRENCY' | translate }}: {{ r.currency }}</nz-tag>
        <nz-tag>{{ 'GL.TOTALS' | translate }}: {{ r.total | money: r.currency }}</nz-tag>
      </p>
      @for (group of r.groups; track group.dimension_id ?? group.dimension_code) {
        <h4>{{ group.dimension_code }} {{ group.dimension_name }} - {{ group.result | money: r.currency }}</h4>
        <nz-table nzSize="small" [nzData]="group.accounts" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'GL.COL_ACCOUNT' | translate }}</th>
              <th nzAlign="right">{{ 'GL.COL_DEBIT' | translate }}</th>
              <th nzAlign="right">{{ 'GL.COL_CREDIT' | translate }}</th>
              <th nzAlign="right">{{ 'GL.COL_AMOUNT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (account of group.accounts; track account.account_id) {
              <tr>
                <td>{{ account.account_code }} {{ account.account_name }}</td>
                <td nzAlign="right">{{ account.debit | money: r.currency }}</td>
                <td nzAlign="right">{{ account.credit | money: r.currency }}</td>
                <td nzAlign="right">{{ account.amount | money: r.currency }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    }
  `,
})
export class GlDimensionReportComponent {
  private readonly api = inject(GeneralLedgerApiService);
  protected readonly dimensions: ReportDimension[] = ['cost_center', 'profit_center', 'project'];
  protected readonly report = signal<DimensionReport | null>(null);
  protected readonly loading = signal(false);
  protected dimension: ReportDimension = 'cost_center';
  protected from = currentYearStart();
  protected to = currentYearEnd();

  protected load(): void {
    this.loading.set(true);
    this.api.getDimensionReport({ dimension: this.dimension, from: this.from, to: this.to }).subscribe({
      next: (res) => {
        this.report.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
