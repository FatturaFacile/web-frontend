import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  EXM_RECONCILIATION_STATUSES,
  ExmCardTransaction,
  ExmLine,
  ExmReconcileAction,
  ExmReconciliationStatus,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { CardMatchSelection, CardsStore, remainingAfter } from './cards.store';
import { ExmOutcome, reconciliationColor, toNumber } from './expense-management.util';

/**
 * Corporate card reconciliation (Mod 075): the transactions of the card statements on the left, the card expense lines
 * of a report on the right. One click matches a transaction with a line of the same amount; picking several lines (each
 * with the part it covers) splits it. A transaction can also be ignored, disputed or released.
 */
@Component({
  selector: 'app-exm-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [CardsStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.EXPENSE_MANAGEMENT_CARDS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="exm-card-status">
        <span>{{ 'expenseManagement.field.status' | translate }}</span>
        <nz-select
          nzId="exm-card-status"
          nzAllowClear
          [nzPlaceHolder]="'expenseManagement.action.all' | translate"
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="store.setFilters({ status: $event ?? undefined })"
        >
          @for (status of statuses; track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'expenseManagement.reconciliationStatus.' + status | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="exm-card-account">
        <span>{{ 'expenseManagement.field.card' | translate }}</span>
        <nz-select
          nzId="exm-card-account"
          nzAllowClear
          [nzPlaceHolder]="'expenseManagement.action.all' | translate"
          [ngModel]="store.filters().card_account_id ?? null"
          (ngModelChange)="store.setFilters({ card_account_id: $event ?? undefined })"
        >
          @for (account of store.accounts(); track account.id) {
            <nz-option
              [nzValue]="account.id"
              [nzLabel]="account.holder_name + ' ·· ' + account.card_last4"
            ></nz-option>
          }
        </nz-select>
      </label>
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (actionError(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <div class="split">
      <section class="pane" [attr.aria-label]="'expenseManagement.cards.transactions' | translate">
        <nz-spin [nzSpinning]="store.loading()">
          <nz-table
            #table
            nzSize="small"
            [nzData]="store.transactions()"
            [nzTotal]="store.total()"
            [nzPageIndex]="store.page()"
            [nzPageSize]="store.pageSize()"
            [nzFrontPagination]="false"
            (nzPageIndexChange)="store.setPage($event)"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'expenseManagement.field.expenseDate' | translate }}</th>
                <th scope="col">{{ 'expenseManagement.field.merchant' | translate }}</th>
                <th scope="col">{{ 'expenseManagement.field.card' | translate }}</th>
                <th scope="col" class="num">{{ 'expenseManagement.field.amount' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'expenseManagement.cards.remaining' | translate }}
                </th>
                <th scope="col">{{ 'expenseManagement.field.status' | translate }}</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              @for (transaction of table.data; track transaction.id) {
                <tr [class.selected]="store.selected()?.id === transaction.id">
                  <td>{{ transaction.transaction_date }}</td>
                  <td>{{ transaction.merchant_name }}</td>
                  <td>{{ transaction.holder_name }} ·· {{ transaction.card_last4 }}</td>
                  <td class="num">{{ transaction.amount | money: transaction.currency }}</td>
                  <td class="num">
                    {{ transaction.remaining_amount | money: transaction.currency }}
                  </td>
                  <td>
                    <nz-tag [nzColor]="color(transaction.status)">{{
                      'expenseManagement.reconciliationStatus.' + transaction.status | translate
                    }}</nz-tag>
                  </td>
                  <td class="row-actions">
                    <button nz-button nzSize="small" type="button" (click)="choose(transaction)">
                      {{ 'expenseManagement.action.reconcile' | translate }}
                    </button>
                    @if (transaction.status === 'unmatched') {
                      <button
                        nz-button
                        nzSize="small"
                        type="button"
                        [disabled]="store.busy()"
                        (click)="act(transaction, 'ignore')"
                      >
                        {{ 'expenseManagement.action.ignore' | translate }}
                      </button>
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        [disabled]="store.busy()"
                        (click)="act(transaction, 'dispute')"
                      >
                        {{ 'expenseManagement.action.dispute' | translate }}
                      </button>
                    } @else {
                      <button
                        nz-button
                        nzSize="small"
                        type="button"
                        [disabled]="store.busy()"
                        (click)="act(transaction, 'unmatch')"
                      >
                        {{ 'expenseManagement.action.unmatch' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">
                    <nz-empty
                      [nzNotFoundContent]="'expenseManagement.empty.transactions' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-spin>
      </section>

      <section class="pane" [attr.aria-label]="'expenseManagement.cards.lines' | translate">
        @if (store.selected(); as transaction) {
          <h3>
            {{ transaction.merchant_name }} ·
            {{ transaction.remaining_amount | money: transaction.currency }}
          </h3>
          @for (matched of transaction.matched_lines; track matched.id) {
            <nz-tag nzColor="green"
              >{{ matched.report_number }} ·
              {{ matched.amount | money: transaction.currency }}</nz-tag
            >
          }
          <label class="field" for="exm-card-report">
            <span>{{ 'expenseManagement.field.report' | translate }}</span>
            <nz-select
              nzId="exm-card-report"
              nzShowSearch
              [ngModel]="reportId()"
              (ngModelChange)="pickReport($event)"
            >
              @for (report of store.reports(); track report.id) {
                <nz-option
                  [nzValue]="report.id"
                  [nzLabel]="report.report_number + ' · ' + (report.employee?.name ?? '')"
                ></nz-option>
              }
            </nz-select>
          </label>

          <nz-table #lines nzSize="small" [nzData]="store.candidates()" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">{{ 'expenseManagement.field.expenseDate' | translate }}</th>
                <th scope="col">{{ 'expenseManagement.field.merchant' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'expenseManagement.field.amountBase' | translate }}
                </th>
                <th scope="col" class="num">{{ 'expenseManagement.cards.covers' | translate }}</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              @for (line of lines.data; track line.id) {
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      [checked]="isChosen(line)"
                      [attr.aria-label]="line.merchant_name"
                      (change)="toggle(line)"
                    />
                  </td>
                  <td>{{ line.expense_date }}</td>
                  <td>{{ line.merchant_name }}</td>
                  <td class="num">
                    {{ line.amount_in_base_currency | money: transaction.currency }}
                  </td>
                  <td class="num">
                    @if (isChosen(line)) {
                      <input
                        nz-input
                        type="number"
                        step="0.01"
                        min="0"
                        class="part"
                        [ngModel]="chosen()[line.id]"
                        (ngModelChange)="setPart(line, $event)"
                      />
                    }
                  </td>
                  <td>
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      [disabled]="store.busy()"
                      (click)="matchOne(transaction, line)"
                    >
                      {{ 'expenseManagement.action.match' | translate }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <nz-empty
                      [nzNotFoundContent]="'expenseManagement.empty.cardLines' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          @if (selections().length > 1 || (selections().length === 1 && splitting())) {
            <div class="split-bar">
              <span [class.over]="left() < 0">
                {{ 'expenseManagement.cards.left' | translate }}:
                {{ left() | money: transaction.currency }}
              </span>
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="store.busy() || left() < 0"
                (click)="matchSplit(transaction)"
              >
                {{ 'expenseManagement.action.matchSplit' | translate }}
              </button>
            </div>
          }
        } @else {
          <nz-empty
            [nzNotFoundContent]="'expenseManagement.cards.pickTransaction' | translate"
          ></nz-empty>
        }
      </section>
    </div>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      min-width: 200px;
      gap: 4px;
      margin: 8px 0;
    }
    .feedback {
      margin-bottom: 12px;
    }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: 24px;
    }
    @media (max-width: 1100px) {
      .split {
        grid-template-columns: 1fr;
      }
    }
    .num {
      text-align: right;
    }
    .row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .selected {
      background: rgba(24, 144, 255, 0.08);
    }
    .part {
      width: 96px;
    }
    .split-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12px;
    }
    .over {
      color: #cf1322;
    }
  `,
})
export class CardsComponent implements OnInit {
  protected readonly store = inject(CardsStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly statuses: readonly ExmReconciliationStatus[] = EXM_RECONCILIATION_STATUSES;
  protected readonly reportId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  /** Lines picked for a split, with the part of the transaction each covers. */
  protected readonly chosen = signal<Record<string, number>>({});
  protected readonly splitting = signal(false);

  protected readonly selections = computed<CardMatchSelection[]>(() => {
    const parts = this.chosen();
    return this.store
      .candidates()
      .filter((line) => parts[line.id] !== undefined)
      .map((line) => ({ line, amount: parts[line.id] }));
  });

  protected readonly left = computed(() => {
    const transaction = this.store.selected();
    return transaction ? remainingAfter(transaction, this.selections()) : 0;
  });

  protected color = reconciliationColor;

  ngOnInit(): void {
    void this.store.init();
  }

  protected choose(transaction: ExmCardTransaction): void {
    this.store.select(transaction);
    this.chosen.set({});
    this.splitting.set(false);
  }

  protected async pickReport(id: string | null): Promise<void> {
    this.reportId.set(id);
    this.chosen.set({});
    await this.store.openReport(id);
  }

  protected isChosen(line: ExmLine): boolean {
    return this.chosen()[line.id] !== undefined;
  }

  protected toggle(line: ExmLine): void {
    const next = { ...this.chosen() };
    if (next[line.id] === undefined) {
      next[line.id] = toNumber(line.amount_in_base_currency);
      this.splitting.set(true);
    } else {
      delete next[line.id];
    }
    this.chosen.set(next);
  }

  protected setPart(line: ExmLine, value: number | string): void {
    this.chosen.update((parts) => ({ ...parts, [line.id]: toNumber(value) }));
  }

  /** One-click match: the line covers the whole transaction when the amounts agree, otherwise what is left. */
  protected matchOne(transaction: ExmCardTransaction, line: ExmLine): Promise<void> {
    const amount = Math.min(
      toNumber(line.amount_in_base_currency),
      toNumber(transaction.remaining_amount),
    );
    return this.finish(this.store.match(transaction, [{ line, amount }]), 'matched');
  }

  protected matchSplit(transaction: ExmCardTransaction): Promise<void> {
    return this.finish(this.store.match(transaction, this.selections()), 'matched');
  }

  protected act(
    transaction: ExmCardTransaction,
    action: Exclude<ExmReconcileAction, 'match'>,
  ): Promise<void> {
    return this.finish(
      this.store.act(transaction, action),
      action === 'unmatch' ? 'unmatched' : action,
    );
  }

  private async finish(pending: Promise<ExmOutcome>, done: string): Promise<void> {
    const outcome = await pending;
    if (outcome.ok) {
      this.actionError.set(null);
      this.chosen.set({});
      this.splitting.set(false);
      this.message.success(this.i18n.instant(`expenseManagement.message.card.${done}`));
      await this.store.openReport(this.reportId());
    } else {
      this.actionError.set(outcome.errorKey);
    }
  }
}
