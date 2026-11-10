/**
 * Declarative description of a resource panel: a list (or a report), a create form, row actions
 * and toolbar actions, all bound to REST paths relative to `environment.apiBaseUrl`.
 * Path placeholders such as `{id}` are resolved from the row, then from the panel scope.
 */
import { ResourceHttpMethod, ResourceRow } from '@core';

export type { ResourceHttpMethod, ResourceRow };

export type ResourceFieldType =
  | 'text'
  | 'textarea'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'select'
  | 'lookup'
  | 'switch'
  | 'tags'
  | 'multiselect'
  | 'file'
  | 'json'
  | 'lines'
  | 'uuid';

/** Remote option sources shared by every form (see `ResourceLookupService`). */
export type ResourceLookupName =
  | 'warehouses'
  | 'stockItems'
  | 'suppliers'
  | 'mfgItems'
  | 'bins'
  | 'zones'
  | 'contacts'
  | 'kbCategories'
  | 'businessHours';

export interface ResourceField {
  key: string;
  type?: ResourceFieldType;
  /** Translation key; defaults to `RES.F.<key>`. */
  labelKey?: string;
  required?: boolean;
  maxLength?: number;
  /** Text input that hides what is typed (passwords, API secrets). */
  secret?: boolean;
  min?: number;
  /** Enum values of a `select`; labels come from `RES.V.<value>` (humanised when missing). */
  options?: readonly string[];
  lookup?: ResourceLookupName;
  /** Sibling field whose value scopes the lookup (for example `warehouse_id` for `bins`). */
  dependsOn?: string;
  /** Sub-fields of a `lines` repeater. */
  fields?: readonly ResourceField[];
  defaultValue?: unknown;
}

export type ResourceColumnType = 'text' | 'decimal' | 'date' | 'datetime' | 'tag' | 'bool';

export interface ResourceColumn {
  /** Dotted path into the row. */
  key: string;
  type?: ResourceColumnType;
  labelKey?: string;
}

export interface ResourceAction {
  key: string;
  labelKey: string;
  method: ResourceHttpMethod;
  path: string;
  fields?: readonly ResourceField[];
  /** Pre-fills the form with the values of the row (edit actions). */
  prefill?: boolean;
  confirmKey?: string;
  danger?: boolean;
  visible?: (row: Record<string, unknown>) => boolean;
  /** Opens the response in the detail drawer. */
  showResult?: boolean;
  /** Fixed body sent when the action has no form. */
  body?: Record<string, unknown>;
  /** Sends the response as a file download. */
  download?: boolean;
}

export interface ResourceListConfig {
  path: string;
  columns: readonly ResourceColumn[];
  filters?: readonly ResourceField[];
  /** Mandatory select (for example the warehouse) whose key fills a `{placeholder}` of the paths. */
  scope?: ResourceField;
  /** Renders the response as a key/value report instead of a table. */
  report?: boolean;
  /** Reports wait for the Run button instead of loading on open. */
  manual?: boolean;
}

/** Link of every row to a detail route (`{id}` is replaced with the id of the row). */
export interface ResourceRowLink {
  labelKey: string;
  route: string;
}

export interface ResourcePanelConfig {
  id: string;
  titleKey: string;
  /** Module driving the write permission (see `core/auth/permissions.ts`). */
  module: string;
  list: ResourceListConfig;
  create?: ResourceAction;
  /** GET opened in the detail drawer. */
  detailPath?: string;
  rowLink?: ResourceRowLink;
  rowActions?: readonly ResourceAction[];
  toolbar?: readonly ResourceAction[];
}

export interface ResourcePageConfig {
  titleKey: string;
  tabs: readonly ResourcePanelConfig[];
}
