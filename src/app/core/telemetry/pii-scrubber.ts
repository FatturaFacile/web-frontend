/**
 * PII scrubbing for everything the browser sends to the telemetry collector (span names, attributes, error messages, URLs).
 * Personal and fiscal identifiers are replaced by a `[redacted:<kind>]` marker before they leave the page; the collector side
 * (web-api) applies the same rules again, so a mistake here is never the only line of defence.
 */
interface ScrubRule {
  readonly kind: string;
  readonly pattern: RegExp;
}

/** Order matters: the more specific identifiers go first so a Swiss UID is not read as a plain number. */
const SCRUB_RULES: readonly ScrubRule[] = [
  { kind: 'email', pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { kind: 'iban', pattern: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g },
  { kind: 'avs', pattern: /\b756[.\s]?\d{4}[.\s]?\d{4}[.\s]?\d{2}\b/g },
  { kind: 'uid', pattern: /\bCHE[-\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3}(?:\s?(?:MWST|TVA|IVA))?\b/gi },
  { kind: 'cf', pattern: /\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b/gi },
  { kind: 'vat', pattern: /\b(?:IT|DE|FR|ATU)\s?\d{8,11}\b/gi },
  { kind: 'token', pattern: /\b(?:Bearer\s+)?[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g },
  { kind: 'number', pattern: /\b\d{11,}\b/g },
];

const DEFAULT_MAX_LENGTH = 200;

/** Replaces emails, IBANs, AVS/AHV, UID, Codice Fiscale, VAT numbers, JWT-like tokens and long digit runs; truncates the result. */
export function scrubPii(text: string | null | undefined, maxLength: number = DEFAULT_MAX_LENGTH): string {
  if (!text) {
    return '';
  }
  let result = text;
  for (const rule of SCRUB_RULES) {
    result = result.replace(rule.pattern, `[redacted:${rule.kind}]`);
  }
  return result.length > maxLength ? `${result.slice(0, maxLength)}…` : result;
}

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;

/** The path of a URL without query string, fragment or credentials, with ids replaced by `:id` (low cardinality, no PII). */
export function scrubUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }
  const withoutQuery = url.split(/[?#]/)[0].replace(/^(https?:\/\/)[^/@]*@/i, '$1');
  const [origin, ...segments] = splitOrigin(withoutQuery);
  const path = segments
    .map((segment) => (UUID_SEGMENT.test(segment) || NUMERIC_SEGMENT.test(segment) ? ':id' : scrubPii(segment, 60)))
    .join('/');
  return `${origin}${path}`;
}

function splitOrigin(url: string): string[] {
  const match = /^(https?:\/\/[^/]+)(\/.*)?$/i.exec(url);
  if (!match) {
    return url.startsWith('/') ? ['/', ...url.split('/').slice(1)] : ['', ...url.split('/')];
  }
  return [`${match[1]}/`, ...(match[2] ?? '').split('/').slice(1)];
}

/** The scrubbed, truncated message of anything thrown; never the stack and never the payload attached to the error. */
export function describeError(error: unknown): { type: string; message: string } {
  if (error instanceof Error) {
    return { type: error.name || 'Error', message: scrubPii(error.message) };
  }
  if (typeof error === 'string') {
    return { type: 'string', message: scrubPii(error) };
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    // HttpErrorResponse and alike: the status says what happened, the body may hold personal data and is dropped.
    return { type: 'HttpError', message: `HTTP ${String((error as { status: unknown }).status)}` };
  }
  return { type: typeof error, message: '' };
}
