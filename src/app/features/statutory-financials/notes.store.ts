import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  SfNarrativeSection,
  SfNotes,
  SfNotesPayload,
  SfNotesTableName,
  SfQuantitativeTables,
  StatutoryFinancialsApiService,
} from '@core';
import {
  failureOf,
  MaturityBucket,
  MaturityGroup,
  SF_OK,
  SfOutcome,
} from './statutory-financials.util';

type TableDrafts = Partial<Record<SfNotesTableName, Record<string, unknown>>>;

export interface NotesState {
  notes: SfNotes | null;
  /** Tables the user edited and has not saved: a copy of the table with the new rows. */
  tableDrafts: TableDrafts;
  /** Bodies of the narrative sections edited and not saved, by key. */
  sectionDrafts: Record<string, string>;
  loading: boolean;
  populating: boolean;
  saving: boolean;
  error: string | null;
}

/** The notes (Nota Integrativa / Anhang) of a dossier: populate from the subledgers, edit, save. */
export const NotesStore = signalStore(
  withState<NotesState>({
    notes: null,
    tableDrafts: {},
    sectionDrafts: {},
    loading: false,
    populating: false,
    saving: false,
    error: null,
  }),
  withComputed(({ notes, tableDrafts, sectionDrafts }) => ({
    /** The tables with the unsaved edits laid over the stored ones. */
    tables: computed<SfQuantitativeTables>(
      () =>
        ({
          ...(notes()?.quantitative_tables ?? {}),
          ...tableDrafts(),
        }) as SfQuantitativeTables,
    ),
    /** The narrative sections with the unsaved edits laid over the stored ones. */
    sections: computed<SfNarrativeSection[]>(() =>
      (notes()?.narrative_text_sections ?? []).map((section) =>
        section.key in sectionDrafts()
          ? { ...section, body: sectionDrafts()[section.key] ?? section.body }
          : section,
      ),
    ),
    sources: computed(() => notes()?.sources ?? {}),
    dirtyTables: computed(() => Object.keys(tableDrafts()) as SfNotesTableName[]),
    dirtySections: computed(() => Object.keys(sectionDrafts())),
    populated: computed(() => notes() !== null),
  })),
  withComputed(({ dirtyTables, dirtySections }) => ({
    dirty: computed(() => dirtyTables().length > 0 || dirtySections().length > 0),
  })),
  withMethods((store, api = inject(StatutoryFinancialsApiService)) => {
    const baseTable = (name: SfNotesTableName): Record<string, unknown> =>
      ((store.tables() as Record<string, unknown>)[name] as Record<string, unknown> | undefined) ??
      {};

    return {
      async load(id: string): Promise<void> {
        patchState(store, { loading: true, error: null, tableDrafts: {}, sectionDrafts: {} });
        try {
          const response = await firstValueFrom(api.getNotes(id));
          patchState(store, { notes: response.data, loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      /** Fills the tables from the subledgers (fixed assets, due dates, leases, workforce) and the narrative templates. */
      async populate(id: string, overwriteNarrative = false): Promise<SfOutcome> {
        patchState(store, { populating: true });
        try {
          const response = await firstValueFrom(api.populateNotes(id, overwriteNarrative));
          patchState(store, {
            notes: response.data,
            populating: false,
            tableDrafts: {},
            sectionDrafts: overwriteNarrative ? {} : store.sectionDrafts(),
          });
          return SF_OK;
        } catch (error) {
          patchState(store, { populating: false });
          return failureOf(error);
        }
      },
      /** Replaces the rows of a table (edit of a cell, row added or removed). */
      setRows(name: SfNotesTableName, rows: readonly object[]): void {
        patchState(store, {
          tableDrafts: {
            ...store.tableDrafts(),
            [name]: { ...baseTable(name), rows, manual: true },
          },
        });
      },
      /** Edits one figure of the maturity table (receivables or payables, one bucket). */
      setMaturity(group: MaturityGroup, bucket: MaturityBucket, value: string): void {
        const table = baseTable('maturity');
        const buckets = (table[group] as Record<string, unknown> | undefined) ?? {};
        patchState(store, {
          tableDrafts: {
            ...store.tableDrafts(),
            maturity: { ...table, [group]: { ...buckets, [bucket]: value }, manual: true },
          },
        });
      },
      setSectionBody(key: string, body: string): void {
        patchState(store, { sectionDrafts: { ...store.sectionDrafts(), [key]: body } });
      },
      discard(): void {
        patchState(store, { tableDrafts: {}, sectionDrafts: {} });
      },
      /** Saves the edited tables and sections; what was not edited is not sent. */
      async save(id: string): Promise<SfOutcome> {
        const payload: SfNotesPayload = {};
        const drafts = store.tableDrafts();
        if (Object.keys(drafts).length > 0) {
          payload.tables = drafts;
        }
        const edited = store.sectionDrafts();
        if (Object.keys(edited).length > 0) {
          payload.sections = store
            .sections()
            .filter((section) => section.key in edited)
            .map((section) => ({ key: section.key, title: section.title, body: section.body }));
        }
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.updateNotes(id, payload));
          patchState(store, {
            notes: response.data,
            saving: false,
            tableDrafts: {},
            sectionDrafts: {},
          });
          return SF_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
    };
  }),
);
