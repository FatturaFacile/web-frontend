import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CcvCartLine,
  CcvCheckoutResult,
  CcvEnrollment,
  CcvLookups,
  CcvPricing,
  CcvSourceDocumentType,
  CcvWelfareJurisdiction,
  CcvWelfareRedeemRequest,
  CcvWelfareRedemption,
  CorporateConventionsApiService,
} from '@core';
import {
  CCV_OK,
  CcvOutcome,
  failureOf,
  jurisdictionOfCurrency,
  providersOf,
  toNumber,
} from './corporate-conventions.util';

export interface PosConventionState {
  lookups: CcvLookups | null;
  enrollment: CcvEnrollment | null;
  pricing: CcvPricing | null;
  checkout: CcvCheckoutResult | null;
  redemptions: CcvWelfareRedemption[];
  verifying: boolean;
  pricingBusy: boolean;
  committing: boolean;
  redeeming: boolean;
}

/** Till and checkout: the convention pass of the customer, the live split of the cart and the welfare vouchers paid on it. */
export const PosConventionStore = signalStore(
  withState<PosConventionState>({
    lookups: null,
    enrollment: null,
    pricing: null,
    checkout: null,
    redemptions: [],
    verifying: false,
    pricingBusy: false,
    committing: false,
    redeeming: false,
  }),
  withComputed(({ pricing, redemptions }) => ({
    totals: computed(() => pricing()?.totals ?? null),
    capRemaining: computed(() => pricing()?.cap.remaining_before ?? null),
    capReached: computed(() => pricing()?.cap.reached ?? false),
    /** What the customer still has to pay after the vouchers redeemed on this sale. */
    paidByVouchers: computed(() =>
      redemptions().reduce((sum, voucher) => sum + toNumber(voucher.gross_voucher_amount), 0),
    ),
  })),
  withMethods((store, api = inject(CorporateConventionsApiService)) => {
    let pricingSequence = 0;

    return {
      async init(): Promise<void> {
        const lookups = await firstValueFrom(api.getLookups()).catch(() => null);
        patchState(store, { lookups: lookups?.data ?? null });
      },
      providersFor: (jurisdiction: CcvWelfareJurisdiction) =>
        providersOf(store.lookups(), jurisdiction),
      jurisdictionFor: (currency: string): CcvWelfareJurisdiction =>
        jurisdictionOfCurrency(currency),
      /** Reads a QR payload, card number, matricola or e-mail: shows who the customer is and what is left of the caps. */
      async verify(identifier: string, conventionId: string | null = null): Promise<CcvOutcome> {
        patchState(store, { verifying: true, enrollment: null, pricing: null, checkout: null });
        try {
          const response = await firstValueFrom(
            api.verifyIdentifier({ identifier, convention_id: conventionId }),
          );
          patchState(store, { enrollment: response.data, verifying: false });
          return CCV_OK;
        } catch (error) {
          patchState(store, { verifying: false });
          return failureOf(error);
        }
      },
      /** Prices the cart under the pass: the discount, the employer quota and what the employee pays. */
      async price(lines: CcvCartLine[], currency: string): Promise<CcvOutcome> {
        const enrollment = store.enrollment();
        if (enrollment === null || lines.length === 0) {
          patchState(store, { pricing: null });
          return CCV_OK;
        }
        const ticket = ++pricingSequence;
        patchState(store, { pricingBusy: true });
        try {
          const response = await firstValueFrom(
            api.priceCart({
              identifier: enrollment.qr_payload,
              convention_id: enrollment.convention_id,
              currency,
              lines,
            }),
          );
          if (ticket === pricingSequence) {
            patchState(store, { pricing: response.data, pricingBusy: false });
          }
          return CCV_OK;
        } catch (error) {
          if (ticket === pricingSequence) {
            patchState(store, { pricing: null, pricingBusy: false });
          }
          return failureOf(error);
        }
      },
      /** Commits the discount and the split billing of the sale. */
      async commit(
        lines: CcvCartLine[],
        documentType: CcvSourceDocumentType,
        documentId: string,
        currency: string,
        employeeDocumentId: string | null = null,
      ): Promise<CcvOutcome> {
        const enrollment = store.enrollment();
        if (enrollment === null) {
          return {
            ...CCV_OK,
            ok: false,
            errorKey: 'corporateConventions.error.enrollment_not_found',
            code: 'enrollment_not_found',
          };
        }
        patchState(store, { committing: true });
        try {
          const response = await firstValueFrom(
            api.checkout({
              enrollment_id: enrollment.id,
              lines,
              source_document_type: documentType,
              source_document_id: documentId,
              employee_document_id: employeeDocumentId,
              currency,
            }),
          );
          patchState(store, { checkout: response.data, committing: false });
          return CCV_OK;
        } catch (error) {
          patchState(store, { committing: false });
          return failureOf(error);
        }
      },
      /** Records a welfare voucher paid on the sale; the API validates the jurisdiction, the category and the fee. */
      async redeem(request: CcvWelfareRedeemRequest): Promise<CcvOutcome> {
        patchState(store, { redeeming: true });
        try {
          const response = await firstValueFrom(api.redeemVoucher(request));
          patchState(store, {
            redemptions: [...store.redemptions(), response.data],
            redeeming: false,
          });
          return CCV_OK;
        } catch (error) {
          patchState(store, { redeeming: false });
          return failureOf(error);
        }
      },
      reset(): void {
        pricingSequence++;
        patchState(store, {
          enrollment: null,
          pricing: null,
          checkout: null,
          redemptions: [],
          pricingBusy: false,
        });
      },
    };
  }),
);
