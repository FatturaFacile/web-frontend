import {
  ConfiguratorConfigurationStatus,
  ConfiguratorModelStatus,
  ConfiguratorViolation,
} from '@core';

/** Amount of a decimal string in the currency given, for display only. */
export function formatMoney(value: string | number | null | undefined, currency: string): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return Number(value).toLocaleString(undefined, { style: 'currency', currency });
}

/** A decimal string without the trailing zeros, for display only. */
export function trimDecimal(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return String(Number(value));
}

export function modelStatusColor(status: ConfiguratorModelStatus): string {
  return { draft: 'default', published: 'green', archived: 'red' }[status];
}

export function configurationStatusColor(status: ConfiguratorConfigurationStatus): string {
  return {
    draft: 'default',
    validated: 'blue',
    pending_approval: 'orange',
    approved: 'green',
    rejected: 'red',
    converted: 'purple',
  }[status];
}

/** Translation key of the message of a violation; the API message stays as the fallback. */
export function violationKey(violation: ConfiguratorViolation): string {
  return `CONFIGURATOR.VIOLATION.${violation.code.toUpperCase()}`;
}
