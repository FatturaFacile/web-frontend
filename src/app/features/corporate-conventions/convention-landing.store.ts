import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CcvPass,
  CcvPublicConvention,
  CcvRelationship,
  CorporateConventionsApiService,
} from '@core';
import { CCV_OK, CcvOutcome, failureOf } from './corporate-conventions.util';

export type LandingStep = 'loading' | 'unavailable' | 'choose' | 'otp' | 'pass';

export interface LandingState {
  slug: string;
  convention: CcvPublicConvention | null;
  step: LandingStep;
  email: string;
  pass: CcvPass | null;
  busy: boolean;
}

/** Self-service landing page: a partner employee verifies the eligibility in a few seconds and receives the pass. */
export const ConventionLandingStore = signalStore(
  withState<LandingState>({
    slug: '',
    convention: null,
    step: 'loading',
    email: '',
    pass: null,
    busy: false,
  }),
  withComputed(({ convention, pass }) => ({
    verification: computed(() => convention()?.verification ?? null),
    canAddFamily: computed(() => pass()?.can_add_family_member ?? false),
  })),
  withMethods((store, api = inject(CorporateConventionsApiService)) => ({
    /** Loads the branding and the ways to verify; a convention that is not in force answers 404 and shows the unavailable step. */
    async load(slug: string): Promise<void> {
      patchState(store, { slug, step: 'loading', convention: null, pass: null });
      try {
        const response = await firstValueFrom(api.getPublicConvention(slug));
        patchState(store, { convention: response.data, step: 'choose' });
      } catch {
        patchState(store, { step: 'unavailable' });
      }
    },
    logoUrl: (): string | null =>
      store.convention()?.has_logo ? api.publicLogoUrl(store.slug()) : null,
    /** Sends the one-time code to a work e-mail address of the partner. */
    async requestOtp(email: string): Promise<CcvOutcome> {
      patchState(store, { busy: true });
      try {
        await firstValueFrom(api.requestOtp(store.slug(), email));
        patchState(store, { busy: false, email, step: 'otp' });
        return CCV_OK;
      } catch (error) {
        patchState(store, { busy: false });
        return failureOf(error);
      }
    },
    async verifyOtp(code: string, fullName: string): Promise<CcvOutcome> {
      patchState(store, { busy: true });
      try {
        const response = await firstValueFrom(
          api.verifyOtp(store.slug(), store.email(), code, fullName),
        );
        patchState(store, { busy: false, pass: response.data, step: 'pass' });
        return CCV_OK;
      } catch (error) {
        patchState(store, { busy: false });
        return failureOf(error);
      }
    },
    /** Membership card, matricola or promo code instead of the e-mail. */
    async verifyIdentifier(
      identifier: string,
      fullName: string,
      email?: string,
    ): Promise<CcvOutcome> {
      patchState(store, { busy: true });
      try {
        const response = await firstValueFrom(
          api.verifyPublicIdentifier(store.slug(), identifier, fullName, email),
        );
        patchState(store, { busy: false, pass: response.data, step: 'pass' });
        return CCV_OK;
      } catch (error) {
        patchState(store, { busy: false });
        return failureOf(error);
      }
    },
    backToChoice(): void {
      patchState(store, { step: 'choose', email: '' });
    },
    async addFamilyMember(fullName: string, relationship: CcvRelationship): Promise<CcvOutcome> {
      const pass = store.pass();
      if (pass === null) {
        return {
          ...CCV_OK,
          ok: false,
          errorKey: 'corporateConventions.error.pass_not_found',
          code: 'pass_not_found',
        };
      }
      patchState(store, { busy: true });
      try {
        const response = await firstValueFrom(
          api.addPublicFamilyMember(pass.wallet_pass_id, { full_name: fullName, relationship }),
        );
        patchState(store, { busy: false, pass: response.data });
        return CCV_OK;
      } catch (error) {
        patchState(store, { busy: false });
        return failureOf(error);
      }
    },
  })),
);
