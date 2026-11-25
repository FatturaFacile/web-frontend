import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { DcInstallment, DcPaymentPlanPayload, DcProposalItem } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { ArCustomerSelectComponent } from '../receivables/ar-customer-select.component';
import { buildInstallments, sumDecimals, todayIso } from './debt-collection.util';

/**
 * Dialog that agrees a payment plan (piano di rientro): the open items it covers, a monthly instalment schedule that the
 * user can adjust, and the end date. While the plan is active the covered items stay out of the dunning queue.
 */
@Component({
  selector: 'app-dc-plan-dialog',
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    ArCustomerSelectComponent,
    NzButtonModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
  ],
  styleUrl: './debt-collection.scss',
  template: `
    <nz-modal
      nzWidth="720px"
      [nzVisible]="open()"
      [nzTitle]="'debtCollection.plan.dialogTitle' | translate"
      [nzOkText]="'debtCollection.action.save' | translate"
      [nzCancelText]="'debtCollection.action.cancel' | translate"
      [nzOkDisabled]="!valid()"
      [nzOkLoading]="saving()"
      (nzOnOk)="submit()"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        <div class="stack">
          @if (!customerId()) {
            <div class="field">
              <span>{{ 'debtCollection.field.customer' | translate }}</span>
              <app-ar-customer-select
                [customerId]="pickedCustomer()"
                (customerChange)="pick($event?.id ?? null)"
              />
            </div>
          }

          <div>
            <span>{{ 'debtCollection.plan.items' | translate }}</span>
            @for (item of items(); track item.receivable_item_id) {
              <div>
                <label
                  nz-checkbox
                  [ngModel]="selected().includes(item.receivable_item_id)"
                  (ngModelChange)="toggle(item.receivable_item_id, $event)"
                >
                  {{ item.document_number }} · {{ item.due_date }} ·
                  {{ item.open_amount | money: item.currency }}
                </label>
              </div>
            } @empty {
              <nz-empty [nzNotFoundContent]="'debtCollection.legal.noItems' | translate" />
            }
          </div>

          <div class="form-grid">
            <label class="field" for="dc-p-start">
              <span>{{ 'debtCollection.plan.firstInstallment' | translate }}</span>
              <input
                nz-input
                id="dc-p-start"
                type="date"
                [ngModel]="start()"
                (ngModelChange)="start.set($event)"
              />
            </label>
            <label class="field" for="dc-p-count">
              <span>{{ 'debtCollection.plan.installmentCount' | translate }}</span>
              <input
                nz-input
                id="dc-p-count"
                type="number"
                min="1"
                max="60"
                [ngModel]="count()"
                (ngModelChange)="count.set($event)"
              />
            </label>
            <div class="field">
              <span>&nbsp;</span>
              <button
                nz-button
                type="button"
                [disabled]="selected().length === 0"
                (click)="generate()"
              >
                {{ 'debtCollection.plan.generateSchedule' | translate }}
              </button>
            </div>
          </div>

          @for (row of installments(); track $index) {
            <div class="form-grid">
              <label class="field" [attr.for]="'dc-p-due-' + $index">
                <span>{{
                  'debtCollection.plan.installmentDue' | translate: { number: $index + 1 }
                }}</span>
                <input
                  nz-input
                  [id]="'dc-p-due-' + $index"
                  type="date"
                  [ngModel]="row.due_date"
                  (ngModelChange)="patch($index, { due_date: $event })"
                />
              </label>
              <label class="field" [attr.for]="'dc-p-amt-' + $index">
                <span>{{ 'debtCollection.field.amount' | translate }}</span>
                <input
                  nz-input
                  [id]="'dc-p-amt-' + $index"
                  inputmode="decimal"
                  [ngModel]="row.amount"
                  (ngModelChange)="patch($index, { amount: $event })"
                />
              </label>
            </div>
          }

          @if (installments().length > 0) {
            <p>
              <strong>{{ 'debtCollection.field.total' | translate }}:</strong>
              {{ scheduleTotal() | money: currency() }}
              @if (scheduleTotal() !== selectedTotal()) {
                <small class="error-text">
                  {{
                    'debtCollection.plan.totalMismatch' | translate: { expected: selectedTotal() }
                  }}
                </small>
              }
            </p>
          }

          <label class="field" for="dc-p-notes">
            <span>{{ 'debtCollection.field.notes' | translate }}</span>
            <textarea
              nz-input
              id="dc-p-notes"
              rows="2"
              maxlength="1000"
              [ngModel]="notes()"
              (ngModelChange)="notes.set($event)"
            ></textarea>
          </label>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class DcPlanDialogComponent {
  readonly open = input(false);
  readonly customerId = input<string | null>(null);
  /** Open items of the customer the plan can cover (the parent loads them when the customer is known). */
  readonly items = input<readonly DcProposalItem[]>([]);
  readonly saving = input(false);
  readonly submitted = output<DcPaymentPlanPayload>();
  readonly closed = output<void>();
  readonly customerPicked = output<string | null>();

  protected readonly pickedCustomer = signal<string | null>(null);
  protected readonly selected = signal<string[]>([]);
  protected readonly start = signal(todayIso());
  protected readonly count = signal(3);
  protected readonly installments = signal<DcInstallment[]>([]);
  protected readonly notes = signal('');

  private readonly chosen = computed(() =>
    this.items().filter((item) => this.selected().includes(item.receivable_item_id)),
  );
  protected readonly currency = computed(() => this.chosen()[0]?.currency ?? 'CHF');
  protected readonly selectedTotal = computed(() =>
    sumDecimals(this.chosen().map((item) => item.open_amount)),
  );
  protected readonly scheduleTotal = computed(() =>
    sumDecimals(this.installments().map((row) => row.amount || '0')),
  );

  protected readonly valid = computed(
    () =>
      (this.customerId() ?? this.pickedCustomer()) !== null &&
      this.chosen().length > 0 &&
      this.installments().length > 0 &&
      this.installments().every((row) => row.due_date !== '' && Number(row.amount) > 0) &&
      this.scheduleTotal() === this.selectedTotal(),
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        this.selected.set([]);
        this.installments.set([]);
        this.notes.set('');
        this.start.set(todayIso());
        this.count.set(3);
        this.pickedCustomer.set(null);
      }
    });
  }

  protected pick(id: string | null): void {
    this.pickedCustomer.set(id);
    this.selected.set([]);
    this.installments.set([]);
    this.customerPicked.emit(id);
  }

  protected toggle(id: string, checked: boolean): void {
    const without = this.selected().filter((value) => value !== id);
    this.selected.set(checked ? [...without, id] : without);
    this.installments.set([]);
  }

  protected generate(): void {
    this.installments.set(
      buildInstallments(this.selectedTotal(), Number(this.count()), this.start()),
    );
  }

  protected patch(index: number, change: Partial<DcInstallment>): void {
    this.installments.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...change } : row)),
    );
  }

  protected submit(): void {
    const customer = this.customerId() ?? this.pickedCustomer();
    const rows = this.installments();
    if (!customer || rows.length === 0) {
      return;
    }
    const notes = this.notes().trim();
    const dates = rows.map((row) => row.due_date).sort();
    this.submitted.emit({
      customer_id: customer,
      currency: this.currency(),
      total_amount: this.scheduleTotal(),
      start_date: dates[0] ?? this.start(),
      end_date: dates[dates.length - 1] ?? this.start(),
      receivable_item_ids: this.chosen().map((item) => item.receivable_item_id),
      installments: rows.map((row) => ({
        due_date: row.due_date,
        amount: Number(row.amount).toFixed(2),
      })),
      ...(notes ? { notes } : {}),
    });
  }
}
