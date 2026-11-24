import { Component, effect, inject, input, model, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ArAllocationType, ArItem, AR_ALLOCATION_TYPES, TranslateService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { ReconciliationStore } from './reconciliation.store';
import { fromIsoDate, toIsoDate, todayIso } from './receivables.util';

/**
 * Reconciliation drawer: allocates a payment, a credit note, a write-off, a discount or a debit adjustment to one or
 * several open items of a customer, partially or in full. It shows the residual of every item and the value dates.
 */
@Component({
  selector: 'app-reconciliation-drawer',
  styleUrl: './receivables.scss',
  providers: [ReconciliationStore],
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzInputModule,
    NzSelectModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      nzPlacement="right"
      [nzWidth]="880"
      [nzTitle]="'AR.RECONCILE_TITLE' | translate"
      [nzFooter]="footer"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (store.error(); as error) {
          <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error"></nz-alert>
        }

        <table class="matrix card">
          <caption class="sr-only">
            {{
              'AR.RECONCILE_ITEMS' | translate
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ 'AR.DOCUMENT' | translate }}</th>
              <th scope="col">{{ 'AR.DUE_DATE' | translate }}</th>
              <th scope="col">{{ 'AR.VALUE_DATE' | translate }}</th>
              <th scope="col" class="num">{{ 'AR.OPEN_AMOUNT' | translate }}</th>
              <th scope="col" class="num">{{ 'AR.ALLOCATED' | translate }}</th>
              <th scope="col" class="num">{{ 'AR.RESIDUAL' | translate }}</th>
              <th scope="col">{{ 'AR.ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of store.residuals(); track row.item.id) {
              <tr>
                <th scope="row">{{ row.item.document_number }} · {{ row.item.sequence }}</th>
                <td>{{ row.item.due_date }}</td>
                <td>{{ row.item.value_date ?? '–' }}</td>
                <td class="num">{{ row.item.open_amount | money: row.item.currency }}</td>
                <td class="num">{{ row.settled | money: row.item.currency }}</td>
                <td class="num" [class.negative]="row.residual.startsWith('-')">
                  {{ row.residual | money: row.item.currency }}
                </td>
                <td>
                  <button nz-button nzSize="small" type="button" (click)="store.addLine(row.item.id, today())">
                    {{ 'AR.ADD_LINE' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        @for (line of store.lines(); track line.uid; let index = $index) {
          @let problems = store.lineErrors()[line.uid] ?? [];
          <section
            class="draft-line"
            [class.invalid]="problems.length > 0"
            [attr.aria-label]="'AR.RECONCILE_LINE' | translate: { number: index + 1 }"
          >
            <div class="draft-head">
              <strong>{{ itemLabel(line.itemId) }}</strong>
              <button
                nz-button
                nzSize="small"
                nzDanger
                type="button"
                [disabled]="store.lines().length === 1"
                (click)="store.removeLine(line.uid)"
              >
                {{ 'AR.REMOVE_LINE' | translate }}
              </button>
            </div>

            <div class="draft-grid">
              <div class="field">
                <label [attr.for]="'type-' + line.uid">{{ 'AR.ALLOCATION_TYPE' | translate }}</label>
                <nz-select
                  [nzId]="'type-' + line.uid"
                  style="width: 100%"
                  [ngModel]="line.type"
                  (ngModelChange)="store.setType(line.uid, $event)"
                >
                  @for (type of types; track type) {
                    <nz-option
                      [nzValue]="type"
                      [nzLabel]="'AR.TYPE_' + type.toUpperCase() | translate"
                    ></nz-option>
                  }
                </nz-select>
              </div>

              <div class="field">
                <label [attr.for]="'amount-' + line.uid">{{ 'AR.AMOUNT' | translate }}</label>
                <div style="display: flex; gap: 4px">
                  <input
                    nz-input
                    inputmode="decimal"
                    [id]="'amount-' + line.uid"
                    [ngModel]="line.amount"
                    (ngModelChange)="store.updateLine(line.uid, { amount: $event })"
                  />
                  @if (line.type !== 'debit_adjustment') {
                    <button nz-button type="button" (click)="store.setFull(line.uid)">
                      {{ 'AR.FULL' | translate }}
                    </button>
                  }
                </div>
              </div>

              <div class="field">
                <label [attr.for]="'date-' + line.uid">{{ 'AR.VALUE_DATE' | translate }}</label>
                <nz-date-picker
                  style="width: 100%"
                  [nzId]="'date-' + line.uid"
                  [ngModel]="date(line.valueDate)"
                  (ngModelChange)="store.updateLine(line.uid, { valueDate: iso($event) })"
                ></nz-date-picker>
              </div>

              @if (line.type === 'payment') {
                <div class="field">
                  <label [attr.for]="'payment-' + line.uid">{{ 'AR.UNRECONCILED_PAYMENT' | translate }}</label>
                  <nz-select
                    [nzId]="'payment-' + line.uid"
                    style="width: 100%"
                    nzAllowClear
                    [nzLoading]="store.paymentsLoading()"
                    [nzPlaceHolder]="'AR.PICK_PAYMENT' | translate"
                    [ngModel]="line.sourceId"
                    (ngModelChange)="store.pickPayment(line.uid, $event)"
                  >
                    @for (payment of store.payments(); track payment.ledger_entry_id) {
                      <nz-option
                        [nzValue]="payment.ledger_entry_id"
                        [nzLabel]="paymentLabel(payment.reference, payment.date, store.paymentRemaining()[payment.ledger_entry_id], payment.currency)"
                      ></nz-option>
                    }
                  </nz-select>
                </div>
              } @else if (line.type === 'credit_note') {
                <div class="field">
                  <label [attr.for]="'source-' + line.uid">{{ 'AR.CREDIT_NOTE_ID' | translate }}</label>
                  <input
                    nz-input
                    [id]="'source-' + line.uid"
                    [ngModel]="line.sourceId ?? ''"
                    (ngModelChange)="store.updateLine(line.uid, { sourceId: $event || null })"
                  />
                </div>
              }

              <div class="field">
                <label [attr.for]="'reference-' + line.uid">{{ 'AR.REFERENCE' | translate }}</label>
                <input
                  nz-input
                  [id]="'reference-' + line.uid"
                  [ngModel]="line.reference"
                  (ngModelChange)="store.updateLine(line.uid, { reference: $event })"
                />
              </div>

              <div class="field">
                <label [attr.for]="'notes-' + line.uid">{{ 'AR.NOTES' | translate }}</label>
                <input
                  nz-input
                  [id]="'notes-' + line.uid"
                  [ngModel]="line.notes"
                  (ngModelChange)="store.updateLine(line.uid, { notes: $event })"
                />
              </div>
            </div>

            @if (problems.length > 0) {
              <ul class="error" role="alert">
                @for (problem of problems; track problem) {
                  <li>{{ problem | translate }}</li>
                }
              </ul>
            }
          </section>
        }
      </ng-container>
    </nz-drawer>

    <ng-template #footer>
      <div class="drawer-footer">
        <span>
          {{ 'AR.TOTAL_ALLOCATED' | translate }}:
          <strong>{{ store.totalSettled() | money: currency() }}</strong>
        </span>
        <span>
          <button nz-button type="button" (click)="open.set(false)">{{ 'AR.CANCEL' | translate }}</button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="!store.isValid()"
            [nzLoading]="store.saving()"
            (click)="submit()"
          >
            {{ 'AR.ALLOCATE' | translate }}
          </button>
        </span>
      </div>
    </ng-template>
  `,
})
export class ReconciliationDrawerComponent {
  readonly store = inject(ReconciliationStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly open = model(false);
  /** The open items to reconcile (one customer, one currency). */
  readonly items = input<readonly ArItem[]>([]);
  /** The fresh state of the items the API answered after a successful allocation. */
  readonly reconciled = output<ArItem[]>();

  readonly types: readonly ArAllocationType[] = AR_ALLOCATION_TYPES;

  constructor() {
    effect(() => {
      // Only the opening restarts the draft: a change of the items while the drawer is open must not wipe the edits.
      if (this.open()) {
        untracked(() => {
          this.store.init(this.items(), todayIso());
          void this.store.loadPayments();
        });
      }
    });
  }

  today(): string {
    return todayIso();
  }

  currency(): string {
    return this.store.items()[0]?.currency ?? 'EUR';
  }

  date(value: string): Date | null {
    return fromIsoDate(value);
  }

  iso(value: Date | null): string {
    return toIsoDate(value) ?? '';
  }

  itemLabel(itemId: string): string {
    const item = this.store.items().find((row) => row.id === itemId);
    return item ? `${item.document_number} · ${item.sequence}` : itemId;
  }

  paymentLabel(
    reference: string | null,
    date: string,
    remaining: string | undefined,
    currency: string,
  ): string {
    const amount = [remaining, currency].filter((part) => !!part).join(' ');
    return [reference ?? '—', date, amount].join(' · ');
  }

  async submit(): Promise<void> {
    const result = await this.store.submit();
    if (result.ok) {
      this.message.success(this.translate.instant('AR.ALLOCATED_OK'));
      this.reconciled.emit(result.items);
      this.open.set(false);
    } else if (result.message) {
      this.message.error(result.message);
    }
  }
}
