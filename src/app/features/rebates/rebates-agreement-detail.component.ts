import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { RebateAccrual, RebateAgreement, RebateSettlement, RebatesApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AGREEMENT_STATUS_COLORS, apiErrorText, todayIso } from './rebates.util';

/** An agreement with its scale, the accrual runs and the settlements; calculating, settling and closing happen here. */
@Component({
  selector: 'app-rebates-agreement-detail',
  styleUrl: './rebates.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    @if (agreement(); as current) {
      <app-page-header [title]="current.code + ' - ' + current.name" [subtitle]="'REBATES.DETAIL_SUBTITLE' | translate">
        <a nz-button routerLink="/rebates/agreements">{{ 'REBATES.BACK' | translate }}</a>
      </app-page-header>

      <nz-card class="main-card">
        <nz-descriptions nzSize="small" [nzColumn]="3">
          <nz-descriptions-item [nzTitle]="'REBATES.DIRECTION' | translate">{{ ('REBATES.DIRECTION_' + current.direction.toUpperCase()) | translate }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'REBATES.CONTACT' | translate">{{ current.contact_name }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'REBATES.STATUS' | translate">
            <nz-tag [nzColor]="statusColor(current.status)">{{ ('REBATES.STATUS_' + current.status.toUpperCase()) | translate }}</nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'REBATES.PERIOD' | translate">{{ current.starts_on }} - {{ current.ends_on }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'REBATES.TIER_MODE' | translate">{{ ('REBATES.MODE_' + current.tier_mode.toUpperCase()) | translate }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'REBATES.OPEN_REBATE' | translate">{{ current.open_rebate ?? '0' | number: '1.2-2' }} {{ current.currency }}</nz-descriptions-item>
        </nz-descriptions>

        <div class="toolbar">
          @if (current.status === 'active') {
            <input nz-input style="width: 180px" type="date" [ngModel]="asOf()" (ngModelChange)="asOf.set($event)" [attr.aria-label]="'REBATES.AS_OF' | translate" />
            <button nz-button nzType="primary" (click)="calculate()">{{ 'REBATES.CALCULATE' | translate }}</button>
          }
          @if (current.status === 'active' || current.status === 'closed') {
            <button nz-button (click)="openSettle()" [disabled]="openAmount() <= 0">{{ 'REBATES.SETTLE' | translate }}</button>
          }
          @if (current.status === 'active') {
            <button nz-button nzDanger nz-popconfirm [nzPopconfirmTitle]="'REBATES.CLOSE_CONFIRM' | translate" (nzOnConfirm)="close()">{{ 'REBATES.CLOSE' | translate }}</button>
          }
        </div>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'REBATES.TIERS' | translate">
        <nz-table #tierTable [nzData]="current.tiers ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th class="num">{{ 'REBATES.THRESHOLD' | translate }}</th>
              <th class="num">{{ 'REBATES.RATE_PERCENT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of tierTable.data; track row.id) {
              <tr>
                <td class="num">{{ row.threshold_amount | number: '1.2-2' }}</td>
                <td class="num">{{ row.rate_percent | number: '1.2-4' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'REBATES.ACCRUALS' | translate">
        <nz-table #accrualTable [nzData]="accruals()" nzSize="small" [nzPageSize]="25">
          <thead>
            <tr>
              <th>{{ 'REBATES.AS_OF' | translate }}</th>
              <th class="num">{{ 'REBATES.BASE_AMOUNT' | translate }}</th>
              <th class="num">{{ 'REBATES.APPLIED_RATE' | translate }}</th>
              <th class="num">{{ 'REBATES.CUMULATIVE_REBATE' | translate }}</th>
              <th class="num">{{ 'REBATES.REBATE_AMOUNT' | translate }}</th>
              <th>{{ 'REBATES.STATUS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of accrualTable.data; track row.id) {
              <tr>
                <td>{{ row.as_of }}</td>
                <td class="num">{{ row.base_amount | number: '1.2-2' }}</td>
                <td class="num">{{ row.applied_rate_percent !== null ? (row.applied_rate_percent | number: '1.2-4') : '' }}</td>
                <td class="num">{{ row.cumulative_rebate | number: '1.2-2' }}</td>
                <td class="num">{{ row.rebate_amount | number: '1.2-2' }}</td>
                <td>{{ ('REBATES.ACCRUAL_' + row.status.toUpperCase()) | translate }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (accruals().length === 0) {
          <nz-empty [nzNotFoundContent]="'REBATES.NO_ACCRUALS' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'REBATES.SETTLEMENTS' | translate">
        <nz-table #settlementTable [nzData]="settlements()" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'REBATES.SETTLED_ON' | translate }}</th>
              <th>{{ 'REBATES.SETTLEMENT_TYPE' | translate }}</th>
              <th class="num">{{ 'REBATES.AMOUNT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of settlementTable.data; track row.id) {
              <tr>
                <td>{{ row.settled_on }}</td>
                <td>{{ ('REBATES.SETTLEMENT_' + row.settlement_type.toUpperCase()) | translate }}</td>
                <td class="num">{{ row.amount | number: '1.2-2' }} {{ row.currency }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (settlements().length === 0) {
          <nz-empty [nzNotFoundContent]="'REBATES.NO_SETTLEMENTS' | translate"></nz-empty>
        }
      </nz-card>

      <nz-modal [(nzVisible)]="settleVisible" [nzTitle]="'REBATES.SETTLE' | translate" (nzOnCancel)="settleVisible.set(false)" (nzOnOk)="settle()" [nzOkText]="'REBATES.SETTLE' | translate">
        <ng-container *nzModalContent>
          <p>{{ 'REBATES.SETTLE_HINT' | translate: { amount: (openAmount() | number: '1.2-2') } }}</p>
          @if (current.direction === 'sales') {
            <label for="settle-tax">{{ 'REBATES.TAX_RATE' | translate }}</label>
            <input nz-input id="settle-tax" type="number" min="0" max="100" step="any" [ngModel]="taxRate()" (ngModelChange)="taxRate.set($event)" />
          }
        </ng-container>
      </nz-modal>
    }
  `,
})
export class RebatesAgreementDetailComponent implements OnInit {
  private readonly api = inject(RebatesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly agreement = signal<RebateAgreement | null>(null);
  readonly accruals = signal<RebateAccrual[]>([]);
  readonly settlements = signal<RebateSettlement[]>([]);
  readonly asOf = signal(todayIso());
  readonly settleVisible = signal(false);
  readonly taxRate = signal<number | null>(null);

  /** Rebate accrued and not settled yet. */
  readonly openAmount = computed(() => this.accruals().filter((accrual) => accrual.status === 'accrued').reduce((sum, accrual) => sum + Number(accrual.rebate_amount), 0));

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: string): string {
    return AGREEMENT_STATUS_COLORS[status] ?? 'default';
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.getAgreement(id).subscribe({
      next: (response) => this.agreement.set(response.data),
      error: (error: unknown) => this.fail(error),
    });
    this.api.getAccruals(id).subscribe({ next: (response) => this.accruals.set(response.data), error: (error: unknown) => this.fail(error) });
    this.api.getSettlements({ agreement_id: id, per_page: 100 }).subscribe({ next: (response) => this.settlements.set(response.data), error: (error: unknown) => this.fail(error) });
  }

  calculate(): void {
    const current = this.agreement();
    if (!current) {
      return;
    }

    this.api.calculateAccrual(current.id, { as_of: this.asOf() }).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant(response.data.accrual ? 'REBATES.CALCULATED' : 'REBATES.NOTHING_NEW'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  openSettle(): void {
    this.taxRate.set(null);
    this.settleVisible.set(true);
  }

  settle(): void {
    const current = this.agreement();
    if (!current) {
      return;
    }

    const taxRate = this.taxRate();
    this.api.settleAgreement(current.id, { tax_rate: taxRate === null ? null : String(taxRate) }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('REBATES.SETTLED'));
        this.settleVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  close(): void {
    const current = this.agreement();
    if (!current) {
      return;
    }

    this.api.closeAgreement(current.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('REBATES.AGREEMENT_CLOSED'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.message.error(apiErrorText(error) ?? this.translate.instant('REBATES.ACTION_ERROR'));
  }
}
