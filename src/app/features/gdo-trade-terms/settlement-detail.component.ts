import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GdtSettlementLine, PermissionsService, TranslateService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import {
  GDO_TRADE_TERMS_FINANCE_MODULE,
  GDT_DEFAULT_TAX_RATES,
  GdtOutcome,
  num,
  percentText,
  settlementStatusColor,
  today,
} from './gdo-trade-terms.util';
import { SettlementDetailStore } from './settlement-detail.store';

/**
 * A settlement run: accrued against earned per rebate scale and promotion; the credit note of the target rebates (Italy TD04,
 * art. 26 DPR 633/72; Switzerland art. 41 MWSTG) and the reconciliation of the promotional invoice of the retailer with the
 * accrued provision, with the dispute when the claim is outside the tolerance of the contract.
 */
@Component({
  selector: 'app-gdt-settlement-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    NgTemplateOutlet,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
  ],
  providers: [SettlementDetailStore],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.GDO_TRADE_TERMS_SETTLEMENT' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="(failure.errorKey ?? 'gdoTradeTerms.error.generic') | translate: failure.params"
        [nzDescription]="failure.detail ?? undefined"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading() || store.working()">
      @if (store.settlement(); as settlement) {
        <nz-card class="main-card">
          <div class="toolbar">
            <div>
              <strong>{{ settlement.code }}</strong> · {{ 'gdoTradeTerms.settlementKind.' + settlement.kind | translate }}
              <small class="muted">
                {{ settlement.contract?.code }} {{ settlement.contract?.name }} · {{ settlement.period_start }} – {{ settlement.period_end }}
              </small>
            </div>
            <nz-tag [nzColor]="color(settlement.status)">{{ 'gdoTradeTerms.settlementStatus.' + settlement.status | translate }}</nz-tag>
            <span class="spacer"></span>
            <a nz-button [routerLink]="['/gdo-trade-terms/settlements']">{{ 'gdoTradeTerms.action.back' | translate }}</a>
            @if (canSettle && store.open() && !hasSettledLines()) {
              <button
                nz-button
                nzDanger
                type="button"
                nz-popconfirm
                [nzPopconfirmTitle]="'gdoTradeTerms.confirm.cancelSettlement' | translate"
                [nzOkText]="'gdoTradeTerms.action.confirm' | translate"
                [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
                (nzOnConfirm)="cancel(settlement.id)"
              >
                {{ 'gdoTradeTerms.action.cancelSettlement' | translate }}
              </button>
            }
          </div>
          <p class="muted">{{ 'gdoTradeTerms.taxTreatment.' + settlement.tax_treatment | translate }}</p>
        </nz-card>

        <div class="stats-grid">
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.accrued' | translate }}</small>
            <strong>{{ settlement.accrued_total | money: settlement.currency }}</strong>
          </nz-card>
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.earned' | translate }}</small>
            <strong>{{ settlement.earned_total | money: settlement.currency }}</strong>
          </nz-card>
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.field.variance' | translate }}</small>
            <strong [class.negative]="isNegative(settlement.variance_total)">{{ settlement.variance_total | money: settlement.currency }}</strong>
          </nz-card>
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.treatment.credit_note' | translate }}</small>
            <strong>{{ settlement.credit_note_amount | money: settlement.currency }}</strong>
          </nz-card>
          <nz-card>
            <small class="muted">{{ 'gdoTradeTerms.treatment.promo_invoice' | translate }}</small>
            <strong>{{ settlement.promo_amount | money: settlement.currency }}</strong>
          </nz-card>
        </div>

        <nz-card class="main-card" [nzTitle]="'gdoTradeTerms.section.creditNoteLines' | translate">
          <ng-container *ngTemplateOutlet="linesTable; context: { $implicit: store.creditLines(), currency: settlement.currency }"></ng-container>

          @if (settlement.credit_note_id) {
            <p>
              {{ 'gdoTradeTerms.field.creditNote' | translate }}:
              <a routerLink="/sales/invoices">{{ 'gdoTradeTerms.action.openInvoices' | translate }}</a>
              · {{ 'gdoTradeTerms.field.taxRate' | translate }}: {{ pct(settlement.tax_rate) }}
            </p>
          }

          @if (canSettle && store.hasOpenCreditLines() && store.open()) {
            <form [formGroup]="creditForm" class="form-grid" (ngSubmit)="creditNote(settlement.id)">
              <label class="field" for="gdt-cn-rate">
                <span>{{ 'gdoTradeTerms.field.taxRate' | translate }}</span>
                <input nz-input id="gdt-cn-rate" type="number" step="0.01" min="0" max="100" formControlName="tax_rate" />
              </label>
              <label class="field" for="gdt-cn-date">
                <span>{{ 'gdoTradeTerms.field.settledOn' | translate }}</span>
                <input nz-input id="gdt-cn-date" type="date" formControlName="settled_on" />
              </label>
              <div class="actions">
                <button nz-button nzType="primary" type="submit" [nzLoading]="store.working()" [disabled]="creditForm.invalid">
                  {{ 'gdoTradeTerms.action.issueCreditNote' | translate }}
                </button>
              </div>
            </form>
          }
        </nz-card>

        <nz-card class="main-card" [nzTitle]="'gdoTradeTerms.section.promoLines' | translate">
          <ng-container *ngTemplateOutlet="linesTable; context: { $implicit: store.promoLines(), currency: settlement.currency }"></ng-container>

          @if (settlement.claim_invoice_number) {
            <div class="stats-grid">
              <div>
                <small class="muted">{{ 'gdoTradeTerms.field.claimInvoice' | translate }}</small>
                <strong>{{ settlement.claim_invoice_number }} · {{ settlement.claim_invoice_date }}</strong>
              </div>
              <div>
                <small class="muted">{{ 'gdoTradeTerms.field.claimNet' | translate }}</small>
                <strong>{{ settlement.claim_net | money: settlement.currency }}</strong>
              </div>
              <div>
                <small class="muted">{{ 'gdoTradeTerms.field.claimTax' | translate }}</small>
                <strong>{{ settlement.claim_tax | money: settlement.currency }}</strong>
              </div>
              <div>
                <small class="muted">{{ 'gdoTradeTerms.field.claimVariance' | translate }}</small>
                <strong [class.negative]="isNegative(settlement.claim_variance)">{{ settlement.claim_variance | money: settlement.currency }}</strong>
              </div>
            </div>
          }

          @if (settlement.dispute_reason; as reason) {
            <nz-alert
              class="feedback"
              nzType="warning"
              nzShowIcon
              [nzMessage]="'gdoTradeTerms.disputeReason.' + reason | translate"
              [nzDescription]="'gdoTradeTerms.hint.dispute' | translate: { tolerance: pct(settlement.contract?.tolerance_percent) }"
            ></nz-alert>
            @if (canSettle) {
              <div class="actions">
                <button
                  nz-button
                  type="button"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'gdoTradeTerms.confirm.acceptClaim' | translate"
                  [nzOkText]="'gdoTradeTerms.action.confirm' | translate"
                  [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
                  (nzOnConfirm)="resolve(settlement.id, 'accept_claim')"
                >
                  {{ 'gdoTradeTerms.action.acceptClaim' | translate }}
                </button>
                <button
                  nz-button
                  nzDanger
                  type="button"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'gdoTradeTerms.confirm.rejectClaim' | translate"
                  [nzOkText]="'gdoTradeTerms.action.confirm' | translate"
                  [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
                  (nzOnConfirm)="resolve(settlement.id, 'reject')"
                >
                  {{ 'gdoTradeTerms.action.rejectClaim' | translate }}
                </button>
              </div>
            }
          } @else if (canSettle && store.hasOpenPromoLines() && store.open()) {
            <form [formGroup]="invoiceForm" class="form-grid" (ngSubmit)="promoInvoice(settlement.id)">
              <label class="field" for="gdt-pi-number">
                <span>{{ 'gdoTradeTerms.field.invoiceNumber' | translate }}</span>
                <input nz-input id="gdt-pi-number" maxlength="60" formControlName="invoice_number" />
              </label>
              <label class="field" for="gdt-pi-date">
                <span>{{ 'gdoTradeTerms.field.invoiceDate' | translate }}</span>
                <input nz-input id="gdt-pi-date" type="date" formControlName="invoice_date" />
              </label>
              <label class="field" for="gdt-pi-net">
                <span>{{ 'gdoTradeTerms.field.claimNet' | translate }}</span>
                <input nz-input id="gdt-pi-net" type="number" step="0.01" min="0" formControlName="net" />
              </label>
              <label class="field" for="gdt-pi-tax">
                <span>{{ 'gdoTradeTerms.field.claimTax' | translate }}</span>
                <input nz-input id="gdt-pi-tax" type="number" step="0.01" min="0" formControlName="tax" />
              </label>
              <label class="field" for="gdt-pi-notes">
                <span>{{ 'gdoTradeTerms.field.notes' | translate }}</span>
                <input nz-input id="gdt-pi-notes" formControlName="notes" />
              </label>
              <div class="actions">
                <button nz-button nzType="primary" type="submit" [nzLoading]="store.working()" [disabled]="invoiceForm.invalid">
                  {{ 'gdoTradeTerms.action.reconcileInvoice' | translate }}
                </button>
              </div>
            </form>
          }
        </nz-card>
      }
    </nz-spin>

    <ng-template #linesTable let-lines let-currency="currency">
      <nz-table #table nzSize="small" [nzData]="lines" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'gdoTradeTerms.field.source' | translate }}</th>
            <th scope="col" class="num">{{ 'gdoTradeTerms.field.accrued' | translate }}</th>
            <th scope="col" class="num">{{ 'gdoTradeTerms.field.earned' | translate }}</th>
            <th scope="col" class="num">{{ 'gdoTradeTerms.field.variance' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.status' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (line of table.data; track line.id) {
            <tr>
              <th scope="row">
                <nz-tag>{{ 'gdoTradeTerms.sourceType.' + line.source_type | translate }}</nz-tag>
                {{ line.source_label }}
              </th>
              <td class="num">{{ line.accrued_amount | money: currency }}</td>
              <td class="num">{{ line.earned_amount | money: currency }}</td>
              <td class="num" [class.negative]="isNegative(line.variance_amount)">{{ line.variance_amount | money: currency }}</td>
              <td>{{ 'gdoTradeTerms.settlementLineStatus.' + line.status | translate }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5"><nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.lines' | translate"></nz-empty></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </ng-template>
  `,
})
export class SettlementDetailComponent implements OnInit {
  protected readonly store = inject(SettlementDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canSettle = inject(PermissionsService).canWrite(GDO_TRADE_TERMS_FINANCE_MODULE);
  protected readonly feedback = signal<GdtOutcome | null>(null);
  protected color = settlementStatusColor;
  protected pct = percentText;

  protected readonly hasSettledLines = computed(() => this.store.lines().some((line: GdtSettlementLine) => line.status === 'settled'));

  protected readonly creditForm = this.fb.nonNullable.group({
    tax_rate: ['22', Validators.required],
    settled_on: [today()],
  });

  protected readonly invoiceForm = this.fb.nonNullable.group({
    invoice_number: ['', [Validators.required, Validators.maxLength(60)]],
    invoice_date: [today(), Validators.required],
    net: ['', Validators.required],
    tax: ['0'],
    notes: [''],
  });

  private get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  async ngOnInit(): Promise<void> {
    await this.store.load(this.id);
    const jurisdiction = this.store.settlement()?.contract?.jurisdiction;
    if (jurisdiction) {
      this.creditForm.patchValue({ tax_rate: GDT_DEFAULT_TAX_RATES[jurisdiction] });
    }
  }

  protected isNegative(value: string | null | undefined): boolean {
    return num(value) < 0;
  }

  protected async creditNote(id: string): Promise<void> {
    const value = this.creditForm.getRawValue();
    this.done(await this.store.creditNote(id, { tax_rate: value.tax_rate, settled_on: value.settled_on || null }), 'creditNote');
  }

  protected async promoInvoice(id: string): Promise<void> {
    const value = this.invoiceForm.getRawValue();
    const outcome = await this.store.promoInvoice(id, {
      invoice_number: value.invoice_number,
      invoice_date: value.invoice_date,
      net: value.net,
      tax: value.tax || '0',
      notes: value.notes || null,
    });
    this.done(outcome, this.store.settlement()?.status === 'disputed' ? 'disputed' : 'reconciled');
  }

  protected async resolve(id: string, resolution: 'accept_claim' | 'reject'): Promise<void> {
    this.done(await this.store.resolve(id, resolution, null), 'disputeResolved');
  }

  protected async cancel(id: string): Promise<void> {
    this.done(await this.store.cancel(id), 'cancelled');
  }

  private done(outcome: GdtOutcome, done: string): void {
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant(`gdoTradeTerms.message.${done}`));
    }
  }
}
