import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingImportPayload } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AMOUNT_FIELDS,
  AmountKey,
  CentsByKey,
  parseEmployeeNets,
  reconcile,
  toAccountingPayload,
  toCents,
} from './accounting-reconciliation.util';

/**
 * Preview of the accounting summary before it is posted: the amounts of the consultant's prospetto are typed on the
 * left, and on the right each equation shows what is stated against what the aggregates calculate. The import
 * button opens only when every blocking equation balances, so that the ledger never receives a summary that the API
 * would refuse.
 */
@Component({
  selector: 'app-accounting-reconciler',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzGridModule,
    NzInputModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <div nz-row [nzGutter]="24">
      <div nz-col [nzXs]="24" [nzLg]="10">
        <h4>{{ 'itPayroll.reconciler.amounts' | translate }}</h4>
        @for (field of fields; track field.key) {
          <div class="field">
            <label [for]="'amount-' + field.key"
              >{{ 'itPayroll.field.' + field.key | translate }}
              @if (field.required) {
                *
              }
            </label>
            <input
              nz-input
              type="number"
              step="0.01"
              min="0"
              inputmode="decimal"
              [id]="'amount-' + field.key"
              [disabled]="disabled()"
              [ngModel]="amounts()[field.key] ?? ''"
              (ngModelChange)="setAmount(field.key, $event)"
            />
          </div>
        }

        <h4 class="gap">{{ 'itPayroll.reconciler.nets' | translate }}</h4>
        <label for="employee-nets">{{ 'itPayroll.reconciler.netsHint' | translate }}</label>
        <textarea
          nz-input
          id="employee-nets"
          rows="5"
          [disabled]="disabled()"
          [ngModel]="netsText()"
          (ngModelChange)="netsText.set($event)"
        ></textarea>
        <p class="meta" data-testid="nets-summary">
          {{ 'itPayroll.reconciler.netsRows' | translate: { count: nets().rows.length } }} ·
          {{ netsSumCents() / 100 | money: 'EUR' }}
        </p>
        @for (problem of nets().errors; track problem.line) {
          <nz-alert
            class="gap-small"
            nzType="error"
            [nzMessage]="
              'itPayroll.reconciler.netsError.' + problem.reason | translate: { line: problem.line }
            "
          />
        }
      </div>

      <div nz-col [nzXs]="24" [nzLg]="14">
        <h4>{{ 'itPayroll.reconciler.checks' | translate }}</h4>
        <nz-table
          #checks
          [nzData]="reconciliation().checks"
          nzSize="small"
          [nzShowPagination]="false"
          data-testid="reconciliation-table"
        >
          <thead>
            <tr>
              <th>{{ 'itPayroll.reconciler.check' | translate }}</th>
              <th class="num">{{ 'itPayroll.reconciler.stated' | translate }}</th>
              <th class="num">{{ 'itPayroll.reconciler.calculated' | translate }}</th>
              <th class="num">{{ 'itPayroll.reconciler.difference' | translate }}</th>
              <th>{{ 'itPayroll.reconciler.result' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of checks.data; track row.id) {
              <tr [attr.data-testid]="'check-' + row.id">
                <td>{{ 'itPayroll.check.' + row.id | translate }}</td>
                <td class="num">{{ row.stated / 100 | money: 'EUR' }}</td>
                <td class="num">{{ row.calculated / 100 | money: 'EUR' }}</td>
                <td class="num">{{ row.difference / 100 | money: 'EUR' }}</td>
                <td>
                  @if (row.ok) {
                    <nz-tag nzColor="success">{{ 'itPayroll.reconciler.ok' | translate }}</nz-tag>
                  } @else if (row.severity === 'warning') {
                    <nz-tag nzColor="warning">{{
                      'itPayroll.reconciler.warning' | translate
                    }}</nz-tag>
                  } @else {
                    <nz-tag nzColor="error">{{
                      'itPayroll.reconciler.mismatch' | translate
                    }}</nz-tag>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>

        @if (reconciliation().missing.length) {
          <nz-alert
            class="gap"
            nzType="info"
            nzShowIcon
            [nzMessage]="'itPayroll.reconciler.missing' | translate"
            data-testid="missing-amounts"
          />
        }

        <button
          nz-button
          nzType="primary"
          type="button"
          class="gap"
          data-testid="import-accounting"
          [disabled]="disabled() || busy() || !canSubmit()"
          [nzLoading]="busy()"
          (click)="submit()"
        >
          {{ 'itPayroll.reconciler.import' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 8px;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .meta {
      margin: 4px 0 0;
    }
    .gap {
      margin-top: 16px;
    }
    .gap-small {
      margin-top: 8px;
    }
  `,
})
export class AccountingReconcilerComponent {
  protected readonly fields = AMOUNT_FIELDS;

  /** The workflow does not accept the summary in the current state (not exported yet, or already posted). */
  readonly disabled = input(false);
  /** The import is running. */
  readonly busy = input(false);
  /** The company the journal entry is posted for; none posts it for the tenant. */
  readonly companyId = input<string | null>(null);
  readonly submitted = output<AccountingImportPayload>();

  protected readonly amounts = signal<Partial<Record<AmountKey, string>>>({});
  protected readonly netsText = signal('');

  protected readonly nets = computed(() => parseEmployeeNets(this.netsText()));
  protected readonly netsCents = computed(() =>
    this.nets().rows.map((row) => toCents(row.net_amount) ?? 0),
  );
  protected readonly netsSumCents = computed(() =>
    this.netsCents().reduce((sum, cents) => sum + cents, 0),
  );

  private readonly cents = computed<CentsByKey>(
    () =>
      Object.fromEntries(
        AMOUNT_FIELDS.map((field) => [field.key, toCents(this.amounts()[field.key])]),
      ) as CentsByKey,
  );

  protected readonly reconciliation = computed(() => reconcile(this.cents(), this.netsCents()));

  /** Every blocking equation balances and every pasted line was understood. */
  protected readonly canSubmit = computed(
    () => this.reconciliation().canImport && this.nets().errors.length === 0,
  );

  protected setAmount(key: AmountKey, value: string | number | null): void {
    this.amounts.update((current) => ({ ...current, [key]: value === null ? '' : String(value) }));
  }

  protected submit(): void {
    // The button is closed in this case; this guards against a call from a test or a stale click.
    if (!this.canSubmit()) {
      return;
    }

    this.submitted.emit(toAccountingPayload(this.cents(), this.nets().rows, this.companyId()));
  }
}
