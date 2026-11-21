import {
  BlockingReason,
  CertificateType,
  FitnessOutcome,
  IncidentStatus,
  IncidentType,
  MatrixRow,
  TrafficLight,
} from './hse.models';

/** Translation key of each certificate type (the keys live in the backend seeder, never in a frontend file). */
export const CERTIFICATE_KEYS: Readonly<Record<CertificateType, string>> = {
  general_safety_accordo_stato_regioni: 'HSE.CERT_GENERAL_SAFETY',
  low_risk_specific: 'HSE.CERT_LOW_RISK',
  medium_risk_specific: 'HSE.CERT_MEDIUM_RISK',
  high_risk_specific: 'HSE.CERT_HIGH_RISK',
  forklift_patentino_muletto: 'HSE.CERT_FORKLIFT',
  crane_operator_gru: 'HSE.CERT_CRANE',
  first_aid_primo_soccorso: 'HSE.CERT_FIRST_AID',
  fire_safety_antincendio: 'HSE.CERT_FIRE_SAFETY',
  work_at_height_lavori_in_quota: 'HSE.CERT_WORK_AT_HEIGHT',
  confined_spaces: 'HSE.CERT_CONFINED_SPACES',
  suva_psa_training: 'HSE.CERT_SUVA_PSA',
  rspp_asl_training: 'HSE.CERT_RSPP',
  sibe_ekas_training: 'HSE.CERT_SIBE',
};

export const FITNESS_KEYS: Readonly<Record<FitnessOutcome, string>> = {
  fit_idoneo: 'HSE.FITNESS_FIT',
  fit_with_prescriptions_idoneo_con_prescrizioni: 'HSE.FITNESS_FIT_WITH_PRESCRIPTIONS',
  temporarily_unfit_inidoneo_temporaneo: 'HSE.FITNESS_TEMPORARILY_UNFIT',
  permanently_unfit_inidoneo_permanente: 'HSE.FITNESS_PERMANENTLY_UNFIT',
};

export const INCIDENT_TYPE_KEYS: Readonly<Record<IncidentType, string>> = {
  near_miss: 'HSE.INC_TYPE_NEAR_MISS',
  first_aid_injury: 'HSE.INC_TYPE_FIRST_AID',
  lost_time_accident_inail_or_suva: 'HSE.INC_TYPE_LOST_TIME',
  fatal_or_severe: 'HSE.INC_TYPE_FATAL',
};

export const INCIDENT_STATUS_KEYS: Readonly<Record<IncidentStatus, string>> = {
  draft: 'HSE.INC_STATUS_DRAFT',
  under_investigation: 'HSE.INC_STATUS_INVESTIGATION',
  corrective_actions_open: 'HSE.INC_STATUS_CAPA_OPEN',
  closed: 'HSE.INC_STATUS_CLOSED',
};

/** `HSE.LIGHT_GREEN`, `HSE.LIGHT_YELLOW` or `HSE.LIGHT_RED`. */
export function lightKey(light: TrafficLight): string {
  return `HSE.LIGHT_${light}`;
}

/** Translation key of a blocking reason code (`certificate_missing` becomes `HSE.REASON_CERTIFICATE_MISSING`). */
export function reasonKey(reason: BlockingReason): string {
  return `HSE.REASON_${reason.code.toUpperCase()}`;
}

/** Translation key of a certificate type, or the type itself when it is not a known one (a custom code of the tenant). */
export function certificateKey(type: string): string {
  return CERTIFICATE_KEYS[type as CertificateType] ?? type;
}

/** The name of the NG-ZORRO tag colour of a light. */
export function lightColor(light: TrafficLight): 'success' | 'warning' | 'error' {
  return light === 'GREEN' ? 'success' : light === 'YELLOW' ? 'warning' : 'error';
}

/** The distinct training columns present in the rows, in a stable order. */
export function trainingColumns(rows: readonly MatrixRow[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row.trainings)))].sort();
}

/** The distinct PPE columns present in the rows, in a stable order. */
export function ppeColumns(rows: readonly MatrixRow[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row.ppe)))].sort();
}

/** Whole days from `today` to a `YYYY-MM-DD` date (negative once it passed), or null without a date. */
export function daysUntil(date: string | null, today: Date = new Date()): number | null {
  if (date === null) {
    return null;
  }

  const [year, month, day] = date.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.round((target - start) / 86_400_000);
}

/** Whether an incident type must reach the insurer given its prognosis (the server decides; this drives the form hint). */
export function isReportable(type: IncidentType, jurisdiction: 'IT' | 'CH', prognosisDays: number): boolean {
  if (type === 'lost_time_accident_inail_or_suva' || type === 'fatal_or_severe') {
    return true;
  }

  return type === 'first_aid_injury' && prognosisDays > (jurisdiction === 'IT' ? 1 : 3);
}
