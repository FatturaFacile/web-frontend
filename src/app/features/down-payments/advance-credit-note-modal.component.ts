import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  DP_CREDIT_MODES,
  DpCreditMode,
  DpCreditNotePayload,
  DpLink,
  TranslateService,
} from '@core';
import { ModalActionsDirective, MoneyPipe, TranslatePipe } from '@shared';
import { ChainStore } from './chain.store';
import { creditableGross, DpOutcome, isoDay } from './down-payments.util';
import { DpFeedbackComponent } from './feedback.component';

interface LineRow {
  vatRate: string;
  /** Net still open of the advance at this rate. */
  open: string;
  net: number | null;
}

const PREVIEW_DELAY_MS = 300;

/**
 * Credit note (TD04) against an issued advance invoice: the whole open amount, a gross amount or a net amount per VAT line. The
 * split over the VAT rates and the residual of the order it reopens are recalculated by the API while the user types.
 */
@Component({
  selector: 'app-dp-credit-note-modal',
  imports: [
    FormsModule,
    ModalActionsDirective,
    MoneyPipe,
    NzButtonModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzRadioModule,
    NzTableModule,
    DpFeedbackComponent,
    TranslatePipe,
  ],
  styleUrl: './down-payments.scss',
  template: `
    <nz-modal
      appModalActions
      [nzVisible]="visible()"
      [nzWidth]="820"
      [nzTitle]="'down_payments.modal.creditNote' | translate"
      [nzFooter]="null"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        <app-dp-feedback [outcome]="feedback()" (dismissed)="feedback.set(null)" />

        <nz-descriptions nzBordered nzSize="small" [nzColumn]="2" data-test="advance">
          <nz-descriptions-item [nzTitle]="'down_payments.field.advanceInvoice' | translate">{{
            link().document_number
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'down_payments.field.date' | translate">{{
            link().document_date ?? '-'
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'down_payments.field.gross' | translate">{{
            link().gross_amount | money: currency()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'down_payments.field.creditable' | translate">{{
            creditable() | money: currency()
          }}</nz-descriptions-item>
        </nz-descriptions>

        <h4 class="section-title">{{ 'down_payments.section.creditMode' | translate }}</h4>
        <nz-radio-group
          [attr.aria-label]="'down_payments.section.creditMode' | translate"
          [ngModel]="mode()"
          (ngModelChange)="setMode($event)"
          data-test="modes"
        >
          @for (item of modes; track item) {
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label nz-radio [nzValue]="item" [attr.data-test]="'mode-' + item">{{
              'down_payments.creditMode.' + item | translate
            }}</label>
          }
        </nz-radio-group>

        @switch (mode()) {
          @case ('amount') {
            <label class="field" for="dp-c-amount">
              <span>{{ 'down_payments.field.creditAmount' | translate }}</span>
              <nz-input-number
                nzId="dp-c-amount"
                [nzMin]="0"
                [nzPrecision]="2"
                [ngModel]="amount()"
                (ngModelChange)="amount.set($event)"
                data-test="amount"
              ></nz-input-number>
            </label>
          }
          @case ('lines') {
            <nz-table
              nzSize="small"
              [nzData]="lines()"
              [nzShowPagination]="false"
              data-test="lines"
            >
              <thead>
                <tr>
                  <th scope="col">{{ 'down_payments.field.vatRate' | translate }}</th>
                  <th scope="col" class="num">{{ 'down_payments.field.openNet' | translate }}</th>
                  <th scope="col" class="num">{{ 'down_payments.field.creditNet' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of lines(); track row.vatRate) {
                  <tr [attr.data-test]="'line-' + row.vatRate">
                    <td>{{ row.vatRate }}%</td>
                    <td class="num">{{ row.open | money: currency() }}</td>
                    <td class="num">
                      <nz-input-number
                        [nzMin]="0"
                        [nzMax]="+row.open"
                        [nzPrecision]="2"
                        [attr.aria-label]="'down_payments.field.creditNet' | translate"
                        [ngModel]="row.net"
                        (ngModelChange)="setLine(row.vatRate, $event)"
                      ></nz-input-number>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        }

        <div class="form-grid">
          <label class="field" for="dp-c-date">
            <span>{{ 'down_payments.field.date' | translate }}</span>
            <nz-date-picker
              nzId="dp-c-date"
              [ngModel]="date()"
              (ngModelChange)="date.set($event)"
            ></nz-date-picker>
          </label>
          <label class="field" for="dp-c-reason">
            <span>{{ 'down_payments.field.reason' | translate }}</span>
            <input
              nz-input
              id="dp-c-reason"
              maxlength="500"
              [ngModel]="reason()"
              (ngModelChange)="reason.set($event)"
            />
          </label>
        </div>

        @if (store.creditNote(); as preview) {
          <div class="preview-box" data-test="preview">
            <h4 class="section-title">{{ 'down_payments.section.creditPreview' | translate }}</h4>
            <nz-table nzSize="small" [nzData]="preview.slices" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'down_payments.field.vatRate' | translate }}</th>
                  <th scope="col" class="num">{{ 'down_payments.field.net' | translate }}</th>
                  <th scope="col" class="num">{{ 'down_payments.field.vat' | translate }}</th>
                  <th scope="col" class="num">{{ 'down_payments.field.gross' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (slice of preview.slices; track slice.vat_rate) {
                  <tr>
                    <td>{{ slice.vat_rate }}%</td>
                    <td class="num">{{ slice.net | money: currency() }}</td>
                    <td class="num">{{ slice.vat | money: currency() }}</td>
                    <td class="num">{{ slice.gross | money: currency() }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <dl>
              <dt class="total">{{ 'down_payments.field.creditedGross' | translate }}</dt>
              <dd class="total" data-test="credited-gross">
                {{ preview.credited_gross | money: currency() }}
              </dd>
              <dt>{{ 'down_payments.field.residualBefore' | translate }}</dt>
              <dd data-test="residual-before">
                {{ preview.residual_before_gross | money: currency() }}
              </dd>
              <dt>{{ 'down_payments.field.residualAfter' | translate }}</dt>
              <dd data-test="residual-after">
                {{ preview.residual_after_gross | money: currency() }}
              </dd>
              <dt>{{ 'down_payments.field.advanceResidualAfter' | translate }}</dt>
              <dd>{{ preview.advance_residual_after_gross | money: currency() }}</dd>
            </dl>
          </div>
        }

        <p class="actions-bar">
          <button
            nz-button
            nzType="primary"
            nzDanger
            type="button"
            data-test="issue"
            [disabled]="!store.creditNote()"
            [nzLoading]="store.saving()"
            (click)="issue()"
          >
            {{ 'down_payments.action.issueCreditNote' | translate }}
          </button>
          <button nz-button type="button" (click)="closed.emit()">
            {{ 'down_payments.action.close' | translate }}
          </button>
        </p>
      </ng-container>
    </nz-modal>
  `,
})
export class AdvanceCreditNoteModalComponent {
  readonly link = input.required<DpLink>();
  readonly visible = input.required<boolean>();
  readonly closed = output<void>();

  protected readonly store = inject(ChainStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly modes = DP_CREDIT_MODES;
  protected readonly mode = signal<DpCreditMode>('total');
  protected readonly amount = signal<number | null>(null);
  protected readonly lines = signal<LineRow[]>([]);
  protected readonly date = signal<Date | null>(null);
  protected readonly reason = signal('');
  protected readonly feedback = signal<DpOutcome | null>(null);

  protected readonly currency = computed(() => this.store.chain()?.currency ?? 'EUR');
  protected readonly creditable = computed(() => creditableGross(this.link()));

  /** What the API previews: null while the form does not state an amount yet. */
  readonly previewPayload = computed<DpCreditNotePayload | null>(() => {
    switch (this.mode()) {
      case 'total':
        return { mode: 'total' };
      case 'amount': {
        const amount = this.amount() ?? 0;
        return amount > 0 ? { mode: 'amount', amount: amount.toFixed(2) } : null;
      }
      case 'lines': {
        const picked = this.lines()
          .filter((row) => (row.net ?? 0) > 0)
          .map((row) => ({ vat_rate: row.vatRate, net: (row.net ?? 0).toFixed(2) }));
        return picked.length > 0 ? { mode: 'lines', lines: picked } : null;
      }
    }
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        untracked(() => this.reset(this.link()));
      }
    });

    // Live recalculation: the preview follows the form, a short pause after the last keystroke
    effect((onCleanup) => {
      const payload = this.previewPayload();
      if (!this.visible()) {
        return;
      }
      if (payload === null) {
        untracked(() => this.store.clearCreditNote());
        return;
      }
      const timer = setTimeout(() => void this.refresh(payload), PREVIEW_DELAY_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  private reset(link: DpLink): void {
    this.feedback.set(null);
    this.store.clearCreditNote();
    this.mode.set('total');
    this.amount.set(null);
    this.date.set(null);
    this.reason.set('');
    this.lines.set(
      link.vat_lines.map((line) => ({
        vatRate: line.vat_percentage,
        open: line.residual_net_amount,
        net: null,
      })),
    );
  }

  protected setMode(mode: DpCreditMode): void {
    this.mode.set(mode);
    this.store.clearCreditNote();
  }

  protected setLine(vatRate: string, net: number | null): void {
    this.lines.update((rows) =>
      rows.map((row) => (row.vatRate === vatRate ? { ...row, net } : row)),
    );
  }

  /** Previews a payload now (the live recalculation calls it after its short delay). */
  async refresh(payload: DpCreditNotePayload | null = this.previewPayload()): Promise<void> {
    if (payload === null) {
      return;
    }
    const outcome = await this.store.previewCreditNote(this.link().id, payload);
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async issue(): Promise<void> {
    const payload = this.previewPayload();
    if (payload === null) {
      return;
    }
    const date = isoDay(this.date());
    const outcome = await this.store.issueCreditNote(this.link().id, {
      ...payload,
      ...(date ? { date } : {}),
      ...(this.reason().trim() ? { reason: this.reason().trim() } : {}),
    });
    if (outcome.ok) {
      this.message.success(this.i18n.instant('down_payments.message.creditNoteIssued'));
      this.closed.emit();
    } else {
      this.feedback.set(outcome);
    }
  }
}
