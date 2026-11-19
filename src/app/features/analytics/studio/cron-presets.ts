/** The presets of the schedule drawer, as cron expressions, and the plain-language reading of an expression. */
export type CronPresetKey = 'daily' | 'weekly_monday' | 'monthly_first' | 'custom';

export const CRON_PRESETS: Record<Exclude<CronPresetKey, 'custom'>, string> = {
  daily: '0 7 * * *',
  weekly_monday: '0 7 * * 1',
  monthly_first: '0 7 1 * *',
};

export const CRON_PRESET_KEYS: CronPresetKey[] = [
  'daily',
  'weekly_monday',
  'monthly_first',
  'custom',
];

/** The preset an expression is, or `custom`. */
export function presetOf(expression: string): CronPresetKey {
  const normalised = expression.trim().replace(/\s+/g, ' ');
  const found = (Object.keys(CRON_PRESETS) as Exclude<CronPresetKey, 'custom'>[]).find(
    (key) => CRON_PRESETS[key] === normalised,
  );

  return found ?? 'custom';
}

export interface CronReading {
  /** Translation key of the sentence. */
  key: string;
  params: Record<string, string>;
}

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function time(minute: string, hour: string): string {
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

/**
 * A human-readable reading of the common expressions (every day, a weekday, a day of the month at a time). Anything else
 * is shown as the expression itself; the schedule preview then lists the real runs.
 */
export function readCron(expression: string): CronReading {
  const parts = expression.trim().split(/\s+/);
  const [minute, hour, day, month, weekday] = parts;
  const numeric = (value: string | undefined): boolean =>
    value !== undefined && /^\d{1,2}$/.test(value);

  if (parts.length === 5 && numeric(minute) && numeric(hour) && month === '*') {
    if (day === '*' && weekday === '*') {
      return { key: 'ANALYTICS_STUDIO.CRON_READ_DAILY', params: { time: time(minute, hour) } };
    }
    if (day === '*' && numeric(weekday)) {
      return {
        key: 'ANALYTICS_STUDIO.CRON_READ_WEEKLY',
        params: {
          time: time(minute, hour),
          weekday: `ANALYTICS_STUDIO.WEEKDAY_${WEEKDAYS[Number(weekday) % 7]}`,
        },
      };
    }
    if (numeric(day) && weekday === '*') {
      return {
        key: 'ANALYTICS_STUDIO.CRON_READ_MONTHLY',
        params: { time: time(minute, hour), day },
      };
    }
  }

  return { key: 'ANALYTICS_STUDIO.CRON_READ_CUSTOM', params: { expression } };
}
