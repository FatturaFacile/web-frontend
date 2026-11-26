import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GDT_SETTLEMENT_KINDS, GDT_SETTLEMENT_STATUSES, GdtSettlementKind, PermissionsService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { currentYear, GDO_TRADE_TERMS_FINANCE_MODULE, GdtOutcome, num, settlementStatusColor } from './gdo-trade-terms.util';
import { SettlementsStore } from './settlements.store';

/** The settlement runs of the contracts, and the proposal of a new one for a contract and period. */
@Component({
  selector: 'app-gdt-settlements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
  ],
  providers: [SettlementsStore],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.GDO_TRADE_TERMS_SETTLEMENTS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="gdt-st-status">
        <span>{{ 'gdoTradeTerms.field.status' | translate }}</span>
        <nz-select
          nzId="gdt-st-status"
          nzAllowClear
          [nzPlaceHolder]="'gdoTradeTerms.action.all' | translate"
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="store.setFilters({ status: $event ?? undefined })"
        >
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="'gdoTradeTerms.settlementStatus.' + status | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gdt-st-contract">
        <span>{{ 'gdoTradeTerms.field.contract' | translate }}</span>
        <nz-select
          nzId="gdt-st-contract"
          nzAllowClear
          nzShowSearch
          [nzPlaceHolder]="'gdoTradeTerms.action.all' | translate"
          [ngModel]="store.filters().contract_id ?? null"
          (ngModelChange)="store.setFilters({ contract_id: $event ?? undefined })"
        >
          @for (contract of store.contracts(); track contract.id) {
            <nz-option [nzValue]="contract.id" [nzLabel]="contract.code + ' ' + contract.name"></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      @if (canSettle) {
        <button nz-button nzType="primary" type="button" (click)="openPropose()">
          {{ 'gdoTradeTerms.action.proposeSettlement' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.settlements()"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzFrontPagination]="false"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'gdoTradeTerms.field.settlement' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.contract' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.period' | translate }}</th>
            <th scope="col" class="num">{{ 'gdoTradeTerms.field.accrued' | translate }}</th>
            <th scope="col" class="num">{{ 'gdoTradeTerms.field.earned' | translate }}</th>
            <th scope="col" class="num">{{ 'gdoTradeTerms.field.variance' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.status' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (settlement of table.data; track settlement.id) {
            <tr>
              <th scope="row">
                <a [routerLink]="['/gdo-trade-terms/settlements', settlement.id]">{{ settlement.code }}</a>
                <small class="muted">{{ 'gdoTradeTerms.settlementKind.' + settlement.kind | translate }}</small>
              </th>
              <td>{{ settlement.contract?.code }}</td>
              <td>{{ settlement.period_start }} – {{ settlement.period_end }}</td>
              <td class="num">{{ settlement.accrued_total | money: settlement.currency }}</td>
              <td class="num">{{ settlement.earned_total | money: settlement.currency }}</td>
              <td class="num" [class.negative]="isNegative(settlement.variance_total)">{{ settlement.variance_total | money: settlement.currency }}</td>
              <td>
                <nz-tag [nzColor]="color(settlement.status)">{{ 'gdoTradeTerms.settlementStatus.' + settlement.status | translate }}</nz-tag>
              </td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="open(settlement.id)">
                  {{ 'gdoTradeTerms.action.open' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8"><nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.settlements' | translate"></nz-empty></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-modal
      [nzVisible]="proposing()"
      [nzTitle]="'gdoTradeTerms.action.proposeSettlement' | translate"
      [nzOkText]="'gdoTradeTerms.action.propose' | translate"
      [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="propose()"
      (nzOnCancel)="proposing.set(false)"
    >
      <ng-container *nzModalContent>
        <form [formGroup]="form" class="form">
          @if (proposeError(); as failure) {
            <nz-alert
              nzType="error"
              nzShowIcon
              [nzMessage]="(failure.errorKey ?? 'gdoTradeTerms.error.generic') | translate: failure.params"
              [nzDescription]="failure.detail ?? null"
            ></nz-alert>
          }
          <label for="gdt-st-new-contract">{{ 'gdoTradeTerms.field.contract' | translate }}</label>
          <nz-select nzId="gdt-st-new-contract" nzShowSearch formControlName="contract_id">
            @for (contract of store.settleableContracts(); track contract.id) {
              <nz-option [nzValue]="contract.id" [nzLabel]="contract.code + ' ' + contract.name"></nz-option>
            }
          </nz-select>
          <label for="gdt-st-new-kind">{{ 'gdoTradeTerms.field.kind' | translate }}</label>
          <nz-select nzId="gdt-st-new-kind" formControlName="kind">
            @for (kind of kinds; track kind) {
              <nz-option [nzValue]="kind" [nzLabel]="'gdoTradeTerms.settlementKind.' + kind | translate"></nz-option>
            }
          </nz-select>
          <label for="gdt-st-new-start">{{ 'gdoTradeTerms.field.periodStart' | translate }}</label>
          <input nz-input id="gdt-st-new-start" type="date" formControlName="period_start" />
          <label for="gdt-st-new-end">{{ 'gdoTradeTerms.field.periodEnd' | translate }}</label>
          <input nz-input id="gdt-st-new-end" type="date" formControlName="period_end" />
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class SettlementsComponent implements OnInit {
  protected readonly store = inject(SettlementsStore);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly canSettle = inject(PermissionsService).canWrite(GDO_TRADE_TERMS_FINANCE_MODULE);
  protected readonly statuses = GDT_SETTLEMENT_STATUSES;
  protected readonly kinds = GDT_SETTLEMENT_KINDS;
  protected readonly proposing = signal(false);
  protected readonly proposeError = signal<GdtOutcome | null>(null);
  protected color = settlementStatusColor;

  protected readonly form = this.fb.nonNullable.group({
    contract_id: ['', Validators.required],
    kind: ['year_end' as GdtSettlementKind, Validators.required],
    period_start: [currentYear().start, Validators.required],
    period_end: [currentYear().end, Validators.required],
  });

  ngOnInit(): void {
    void this.store.init();
  }

  protected isNegative(value: string): boolean {
    return num(value) < 0;
  }

  protected open(id: string): void {
    void this.router.navigate(['/gdo-trade-terms/settlements', id]);
  }

  protected openPropose(): void {
    this.proposeError.set(null);
    this.proposing.set(true);
  }

  protected async propose(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const outcome = await this.store.propose(this.form.getRawValue());
    if (!outcome.ok) {
      this.proposeError.set(outcome);
      return;
    }
    this.proposing.set(false);
    const proposed = this.store.proposed();
    if (proposed) {
      this.open(proposed.id);
    }
  }
}
