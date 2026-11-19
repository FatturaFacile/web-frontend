import { BatchStatus, PreservationAuditLog } from './digital-preservation.models';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
}

/** Escapes the XML and wraps tags, attributes, values and comments in classed spans (all input stays escaped). */
export function highlightXml(xml: string): string {
  return escapeHtml(xml)
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="x-comment">$1</span>')
    .replace(
      /(&lt;\/?)([\w:.-]+)((?:\s+[\w:.-]+=&quot;[^&]*?&quot;)*)\s*(\/?&gt;)/g,
      (_m, open: string, name: string, attrs: string, close: string) => {
        const styled = attrs.replace(
          /([\w:.-]+)=(&quot;[^&]*?&quot;)/g,
          '<span class="x-attr">$1</span>=<span class="x-value">$2</span>',
        );
        return `<span class="x-tag">${open}${name}</span>${styled}<span class="x-tag">${close}</span>`;
      },
    );
}

/** First and last characters of a SHA-256 digest, for tables. */
export function shortHash(hash: string | null | undefined, head = 8, tail = 6): string {
  if (!hash) {
    return '';
  }
  return hash.length <= head + tail + 1 ? hash : `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

const STEPS: readonly BatchStatus[] = ['draft', 'sealed', 'timestamped', 'dispatched', 'confirmed'];

/** Index of the status in the lifecycle (draft → confirmed); `failed` and unknown values give -1. */
export function lifecycleIndex(status: BatchStatus): number {
  return STEPS.indexOf(status);
}

export const LIFECYCLE_STEPS = STEPS;

export function statusColor(status: BatchStatus): string {
  switch (status) {
    case 'confirmed':
      return 'green';
    case 'dispatched':
      return 'blue';
    case 'timestamped':
      return 'geekblue';
    case 'sealed':
      return 'cyan';
    case 'failed':
      return 'red';
    default:
      return 'default';
  }
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV of the audit trail rows (the details column is JSON). */
export function auditLogsToCsv(logs: readonly PreservationAuditLog[]): string {
  const header = [
    'sequence',
    'created_at',
    'action',
    'actor_id',
    'batch_id',
    'item_id',
    'ip_address',
    'entry_sha256',
    'previous_log_sha256',
    'details',
  ];
  const rows = logs.map((log) =>
    [
      log.sequence,
      log.created_at,
      log.action,
      log.actor_id,
      log.preservation_batch_id,
      log.preservation_item_id,
      log.ip_address,
      log.entry_sha256,
      log.previous_log_sha256,
      JSON.stringify(log.details),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

/** Local calendar date as `YYYY-MM-DD` (the API takes plain dates). */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The `message` of an API error body, or the fallback. */
export function apiMessage(error: unknown, fallback: string): string {
  const body = (error as { error?: { message?: unknown } } | null)?.error;
  return typeof body?.message === 'string' && body.message !== '' ? body.message : fallback;
}
