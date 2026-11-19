import { Observable } from 'rxjs';
import { ExtraListResponse, ExtraRecord } from '@core';
import { CrudConfig, CrudField } from '../hr/shared/crud/crud.types';

type Row = { id: string } & Record<string, unknown>;

/**
 * A tab of a resource hub page. Every label is the text shown to the user: when the dictionary has a
 * translation for it the translation wins (the shared translate service returns the key when none exists).
 */
export type HubTab =
  | { kind: 'crud'; title: string; config: CrudConfig<Row>; hint?: string }
  /** Read-only data (list or object) loaded from an endpoint, with optional filter fields sent as query parameters. */
  | { kind: 'report'; title: string; load: (params: Record<string, unknown>) => Observable<unknown>; filters?: CrudField[]; hint?: string }
  /** An action that needs a form (create, calculate, import ...): the answer of the server is shown under the form. */
  | { kind: 'form'; title: string; fields: CrudField[]; submitLabel: string; submit: (payload: Record<string, unknown>) => Observable<unknown>; canWrite?: boolean; hint?: string; resetOnSuccess?: boolean }
  /** A file to download (PDF, CSV), with the fields the endpoint needs. */
  | { kind: 'download'; title: string; fields: CrudField[]; buttonLabel: string; fileName: string; download: (params: Record<string, unknown>) => Observable<Blob>; hint?: string }
  /** A file to upload next to optional text fields. */
  | { kind: 'upload'; title: string; fields: CrudField[]; buttonLabel: string; upload: (fields: Record<string, string>, file: File) => Observable<unknown>; canWrite?: boolean; accept?: string; hint?: string };

/** Unwraps the `data` of a list answer for the client-side crud table. */
export function rows(source: Observable<ExtraListResponse>): Observable<ExtraRecord[]>;
export function rows<T extends { id: string }>(source: Observable<{ data: T[] }>): Observable<T[]>;
export function rows(source: Observable<{ data: unknown[] }>): Observable<never[]> {
  return new Observable((subscriber) =>
    source.subscribe({
      next: (r) => subscriber.next((r.data ?? []) as never[]),
      error: (e: unknown) => subscriber.error(e),
      complete: () => subscriber.complete(),
    }),
  );
}

type Opt = Partial<CrudField>;

/** Field builders: keep the page configs short. */
export const f = {
  text: (key: string, label: string, o: Opt = {}): CrudField => ({ key, labelKey: label, type: 'text', maxLength: 255, ...o }),
  area: (key: string, label: string, o: Opt = {}): CrudField => ({ key, labelKey: label, type: 'textarea', ...o }),
  num: (key: string, label: string, o: Opt = {}): CrudField => ({ key, labelKey: label, type: 'decimal', ...o }),
  int: (key: string, label: string, o: Opt = {}): CrudField => ({ key, labelKey: label, type: 'integer', ...o }),
  date: (key: string, label: string, o: Opt = {}): CrudField => ({ key, labelKey: label, type: 'date', ...o }),
  bool: (key: string, label: string, o: Opt = {}): CrudField => ({ key, labelKey: label, type: 'boolean', ...o }),
  select: (key: string, label: string, values: readonly string[] | Record<string, string>, o: Opt = {}): CrudField => {
    const options = Array.isArray(values)
      ? (values as readonly string[]).map((value) => ({ value, label: value }))
      : Object.entries(values as Record<string, string>).map(([value, text]) => ({ value, label: text }));
    return { key, labelKey: label, type: 'select', options: () => options, ...o };
  },
  /** Table-only column. */
  col: (key: string, label: string, o: Opt = {}): CrudField => ({ key, labelKey: label, type: 'text', noForm: true, ...o }),
  /** A uuid typed by the user (the parent record cannot be picked from a list on this page). */
  id: (key: string, label: string, o: Opt = {}): CrudField => ({ key, labelKey: label, type: 'text', uuid: true, maxLength: 36, ...o }),
};
