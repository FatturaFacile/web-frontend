import type { FsmCalendarUnit, FsmMaintenanceContract, FsmPreventiveFrequencyRule } from '@core';

/** Form representation of the preventive frequency rule (calendar and meter triggers plus lead times). */
export interface RuleFormValue {
  calendar_every: number | null;
  calendar_unit: FsmCalendarUnit;
  meter_hours: number | null;
  meter_cycles: number | null;
  meter_lead_percent: number | null;
  lead_days: number | null;
}

export const EMPTY_RULE_FORM: RuleFormValue = {
  calendar_every: null,
  calendar_unit: 'month',
  meter_hours: null,
  meter_cycles: null,
  meter_lead_percent: null,
  lead_days: null,
};

/** Builds the API rule from the form: only the triggers that are filled in are sent; `null` when none is. */
export function buildFrequencyRule(value: RuleFormValue): FsmPreventiveFrequencyRule | null {
  const rule: FsmPreventiveFrequencyRule = {};

  if (value.calendar_every !== null && value.calendar_every > 0) {
    rule.calendar = { every: value.calendar_every, unit: value.calendar_unit };
  }

  const meter: NonNullable<FsmPreventiveFrequencyRule['meter']> = {};
  if (value.meter_hours !== null && value.meter_hours > 0) {
    meter.operating_hours = value.meter_hours;
  }
  if (value.meter_cycles !== null && value.meter_cycles > 0) {
    meter.cycles = value.meter_cycles;
  }
  if (meter.operating_hours !== undefined || meter.cycles !== undefined) {
    if (value.meter_lead_percent !== null) {
      meter.lead_percent = value.meter_lead_percent;
    }
    rule.meter = meter;
  }

  if (rule.calendar === undefined && rule.meter === undefined) {
    return null;
  }
  if (value.lead_days !== null) {
    rule.lead_days = value.lead_days;
  }
  return rule;
}

/** Inverse of `buildFrequencyRule`, to fill the edit form. */
export function ruleToForm(rule: FsmPreventiveFrequencyRule | null | undefined): RuleFormValue {
  return {
    calendar_every: rule?.calendar?.every ?? null,
    calendar_unit: rule?.calendar?.unit ?? 'month',
    meter_hours: rule?.meter?.operating_hours ?? null,
    meter_cycles: rule?.meter?.cycles ?? null,
    meter_lead_percent: rule?.meter?.lead_percent ?? null,
    lead_days: rule?.lead_days ?? null,
  };
}

/** One-line summary of the rule for the contract table (calendar, hours and cycles); empty without a rule. */
export function summariseRule(
  contract: Pick<FsmMaintenanceContract, 'preventive_frequency_rule'>,
  translate: (key: string) => string,
): string {
  const rule = contract.preventive_frequency_rule;
  const parts: string[] = [];
  if (rule?.calendar) {
    parts.push(`${rule.calendar.every} ${translate('FSM.CONTRACTS.UNIT_' + rule.calendar.unit.toUpperCase())}`);
  }
  if (rule?.meter?.operating_hours) {
    parts.push(`${rule.meter.operating_hours} ${translate('FSM.CONTRACTS.HOURS_SHORT')}`);
  }
  if (rule?.meter?.cycles) {
    parts.push(`${rule.meter.cycles} ${translate('FSM.CONTRACTS.CYCLES_SHORT')}`);
  }
  return parts.join(', ');
}
