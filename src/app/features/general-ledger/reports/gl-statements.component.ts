import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { GeneralLedgerApiService, LedgerStatementReport } from '@core';
import { TranslatePipe } from '@shared';
import { currentYearEnd, currentYearStart } from '../shared/gl-dates';
import { GlStatementViewComponent } from './gl-statement-view.component';

/** Balance sheet (as of a date) or income statement (range), with an optional comparison period. */
@Component({
  selector: 'app-gl-statements',
  imports: [FormsModule, NzButtonModule, NzInputModule, GlStatementViewComponent, TranslatePipe],
  template: `
    <div>
      @if (mode() === 'balance-sheet') {
        <label for="st-asof">{{ 'GL.AS_OF' | translate }}</label>
        <input id="st-asof" nz-input type="date" [(ngModel)]="asOf" />
        <label for="st-casof">{{ 'GL.COMPARE_AS_OF' | translate }}</label>
        <input id="st-casof" nz-input type="date" [(ngModel)]="compareAsOf" />
      } @else {
        <label for="st-from">{{ 'GL.FROM' | translate }}</label>
        <input id="st-from" nz-input type="date" [(ngModel)]="from" />
        <label for="st-to">{{ 'GL.TO' | translate }}</label>
        <input id="st-to" nz-input type="date" [(ngModel)]="to" />
        <label for="st-cfrom">{{ 'GL.COMPARE_FROM' | translate }}</label>
        <input id="st-cfrom" nz-input type="date" [(ngModel)]="compareFrom" />
        <label for="st-cto">{{ 'GL.COMPARE_TO' | translate }}</label>
        <input id="st-cto" nz-input type="date" [(ngModel)]="compareTo" />
      }
      <button nz-button nzType="primary" type="button" [nzLoading]="loading()" (click)="load()">{{ 'GL.RUN_REPORT' | translate }}</button>
    </div>
    <app-gl-statement-view [report]="report()" />
  `,
})
export class GlStatementsComponent {
  readonly mode = input.required<'balance-sheet' | 'income-statement'>();

  private readonly api = inject(GeneralLedgerApiService);
  protected readonly report = signal<LedgerStatementReport | null>(null);
  protected readonly loading = signal(false);

  protected asOf = currentYearEnd();
  protected compareAsOf = '';
  protected from = currentYearStart();
  protected to = currentYearEnd();
  protected compareFrom = '';
  protected compareTo = '';

  protected load(): void {
    this.loading.set(true);
    const call =
      this.mode() === 'balance-sheet'
        ? this.api.getBalanceSheetReport({ as_of: this.asOf, compare_as_of: this.compareAsOf || null })
        : this.api.getIncomeStatementReport({
            from: this.from,
            to: this.to,
            compare_from: this.compareFrom || null,
            compare_to: this.compareTo || null,
          });
    call.subscribe({
      next: (res) => {
        this.report.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
