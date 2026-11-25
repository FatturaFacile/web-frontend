import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { CsFeedbackPayload, CsPublicSurvey, CustomerSatisfactionApiService } from '@core';
import { CS_OK, CsOutcome, failureOf } from './customer-satisfaction.util';

export interface PublicSurveyState {
  token: string;
  survey: CsPublicSurvey | null;
  loading: boolean;
  savingScore: boolean;
  savingFeedback: boolean;
  /** The comment (text or voice) reached the API: the thank-you step. */
  feedbackSent: boolean;
  optedOut: boolean;
  /** Translation key of the load failure (an invalid or expired link). */
  errorKey: string | null;
}

/**
 * The public landing page of a survey. The score is stored by the first click (an email link records it before this page
 * opens); the page then asks the follow-up question of the band and adds the comment to the same answer.
 */
export const PublicSurveyStore = signalStore(
  withState<PublicSurveyState>({
    token: '',
    survey: null,
    loading: false,
    savingScore: false,
    savingFeedback: false,
    feedbackSent: false,
    optedOut: false,
    errorKey: null,
  }),
  withMethods((store, api = inject(CustomerSatisfactionApiService)) => {
    const load = async (token: string): Promise<void> => {
      patchState(store, { token, loading: true, errorKey: null });
      try {
        const response = await firstValueFrom(api.getPublicSurvey(token));
        patchState(store, {
          survey: response.data,
          loading: false,
          feedbackSent: response.data.has_comment,
        });
      } catch (error) {
        patchState(store, { loading: false, errorKey: failureOf(error).errorKey });
      }
    };

    return {
      load,
      /** Records the score picked on the page (when the visitor did not come through a one-click link). */
      submitScore: async (score: number): Promise<CsOutcome> => {
        patchState(store, { savingScore: true });
        try {
          await firstValueFrom(api.submitPublicScore(store.token(), score));
          patchState(store, { savingScore: false });
          await load(store.token());
          return CS_OK;
        } catch (error) {
          patchState(store, { savingScore: false });
          return failureOf(error);
        }
      },
      submitFeedback: async (payload: CsFeedbackPayload): Promise<CsOutcome> => {
        patchState(store, { savingFeedback: true });
        try {
          await firstValueFrom(api.submitPublicFeedback(store.token(), payload));
          patchState(store, { savingFeedback: false, feedbackSent: true });
          return CS_OK;
        } catch (error) {
          patchState(store, { savingFeedback: false });
          return failureOf(error);
        }
      },
      optOut: async (): Promise<CsOutcome> => {
        try {
          await firstValueFrom(api.optOutPublic(store.token()));
          patchState(store, { optedOut: true });
          return CS_OK;
        } catch (error) {
          return failureOf(error);
        }
      },
    };
  }),
);
