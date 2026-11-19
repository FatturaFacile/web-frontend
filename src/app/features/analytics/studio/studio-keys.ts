/**
 * Translation keys of the studio's closed lists, written out in full so every key can be found by searching the code and
 * checked against the seeded dictionaries (the texts live only in the backend seeders).
 */
export const OPERATOR_KEYS: Record<string, string> = {
  eq: 'ANALYTICS_STUDIO.OP_EQ',
  neq: 'ANALYTICS_STUDIO.OP_NEQ',
  gt: 'ANALYTICS_STUDIO.OP_GT',
  gte: 'ANALYTICS_STUDIO.OP_GTE',
  lt: 'ANALYTICS_STUDIO.OP_LT',
  lte: 'ANALYTICS_STUDIO.OP_LTE',
  between: 'ANALYTICS_STUDIO.OP_BETWEEN',
  in: 'ANALYTICS_STUDIO.OP_IN',
  not_in: 'ANALYTICS_STUDIO.OP_NOT_IN',
  contains: 'ANALYTICS_STUDIO.OP_CONTAINS',
  starts_with: 'ANALYTICS_STUDIO.OP_STARTS_WITH',
  is_null: 'ANALYTICS_STUDIO.OP_IS_NULL',
  not_null: 'ANALYTICS_STUDIO.OP_NOT_NULL',
};

export const GRANULARITY_KEYS: Record<string, string> = {
  day: 'ANALYTICS_STUDIO.GRAN_DAY',
  week: 'ANALYTICS_STUDIO.GRAN_WEEK',
  month: 'ANALYTICS_STUDIO.GRAN_MONTH',
  quarter: 'ANALYTICS_STUDIO.GRAN_QUARTER',
  year: 'ANALYTICS_STUDIO.GRAN_YEAR',
};

export const PERIOD_KEYS: Record<string, string> = {
  month_to_date: 'ANALYTICS_STUDIO.PERIOD_MONTH_TO_DATE',
  last_month: 'ANALYTICS_STUDIO.PERIOD_LAST_MONTH',
  quarter_to_date: 'ANALYTICS_STUDIO.PERIOD_QUARTER_TO_DATE',
  year_to_date: 'ANALYTICS_STUDIO.PERIOD_YEAR_TO_DATE',
  last_30_days: 'ANALYTICS_STUDIO.PERIOD_LAST_30_DAYS',
  last_12_months: 'ANALYTICS_STUDIO.PERIOD_LAST_12_MONTHS',
};

export const CHART_KEYS: Record<string, string> = {
  bar: 'ANALYTICS_STUDIO.CHART_BAR',
  stacked_bar: 'ANALYTICS_STUDIO.CHART_STACKED_BAR',
  line: 'ANALYTICS_STUDIO.CHART_LINE',
  area: 'ANALYTICS_STUDIO.CHART_AREA',
  pie: 'ANALYTICS_STUDIO.CHART_PIE',
  donut: 'ANALYTICS_STUDIO.CHART_DONUT',
  combo: 'ANALYTICS_STUDIO.CHART_COMBO',
};

export const FORMAT_KEYS: Record<string, string> = {
  xlsx: 'ANALYTICS_STUDIO.FORMAT_XLSX',
  pdf: 'ANALYTICS_STUDIO.FORMAT_PDF',
  csv: 'ANALYTICS_STUDIO.FORMAT_CSV',
  excel_csv: 'ANALYTICS_STUDIO.FORMAT_EXCEL_CSV',
  json: 'ANALYTICS_STUDIO.FORMAT_JSON',
};

export const LOCALE_KEYS: Record<string, string> = {
  'it-CH': 'ANALYTICS_STUDIO.LOCALE_IT_CH',
  'de-CH': 'ANALYTICS_STUDIO.LOCALE_DE_CH',
  'fr-CH': 'ANALYTICS_STUDIO.LOCALE_FR_CH',
  'it-IT': 'ANALYTICS_STUDIO.LOCALE_IT_IT',
  en: 'ANALYTICS_STUDIO.LOCALE_EN',
};

export const VISIBILITY_KEYS: Record<string, string> = {
  private: 'ANALYTICS_STUDIO.VISIBILITY_PRIVATE',
  role_shared: 'ANALYTICS_STUDIO.VISIBILITY_ROLE_SHARED',
  tenant_public: 'ANALYTICS_STUDIO.VISIBILITY_TENANT_PUBLIC',
};

export const VALUE_FORMAT_KEYS: Record<string, string> = {
  currency: 'ANALYTICS_STUDIO.VALUE_FORMAT_CURRENCY',
  number: 'ANALYTICS_STUDIO.VALUE_FORMAT_NUMBER',
  percentage: 'ANALYTICS_STUDIO.VALUE_FORMAT_PERCENTAGE',
  integer: 'ANALYTICS_STUDIO.VALUE_FORMAT_INTEGER',
};

export const UNIT_KEYS: Record<string, string> = {
  currency: 'ANALYTICS_STUDIO.UNIT_CURRENCY',
  count: 'ANALYTICS_STUDIO.UNIT_COUNT',
  quantity: 'ANALYTICS_STUDIO.UNIT_QUANTITY',
  percent: 'ANALYTICS_STUDIO.UNIT_PERCENT',
};

export const COLOR_KEYS: Record<string, string> = {
  none: 'ANALYTICS_STUDIO.COLOR_NONE',
  default: 'ANALYTICS_STUDIO.COLOR_DEFAULT',
  red: 'ANALYTICS_STUDIO.COLOR_RED',
  orange: 'ANALYTICS_STUDIO.COLOR_ORANGE',
  yellow: 'ANALYTICS_STUDIO.COLOR_YELLOW',
  green: 'ANALYTICS_STUDIO.COLOR_GREEN',
  blue: 'ANALYTICS_STUDIO.COLOR_BLUE',
  purple: 'ANALYTICS_STUDIO.COLOR_PURPLE',
  gray: 'ANALYTICS_STUDIO.COLOR_GRAY',
  white: 'ANALYTICS_STUDIO.COLOR_WHITE',
  black: 'ANALYTICS_STUDIO.COLOR_BLACK',
};

export const STATUS_KEYS: Record<string, string> = {
  ok: 'ANALYTICS_STUDIO.STATUS_OK',
  failed: 'ANALYTICS_STUDIO.STATUS_FAILED',
  queued: 'ANALYTICS_STUDIO.STATUS_QUEUED',
  running: 'ANALYTICS_STUDIO.STATUS_RUNNING',
  completed: 'ANALYTICS_STUDIO.STATUS_COMPLETED',
};

export const PRESET_KEYS: Record<string, string> = {
  daily: 'ANALYTICS_STUDIO.PRESET_DAILY',
  weekly_monday: 'ANALYTICS_STUDIO.PRESET_WEEKLY_MONDAY',
  monthly_first: 'ANALYTICS_STUDIO.PRESET_MONTHLY_FIRST',
  custom: 'ANALYTICS_STUDIO.PRESET_CUSTOM',
};

export const WEEKDAY_KEYS: Record<string, string> = {
  SUNDAY: 'ANALYTICS_STUDIO.WEEKDAY_SUNDAY',
  MONDAY: 'ANALYTICS_STUDIO.WEEKDAY_MONDAY',
  TUESDAY: 'ANALYTICS_STUDIO.WEEKDAY_TUESDAY',
  WEDNESDAY: 'ANALYTICS_STUDIO.WEEKDAY_WEDNESDAY',
  THURSDAY: 'ANALYTICS_STUDIO.WEEKDAY_THURSDAY',
  FRIDAY: 'ANALYTICS_STUDIO.WEEKDAY_FRIDAY',
  SATURDAY: 'ANALYTICS_STUDIO.WEEKDAY_SATURDAY',
};

/** A key of a closed list, or the raw value when the list does not know it (a value the API added later). */
export function labelKey(list: Record<string, string>, value: string): string {
  return list[value] ?? value;
}

export const TIMEZONES = [
  'Europe/Zurich',
  'Europe/Rome',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/London',
  'UTC',
];

/** Colors of the style tokens, as CSS custom properties with a fallback, applied by the grid. */
export const TOKEN_BACKGROUND: Record<string, string> = {
  none: 'transparent',
  red: '#ffccc7',
  orange: '#ffd8a8',
  yellow: '#fff1b8',
  green: '#c3f0ca',
  blue: '#bae0ff',
  purple: '#e0d4fc',
  gray: '#e5e7eb',
};

export const TOKEN_TEXT: Record<string, string> = {
  default: 'inherit',
  white: '#ffffff',
  black: '#000000',
  red: '#a8071a',
  green: '#135200',
  blue: '#003a8c',
};

/** The darker shade of each background, used when the text token is white so the contrast stays readable. */
export const TOKEN_BACKGROUND_DARK: Record<string, string> = {
  none: '#1f2937',
  red: '#a8071a',
  orange: '#ad4e00',
  yellow: '#7c5e00',
  green: '#237804',
  blue: '#0958d9',
  purple: '#531dab',
  gray: '#434343',
};
