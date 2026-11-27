import { CurrencyPipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ForeignVatRefundApiService, FvrSplitPreview, PermissionsService } from '@core';
import { TranslatePipe } from '@shared';
import { FOREIGN_VAT_MODULE, toNumber } from './foreign-vat-refund.util';

/**
 * Inline information badge of the supplier invoice and expense screens: when the VAT belongs to another country than the one the company is
 * established in, it shows how the foreign VAT is split between the part that will be claimed back (parked on the transitory receivable) and the
 * part that stays a cost, according to the reciprocity and deductibility matrix of the country.
 */
@Component({
  selector: 'app-foreign-vat-split-badge',
  imports: [CurrencyPipe, NzTagModule, TranslatePipe],
  template: `
    @if (preview(); as split) {
      @if (split.applies) {
        <div class="fvr-badge" data-test="foreign-vat-badge">
          <nz-tag [nzColor]="split.has_reciprocity ? 'blue' : 'red'">{{ 'foreignVat.badge.foreignVat' | translate: { country: ('foreignVat.country.' + split.country | translate) } }}</nz-tag>
          @if (split.has_reciprocity) {
            <span data-test="foreign-vat-split">
              {{
                'foreignVat.badge.split'
                  | translate
                    : {
                        percentage: num(split.deductible_percentage),
                        recoverable: (num(split.recoverable_vat_amount) | currency: (split.currency_code ?? 'EUR')) ?? '',
                        nonRecoverable: (num(split.non_recoverable_vat_amount) | currency: (split.currency_code ?? 'EUR')) ?? '',
                      }
              }}
            </span>
          } @else {
            <span data-test="foreign-vat-no-reciprocity">{{ 'foreignVat.badge.noRefund' | translate }}</span>
          }
        </div>
      }
    }
  `,
})
export class ForeignVatSplitBadgeComponent {
  /** ISO code of the country the VAT belongs to. */
  readonly country = input<string | null>(null);
  /** VAT amount of the document or line, in its own currency. */
  readonly vatAmount = input<number>(0);
  /** EU expense code (1-10) when known; otherwise it is proposed from the description. */
  readonly category = input<number | null>(null);
  readonly description = input<string | null>(null);

  protected readonly num = toNumber;
  protected readonly preview = signal<FvrSplitPreview | null>(null);

  private readonly api = inject(ForeignVatRefundApiService);
  private readonly allowed = inject(PermissionsService).canWrite(FOREIGN_VAT_MODULE);

  constructor() {
    effect((onCleanup) => {
      const country = (this.country() ?? '').toUpperCase();
      const vat = this.vatAmount();
      if (!this.allowed || country.length !== 2 || !(vat > 0)) {
        this.preview.set(null);
        return;
      }
      const subscription = this.api
        .previewSplit({
          country,
          vat_amount: vat,
          expense_category_code: this.category(),
          description: this.description(),
        })
        .subscribe({
          next: (answer) => this.preview.set(answer.data),
          error: () => this.preview.set(null),
        });
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
