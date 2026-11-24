import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService, PayrollApiService } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { Observable } from 'rxjs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudField, crudPage } from '../shared/crud/crud.types';
import { reportHttpError, saveBlob } from '../shared/hr-http.util';

type Row = { id: string } & Record<string, unknown>;

const money = (key: string, labelKey: string): CrudField => ({ key, labelKey, type: 'text' });

/** Payslips and Swiss salary certificates of a year, with PDF download and certificate generation. */
@Component({
  selector: 'app-payroll-documents',
  styleUrl: './payroll-documents.component.scss',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzTabsModule, TranslatePipe, CrudTableComponent],
  template: `
    <div class="filter-bar">
      <div>
        <label for="doc-year">{{ 'hrmCommon.year' | translate }}</label>
        <input nz-input id="doc-year" type="number" [ngModel]="year()" (ngModelChange)="year.set($event)" />
      </div>
      @if (canWrite()) {
        <button nz-button type="button" [nzLoading]="generating()" [disabled]="!year()" (click)="generate()">
          {{ 'hrmPayroll.generateCertificates' | translate }}
        </button>
      }
    </div>
    <nz-tabs>
      <nz-tab [nzTitle]="'hrmPayroll.payslips' | translate">
        <app-crud-table [config]="payslipsConfig()" />
      </nz-tab>
      <nz-tab [nzTitle]="'hrmPayroll.certificates' | translate">
        <app-crud-table [config]="certificatesConfig()" />
      </nz-tab>
    </nz-tabs>
  `,
})
export class PayrollDocumentsComponent {
  readonly canWrite = input(false);

  private readonly api = inject(PayrollApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly year = signal<number | null>(new Date().getFullYear());
  protected readonly generating = signal(false);
  private readonly refresh = signal(0);

  protected readonly payslipsConfig = computed<CrudConfig<Row>>(() => {
    this.refresh();
    const year = this.year() ?? undefined;
    return {
      titleKey: 'hrmPayroll.payslips',
      canWrite: false,
      gridList: (query) => crudPage(this.api.getPayslips({ ...query, year })),
      rowActions: [{ labelKey: 'hrmCommon.download', run: (row) => this.pdf(this.api.downloadPayslipPdf(row.id), 'payslip') }],
      fields: [
        { key: 'year', labelKey: 'hrmCommon.year', type: 'text' },
        { key: 'month', labelKey: 'hrmLeave.month', type: 'text' },
        { key: 'employee_name', labelKey: 'hrmCommon.employee', type: 'text' },
        money('gross_salary', 'hrmPayroll.gross'),
        money('employee_deductions', 'hrmPayroll.deductions'),
        money('net_salary', 'hrmPayroll.net'),
      ],
    };
  });

  protected readonly certificatesConfig = computed<CrudConfig<Row>>(() => {
    this.refresh();
    const year = this.year() ?? undefined;
    return {
      titleKey: 'hrmPayroll.certificates',
      canWrite: false,
      gridList: (query) => crudPage(this.api.getSalaryCertificates({ ...query, year })),
      rowActions: [
        { labelKey: 'hrmCommon.download', run: (row) => this.pdf(this.api.downloadSalaryCertificatePdf(row.id), 'certificate') },
      ],
      fields: [
        { key: 'year', labelKey: 'hrmCommon.year', type: 'text' },
        { key: 'employee_id', labelKey: 'hrmCommon.employee', type: 'text' },
        money('box8_gross', 'hrmPayroll.gross'),
        money('box10_1_ordinary_pension', 'LPP 10.1'),
        money('box10_2_pension_buyin', 'LPP 10.2'),
        money('box11_net', 'hrmPayroll.net'),
        money('box12_withholding_tax', 'hrmPayroll.withholdingTax'),
        money('box13_1_effective_expenses', 'Spese 13.1'),
        money('box13_2_lump_sum_expenses', 'Spese 13.2'),
        { key: 'box15_remarks', labelKey: 'hrmCommon.notes', type: 'text' },
        { key: 'generated_at', labelKey: 'hrmPayroll.generatedAt', type: 'text' },
      ],
    };
  });

  protected generate(): void {
    const year = this.year();
    if (!year) {
      return;
    }
    this.generating.set(true);
    this.api.generateSalaryCertificates(year).subscribe({
      next: () => {
        this.generating.set(false);
        this.message.success(this.i18n.translate('hrmPayroll.certificatesGenerated'));
        this.refresh.update((n) => n + 1);
      },
      error: (err: unknown) => {
        this.generating.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }

  private pdf(request: Observable<Blob>, name: string): void {
    request.subscribe({
      next: (blob) => saveBlob(blob, `${name}.pdf`),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }
}
