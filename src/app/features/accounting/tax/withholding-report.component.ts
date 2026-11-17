import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { Subscription } from 'rxjs';
import { I18nService, TaxApiService, WithholdingReport } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { TaxNavComponent } from './tax-nav.component';
import { downloadBlob, needsOwnToast, reportYears } from './tax-report.utils';

/** Withholding (CU) report per supplier and causale, with unpaid withholdings and CSV export (issue #286). */
@Component({
  selector: 'app-withholding-report',
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzIconModule,
    NzSelectModule,
    NzTableModule,
    PageHeaderComponent,
    TaxNavComponent,
    TranslatePipe,
  ],
  templateUrl: './withholding-report.component.html',
  styleUrl: './tax-report.scss',
})
export class WithholdingReportComponent implements OnInit {
  private readonly api = inject(TaxApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** The CU covers the payments of the previous year. */
  private readonly currentYear = new Date().getFullYear();
  protected readonly years = reportYears(this.currentYear);
  protected readonly year = signal(this.currentYear - 1);

  protected readonly report = signal<WithholdingReport | null>(null);
  protected readonly loading = signal(false);
  /** In-flight load: a newer filter cancels it so responses never arrive out of order. */
  private loadSub?: Subscription;
  protected readonly exporting = signal(false);
  protected readonly isEmpty = computed(() => !this.report()?.suppliers.length);
  protected readonly unpaid = computed(() => this.report()?.unpaid_withholdings ?? []);

  ngOnInit(): void {
    this.load();
  }

  protected setYear(year: number): void {
    this.year.set(year);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadSub?.unsubscribe();
    this.loadSub = this.api.getWithholdingsReport(this.year()).subscribe({
      next: (res) => {
        this.report.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.report.set(null);
        this.loading.set(false);
        if (needsOwnToast(err)) {
          this.message.error(this.i18n.translate('ACCOUNTING.TAX.LOAD_FAILED'));
        }
      },
    });
  }

  exportCsv(): void {
    if (this.isEmpty()) {
      return;
    }
    const year = this.year();
    this.exporting.set(true);
    this.api.downloadWithholdingsReportCsv(year).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        downloadBlob(blob, `ritenute-cu-${year}.csv`);
      },
      error: (err: unknown) => {
        this.exporting.set(false);
        if (needsOwnToast(err)) {
          this.message.error(this.i18n.translate('ACCOUNTING.TAX.CSV_FAILED'));
        }
      },
    });
  }
}
