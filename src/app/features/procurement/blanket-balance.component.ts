import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BlanketAgreementBalance, ProcurementApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, barPercent, BLANKET_ALERT_COLORS, toNumber } from '../rebates/rebates.util';

/** Balance of a blanket purchase agreement: ceiling, minimum spend, ordered / received / invoiced amounts and the quantity left per line. */
@Component({
  selector: 'app-blanket-balance',
  styleUrl: '../rebates/rebates.scss',
  imports: [DecimalPipe, RouterLink, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzEmptyModule, NzProgressModule, NzTableModule, NzTagModule],
  template: `
    <app-page-header [title]="'SUPPLIER_REBATES.BLANKET_BALANCE' | translate">
      <a nz-button routerLink="/procurement/sourcing">{{ 'SUPPLIER_REBATES.BLANKET_AGREEMENT' | translate }}</a>
    </app-page-header>

    @if (balance(); as data) {
      @if (data.alerts.length > 0) {
        <div class="alert-list" role="status">
          @for (alert of data.alerts; track alert.code) {
            <nz-tag [nzColor]="alertColor(alert.code)">{{ ('SUPPLIER_REBATES.ALERT_' + alert.code.toUpperCase()) | translate }}</nz-tag>
          }
        </div>
      }

      <nz-card class="main-card">
        @if (data.ceiling_amount !== null) {
          <div class="bar-block">
            <div class="bar-head">
              <span>{{ 'SUPPLIER_REBATES.CEILING' | translate }}: {{ data.ceiling_amount | number: '1.2-2' }} {{ data.currency }}</span>
              <span>{{ 'SUPPLIER_REBATES.REMAINING_CEILING' | translate }}: {{ data.remaining_ceiling | number: '1.2-2' }} {{ data.currency }}</span>
            </div>
            <nz-progress [nzPercent]="ceilingPercent()" nzSize="small" [nzStatus]="ceilingExceeded() ? 'exception' : 'active'"></nz-progress>
          </div>
        }

        @if (data.minimum_spend_amount !== null) {
          <div class="bar-block">
            <div class="bar-head">
              <span>{{ 'SUPPLIER_REBATES.MINIMUM_SPEND' | translate }}: {{ data.minimum_spend_amount | number: '1.2-2' }} {{ data.currency }}</span>
              <span>{{ 'SUPPLIER_REBATES.SHORTFALL' | translate }}: {{ data.minimum_shortfall | number: '1.2-2' }} {{ data.currency }}</span>
            </div>
            <nz-progress [nzPercent]="minimumPercent()" nzSize="small" [nzStatus]="minimumPercent() >= 100 ? 'success' : 'active'"></nz-progress>
          </div>
        }

        <div class="bar-block">
          <div class="bar-head">
            <span>{{ 'SUPPLIER_REBATES.ORDERED' | translate }}</span>
            <span>{{ data.ordered_amount | number: '1.2-2' }} {{ data.currency }}</span>
          </div>
          <nz-progress [nzPercent]="percentOf(data.ordered_amount)" nzSize="small" [nzShowInfo]="false"></nz-progress>
        </div>
        <div class="bar-block">
          <div class="bar-head">
            <span>{{ 'SUPPLIER_REBATES.RECEIVED' | translate }}</span>
            <span>{{ data.received_amount | number: '1.2-2' }} {{ data.currency }}</span>
          </div>
          <nz-progress [nzPercent]="percentOf(data.received_amount)" nzSize="small" [nzShowInfo]="false"></nz-progress>
        </div>
        <div class="bar-block">
          <div class="bar-head">
            <span>{{ 'SUPPLIER_REBATES.INVOICED' | translate }}</span>
            <span>{{ data.invoiced_amount | number: '1.2-2' }} {{ data.currency }}</span>
          </div>
          <nz-progress [nzPercent]="percentOf(data.invoiced_amount)" nzSize="small" [nzShowInfo]="false"></nz-progress>
        </div>
      </nz-card>

      <nz-card class="main-card">
        <nz-table #lineTable [nzData]="data.lines" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'SUPPLIER_REBATES.DESCRIPTION' | translate }}</th>
              <th class="num">{{ 'SUPPLIER_REBATES.COMMITTED_QTY' | translate }}</th>
              <th class="num">{{ 'SUPPLIER_REBATES.RELEASED_QTY' | translate }}</th>
              <th class="num">{{ 'SUPPLIER_REBATES.REMAINING_QTY' | translate }}</th>
              <th class="num">{{ 'SUPPLIER_REBATES.ORDERED' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of lineTable.data; track line.line_id) {
              <tr>
                <td>{{ line.description }}</td>
                <td class="num">{{ line.committed_quantity | number: '1.0-4' }}</td>
                <td class="num">{{ line.released_quantity | number: '1.0-4' }}</td>
                <td class="num">{{ line.remaining_quantity | number: '1.0-4' }}</td>
                <td class="num">{{ line.ordered_amount | number: '1.2-2' }} {{ data.currency }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.lines.length === 0) {
          <nz-empty [nzNotFoundContent]="'SUPPLIER_REBATES.EMPTY' | translate"></nz-empty>
        }
      </nz-card>
    }
  `,
})
export class BlanketBalanceComponent implements OnInit {
  private readonly api = inject(ProcurementApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly balance = signal<BlanketAgreementBalance | null>(null);

  /** Share of the ceiling already ordered. */
  readonly ceilingPercent = computed(() => barPercent(this.balance()?.ordered_amount, this.balance()?.ceiling_amount) ?? 0);
  readonly ceilingExceeded = computed(() => this.balance()?.alerts.some((alert) => alert.code === 'ceiling_exceeded') ?? false);
  readonly minimumPercent = computed(() => barPercent(this.balance()?.ordered_amount, this.balance()?.minimum_spend_amount) ?? 0);

  /** The bars of ordered, received and invoiced are drawn against the ceiling, or against the largest of them without one. */
  private readonly scale = computed(() => {
    const data = this.balance();
    if (!data) {
      return 0;
    }
    const ceiling = toNumber(data.ceiling_amount);
    return ceiling > 0 ? ceiling : Math.max(toNumber(data.ordered_amount), toNumber(data.received_amount), toNumber(data.invoiced_amount));
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.getContractBalance(id).subscribe({
      next: (response) => this.balance.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUPPLIER_REBATES.LOAD_ERROR')),
    });
  }

  alertColor(code: string): string {
    return BLANKET_ALERT_COLORS[code] ?? 'default';
  }

  percentOf(amount: string): number {
    return barPercent(amount, this.scale()) ?? 0;
  }
}
