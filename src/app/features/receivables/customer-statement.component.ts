import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AR_STATEMENT_LOCALES,
  ArBucket,
  ArItemStatus,
  ArStatementLocale,
  PermissionsService,
  TranslateService,
} from '@core';
import { downloadBlob, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { ArCustomerOption, ArCustomerSelectComponent } from './ar-customer-select.component';
import { CustomerStatementStore, StatementFormat } from './customer-statement.store';
import {
  bucketLabelParts,
  dateRange,
  RECEIVABLES_MODULE,
  statusColor,
  toIsoDate,
} from './receivables.util';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Customer statement (Estratto Conto): period picker and preview (opening balance, movements, open items with the
 * overdue ones highlighted, aging, closing balance), PDF and Excel downloads and the send by e-mail.
 */
@Component({
  selector: 'app-customer-statement',
  styleUrl: './receivables.scss',
  providers: [CustomerStatementStore],
  imports: [
    ArCustomerSelectComponent,
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'AR.STATEMENT_TITLE' | translate"
      [subtitle]="'AR.STATEMENT_SUBTITLE' | translate"
    >
      @if (customerId(); as id) {
        <a nz-button [routerLink]="['/receivables/ledger', id]">{{ 'AR.LEDGER' | translate }}</a>
        <button
          nz-button
          type="button"
          [disabled]="!store.statement() || !store.periodIsValid()"
          [nzLoading]="store.downloading() === 'pdf'"
          (click)="download('pdf')"
        >
          {{ 'AR.DOWNLOAD_PDF' | translate }}
        </button>
        <button
          nz-button
          type="button"
          [disabled]="!store.statement() || !store.periodIsValid()"
          [nzLoading]="store.downloading() === 'xlsx'"
          (click)="download('xlsx')"
        >
          {{ 'AR.DOWNLOAD_XLSX' | translate }}
        </button>
        @if (canWrite) {
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="!store.statement() || !store.periodIsValid()"
            (click)="openSend()"
          >
            {{ 'AR.SEND_EMAIL' | translate }}
          </button>
        }
      }
    </app-page-header>

    <div class="toolbar">
      <app-ar-customer-select
        [customerId]="customerId()"
        (customerChange)="onCustomer($event)"
      ></app-ar-customer-select>
      @if (customerId()) {
        <nz-range-picker
          [ngModel]="range()"
          [attr.aria-label]="'AR.PERIOD' | translate"
          (ngModelChange)="onRange($event)"
        ></nz-range-picker>
      }
    </div>

    @if (!customerId()) {
      <nz-empty [nzNotFoundContent]="'AR.PICK_CUSTOMER_HINT' | translate"></nz-empty>
    } @else {
      @if (store.error(); as error) {
        <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
      }
      @if (!store.periodIsValid()) {
        <nz-alert class="card" nzType="warning" nzShowIcon [nzMessage]="'AR.ERR_PERIOD' | translate"></nz-alert>
      }

      <nz-spin [nzSpinning]="store.loading()">
        @if (store.statement(); as statement) {
          @let money = statement.currency;

          <nz-card class="card" [nzTitle]="statement.customer.name">
            <p class="muted">
              {{ statement.tenant.name }} ·
              {{ 'AR.PERIOD' | translate }}: {{ statement.period.from }} – {{ statement.period.to }} ·
              {{ 'AR.AS_OF' | translate: { date: statement.as_of } }}
            </p>

            <div class="summary">
              <div>
                <span class="muted">{{ 'AR.OPENING_BALANCE' | translate }}</span>
                <span class="figure">{{ statement.opening_balance | money: money }}</span>
              </div>
              <div>
                <span class="muted">{{ 'AR.CLOSING_BALANCE' | translate }}</span>
                <span class="figure">{{ statement.closing_balance | money: money }}</span>
              </div>
              <div>
                <span class="muted">{{ 'AR.TOTAL_OPEN' | translate }}</span>
                <span class="figure">{{ statement.total_open | money: money }}</span>
              </div>
              <div>
                <span class="muted">{{ 'AR.TOTAL_OVERDUE' | translate }}</span>
                <span class="figure negative">{{ statement.total_overdue | money: money }}</span>
              </div>
              @if (statement.credit.granted_limit !== null) {
                <div>
                  <span class="muted">{{ 'AR.CREDIT_LIMIT' | translate }}</span>
                  <span class="figure">{{ statement.credit.granted_limit | money: money }}</span>
                  @if (statement.credit.available_credit !== null) {
                    <span class="muted"
                      >{{ 'AR.AVAILABLE_CREDIT' | translate }}:
                      {{ statement.credit.available_credit | money: money }}</span
                    >
                  }
                </div>
              }
            </div>
          </nz-card>

          <nz-card class="card" [nzTitle]="'AR.MOVEMENTS' | translate">
            @if (store.movements().length === 0) {
              <nz-empty [nzNotFoundContent]="'AR.NO_MOVEMENTS' | translate"></nz-empty>
            } @else {
              <div class="matrix-wrap">
                <table class="matrix">
                  <thead>
                    <tr>
                      <th scope="col">{{ 'AR.DATE' | translate }}</th>
                      <th scope="col">{{ 'AR.VALUE_DATE' | translate }}</th>
                      <th scope="col">{{ 'AR.KIND' | translate }}</th>
                      <th scope="col">{{ 'AR.REFERENCE' | translate }}</th>
                      <th scope="col" class="num">{{ 'AR.DEBIT' | translate }}</th>
                      <th scope="col" class="num">{{ 'AR.CREDIT_AMOUNT' | translate }}</th>
                      <th scope="col" class="num">{{ 'AR.BALANCE' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row" colspan="6">{{ 'AR.OPENING_BALANCE' | translate }}</th>
                      <td class="num">{{ statement.opening_balance | money: money }}</td>
                    </tr>
                    @for (movement of store.movements(); track $index) {
                      <tr>
                        <td>{{ movement.date }}</td>
                        <td>{{ movement.value_date }}</td>
                        <td>{{ 'AR.KIND_' + movement.kind.toUpperCase() | translate }}</td>
                        <td>{{ movement.reference ?? '–' }}</td>
                        <td class="num">{{ movement.debit | money: money }}</td>
                        <td class="num">{{ movement.credit | money: money }}</td>
                        <td class="num">{{ movement.balance | money: money }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colspan="6">{{ 'AR.CLOSING_BALANCE' | translate }}</th>
                      <td class="num">{{ statement.closing_balance | money: money }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }
          </nz-card>

          <nz-card class="card" [nzTitle]="'AR.OPEN_ITEMS' | translate">
            @if (store.openItems().length === 0) {
              <nz-empty [nzNotFoundContent]="'AR.NO_OPEN_ITEMS' | translate"></nz-empty>
            } @else {
              <div class="matrix-wrap">
                <table class="matrix">
                  <thead>
                    <tr>
                      <th scope="col">{{ 'AR.DOCUMENT' | translate }}</th>
                      <th scope="col">{{ 'AR.ISSUE_DATE' | translate }}</th>
                      <th scope="col">{{ 'AR.DUE_DATE' | translate }}</th>
                      <th scope="col" class="num">{{ 'AR.ORIGINAL_AMOUNT' | translate }}</th>
                      <th scope="col" class="num">{{ 'AR.OPEN_AMOUNT' | translate }}</th>
                      <th scope="col">{{ 'AR.STATUS' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of store.openItems(); track row.receivable_item_id) {
                      <tr [class.overdue-row]="row.is_overdue">
                        <th scope="row">{{ row.document_number }}</th>
                        <td>{{ row.issue_date }}</td>
                        <td>{{ row.due_date }}</td>
                        <td class="num">{{ row.original_amount | money: money }}</td>
                        <td class="num">{{ row.open_amount | money: money }}</td>
                        <td>
                          <nz-tag [nzColor]="color(row.status)">{{ 'AR.STATUS_' + row.status.toUpperCase() | translate }}</nz-tag>
                          @if (row.is_overdue) {
                            <span class="negative">{{ 'AR.DAYS_PAST_DUE' | translate: { days: row.days_past_due } }}</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </nz-card>

          <nz-card class="card" [nzTitle]="'AR.AGING' | translate">
            <div class="matrix-wrap">
              <table class="matrix">
                <thead>
                  <tr>
                    @for (bucket of statement.aging.buckets; track bucket.key) {
                      @let part = parts(bucket);
                      <th scope="col">{{ part.key | translate: part.params }}</th>
                    }
                    <th scope="col">{{ 'AR.TOTAL_OPEN' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    @for (bucket of statement.aging.buckets; track bucket.key) {
                      <td class="num">{{ (statement.aging.totals[bucket.key] ?? '0.00') | money: money }}</td>
                    }
                    <td class="num">{{ statement.aging.total_open | money: money }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </nz-card>
        } @else if (!store.loading() && !store.error()) {
          <nz-empty [nzNotFoundContent]="'AR.NO_DATA' | translate"></nz-empty>
        }
      </nz-spin>

      <nz-modal
        [nzVisible]="sendOpen()"
        [nzTitle]="'AR.SEND_EMAIL' | translate"
        [nzOkText]="'AR.SEND' | translate"
        [nzCancelText]="'AR.CANCEL' | translate"
        [nzOkDisabled]="!sendValid()"
        [nzOkLoading]="store.sending()"
        (nzOnCancel)="sendOpen.set(false)"
        (nzOnOk)="send()"
      >
        <ng-container *nzModalContent>
          <div class="field">
            <label for="st-recipient">{{ 'AR.RECIPIENT' | translate }}</label>
            <input
              nz-input
              id="st-recipient"
              type="email"
              [placeholder]="store.customerEmail() ?? ''"
              [ngModel]="recipient()"
              (ngModelChange)="recipient.set($event)"
            />
            @if (recipientInvalid()) {
              <span class="error" role="alert">{{ 'AR.ERR_EMAIL' | translate }}</span>
            }
            @if (!store.customerEmail()) {
              <span class="muted">{{ 'AR.NO_CUSTOMER_EMAIL' | translate }}</span>
            }
          </div>
          <div class="field">
            <label for="st-locale">{{ 'AR.LANGUAGE' | translate }}</label>
            <nz-select
              nzId="st-locale"
              style="width: 100%"
              [ngModel]="locale()"
              (ngModelChange)="locale.set($event)"
            >
              @for (code of locales; track code) {
                <nz-option [nzValue]="code" [nzLabel]="'AR.LOCALE_' + code.toUpperCase() | translate"></nz-option>
              }
            </nz-select>
          </div>
        </ng-container>
      </nz-modal>
    }
  `,
})
export class CustomerStatementComponent implements OnInit {
  readonly store = inject(CustomerStatementStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  /** Sending a statement by e-mail is a write: credit managers only. */
  readonly canWrite = inject(PermissionsService).canWrite(RECEIVABLES_MODULE);

  readonly locales = AR_STATEMENT_LOCALES;
  readonly customerId = signal<string | null>(null);
  readonly range = computed(() => dateRange(this.store.from(), this.store.to()));

  readonly sendOpen = signal(false);
  readonly recipient = signal('');
  readonly locale = signal<ArStatementLocale>('en');
  readonly recipientInvalid = computed(
    () => this.recipient().trim() !== '' && !EMAIL_PATTERN.test(this.recipient().trim()),
  );
  /** A recipient is needed when the customer has no e-mail of its own. */
  readonly sendValid = computed(() => {
    const typed = this.recipient().trim();
    if (typed !== '') {
      return EMAIL_PATTERN.test(typed);
    }
    return !!this.store.customerEmail();
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('customerId');
      this.customerId.set(id);
      if (id) {
        void this.store.open(id);
      }
    });
  }

  color(status: ArItemStatus): string {
    return statusColor(status);
  }

  parts(bucket: ArBucket): { key: string; params?: Record<string, number> } {
    return bucketLabelParts(bucket);
  }

  onCustomer(option: ArCustomerOption | null): void {
    void this.router.navigate(option ? ['/receivables/statement', option.id] : ['/receivables/statement']);
  }

  onRange(dates: Date[] | null): void {
    const from = toIsoDate(dates?.[0]);
    const to = toIsoDate(dates?.[1]);
    if (from && to) {
      void this.store.setPeriod(from, to);
    }
  }

  async download(format: StatementFormat): Promise<void> {
    const result = await this.store.download(format);
    if (result.ok && result.blob) {
      downloadBlob(result.blob, result.filename);
    } else {
      this.message.error(result.message ?? this.translate.instant('AR.DOWNLOAD_ERROR'));
    }
  }

  openSend(): void {
    this.recipient.set('');
    this.locale.set(this.translate.currentLanguage());
    this.sendOpen.set(true);
  }

  async send(): Promise<void> {
    if (!this.sendValid()) {
      return;
    }
    const result = await this.store.send(this.recipient(), this.locale());
    if (result.ok && result.result) {
      this.sendOpen.set(false);
      this.message.success(this.translate.instant('AR.SEND_QUEUED', { recipient: result.result.recipient }));
    } else {
      this.message.error(result.message ?? this.translate.instant('AR.SEND_ERROR'));
    }
  }
}
