import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { BillingApiService, ReceivablesAgingReport, SalesRegisterReport } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from '../../cycle/shared/sales-api-helpers';
import { SalesLookupsService } from '../../cycle/shared/sales-lookups.service';
import { todayIso } from '../../cycle/shared/sales-status';

const DOCUMENT_TYPES = ['TD01', 'TD02', 'TD03', 'TD04', 'TD05', 'TD06', 'TD16', 'TD17', 'TD18', 'TD19', 'TD20'];

/** Sales register of a period and receivables aging at a date. */
@Component({
  selector: 'app-billing-reports',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './billing-reports.component.html',
  styleUrl: '../../cycle/shared/cycle-page.scss',
})
export class BillingReportsComponent implements OnInit {
  private readonly api = inject(BillingApiService);
  private readonly message = inject(NzMessageService);
  protected readonly lookups = inject(SalesLookupsService);

  protected readonly documentTypes = DOCUMENT_TYPES;
  protected from = `${todayIso().substring(0, 4)}-01-01`;
  protected to = todayIso();
  protected documentType: string | null = null;
  protected asOf = todayIso();
  protected customerId: string | null = null;

  protected readonly register = signal<SalesRegisterReport | null>(null);
  protected readonly aging = signal<ReceivablesAgingReport | null>(null);
  protected readonly loadingRegister = signal(false);
  protected readonly loadingAging = signal(false);

  ngOnInit(): void {
    this.lookups.load();
    this.loadRegister();
    this.loadAging();
  }

  protected loadRegister(): void {
    this.loadingRegister.set(true);
    this.api.getSalesRegister({ from: this.from, to: this.to, document_type: this.documentType }).subscribe({
      next: (res) => {
        this.register.set(res.data);
        this.loadingRegister.set(false);
      },
      error: (err: unknown) => {
        this.loadingRegister.set(false);
        this.message.error(apiErrorText(err));
      },
    });
  }

  protected loadAging(): void {
    this.loadingAging.set(true);
    this.api.getReceivablesAging({ as_of: this.asOf, customer_id: this.customerId ?? undefined }).subscribe({
      next: (res) => {
        this.aging.set(res.data);
        this.loadingAging.set(false);
      },
      error: (err: unknown) => {
        this.loadingAging.set(false);
        this.message.error(apiErrorText(err));
      },
    });
  }
}
