import {
  ResourceAction,
  ResourceColumn,
  ResourceColumnType,
  ResourceField,
  ResourceHttpMethod,
  ResourceLookupName,
  ResourceRow,
} from './resource-panel.types';

type FieldOptions = Partial<Omit<ResourceField, 'key' | 'type'>>;

const make =
  (type: ResourceField['type']) =>
  (key: string, options: FieldOptions = {}): ResourceField => ({ key, type, ...options });

/** Short constructors for `ResourceField` and `ResourceColumn`, keeping the page configs readable. */
export const rf = {
  text: make('text'),
  textarea: make('textarea'),
  integer: make('integer'),
  decimal: make('decimal'),
  date: make('date'),
  datetime: make('datetime'),
  uuid: make('uuid'),
  bool: make('switch'),
  tags: make('tags'),
  json: make('json'),
  select: (key: string, options: readonly string[], extra: FieldOptions = {}): ResourceField => ({
    key,
    type: 'select',
    options,
    ...extra,
  }),
  lookup: (key: string, lookup: ResourceLookupName, extra: FieldOptions = {}): ResourceField => ({
    key,
    type: 'lookup',
    lookup,
    ...extra,
  }),
  lines: (key: string, fields: readonly ResourceField[], extra: FieldOptions = {}): ResourceField => ({
    key,
    type: 'lines',
    fields,
    ...extra,
  }),
};

/** Same field, marked as required. */
export const req = (field: ResourceField): ResourceField => ({ ...field, required: true });

export const col = (key: string, type?: ResourceColumnType, labelKey?: string): ResourceColumn => ({
  key,
  type,
  labelKey,
});

/** Plain text columns. */
export const cols = (...keys: string[]): ResourceColumn[] => keys.map((key) => col(key));

export const tagCol = (key: string): ResourceColumn => col(key, 'tag');

interface ActionOptions {
  fields?: readonly ResourceField[];
  prefill?: boolean;
  confirm?: boolean;
  danger?: boolean;
  showResult?: boolean;
  download?: boolean;
  body?: Record<string, unknown>;
  visible?: (row: ResourceRow) => boolean;
}

/** `act('POST', 'RES.ACTION.CANCEL', '/x/{id}/cancel', { confirm: true })`. */
export function act(
  method: ResourceHttpMethod,
  labelKey: string,
  path: string,
  options: ActionOptions = {},
): ResourceAction {
  const { confirm, ...rest } = options;
  return {
    key: `${method.toLowerCase()}:${path}`,
    labelKey,
    method,
    path,
    ...rest,
    confirmKey: confirm ? 'RES.CONFIRM.GENERIC' : undefined,
  };
}

/** Row visible only when `row[key]` is one of the given values. */
export const whenIn =
  (key: string, ...values: string[]) =>
  (row: ResourceRow): boolean =>
    values.includes(String(row[key]));
