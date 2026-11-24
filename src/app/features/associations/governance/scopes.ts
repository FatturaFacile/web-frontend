import { ResourceField, rf } from '@shared';

/** The last eight years, newest first: statements, the art. 398 register and network figures are read per year. */
const currentYear = new Date().getFullYear();
export const SCOPE_YEARS: readonly string[] = Array.from({ length: 8 }, (_, index) => String(currentYear - index));

/** Year selector filling the `{year}` placeholder of a path. */
export const yearScope = (): ResourceField => rf.select('year', SCOPE_YEARS, { labelKey: 'RES.F.statement_year' });
