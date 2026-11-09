import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService, PayrollApiService, PayrollExportName } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Observable } from 'rxjs';
import { reportHttpError, saveBlob } from '../shared/hr-http.util';

interface ExportDefinition {
  name: PayrollExportName;
  labelKey: string;
  needsMonth: boolean;
}

const EXPORTS: ExportDefinition[] = [
  { name: 'f24', labelKey: 'hrmPayroll.exportF24', needsMonth: true },
  { name: 'uniemens', labelKey: 'hrmPayroll.exportUniemens', needsMonth: true },
  { name: 'cu', labelKey: 'hrmPayroll.exportCu', needsMonth: false },
  { name: 'salary-declaration', labelKey: 'hrmPayroll.exportSalaryDeclaration', needsMonth: false },
  { name: 'frontier-exchange', labelKey: 'hrmPayroll.exportFrontierExchange', needsMonth: false },
];

/** CSV exports of a year/month and the year-end report (the server decides the content). */
@Component({
  selector: 'app-payroll-exports',
  imports: [FormsModule, NzButtonModule, NzInputModule, TranslatePipe],
  template: `
    <div class="flex items-end gap-2 mb-3 flex-wrap">
      <div>
        <label for="exp-year">{{ 'hrmCommon.year' | translate }}</label>
        <input nz-input id="exp-year" type="number" [ngModel]="year()" (ngModelChange)="year.set($event)" />
      </div>
      <div>
        <label for="exp-month">{{ 'hrmLeave.month' | translate }}</label>
        <input nz-input id="exp-month" type="number" min="1" max="12" [ngModel]="month()" (ngModelChange)="month.set($event)" />
      </div>
    </div>
    <div class="flex gap-2 flex-wrap">
      @for (item of exports; track item.name) {
        <button nz-button type="button" [disabled]="!canExport(item)" (click)="download(item)">
          {{ item.labelKey | translate }}
        </button>
      }
      <button nz-button type="button" [disabled]="!year()" (click)="downloadYearEnd()">
        {{ 'hrmPayroll.yearEndReport' | translate }}
      </button>
    </div>
  `,
})
export class PayrollExportsComponent {
  private readonly api = inject(PayrollApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly exports = EXPORTS;
  protected readonly year = signal<number | null>(new Date().getFullYear());
  protected readonly month = signal<number | null>(null);

  protected canExport(item: ExportDefinition): boolean {
    return !!this.year() && (!item.needsMonth || !!this.month());
  }

  protected download(item: ExportDefinition): void {
    const params: Record<string, number | undefined> = { year: this.year() ?? undefined };
    if (item.needsMonth) {
      params['month'] = this.month() ?? undefined;
    }
    this.save(this.api.downloadExport(item.name, params), `${item.name}-${this.year()}.csv`);
  }

  protected downloadYearEnd(): void {
    this.save(this.api.downloadYearEndReportCsv(this.year() ?? 0), `year-end-${this.year()}.csv`);
  }

  private save(request: Observable<Blob>, filename: string): void {
    request.subscribe({
      next: (blob) => saveBlob(blob, filename),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }
}
