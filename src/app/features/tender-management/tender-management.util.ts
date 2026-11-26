import { HttpErrorResponse } from '@angular/common/http';
import {
  TndAlertSeverity,
  TndEnvelopeItem,
  TndIssue,
  TndJurisdiction,
  TndParticipation,
  TndParticipationStatus,
  TndProblem,
  TndReadiness,
  TndVaultDocument,
  TndVerificationStatus,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`). */
export const TENDER_MANAGEMENT_MODULE = 'tender_management';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and bind the field errors of a 422. */
export interface TndOutcome {
  ok: boolean;
  /** Translation key of the refusal (`tenderManagement.error.<code>`), null on success. */
  errorKey: string | null;
  errorParams: Record<string, string | number>;
  detail: string | null;
  errors: Record<string, string[]>;
}

export const TND_OK: TndOutcome = { ok: true, errorKey: null, errorParams: {}, detail: null, errors: {} };

export function errorKey(code: string | null | undefined): string {
  return `tenderManagement.error.${code ? code : 'generic'}`;
}

/** Translation key of a compliance issue (`tenderManagement.compliance.<code>`). */
export function issueKey(issue: Pick<TndIssue, 'code'>): string {
  return `tenderManagement.compliance.${issue.code}`;
}

function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** The problem details of a failed call; a failed download answers a Blob that holds the JSON. */
export async function problemOf(error: unknown): Promise<TndProblem | null> {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      return JSON.parse(await readBlobText(body)) as TndProblem;
    } catch {
      return null;
    }
  }
  return body !== null && typeof body === 'object' ? (body as TndProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export async function failureOf(error: unknown): Promise<TndOutcome> {
  const problem = await problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];

  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    errorParams: problem?.params ?? {},
    detail: first ?? problem?.detail ?? null,
    errors,
  };
}

// --- Labels and colours ---

export const PIPELINE_COLUMNS: readonly TndParticipationStatus[] = [
  'Scouting',
  'GoApproved',
  'PreparingEnvelopes',
  'Submitted',
  'AwardedWon',
  'Lost',
  'LegalAppeal_Ricorso',
];

export function statusColor(status: TndParticipationStatus): string {
  switch (status) {
    case 'GoApproved':
      return 'cyan';
    case 'PreparingEnvelopes':
      return 'gold';
    case 'Submitted':
      return 'blue';
    case 'AwardedWon':
      return 'green';
    case 'Lost':
      return 'red';
    case 'LegalAppeal_Ricorso':
      return 'volcano';
    default:
      return 'geekblue';
  }
}

export function jurisdictionColor(jurisdiction: TndJurisdiction): string {
  switch (jurisdiction) {
    case 'CH_SIMAP_LAPub':
      return 'red';
    case 'IT_Dlgs36_2023_ANAC':
      return 'green';
    case 'EU_TED':
      return 'blue';
    default:
      return 'default';
  }
}

/** Short badge of the jurisdiction (the portal names are proper nouns, not translated). */
export function jurisdictionBadge(jurisdiction: TndJurisdiction): string {
  switch (jurisdiction) {
    case 'CH_SIMAP_LAPub':
      return 'CH simap.ch';
    case 'IT_Dlgs36_2023_ANAC':
      return 'IT ANAC-MePA';
    case 'EU_TED':
      return 'EU TED';
    default:
      return 'RFP';
  }
}

export function countryOf(jurisdiction: TndJurisdiction): 'IT' | 'CH' | null {
  if (jurisdiction === 'CH_SIMAP_LAPub') {
    return 'CH';
  }
  return jurisdiction === 'IT_Dlgs36_2023_ANAC' ? 'IT' : null;
}

export function severityColor(severity: TndIssue['severity'] | TndAlertSeverity): string {
  switch (severity) {
    case 'blocking':
    case 'critical':
      return 'red';
    case 'warning':
      return 'orange';
    default:
      return 'blue';
  }
}

// --- Deadline countdown ---

export type CountdownUrgency = 'expired' | 'critical' | 'warning' | 'soon' | 'normal' | 'none';

export interface Countdown {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  urgency: CountdownUrgency;
}

const NO_COUNTDOWN: Countdown = {
  expired: false,
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  totalSeconds: 0,
  urgency: 'none',
};

/**
 * Time left to a peremptory deadline. Urgency follows the alert milestones of the backend: 4 h and 24 h are critical,
 * 72 h a warning and 7 days a reminder.
 */
export function countdownTo(deadline: string | null | undefined, now: Date = new Date()): Countdown {
  if (!deadline) {
    return NO_COUNTDOWN;
  }
  const target = new Date(deadline).getTime();
  if (Number.isNaN(target)) {
    return NO_COUNTDOWN;
  }

  const remaining = Math.floor((target - now.getTime()) / 1000);
  if (remaining <= 0) {
    return { ...NO_COUNTDOWN, expired: true, urgency: 'expired' };
  }

  const hoursLeft = remaining / 3600;
  let urgency: CountdownUrgency = 'normal';
  if (hoursLeft <= 24) {
    urgency = 'critical';
  } else if (hoursLeft <= 72) {
    urgency = 'warning';
  } else if (hoursLeft <= 168) {
    urgency = 'soon';
  }

  return {
    expired: false,
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
    totalSeconds: remaining,
    urgency,
  };
}

export function urgencyColor(urgency: CountdownUrgency): string {
  switch (urgency) {
    case 'expired':
      return 'default';
    case 'critical':
      return 'red';
    case 'warning':
      return 'orange';
    case 'soon':
      return 'gold';
    default:
      return 'green';
  }
}

/** Whether a deadline lies within the given number of hours (and has not passed). */
export function dueWithin(deadline: string | null | undefined, hours: number, now: Date = new Date()): boolean {
  const countdown = countdownTo(deadline, now);
  return countdown.urgency !== 'none' && !countdown.expired && countdown.totalSeconds <= hours * 3600;
}

// --- Pipeline ---

export function groupByStatus(
  participations: readonly TndParticipation[],
): Record<TndParticipationStatus, TndParticipation[]> {
  const groups = Object.fromEntries(PIPELINE_COLUMNS.map((status) => [status, []])) as unknown as Record<
    TndParticipationStatus,
    TndParticipation[]
  >;
  for (const participation of participations) {
    groups[participation.status]?.push(participation);
  }
  return groups;
}

// --- Qualification vault traffic lights ---

export type TrafficLight = 'green' | 'amber' | 'red' | 'grey';

/** Days under which a valid document turns amber, when the server has not classified it yet. */
export const VAULT_EXPIRING_DAYS = 90;

export function trafficLightOf(status: TndVerificationStatus): TrafficLight {
  switch (status) {
    case 'Valid':
      return 'green';
    case 'ExpiringSoon':
      return 'amber';
    case 'Expired':
      return 'red';
    default:
      return 'grey';
  }
}

/** Classification from the dates of a document, for the documents the screen edits before the server answers. */
export function classifyVerification(
  expiryDate: string | null,
  today: Date = new Date(),
  warnDays: number = VAULT_EXPIRING_DAYS,
): TndVerificationStatus {
  if (!expiryDate) {
    return 'Valid';
  }
  const days = daysUntil(expiryDate, today);
  if (days < 0) {
    return 'Expired';
  }
  return days <= warnDays ? 'ExpiringSoon' : 'Valid';
}

export function daysUntil(date: string, today: Date = new Date()): number {
  const target = new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target - start) / 86_400_000);
}

/** The Betreibungsauszug is accepted for a rolling window (3 months) from its issue date. */
export function betreibungsauszugValidUntil(issueDate: string, maxAgeMonths = 3): string {
  const [year, month, day] = issueDate.slice(0, 10).split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + maxAgeMonths, day));
  // A shorter month rolls over (31 January + 1 month): clamp to the last day of the intended month.
  if (target.getUTCDate() !== day) {
    target.setUTCDate(0);
  }
  return target.toISOString().slice(0, 10);
}

export interface RollingTracker {
  validUntil: string;
  daysLeft: number;
  light: TrafficLight;
}

export function betreibungsauszugTracker(
  issueDate: string | null,
  today: Date = new Date(),
  maxAgeMonths = 3,
): RollingTracker | null {
  if (!issueDate) {
    return null;
  }
  const validUntil = betreibungsauszugValidUntil(issueDate, maxAgeMonths);
  const daysLeft = daysUntil(validUntil, today);
  return { validUntil, daysLeft, light: daysLeft < 0 ? 'red' : daysLeft <= 14 ? 'amber' : 'green' };
}

/** Light of a vault document: the server status, with the rolling rule applied to the Betreibungsauszug. */
export function documentLight(doc: TndVaultDocument, today: Date = new Date()): TrafficLight {
  if (doc.doc_type === 'CH_EstrattoEsecuzioniFallimenti_Betreibungsauszug') {
    const tracker = betreibungsauszugTracker(doc.issue_date, today);
    if (tracker && tracker.light === 'red') {
      return 'red';
    }
    if (tracker && tracker.light === 'amber' && doc.verification_status === 'Valid') {
      return 'amber';
    }
  }
  return trafficLightOf(doc.verification_status);
}

/** The next SOA milestone: the triennial check, else the expiry of the attestation. */
export function soaNextMilestone(
  doc: Pick<TndVaultDocument, 'intermediate_triennial_check_date' | 'expiry_date'>,
  today: Date = new Date(),
): { kind: 'intermediate_check' | 'expiry'; date: string; daysLeft: number } | null {
  const candidates: { kind: 'intermediate_check' | 'expiry'; date: string }[] = [];
  if (doc.intermediate_triennial_check_date) {
    candidates.push({ kind: 'intermediate_check', date: doc.intermediate_triennial_check_date });
  }
  if (doc.expiry_date) {
    candidates.push({ kind: 'expiry', date: doc.expiry_date });
  }
  const upcoming = candidates
    .map((candidate) => ({ ...candidate, daysLeft: daysUntil(candidate.date, today) }))
    .filter((candidate) => candidate.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  return upcoming[0] ?? null;
}

export function summarizeLights(
  documents: readonly TndVaultDocument[],
  today: Date = new Date(),
): Record<TrafficLight, number> {
  const summary: Record<TrafficLight, number> = { green: 0, amber: 0, red: 0, grey: 0 };
  for (const doc of documents) {
    summary[documentLight(doc, today)] += 1;
  }
  return summary;
}

// --- Envelope readiness ---

export interface EnvelopeValidation {
  complete: boolean;
  missingRequired: string[];
  invalidSignatures: string[];
  unsignedRequired: string[];
}

/** An envelope is complete when every required item holds a file and every required signature verifies. */
export function validateEnvelope(items: readonly TndEnvelopeItem[]): EnvelopeValidation {
  const missingRequired: string[] = [];
  const invalidSignatures: string[] = [];
  const unsignedRequired: string[] = [];

  for (const item of items) {
    const uploaded = item.file_name !== null && item.status !== 'missing';
    if (item.required && !uploaded) {
      missingRequired.push(item.key);
      continue;
    }
    if (!uploaded) {
      continue;
    }
    if (item.signature?.status === 'invalid' || item.status === 'signature_invalid') {
      invalidSignatures.push(item.key);
    } else if (item.signature_required && item.signature?.status !== 'valid') {
      unsignedRequired.push(item.key);
    }
  }

  return {
    complete:
      missingRequired.length === 0 && invalidSignatures.length === 0 && unsignedRequired.length === 0,
    missingRequired,
    invalidSignatures,
    unsignedRequired,
  };
}

/** The gate of the submission: envelopes complete, no blocking issue (readiness or offer). */
export function submissionGate(
  readiness: TndReadiness | null,
  offerBlocked: boolean,
): { canSubmit: boolean; blocking: TndIssue[] } {
  if (!readiness) {
    return { canSubmit: false, blocking: [] };
  }
  const blocking = readiness.issues.filter((issue) => issue.severity === 'blocking');
  const envelopesOk = Object.values(readiness.envelopes).every((envelope) => envelope.complete);
  return { canSubmit: readiness.ready && envelopesOk && blocking.length === 0 && !offerBlocked, blocking };
}

export function envelopeProgress(items: readonly TndEnvelopeItem[]): { done: number; total: number; percent: number } {
  const required = items.filter((item) => item.required);
  const total = required.length;
  const done = required.filter((item) => item.status === 'ok' || item.status === 'uploaded').length;
  return { done, total, percent: total === 0 ? 100 : Math.round((done / total) * 100) };
}

/** Whether a file name has a digital signature extension (`.p7m`) or is a PDF (PAdES). */
export function signatureFormatOfFile(fileName: string): 'p7m' | 'pades' | 'none' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.p7m')) {
    return 'p7m';
  }
  return lower.endsWith('.pdf') ? 'pades' : 'none';
}

// --- Go/No-Go criteria ---

/**
 * Translation key (and params) of a criterion of the eligibility matrix. The API names them `turnover`, `similar_projects`,
 * `soa_<CATEGORY>` (e.g. `soa_OG1`), `certification_<DocType>` / `document_<DocType>` and `compliance_<code>`; any other key
 * is looked up as `tenderManagement.criterion.<key>`.
 */
export function criterionLabel(key: string): { key: string; params: Record<string, string> } {
  const soa = /^soa[_:](.+)$/.exec(key);
  if (soa) {
    return { key: 'tenderManagement.criterion.soa', params: { category: soa[1] } };
  }
  const document = /^(?:certification|document)[_:](.+)$/.exec(key);
  if (document) {
    return { key: `tenderManagement.enum.vaultDocType.${document[1]}`, params: {} };
  }
  const compliance = /^compliance[_:](.+)$/.exec(key);
  if (compliance) {
    return { key: `tenderManagement.compliance.${compliance[1]}`, params: {} };
  }
  return { key: `tenderManagement.criterion.${key}`, params: {} };
}

/** The reading of the matrix: solo, or the form of association the gaps call for. */
export function recommendationKey(eligibility: Pick<TndEligibilityLike, 'can_bid_solo' | 'recommended_mode'>): string {
  if (eligibility.can_bid_solo) {
    return 'tenderManagement.compliance.solo_eligible';
  }
  return eligibility.recommended_mode === 'Avvalimento'
    ? 'tenderManagement.compliance.avvalimento_recommended'
    : 'tenderManagement.compliance.rti_recommended';
}

interface TndEligibilityLike { can_bid_solo: boolean; recommended_mode: string }

export function decisionColor(decision: 'go' | 'conditional' | 'no_go'): string {
  return decision === 'go' ? 'green' : decision === 'conditional' ? 'orange' : 'red';
}

/** Share of the matrix criteria that are met, 0-100. */
export function metShare(criteria: readonly { met: boolean }[]): number {
  return criteria.length === 0 ? 0 : Math.round((criteria.filter((item) => item.met).length / criteria.length) * 100);
}
