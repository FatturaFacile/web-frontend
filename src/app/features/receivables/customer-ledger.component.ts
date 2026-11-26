import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AR_ITEM_STATUSES, ArItemStatus, ArLedgerFilters } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { ArCustomerOption, ArCustomerSelectComponent } from './ar-customer-select.component';
import { CustomerLedgerStore } from './customer-ledger.store';
import { dateRange, drilldownQuery, statusColor, toIsoDate } from './receivables.util';

/**
 * Customer ledger (Mastrino Clienti): the documents and the allocations of one customer in date order with the running
 * balance, with a shortcut to the reconciliation of its open items.
 */
@Component({
  selector: 'app-customer-ledger',
  styleUrl: './receivables.scss',
  providers: [CustomerLedgerStore],
  imports: [
    ArCustomerSelectComponent,
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'AR.LEDGER_TITLE' | translate"
      [subtitle]="'AR.LEDGER_SUBTITLE' | translate"
    >
      <div class="header-actions">
        @if (customerId(); as id) {
          <a nz-button [routerLink]="['/receivables/items']" [queryParams]="itemsQuery()">{{
            'AR.OPEN_ITEMS_RECONCILE' | translate
          }}</a>
          <a nz-button [routerLink]="['/receivables/credit', id]">{{ 'AR.CREDIT' | translate }}</a>
          <a nz-button [routerLink]="['/receivables/statement', id]">{{
            'AR.STATEMENT' | translate
          }}</a>
        }
      </div>
    </app-page-header>

    <div class="toolbar">
      <app-ar-customer-select
        [customerId]="customerId()"
        (customerChange)="onCustomer($event)"
      ></app-ar-customer-select>
    </div>

    @if (!customerId()) {
      <nz-empty [nzNotFoundContent]="'AR.PICK_CUSTOMER_HINT' | translate"></nz-empty>
    } @else {
      <div class="filters" role="search" [attr.aria-label]="'AR.FILTERS' | translate">
        <div class="field">
          <span>{{ 'AR.PERIOD' | translate }}</span>
          <nz-range-picker
            style="width: 100%"
            [ngModel]="range()"
            (ngModelChange)="onRange($event)"
          ></nz-range-picker>
        </div>
        <div class="field">
          <label for="l-status">{{ 'AR.STATUS' | translate }}</label>
          <nz-select
            nzId="l-status"
            style="width: 100%"
            nzAllowClear
            [ngModel]="store.filters().status ?? null"
            (ngModelChange)="store.setFilters({ status: $event ?? undefined })"
          >
            @for (status of statuses; track status) {
              <nz-option
                [nzValue]="status"
                [nzLabel]="'AR.STATUS_' + status.toUpperCase() | translate"
              ></nz-option>
            }
          </nz-select>
        </div>
        <div class="field">
          <label for="l-doctype">{{ 'AR.DOCUMENT_TYPE' | translate }}</label>
          <nz-select
            nzId="l-doctype"
            style="width: 100%"
            nzAllowClear
            [ngModel]="store.filters().document_type ?? null"
            (ngModelChange)="store.setFilters({ document_type: $event ?? undefined })"
          >
            @for (type of documentTypes; track type) {
              <nz-option
                [nzValue]="type"
                [nzLabel]="'AR.DOCTYPE_' + type.toUpperCase() | translate"
              ></nz-option>
            }
          </nz-select>
        </div>
        <div class="field">
          <label for="l-currency">{{ 'AR.CURRENCY' | translate }}</label>
          <input
            nz-input
            id="l-currency"
            maxlength="3"
            [ngModel]="store.filters().currency ?? ''"
            (ngModelChange)="onCurrency($event)"
          />
        </div>
      </div>

      @if (store.error(); as error) {
        <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
      }

      <nz-spin [nzSpinning]="store.loading()">
        @if (store.movements().length === 0 && !store.loading()) {
          <nz-empty [nzNotFoundContent]="'AR.NO_MOVEMENTS' | translate"></nz-empty>
        } @else {
          <div class="matrix-wrap">
            <table class="matrix">
              <caption class="sr-only">
                {{
                  'AR.LEDGER_TITLE' | translate
                }}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{{ 'AR.DATE' | translate }}</th>
                  <th scope="col">{{ 'AR.VALUE_DATE' | translate }}</th>
                  <th scope="col">{{ 'AR.KIND' | translate }}</th>
                  <th scope="col">{{ 'AR.REFERENCE' | translate }}</th>
                  <th scope="col">{{ 'AR.DUE_DATE' | translate }}</th>
                  <th scope="col">{{ 'AR.STATUS' | translate }}</th>
                  <th scope="col" class="num">{{ 'AR.DEBIT' | translate }}</th>
                  <th scope="col" class="num">{{ 'AR.CREDIT_AMOUNT' | translate }}</th>
                  <th scope="col" class="num">{{ 'AR.BALANCE' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (movement of store.movements(); track $index) {
                  <tr>
                    <td>{{ movement.date }}</td>
                    <td>{{ movement.value_date }}</td>
                    <td>{{ 'AR.KIND_' + movement.kind.toUpperCase() | translate }}</td>
                    <td>{{ movement.reference ?? '–' }}</td>
                    <td>{{ movement.due_date ?? '–' }}</td>
                    <td>
                      @if (movement.status) {
                        <nz-tag [nzColor]="color(movement.status)">{{
                          'AR.STATUS_' + movement.status.toUpperCase() | translate
                        }}</nz-tag>
                      }
                    </td>
                    <td class="num">{{ movement.debit | money: movement.currency }}</td>
                    <td class="num">{{ movement.credit | money: movement.currency }}</td>
                    <td class="num" [class.negative]="movement.balance.startsWith('-')">
                      {{ movement.balance | money: movement.currency }}
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colspan="6">{{ 'AR.TOTAL' | translate }}</th>
                  <td class="num">{{ store.totalDebit() | money: currency() }}</td>
                  <td class="num">{{ store.totalCredit() | money: currency() }}</td>
                  <td class="num">
                    <strong>{{ 'AR.CLOSING_BALANCE' | translate }}:</strong>
                    {{ store.closingBalance() | money: currency() }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
      </nz-spin>
    }
  `,
})
export class CustomerLedgerComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(CustomerLedgerStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly statuses = AR_ITEM_STATUSES;
  readonly documentTypes = ['invoice', 'debit_note'] as const;
  readonly customerId = signal<string | null>(null);
  readonly range = computed(() => dateRange(this.store.filters().from, this.store.filters().to));
  readonly currency = computed(
    () => this.store.currencies()[0] ?? this.store.filters().currency ?? 'EUR',
  );

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('customerId');
      this.customerId.set(id);
      if (id) {
        void this.store.load(id);
      } else {
        this.store.clear();
      }
    });
  }

  itemsQuery(): Record<string, string> {
    return drilldownQuery(null, this.customerId());
  }

  color(status: ArItemStatus): string {
    return statusColor(status);
  }

  onCustomer(option: ArCustomerOption | null): void {
    void this.router.navigate(
      option ? ['/receivables/ledger', option.id] : ['/receivables/ledger'],
    );
  }

  onRange(dates: Date[] | null): void {
    void this.store.setFilters({
      from: toIsoDate(dates?.[0]) ?? undefined,
      to: toIsoDate(dates?.[1]) ?? undefined,
    });
  }

  onCurrency(value: string): void {
    const code = value.trim().toUpperCase();
    if (code.length === 3 || code.length === 0) {
      const patch: Partial<ArLedgerFilters> = { currency: code || undefined };
      void this.store.setFilters(patch);
    }
  }
}
