import { Observable } from 'rxjs';

export type CrudFieldType = 'text' | 'textarea' | 'decimal' | 'integer' | 'date' | 'select' | 'boolean';

export interface CrudOption {
  value: string;
  /** i18n key; falls back to `label` / `value`. */
  labelKey?: string;
  label?: string;
}

export interface CrudField {
  key: string;
  /** i18n key of the column header and form label. */
  labelKey: string;
  type: CrudFieldType;
  required?: boolean;
  maxLength?: number;
  /** Shown as a table column (default true). */
  column?: boolean;
  /** Table column only: never part of the form or payload. */
  noForm?: boolean;
  /** Not editable once the row exists (e.g. natural keys). */
  createOnly?: boolean;
  /** Empty value is sent as null (otherwise omitted). */
  nullable?: boolean;
  /** Select options; called from the template so it can read signals. */
  options?: () => CrudOption[];
  /** Default value of a new row. */
  defaultValue?: string | boolean;
}

export interface CrudConfig<T extends { id: string }> {
  titleKey: string;
  fields: CrudField[];
  list: () => Observable<T[]>;
  create?: (payload: Record<string, unknown>) => Observable<unknown>;
  update?: (id: string, payload: Record<string, unknown>) => Observable<unknown>;
  remove?: (id: string) => Observable<unknown>;
  /** Hides edit/delete for a row (e.g. generic read-only records). */
  isReadonly?: (row: T) => boolean;
  /** Write actions are hidden when false (permission). */
  canWrite: boolean;
  /** Extra buttons per row (e.g. open a detail drawer). */
  rowActions?: { labelKey: string; run: (row: T) => void }[];
}
