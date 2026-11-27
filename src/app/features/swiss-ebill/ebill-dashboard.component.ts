import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  EBILL_CHANNEL_TYPES,
  EBILL_KPI_STAGES,
  EBILL_TRANSMISSION_STATUSES,
  EbillChannelType,
  EbillTransmission,
  EbillTransmissionFilters,
  EbillTransmissionStatus,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { EbillDashboardStore } from './ebill-dashboard.store';
import { EbillLifecycleComponent } from './ebill-lifecycle.component';
import { EbillOutcome, saveBlob, statusColor, SWISS_EBILL_MODULE } from './swiss-ebill.util';

/** `YYYY-MM-DD` of a picked date, the format the API filters on. */
function isoDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Swiss eBill monitoring dashboard: one KPI card per stage of the funnel (transmitted, awaiting approval, approved, rejected,
 * reconciled, failed) and the filterable transmission log, with a drawer showing the lifecycle of the selected transmission.
 */
@Component({
  selector: 'app-ebill-dashboard',
  imports: [
    CurrencyPipe,
    DatePipe,
    EbillLifecycleComponent,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [EbillDashboardStore],
  styleUrl: './swiss-ebill.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.SWISS_EBILL_DASHBOARD' | translate"
      [subtitle]="'swissEbill.section.transmissionLog' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <div class="kpi-grid">
      @for (stage of stages; track stage) {
        <div class="kpi" [attr.data-test]="'kpi-' + stage">
          <nz-statistic
            [nzValue]="store.kpis()?.[stage]?.count ?? 0"
            [nzTitle]="'swissEbill.kpi.' + stage | translate"
          ></nz-statistic>
          @for (amount of amountsOf(stage); track amount.currency) {
            <div class="kpi-sub">{{ amount.value | currency: amount.currency }}</div>
          }
        </div>
      }
    </div>

    <div class="toolbar">
      <label class="field" for="eb-f-status">
        <span>{{ 'swissEbill.filter.status' | translate }}</span>
        <nz-select nzId="eb-f-status" nzAllowClear [(ngModel)]="status" (ngModelChange)="reload()">
          @for (item of statuses; track item) {
            <nz-option
              [nzValue]="item"
              [nzLabel]="'swissEbill.status.' + item | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="eb-f-channel">
        <span>{{ 'swissEbill.filter.channel' | translate }}</span>
        <nz-select
          nzId="eb-f-channel"
          nzAllowClear
          [(ngModel)]="channel"
          (ngModelChange)="reload()"
        >
          @for (item of channels; track item) {
            <nz-option
              [nzValue]="item"
              [nzLabel]="'swissEbill.channel.' + item | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <div class="field">
        <span>{{ 'swissEbill.filter.dateRange' | translate }}</span>
        <nz-range-picker [(ngModel)]="range" (ngModelChange)="reload()"></nz-range-picker>
      </div>
      <label class="field" for="eb-f-search">
        <span>{{ 'swissEbill.filter.search' | translate }}</span>
        <input
          nz-input
          id="eb-f-search"
          [(ngModel)]="search"
          (keyup.enter)="reload()"
          (blur)="reload()"
        />
      </label>
      @if (customerId() !== null) {
        <nz-tag nzMode="closeable" data-test="customer-filter" (nzOnClose)="clearCustomer()">
          {{ 'swissEbill.filter.customer' | translate }}
        </nz-tag>
      }
      <span class="spacer"></span>
      <button nz-button type="button" data-test="refresh" (click)="reload()">
        {{ 'swissEbill.action.refresh' | translate }}
      </button>
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #log
        nzSize="small"
        [nzData]="store.transmissions()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '1000px' }"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'swissEbill.column.invoice' | translate }}</th>
            <th scope="col">{{ 'swissEbill.column.customer' | translate }}</th>
            <th scope="col">{{ 'swissEbill.column.status' | translate }}</th>
            <th scope="col">{{ 'swissEbill.column.channel' | translate }}</th>
            <th scope="col">{{ 'swissEbill.column.amount' | translate }}</th>
            <th scope="col">{{ 'swissEbill.column.submitted' | translate }}</th>
            <th scope="col">{{ 'swissEbill.column.scheduledPayment' | translate }}</th>
            <th scope="col">{{ 'swissEbill.column.attempts' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of log.data; track row.id) {
            <tr>
              <td>
                <a
                  [routerLink]="['/sales/invoices']"
                  [queryParams]="{ invoice_id: row.invoice_id }"
                >
                  {{ row.invoice_number ?? row.invoice_id }}
                </a>
              </td>
              <td>{{ row.customer_name }}</td>
              <td>
                <nz-tag [nzColor]="color(row.status)">{{
                  'swissEbill.status.' + row.status | translate
                }}</nz-tag>
              </td>
              <td>
                {{ row.channel_type ? ('swissEbill.channel.' + row.channel_type | translate) : '' }}
              </td>
              <td>{{ row.invoice_amount | currency: row.currency }}</td>
              <td>{{ row.submission_timestamp | date: 'short' }}</td>
              <td>{{ row.scheduled_payment_date | date: 'mediumDate' }}</td>
              <td>{{ row.attempt_count }}</td>
              <td>
                <button nz-button nzSize="small" type="button" data-test="open" (click)="open(row)">
                  {{ 'swissEbill.action.viewLog' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="9">
                <nz-empty [nzNotFoundContent]="'swissEbill.empty.log' | translate"></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="selected() !== null"
      nzWidth="520"
      [nzTitle]="selected()?.invoice_number ?? ''"
      (nzOnClose)="selected.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (selected(); as transmission) {
          <app-ebill-lifecycle
            [transmission]="transmission"
            [canWrite]="canWrite"
            (retry)="retry($event)"
            (cancelRequested)="cancel($event)"
            (download)="download($event)"
          ></app-ebill-lifecycle>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class EbillDashboardComponent implements OnInit {
  protected readonly store = inject(EbillDashboardStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);

  protected readonly canWrite = inject(PermissionsService).canWrite(SWISS_EBILL_MODULE);
  protected readonly stages = EBILL_KPI_STAGES;
  protected readonly statuses = EBILL_TRANSMISSION_STATUSES;
  protected readonly channels = EBILL_CHANNEL_TYPES;
  protected readonly color = statusColor;

  protected status: EbillTransmissionStatus | null = null;
  protected channel: EbillChannelType | null = null;
  protected range: Date[] = [];
  protected search = '';
  protected readonly customerId = signal<string | null>(null);
  protected readonly selected = signal<EbillTransmission | null>(null);

  ngOnInit(): void {
    this.customerId.set(this.route.snapshot.queryParamMap.get('customer_id'));
    void this.reload();
  }

  protected amountsOf(
    stage: (typeof EBILL_KPI_STAGES)[number],
  ): { currency: string; value: number }[] {
    const amounts = this.store.kpis()?.[stage]?.amounts ?? {};
    return Object.entries(amounts).map(([currency, value]) => ({ currency, value }));
  }

  protected filters(): EbillTransmissionFilters {
    const [from, to] = this.range;
    return {
      ebill_status: this.status,
      channel_type: this.channel,
      from: from ? isoDay(from) : null,
      to: to ? isoDay(to) : null,
      customer_id: this.customerId(),
      search: this.search.trim() === '' ? null : this.search.trim(),
    };
  }

  protected async reload(): Promise<void> {
    await this.store.load(this.filters());
    const current = this.selected();
    if (current) {
      const fresh = this.store.transmissions().find((row) => row.id === current.id);
      this.selected.set(fresh ? ((await this.store.detail(fresh.id)) ?? fresh) : null);
    }
  }

  protected clearCustomer(): void {
    this.customerId.set(null);
    void this.reload();
  }

  protected async open(row: EbillTransmission): Promise<void> {
    // The list carries no events: the drawer shows the detail with its audit trail.
    this.selected.set(row);
    const detail = await this.store.detail(row.id);
    if (detail && this.selected()?.id === row.id) {
      this.selected.set(detail);
    }
  }

  protected async retry(row: EbillTransmission): Promise<void> {
    await this.act(this.store.retry(row.id), 'swissEbill.toast.transmissionQueued');
  }

  protected async cancel(row: EbillTransmission): Promise<void> {
    await this.act(this.store.cancel(row.id), 'swissEbill.toast.transmissionCancelled');
  }

  protected async download(row: EbillTransmission): Promise<void> {
    const blob = await this.store.download(row.id);
    if (blob) {
      saveBlob(blob, `ebill-${row.invoice_number ?? row.invoice_id}.xml`);
    }
  }

  private async act(pending: Promise<EbillOutcome>, successKey: string): Promise<void> {
    const outcome = await pending;
    if (outcome.ok) {
      this.message.success(this.i18n.instant(successKey));
      await this.reload();
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'swissEbill.error.unknown'));
    }
  }
}
