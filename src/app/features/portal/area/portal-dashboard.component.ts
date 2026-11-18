import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { PortalAreaApiService } from '@core/api/portal-area-api.service';
import { PortalDashboard } from '@core/models/portal-area.models';
import { TranslatePipe } from '@shared';

/** `/portal/dashboard`: what the customer owes, what is late, quotes to answer and the latest shipments. */
@Component({
  selector: 'app-portal-dashboard',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzSpinModule,
    TranslatePipe,
  ],
  template: `
    @if (error()) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="'PORTAL_AREA.LOADING_ERROR' | translate" />
    } @else if (data(); as d) {
      <h1>{{ 'PORTAL_AREA.WELCOME' | translate }}, {{ d.customer.name }}</h1>

      @if (d.overdue_invoices > 0) {
        <nz-alert
          nzType="warning"
          nzShowIcon
          class="gap"
          [nzMessage]="('PORTAL_AREA.OVERDUE_INVOICES' | translate) + ': ' + d.overdue_invoices"
        />
      }

      <div class="kpis">
        <nz-card [nzTitle]="'PORTAL_AREA.OPEN_BALANCE' | translate">
          @for (money of d.open_balance; track money.currency) {
            <p class="kpi">{{ money.currency }} {{ money.amount | number: '1.2-2' }}</p>
          } @empty {
            <p class="kpi">0.00</p>
          }
          @if (d.open_invoices > 0) {
            <a
              nz-button
              nzType="primary"
              routerLink="/portal/documents"
              [queryParams]="{ tab: 'invoices', status: 'unpaid' }"
            >
              {{ 'PORTAL_AREA.PAY_NOW' | translate }}
            </a>
          }
        </nz-card>

        <nz-card [nzTitle]="'PORTAL_AREA.PENDING_QUOTES' | translate">
          @for (quote of d.pending_quotes; track quote.id) {
            <p>
              <a routerLink="/portal/documents" [queryParams]="{ tab: 'quotes' }">{{
                quote.quote_number
              }}</a>
              · {{ quote.currency }} {{ quote.total_gross | number: '1.2-2' }}
            </p>
          } @empty {
            <p class="muted">{{ 'PORTAL_AREA.NO_DATA' | translate }}</p>
          }
        </nz-card>

        <nz-card [nzTitle]="'PORTAL_AREA.RECENT_SHIPMENTS' | translate">
          @for (note of d.recent_shipments; track note.id) {
            <p>
              {{ note.ddt_number }} · {{ note.date | date: 'mediumDate' }}
              @if (note.shipment.tracking_url; as url) {
                ·
                <a [href]="url" target="_blank" rel="noopener noreferrer">{{
                  'PORTAL_AREA.TRACK' | translate
                }}</a>
              } @else if (note.shipment.tracking_number) {
                · {{ note.shipment.tracking_number }}
              }
            </p>
          } @empty {
            <p class="muted">{{ 'PORTAL_AREA.NO_DATA' | translate }}</p>
          }
        </nz-card>
      </div>
    } @else {
      <nz-spin />
    }
  `,
  styles: `
    .kpis {
      display: grid;
      gap: 16px;
      grid-template-columns: 1fr;
    }
    .kpi {
      font-size: 28px;
      font-weight: 600;
      margin: 0 0 8px;
    }
    .gap {
      display: block;
      margin-bottom: 16px;
    }
    .muted {
      opacity: 0.6;
    }
    @media (min-width: 768px) {
      .kpis {
        grid-template-columns: repeat(3, 1fr);
      }
    }
  `,
})
export class PortalDashboardComponent implements OnInit {
  private readonly api = inject(PortalAreaApiService);

  protected readonly data = signal<PortalDashboard | null>(null);
  protected readonly error = signal(false);

  ngOnInit(): void {
    this.api.dashboard().subscribe({
      next: (response) => this.data.set(response.data),
      error: () => this.error.set(true),
    });
  }
}
