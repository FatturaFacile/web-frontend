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
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Subscription } from 'rxjs';
import { I18nService, StampDutyQuarterlyReport, TaxApiService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { TaxNavComponent } from './tax-nav.component';
import { downloadBlob, needsOwnToast, reportYears } from './tax-report.utils';

/** Quarterly virtual stamp duty (bollo) report with F24 data and CSV export (issue #286). */
@Component({
  selector: 'app-stamp-duty-report',
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
    NzTagModule,
    PageHeaderComponent,
    TaxNavComponent,
    TranslatePipe,
  ],
  templateUrl: './stamp-duty-report.component.html',
  styleUrl: './tax-report.scss',
})
export class StampDutyReportComponent implements OnInit {
  private readonly api = inject(TaxApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  private readonly today = new Date();
  protected readonly years = reportYears(this.today.getFullYear());
  protected readonly quarters = [1, 2, 3, 4];
  protected readonly year = signal(this.today.getFullYear());
  protected readonly quarter = signal(Math.floor(this.today.getMonth() / 3) + 1);

  protected readonly report = signal<StampDutyQuarterlyReport | null>(null);
  protected readonly loading = signal(false);
  /** In-flight load: a newer filter cancels it so responses never arrive out of order. */
  private loadSub?: Subscription;
  protected readonly exporting = signal(false);
  protected readonly isEmpty = computed(() => !this.report()?.invoices.length);

  ngOnInit(): void {
    this.load();
  }

  protected setYear(year: number): void {
    this.year.set(year);
    this.load();
  }

  protected setQuarter(quarter: number): void {
    this.quarter.set(quarter);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadSub?.unsubscribe();
    this.loadSub = this.api.getStampDutyQuarterly(this.year(), this.quarter()).subscribe({
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
    const quarter = this.quarter();
    this.exporting.set(true);
    this.api.downloadStampDutyQuarterlyCsv(year, quarter).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        downloadBlob(blob, `bollo-${year}-Q${quarter}.csv`);
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
