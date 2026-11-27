import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DP_SETTLEMENT_TYPES,
  DpDeposit,
  DpSettlementDeduction,
  DpSettlementPayload,
  DpSettlementType,
  TranslateService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { ChainStore } from './chain.store';
import { DpOutcome, fromCents, isoDay, sumCents, toCents } from './down-payments.util';
import { DpFeedbackComponent } from './feedback.component';

interface DeductionGroup {
  vatRate: string;
  rows: DpSettlementDeduction[];
  net: string;
  vat: string;
  gross: string;
}

/**
 * Preview of the final settlement invoice: the supply lines next to the negative deduction lines grouped by VAT rate and advance
 * invoice, the DatiFattureCollegate references of the XML, the closing entry of the customer advances, the totals and what blocks the
 * settlement (open pro-formas, held earnest money that can be imputed here), then the one-click generation (TD01 or TD24).
 */
@Component({
  selector: 'app-dp-settlement-drawer',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzRadioModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    DpFeedbackComponent,
    TranslatePipe,
  ],
  styleUrl: './down-payments.scss',
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="1040"
      [nzTitle]="'down_payments.modal.settlement' | translate"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        <app-dp-feedback [outcome]="feedback()" (dismissed)="feedback.set(null)" />

        <nz-spin [nzSpinning]="store.previewing()">
          @if (store.settlement(); as preview) {
            <div class="form-grid">
              <div class="field">
                <span id="dp-s-type-label">{{
                  'down_payments.field.documentType' | translate
                }}</span>
                <nz-radio-group
                  aria-labelledby="dp-s-type-label"
                  [ngModel]="documentType()"
                  (ngModelChange)="documentType.set($event)"
                >
                  @for (item of documentTypes; track item) {
                    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                    <label nz-radio [nzValue]="item" [attr.data-test]="'type-' + item">{{
                      'down_payments.settlementType.' + item | translate
                    }}</label>
                  }
                </nz-radio-group>
              </div>
              <label class="field" for="dp-s-date">
                <span>{{ 'down_payments.field.date' | translate }}</span>
                <nz-date-picker
                  nzId="dp-s-date"
                  [ngModel]="date()"
                  (ngModelChange)="date.set($event)"
                ></nz-date-picker>
              </label>
              <label class="field" for="dp-s-due">
                <span>{{ 'down_payments.field.dueDate' | translate }}</span>
                <nz-date-picker
                  nzId="dp-s-due"
                  [ngModel]="dueDate()"
                  (ngModelChange)="dueDate.set($event)"
                ></nz-date-picker>
              </label>
            </div>

            @if (preview.blockers.length > 0 || openProformas()) {
              <nz-alert
                class="notice"
                nzType="warning"
                nzShowIcon
                data-test="blockers"
                [nzMessage]="'down_payments.blockers.title' | translate"
                [nzDescription]="blockersTemplate"
              ></nz-alert>
              <ng-template #blockersTemplate>
                <ul class="blocker-list">
                  @for (blocker of preview.blockers; track blocker.code + blocker.id) {
                    @if (blocker.code === 'open_proforma') {
                      <li data-test="blocker-proforma">
                        {{ 'down_payments.blockers.open_proforma' | translate }}
                      </li>
                    } @else if (blocker.code === 'held_earnest_money') {
                      <li [attr.data-test]="'blocker-earnest-' + blocker.id">
                        @if (depositOf(blocker.id); as deposit) {
                          @if (deposit.status === 'held_active') {
                            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                            <label
                              nz-checkbox
                              [ngModel]="isImputed(blocker.id)"
                              (ngModelChange)="toggleImpute(blocker.id, $event)"
                              data-test="impute"
                            >
                              {{
                                'down_payments.blockers.imputeEarnest'
                                  | translate
                                    : {
                                        receipt: deposit.receipt_number ?? '',
                                        amount: deposit.amount,
                                      }
                              }}
                            </label>
                          } @else {
                            {{
                              'down_payments.blockers.unpaidEarnest'
                                | translate: { receipt: deposit.receipt_number ?? '' }
                            }}
                          }
                        } @else {
                          {{ 'down_payments.blockers.held_earnest_money' | translate }}
                        }
                      </li>
                    }
                  }
                  @if (openProformas() && !hasProformaBlocker()) {
                    <li data-test="blocker-proforma">
                      {{ 'down_payments.blockers.open_proforma' | translate }}
                    </li>
                  }
                </ul>
              </ng-template>
            }

            <div class="settlement-columns">
              <section>
                <h4 class="section-title">{{ 'down_payments.section.supplyLines' | translate }}</h4>
                <nz-table
                  nzSize="small"
                  [nzData]="preview.supply_lines"
                  [nzShowPagination]="false"
                  data-test="supply"
                >
                  <thead>
                    <tr>
                      <th scope="col">{{ 'down_payments.field.description' | translate }}</th>
                      <th scope="col" class="num">
                        {{ 'down_payments.field.quantity' | translate }}
                      </th>
                      <th scope="col" class="num">
                        {{ 'down_payments.field.unitPrice' | translate }}
                      </th>
                      <th scope="col" class="num">
                        {{ 'down_payments.field.vatRate' | translate }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of preview.supply_lines; track $index) {
                      <tr>
                        <td>{{ line.description }}</td>
                        <td class="num">{{ line.quantity }}</td>
                        <td class="num">{{ line.unit_price | money: preview.currency }}</td>
                        <td class="num">{{ line.vat_rate }}%</td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              </section>

              <section>
                <h4 class="section-title">{{ 'down_payments.section.deductions' | translate }}</h4>
                <nz-table
                  nzSize="small"
                  [nzData]="groups()"
                  [nzShowPagination]="false"
                  data-test="deductions"
                >
                  <thead>
                    <tr>
                      <th scope="col">{{ 'down_payments.field.advanceInvoice' | translate }}</th>
                      <th scope="col">{{ 'down_payments.field.vatRate' | translate }}</th>
                      <th scope="col" class="num">{{ 'down_payments.field.net' | translate }}</th>
                      <th scope="col" class="num">{{ 'down_payments.field.vat' | translate }}</th>
                      <th scope="col" class="num">{{ 'down_payments.field.gross' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (group of groups(); track group.vatRate) {
                      @for (row of group.rows; track row.link_id + row.advance_item_id) {
                        <tr [attr.data-test]="'deduction-' + group.vatRate">
                          <td>
                            {{ row.advance_invoice_number }}
                            <small class="muted">{{ row.advance_invoice_date }}</small>
                          </td>
                          <td>{{ row.vat_rate }}%</td>
                          <td class="num negative">-{{ row.net | money: preview.currency }}</td>
                          <td class="num negative">-{{ row.vat | money: preview.currency }}</td>
                          <td class="num negative">-{{ row.gross | money: preview.currency }}</td>
                        </tr>
                      }
                      <tr class="subtotal" [attr.data-test]="'group-' + group.vatRate">
                        <th scope="row" colspan="2">
                          {{
                            'down_payments.field.subtotalRate' | translate: { rate: group.vatRate }
                          }}
                        </th>
                        <td class="num negative">-{{ group.net | money: preview.currency }}</td>
                        <td class="num negative">-{{ group.vat | money: preview.currency }}</td>
                        <td class="num negative">-{{ group.gross | money: preview.currency }}</td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              </section>
            </div>

            <div class="preview-box" data-test="totals">
              <dl>
                <dt>{{ 'down_payments.totals.supplyNet' | translate }}</dt>
                <dd>{{ preview.totals.supply_net | money: preview.currency }}</dd>
                <dt>{{ 'down_payments.totals.supplyVat' | translate }}</dt>
                <dd>{{ preview.totals.supply_vat | money: preview.currency }}</dd>
                <dt>{{ 'down_payments.totals.deductedNet' | translate }}</dt>
                <dd class="negative">
                  -{{ preview.totals.deducted_net | money: preview.currency }}
                </dd>
                <dt>{{ 'down_payments.totals.deductedVat' | translate }}</dt>
                <dd class="negative">
                  -{{ preview.totals.deducted_vat | money: preview.currency }}
                </dd>
                <dt class="total">{{ 'down_payments.totals.finalNet' | translate }}</dt>
                <dd class="total">{{ preview.totals.final_net | money: preview.currency }}</dd>
                <dt class="total">{{ 'down_payments.totals.finalVat' | translate }}</dt>
                <dd class="total">{{ preview.totals.final_vat | money: preview.currency }}</dd>
                <dt class="total">{{ 'down_payments.totals.finalGross' | translate }}</dt>
                <dd class="total" data-test="final-gross">
                  {{ preview.totals.final_gross | money: preview.currency }}
                </dd>
                @if (hasRoundingDifference()) {
                  <dt>{{ 'down_payments.totals.vatRoundingDifference' | translate }}</dt>
                  <dd data-test="rounding">
                    {{ preview.totals.vat_rounding_difference | money: preview.currency }}
                  </dd>
                }
              </dl>
            </div>

            <div class="settlement-columns">
              <section>
                <h4 class="section-title">
                  {{ 'down_payments.section.linkedDocuments' | translate }}
                </h4>
                <p class="muted">{{ 'down_payments.hint.linkedDocuments' | translate }}</p>
                <nz-table
                  nzSize="small"
                  [nzData]="preview.linked_documents"
                  [nzShowPagination]="false"
                  data-test="linked"
                >
                  <thead>
                    <tr>
                      <th scope="col">IdDocumento</th>
                      <th scope="col">Data</th>
                      <th scope="col" class="num">RiferimentoNumeroLinea</th>
                      <th scope="col">NumItem</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (doc of preview.linked_documents; track $index) {
                      <tr>
                        <td>{{ doc.id_documento }}</td>
                        <td>{{ doc.data }}</td>
                        <td class="num">{{ doc.riferimento_numero_linea }}</td>
                        <td>{{ doc.num_item ?? '-' }}</td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              </section>

              <section>
                <h4 class="section-title">
                  {{ 'down_payments.section.journalClosure' | translate }}
                </h4>
                <p class="muted">{{ 'down_payments.hint.journalClosure' | translate }}</p>
                <nz-table
                  nzSize="small"
                  [nzData]="preview.journal_preview"
                  [nzShowPagination]="false"
                  data-test="journal"
                >
                  <thead>
                    <tr>
                      <th scope="col">{{ 'down_payments.field.account' | translate }}</th>
                      <th scope="col" class="num">{{ 'down_payments.field.debit' | translate }}</th>
                      <th scope="col" class="num">
                        {{ 'down_payments.field.credit' | translate }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of preview.journal_preview; track $index) {
                      <tr [attr.data-test]="'journal-' + line.account">
                        <td>{{ 'down_payments.account.' + line.account | translate }}</td>
                        <td class="num">{{ line.debit | money: preview.currency }}</td>
                        <td class="num">{{ line.credit | money: preview.currency }}</td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              </section>
            </div>

            <p class="actions-bar">
              <button
                nz-button
                nzType="primary"
                type="button"
                data-test="generate"
                [disabled]="!canGenerate()"
                [nzLoading]="store.saving()"
                (click)="generate()"
              >
                {{ 'down_payments.action.generateSettlement' | translate }}
              </button>
              <button nz-button type="button" (click)="closed.emit()">
                {{ 'down_payments.action.close' | translate }}
              </button>
            </p>
          }
        </nz-spin>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .settlement-columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      gap: 16px;
    }

    .blocker-list {
      margin: 0;
      padding-left: 18px;
    }

    .subtotal th,
    .subtotal td {
      font-weight: 600;
    }
  `,
})
export class FinalSettlementPreviewDrawerComponent {
  readonly visible = input.required<boolean>();
  readonly closed = output<void>();
  /** Emits the number of the final invoice once it is issued. */
  readonly settled = output<string>();

  protected readonly store = inject(ChainStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly documentTypes = DP_SETTLEMENT_TYPES;
  protected readonly documentType = signal<DpSettlementType>('TD01');
  protected readonly date = signal<Date | null>(null);
  protected readonly dueDate = signal<Date | null>(null);
  protected readonly imputed = signal<string[]>([]);
  protected readonly feedback = signal<DpOutcome | null>(null);

  /** The API refuses the preview while a pro-forma is still open: that refusal is the blocker. */
  protected readonly openProformas = computed(() => this.feedback()?.code === 'open_proformas');

  protected readonly hasProformaBlocker = computed(() =>
    (this.store.settlement()?.blockers ?? []).some((blocker) => blocker.code === 'open_proforma'),
  );

  protected readonly groups = computed<DeductionGroup[]>(() => {
    const byRate = new Map<string, DpSettlementDeduction[]>();
    for (const row of this.store.settlement()?.deduction_lines ?? []) {
      byRate.set(row.vat_rate, [...(byRate.get(row.vat_rate) ?? []), row]);
    }
    return [...byRate.entries()]
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([vatRate, rows]) => ({
        vatRate,
        rows,
        net: fromCents(sumCents(rows.map((row) => row.net))),
        vat: fromCents(sumCents(rows.map((row) => row.vat))),
        gross: fromCents(sumCents(rows.map((row) => row.gross))),
      }));
  });

  protected readonly hasRoundingDifference = computed(
    () => toCents(this.store.settlement()?.totals.vat_rounding_difference) !== 0,
  );

  /** Whether the settlement can go: no open pro-forma and every held earnest money is imputed here (the other blockers need a resolution first). */
  protected readonly canGenerate = computed(() => {
    const preview = this.store.settlement();
    if (preview === null || this.openProformas()) {
      return false;
    }
    return preview.blockers.every(
      (blocker) => blocker.code === 'held_earnest_money' && this.imputed().includes(blocker.id),
    );
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        void this.open();
      }
    });
  }

  private async open(): Promise<void> {
    this.feedback.set(null);
    this.imputed.set([]);
    this.documentType.set('TD01');
    this.date.set(null);
    this.dueDate.set(null);
    this.store.clearSettlement();
    const outcome = await this.store.previewSettlement();
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected depositOf(id: string): DpDeposit | null {
    return this.store.chain()?.deposits.find((deposit) => deposit.id === id) ?? null;
  }

  protected isImputed(id: string): boolean {
    return this.imputed().includes(id);
  }

  protected toggleImpute(id: string, checked: boolean): void {
    this.imputed.update((ids) =>
      checked ? [...new Set([...ids, id])] : ids.filter((item) => item !== id),
    );
  }

  private payload(): DpSettlementPayload {
    const date = isoDay(this.date());
    const due = isoDay(this.dueDate());
    return {
      document_type: this.documentType(),
      ...(date ? { date } : {}),
      ...(due ? { due_date: due } : {}),
      ...(this.imputed().length > 0 ? { impute_deposit_ids: this.imputed() } : {}),
    };
  }

  protected async generate(): Promise<void> {
    const outcome = await this.store.generateSettlement(this.payload());
    if (outcome.ok) {
      this.message.success(this.i18n.instant('down_payments.message.settled'));
      this.settled.emit(outcome.invoiceNumber ?? '');
      this.closed.emit();
    } else {
      this.feedback.set(outcome);
    }
  }
}
