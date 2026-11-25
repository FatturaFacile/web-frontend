import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { FranchiseNetworkApiService, FrnAudit, FrnTemplate } from '@core';
import { failureOf, FRN_OK, FrnOutcome, toNumber } from './franchise-network.util';

export interface AnswerDraft {
  score: number | null;
  notes: string;
}

export interface AuditRunState {
  audit: FrnAudit | null;
  template: FrnTemplate | null;
  answers: Record<string, AnswerDraft>;
  notes: string;
  /** Object URLs of the photos already on the audit, by photo id, for the preview. */
  previews: Record<string, string>;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/**
 * One store audit on a tablet: the scores and notes are kept in the store while the manager walks the shop, saved as a draft, and
 * the photos upload one by one. Submitting scores the audit on the server.
 */
export const AuditRunStore = signalStore(
  withState<AuditRunState>({
    audit: null,
    template: null,
    answers: {},
    notes: '',
    previews: {},
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(FranchiseNetworkApiService)) => {
    const adopt = (audit: FrnAudit): void => {
      const answers: Record<string, AnswerDraft> = { ...store.answers() };
      for (const answer of audit.answers) {
        answers[answer.criterion_code] = { score: toNumber(answer.score), notes: answer.notes ?? '' };
      }
      patchState(store, { audit, answers, notes: audit.notes ?? store.notes() });
    };

    const loadPreviews = async (audit: FrnAudit): Promise<void> => {
      const previews: Record<string, string> = { ...store.previews() };
      for (const photo of audit.photos) {
        if (previews[photo.id] === undefined) {
          const blob = await firstValueFrom(api.auditPhotoBlob(audit.id, photo.id));
          previews[photo.id] = URL.createObjectURL(blob);
        }
      }
      patchState(store, { previews });
    };

    const guarded = async (work: () => Promise<void>): Promise<FrnOutcome> => {
      patchState(store, { saving: true });
      try {
        await work();
        patchState(store, { saving: false });
        return FRN_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    const answersPayload = () =>
      Object.entries(store.answers())
        .filter(([, draft]) => draft.score !== null)
        .map(([criterion_code, draft]) => ({
          criterion_code,
          score: draft.score ?? 0,
          notes: draft.notes === '' ? null : draft.notes,
        }));

    return {
      async load(id: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [audit, lookups] = await Promise.all([firstValueFrom(api.getAudit(id)), firstValueFrom(api.getLookups())]);
          patchState(store, { template: lookups.data.audit_templates.find((item) => item.id === audit.data.template_id) ?? null });
          adopt(audit.data);
          await loadPreviews(audit.data);
          patchState(store, { loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      setScore(code: string, score: number): void {
        const current = store.answers()[code] ?? { score: null, notes: '' };
        patchState(store, { answers: { ...store.answers(), [code]: { ...current, score } } });
      },
      setNote(code: string, notes: string): void {
        const current = store.answers()[code] ?? { score: null, notes: '' };
        patchState(store, { answers: { ...store.answers(), [code]: { ...current, notes } } });
      },
      setNotes(notes: string): void {
        patchState(store, { notes });
      },
      saveDraft: (): Promise<FrnOutcome> =>
        guarded(async () => {
          const audit = store.audit();
          if (audit === null || answersPayload().length === 0) {
            return;
          }
          const response = await firstValueFrom(api.saveAuditAnswers(audit.id, answersPayload(), store.notes() === '' ? null : store.notes()));
          adopt(response.data);
        }),
      submit: (): Promise<FrnOutcome> =>
        guarded(async () => {
          const audit = store.audit();
          if (audit === null) {
            return;
          }
          await firstValueFrom(api.saveAuditAnswers(audit.id, answersPayload(), store.notes() === '' ? null : store.notes()));
          const response = await firstValueFrom(api.submitAudit(audit.id));
          adopt(response.data);
        }),
      addPhoto: (file: File, criterionCode: string | null, caption: string | null): Promise<FrnOutcome> =>
        guarded(async () => {
          const audit = store.audit();
          if (audit === null) {
            return;
          }
          const response = await firstValueFrom(api.addAuditPhoto(audit.id, file, criterionCode, caption));
          adopt(response.data);
          await loadPreviews(response.data);
        }),
      removePhoto: (photoId: string): Promise<FrnOutcome> =>
        guarded(async () => {
          const audit = store.audit();
          if (audit === null) {
            return;
          }
          const response = await firstValueFrom(api.removeAuditPhoto(audit.id, photoId));
          const { [photoId]: removed, ...previews } = store.previews();
          if (removed !== undefined) {
            URL.revokeObjectURL(removed);
          }
          patchState(store, { previews });
          adopt(response.data);
        }),
      releasePreviews(): void {
        for (const url of Object.values(store.previews())) {
          URL.revokeObjectURL(url);
        }
        patchState(store, { previews: {} });
      },
    };
  }),
);
