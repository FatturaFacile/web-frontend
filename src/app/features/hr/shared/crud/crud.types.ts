import { Observable } from 'rxjs';

export type CrudFieldType = 'text' | 'textarea' | 'decimal' | 'integer' | 'date' | 'datetime' | 'select' | 'boolean';

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
  /** Required while the field with this key is filled/checked (API `required_if`). */
  requiredIf?: string;
  /** Required while the field with this key is empty (API `required_without`). */
  requiredWithout?: string;
  /** Required whenever this returns true for the current form values (API `required_if` with several conditions). */
  requiredWhen?: (values: Record<string, unknown>, editing: boolean) => boolean;
  minLength?: number;
  /** Numeric lower bound. */
  min?: number;
  /** Numeric upper bound. */
  max?: number;
  /** Regex source the value must match. */
  pattern?: string;
  /** Mirrors `after_or_equal:<key>` (`after:<key>` with `strictlyAfter`): the sibling date this one cannot precede. */
  notBefore?: string;
  strictlyAfter?: boolean;
  /** Mirrors `before_or_equal:today`. */
  notInFuture?: boolean;
  /** Mirrors `before_or_equal:<today + N months>`. */
  maxMonthsAhead?: number;
  /** Mirrors `after:today` / `after:now`. */
  inFuture?: boolean;
  /** Mirrors `different:<key>`. */
  differentFrom?: string;
  /** Mirrors `prohibits:<key>`: when this field is filled the sibling field must stay empty. */
  prohibits?: string;
  /** Mirrors `gt:0` on a numeric field. */
  positive?: boolean;
  /** Mirrors the `uuid` rule. */
  uuid?: boolean;
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

export interface CrudRowAction<T> {
  labelKey: string;
  /** Receives the typed value when `input` is set (reason or decimal). */
  run: (row: T, value?: string) => void | Observable<unknown>;
  /** Hides the action for some rows (e.g. already completed). */
  visible?: (row: T) => boolean;
  /** Asks for a value before running: `reason` (mandatory text) or `decimal` (optional number). */
  input?: { labelKey: string; kind: 'reason' | 'decimal' | 'date' | 'select'; optional?: boolean; options?: () => CrudOption[] };
  /** Needs write permission (default true when the config is writable only). */
  writeOnly?: boolean;
}

export interface CrudConfig<T extends { id: string }> {
  titleKey: string;
  fields: CrudField[];
  list: () => Observable<T[]>;
  create?: (payload: Record<string, unknown>) => Observable<unknown>;
  update?: (id: string, payload: Record<string, unknown>) => Observable<unknown>;
  remove?: (id: string, reason?: string) => Observable<unknown>;
  /** Delete asks for a mandatory reason (audited resources) instead of a plain confirmation. */
  removeWithReason?: boolean;
  /** Minimum length of that reason (API `min:N`, default 3). */
  removeReasonMinLength?: number;
  /** Hides edit/delete for a row (e.g. generic read-only records). */
  isReadonly?: (row: T) => boolean;
  /** Write actions are hidden when false (permission). */
  canWrite: boolean;
  /** Extra buttons per row (e.g. open a detail drawer). */
  rowActions?: CrudRowAction<T>[];
}
