import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PermissionsService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CpqQuotesApiService } from './cpq-quotes-api.service';
import { QuoteDetail, QuoteStatus } from './cpq-quotes.models';

const STATUSES: readonly QuoteStatus[] = [
  'draft',
  'pending_approval',
  'sent',
  'viewed',
  'negotiating',
  'accepted',
  'rejected',
  'expired',
  'superseded',
  'converted',
];

/** The interactive quotes, one row per revision, filtered by status; opens the editor or starts a new quote. */
@Component({
  selector: 'app-quote-list',
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'CPQ_QUOTES.TITLE' | translate">
      <div class="bar">
        <nz-select
          class="filter"
          nzAllowClear
          [ngModel]="status()"
          (ngModelChange)="status.set($event); load()"
          [nzPlaceHolder]="'CPQ_QUOTES.FILTER_STATUS' | translate"
          data-test="status-filter"
        >
          @for (s of statuses; track s) {
            <nz-option
              [nzValue]="s"
              [nzLabel]="'CPQ_QUOTES.STATUS_' + s.toUpperCase() | translate"
            />
          }
        </nz-select>
        @if (canWrite()) {
          <a nz-button nzType="primary" routerLink="/cpq-quotes/new" data-test="new">{{
            'CPQ_QUOTES.NEW' | translate
          }}</a>
        }
      </div>
      @if (error()) {
        <nz-alert
          nzType="error"
          nzShowIcon
          data-test="error"
          [nzMessage]="'CPQ_QUOTES.ERROR' | translate"
        />
      }
      <nz-spin [nzSpinning]="loading()">
        <table class="table" data-test="rows">
          <thead>
            <tr>
              <th>{{ 'CPQ_QUOTES.NUMBER' | translate }}</th>
              <th>{{ 'CPQ_QUOTES.CUSTOMER' | translate }}</th>
              <th>{{ 'CPQ_QUOTES.STATUS' | translate }}</th>
              <th>{{ 'CPQ_QUOTES.VALID_UNTIL' | translate }}</th>
              <th>{{ 'CPQ_QUOTES.TOTAL_GROSS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (q of quotes(); track q.id) {
              <tr [attr.data-quote]="q.id">
                <td>
                  <a [routerLink]="['/cpq-quotes', q.id]">{{ q.quote_number }}</a>
                </td>
                <td>{{ q.customer_name }}</td>
                <td>
                  <nz-tag>{{ 'CPQ_QUOTES.STATUS_' + q.status.toUpperCase() | translate }}</nz-tag>
                </td>
                <td>{{ q.valid_until ?? '' }}</td>
                <td>{{ q.totals.gross }} {{ q.currency }}</td>
              </tr>
            }
          </tbody>
        </table>
      </nz-spin>
    </nz-card>
  `,
  styles: `
    .bar {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .filter {
      min-width: 220px;
    }
    .table {
      width: 100%;
    }
    .table th,
    .table td {
      text-align: left;
      padding: 6px 8px;
    }
  `,
})
export class QuoteListComponent implements OnInit {
  private readonly api = inject(CpqQuotesApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly statuses = STATUSES;
  protected readonly quotes = signal<QuoteDetail[]>([]);
  protected readonly status = signal<QuoteStatus | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);

  protected canWrite(): boolean {
    return this.permissions.canWrite('cpq_quotes');
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(false);
    const status = this.status();
    this.api.list(status === null ? {} : { status }).subscribe({
      next: (res) => {
        this.quotes.set(res.data.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
}
