import { HttpErrorResponse } from '@angular/common/http';
import {
  ESIG_LEVELS,
  EsigAuthMethod,
  EsigEnvelope,
  EsigEnvelopeStatus,
  EsigJurisdiction,
  EsigLevel,
  EsigLookups,
  EsigProblem,
  EsigProvider,
  EsigProviderConfig,
  EsigProviderJurisdiction,
  EsigProviderPayload,
  EsigRecipient,
  EsigRecipientPayload,
  EsigRecipientStatus,
  EsigRole,
  EsigRoutingMode,
  EsigSignableType,
  EsigSignatureBox,
  EsigTemplate,
  EsigTemplatePayload,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): follow and start signature requests. */
export const ESIG_MODULE = 'electronic_signature';

/** Module key of the `configure` ability: provider credentials and compliance templates (owners and administrators). */
export const ESIG_CONFIGURE_MODULE = 'electronic_signature_configure';

/** Statuses in which recipients can still sign. */
export const ESIG_OPEN_STATUSES: readonly EsigEnvelopeStatus[] = ['pending', 'partially_signed'];

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and bind the field errors of a 422. */
export interface EsigOutcome {
  ok: boolean;
  /** Translation key of the refusal (`signatures.error.<code>`), null on success. */
  errorKey: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  errors: Record<string, string[]>;
}

export const ESIG_OK: EsigOutcome = { ok: true, errorKey: null, detail: null, errors: {} };

export function errorKey(code: string | null | undefined): string {
  return `signatures.error.${code ? code : 'generic'}`;
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
export async function problemOf(error: unknown): Promise<EsigProblem | null> {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      return JSON.parse(await readBlobText(body)) as EsigProblem;
    } catch {
      return null;
    }
  }
  return body !== null && typeof body === 'object' ? (body as EsigProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export async function failureOf(error: unknown): Promise<EsigOutcome> {
  const problem = await problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    detail: first ?? null,
    errors,
  };
}

// --- Labels and colours ---

export function levelColor(level: EsigLevel): string {
  switch (level) {
    case 'FEQ':
      return 'purple';
    case 'FEA':
      return 'blue';
    default:
      return 'default';
  }
}

export function envelopeStatusColor(status: EsigEnvelopeStatus): string {
  switch (status) {
    case 'completed':
      return 'green';
    case 'pending':
      return 'blue';
    case 'partially_signed':
      return 'gold';
    case 'declined':
      return 'red';
    case 'expired':
      return 'volcano';
    case 'cancelled':
      return 'default';
    default:
      return 'default';
  }
}

export function recipientStatusColor(status: EsigRecipientStatus): string {
  switch (status) {
    case 'signed':
      return 'green';
    case 'pending':
    case 'viewed':
      return 'blue';
    case 'signing':
      return 'gold';
    case 'declined':
      return 'red';
    default:
      return 'default';
  }
}

export function jurisdictionBadgeKey(jurisdiction: EsigJurisdiction): string {
  return `signatures.jurisdictionBadge.${jurisdiction}`;
}

// --- Envelope helpers ---

export function isOpen(status: EsigEnvelopeStatus): boolean {
  return ESIG_OPEN_STATUSES.includes(status);
}

/** The recipients that have to act (everybody but the copy recipients). */
export function actingRecipients(envelope: Pick<EsigEnvelope, 'recipients'>): EsigRecipient[] {
  return (envelope.recipients ?? []).filter((recipient) => recipient.role !== 'CC_RECIPIENT');
}

export function signersProgress(envelope: Pick<EsigEnvelope, 'recipients'>): {
  signed: number;
  total: number;
} {
  const acting = actingRecipients(envelope);
  return {
    signed: acting.filter((recipient) => recipient.status === 'signed').length,
    total: acting.length,
  };
}

/** Whole days left until a date (negative when it has passed); null without a date. */
export function daysLeft(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) {
    return null;
  }
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}

// --- Levels and providers ---

export function levelRank(level: EsigLevel): number {
  return ESIG_LEVELS.indexOf(level) + 1;
}

export function maxLevel(a: EsigLevel, b: EsigLevel): EsigLevel {
  return levelRank(a) >= levelRank(b) ? a : b;
}

/** The levels the lookups say a provider can issue under a jurisdiction. */
export function levelsOf(
  lookups: EsigLookups | null,
  provider: EsigProvider,
  jurisdiction: EsigJurisdiction,
): EsigLevel[] {
  return lookups?.capabilities[provider]?.[jurisdiction] ?? [];
}

/** Whether a configuration of a company can issue the tier under the jurisdiction. */
export function configCanIssue(
  lookups: EsigLookups | null,
  config: EsigProviderConfig,
  level: EsigLevel,
  jurisdiction: EsigJurisdiction,
): boolean {
  const covers =
    config.jurisdiction === 'BOTH' ||
    (config.jurisdiction === 'CH' && jurisdiction === 'ZertES') ||
    (config.jurisdiction === 'EU' && jurisdiction === 'eIDAS');
  return covers && levelsOf(lookups, config.provider, jurisdiction).includes(level);
}

/** The configurations the wizard offers for a tier and jurisdiction; the built-in engine is always there for FES and FEA. */
export function eligibleConfigs(
  lookups: EsigLookups | null,
  level: EsigLevel,
  jurisdiction: EsigJurisdiction,
): EsigProviderConfig[] {
  return (lookups?.provider_configs ?? []).filter((config) =>
    configCanIssue(lookups, config, level, jurisdiction),
  );
}

// --- Credentials of the providers (the keys the API accepts, see SaveProviderConfigRequest) ---

export interface CredentialField {
  key: string;
  /** Rendered as a password input, never shown again. */
  secret: boolean;
  /** Rendered as a multi-line field (PEM). */
  multiline?: boolean;
}

export const ESIG_CREDENTIAL_FIELDS: Record<EsigProvider, CredentialField[]> = {
  native: [],
  swisscom: [
    { key: 'claimed_identity', secret: false },
    { key: 'claimed_identity_qes', secret: false },
    { key: 'client_certificate', secret: true, multiline: true },
    { key: 'client_key', secret: true, multiline: true },
    { key: 'client_key_password', secret: true },
    { key: 'distinguished_name_suffix', secret: false },
    { key: 'webhook_secret', secret: true },
  ],
  infocert: [
    { key: 'client_id', secret: false },
    { key: 'client_secret', secret: true },
    { key: 'signer_alias', secret: false },
    { key: 'webhook_secret', secret: true },
  ],
  namirial: [
    { key: 'api_key', secret: true },
    { key: 'webhook_secret', secret: true },
  ],
};

// --- Recipients ---

/** E.164: a plus, a country code that does not start with 0 and up to 15 digits. */
export function isE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** A recipient being edited in the wizard. */
export interface DraftRecipient {
  uid: string;
  full_name: string;
  email: string;
  phone: string;
  role: EsigRole;
  signing_order: number;
  auth_method: EsigAuthMethod;
  signature_box: EsigSignatureBox | null;
}

let draftCounter = 0;

export function emptyRecipient(order: number, level: EsigLevel): DraftRecipient {
  draftCounter += 1;
  return {
    uid: `draft-${draftCounter}`,
    full_name: '',
    email: '',
    phone: '',
    role: 'SIGNER',
    signing_order: order,
    auth_method: defaultAuthMethod(level),
    signature_box: null,
  };
}

/** The second factor a tier needs: none for FES, the SMS code for FEA and FEQ. */
export function defaultAuthMethod(level: EsigLevel): EsigAuthMethod {
  return level === 'FES' ? 'email_link' : 'sms_otp';
}

export function needsPhone(recipient: Pick<DraftRecipient, 'role' | 'auth_method'>): boolean {
  return (
    recipient.role !== 'CC_RECIPIENT' &&
    (recipient.auth_method === 'sms_otp' || recipient.auth_method === 'mobile_app')
  );
}

/** Translation keys of what is wrong with the recipients, empty when they can be sent. */
export function recipientProblems(recipients: DraftRecipient[], level: EsigLevel): string[] {
  const problems = new Set<string>();
  const emails = new Set<string>();

  if (!recipients.some((recipient) => recipient.role !== 'CC_RECIPIENT')) {
    problems.add('signatures.error.no_signer');
  }

  for (const recipient of recipients) {
    if (recipient.full_name.trim() === '' || !isEmail(recipient.email.trim())) {
      problems.add('signatures.wizard.problemContact');
    }
    const email = recipient.email.trim().toLowerCase();
    if (emails.has(email)) {
      problems.add('signatures.error.duplicate_recipient');
    }
    emails.add(email);
    if (needsPhone(recipient) && !isE164(recipient.phone.trim())) {
      problems.add('signatures.wizard.problemPhone');
    }
    if (
      recipient.role !== 'CC_RECIPIENT' &&
      level !== 'FES' &&
      recipient.auth_method === 'email_link'
    ) {
      problems.add('signatures.error.strong_authentication_required');
    }
  }

  return [...problems];
}

export function toRecipientPayload(recipient: DraftRecipient): EsigRecipientPayload {
  return {
    full_name: recipient.full_name.trim(),
    email: recipient.email.trim(),
    phone: recipient.phone.trim() === '' ? null : recipient.phone.trim(),
    role: recipient.role,
    signing_order: recipient.signing_order,
    auth_method: recipient.auth_method,
    signature_box: recipient.role === 'CC_RECIPIENT' ? null : recipient.signature_box,
  };
}

// --- Signature boxes (fractions of the page) ---

export const DEFAULT_BOX_WIDTH = 0.28;
export const DEFAULT_BOX_HEIGHT = 0.08;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** A box of the default size centred on the point (fractions of the page), kept inside the page. */
export function boxAt(page: number, centerX: number, centerY: number): EsigSignatureBox {
  const width = DEFAULT_BOX_WIDTH;
  const height = DEFAULT_BOX_HEIGHT;
  return {
    page,
    x: clamp(centerX - width / 2, 0, 1 - width),
    y: clamp(centerY - height / 2, 0, 1 - height),
    width,
    height,
  };
}

/** The same box moved by a delta (fractions), kept inside the page. */
export function moveBox(box: EsigSignatureBox, deltaX: number, deltaY: number): EsigSignatureBox {
  return {
    ...box,
    x: clamp(box.x + deltaX, 0, 1 - box.width),
    y: clamp(box.y + deltaY, 0, 1 - box.height),
  };
}

/** The same box with a new size, kept inside the page. */
export function resizeBox(box: EsigSignatureBox, width: number, height: number): EsigSignatureBox {
  const w = clamp(width, 0.05, 1);
  const h = clamp(height, 0.03, 1);
  return { ...box, width: w, height: h, x: clamp(box.x, 0, 1 - w), y: clamp(box.y, 0, 1 - h) };
}

// --- Files ---

/** SHA-256 of a file as lower-case hex, computed in the browser: the file does not leave it. */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Offers a blob to the user as a download. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** The path of the signed or original file as the user will see it named. */
export function downloadName(envelope: Pick<EsigEnvelope, 'title'>, suffix: string): string {
  const slug = envelope.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'document'}${suffix}`;
}

/** The identity checks each provider offers a signer, by tier. */
export function authMethodsFor(provider: EsigProvider, level: EsigLevel): EsigAuthMethod[] {
  if (level === 'FES') {
    return provider === 'native' || provider === 'namirial'
      ? ['email_link', 'sms_otp']
      : ['sms_otp'];
  }
  switch (provider) {
    case 'native':
      return ['sms_otp'];
    case 'swisscom':
      return ['sms_otp', 'mobile_app', 'swiss_id'];
    case 'infocert':
      return ['sms_otp', 'mobile_app', 'spid_cie'];
    default:
      return ['sms_otp', 'mobile_app'];
  }
}

// --- Settings forms ---

export interface ProviderFormValue {
  provider: EsigProvider;
  jurisdiction: EsigProviderJurisdiction;
  name: string;
  is_sandbox: boolean;
  is_active: boolean;
  is_default: boolean;
  credentials: Record<string, string>;
  base_url: string;
  certificate: File | null;
  certificate_password: string;
}

export const DEFAULT_PROVIDER_FORM: ProviderFormValue = {
  provider: 'native',
  jurisdiction: 'BOTH',
  name: '',
  is_sandbox: true,
  is_active: true,
  is_default: false,
  credentials: {},
  base_url: '',
  certificate: null,
  certificate_password: '',
};

export function providerFormOf(config: EsigProviderConfig | null): ProviderFormValue {
  if (config === null) {
    return { ...DEFAULT_PROVIDER_FORM, credentials: {} };
  }
  return {
    provider: config.provider,
    jurisdiction: config.jurisdiction,
    name: config.name,
    is_sandbox: config.is_sandbox,
    is_active: config.is_active,
    is_default: config.is_default,
    // The stored values never come back: a field left empty keeps its secret.
    credentials: {},
    base_url: config.settings?.base_url ?? '',
    certificate: null,
    certificate_password: '',
  };
}

export function isProviderFormValid(form: ProviderFormValue): boolean {
  return form.name.trim() !== '' && (form.certificate === null || form.certificate_password !== '');
}

export function providerPayloadOf(form: ProviderFormValue): EsigProviderPayload {
  const allowed = new Set(ESIG_CREDENTIAL_FIELDS[form.provider].map((field) => field.key));
  const credentials = Object.fromEntries(
    Object.entries(form.credentials).filter(
      ([key, value]) => allowed.has(key) && value.trim() !== '',
    ),
  );
  return {
    provider: form.provider,
    jurisdiction: form.jurisdiction,
    name: form.name.trim(),
    is_sandbox: form.is_sandbox,
    is_active: form.is_active,
    is_default: form.is_default,
    credentials,
    settings: form.base_url.trim() === '' ? null : { base_url: form.base_url.trim() },
    certificate: form.certificate,
    certificate_password: form.certificate === null ? null : form.certificate_password,
  };
}

export interface TemplateFormValue {
  name: string;
  document_type: EsigSignableType;
  required_level: EsigLevel;
  jurisdiction: EsigJurisdiction;
  provider_config_id: string | null;
  routing_mode: EsigRoutingMode;
  expiration_days: number;
  reminder_days: number[];
  min_amount: number | null;
  amount_currency: 'CHF' | 'EUR';
  is_active: boolean;
}

export const DEFAULT_TEMPLATE_FORM: TemplateFormValue = {
  name: '',
  document_type: 'quote',
  required_level: 'FES',
  jurisdiction: 'eIDAS',
  provider_config_id: null,
  routing_mode: 'sequential',
  expiration_days: 14,
  reminder_days: [3, 1],
  min_amount: null,
  amount_currency: 'EUR',
  is_active: true,
};

export function templateFormOf(template: EsigTemplate | null): TemplateFormValue {
  if (template === null) {
    return { ...DEFAULT_TEMPLATE_FORM, reminder_days: [...DEFAULT_TEMPLATE_FORM.reminder_days] };
  }
  return {
    name: template.name,
    document_type: template.document_type,
    required_level: template.required_level,
    jurisdiction: template.jurisdiction,
    provider_config_id: template.provider_config_id,
    routing_mode: template.routing_mode,
    expiration_days: template.expiration_days,
    reminder_days: [...template.reminder_days],
    min_amount: template.min_amount === null ? null : Number(template.min_amount),
    amount_currency: template.amount_currency ?? 'EUR',
    is_active: template.is_active,
  };
}

export function isTemplateFormValid(form: TemplateFormValue): boolean {
  return (
    form.name.trim() !== '' &&
    form.expiration_days >= 1 &&
    form.expiration_days <= 90 &&
    (form.min_amount === null || form.min_amount >= 0)
  );
}

export function templatePayloadOf(form: TemplateFormValue): EsigTemplatePayload {
  return {
    name: form.name.trim(),
    document_type: form.document_type,
    required_level: form.required_level,
    jurisdiction: form.jurisdiction,
    provider_config_id: form.provider_config_id,
    routing_mode: form.routing_mode,
    expiration_days: form.expiration_days,
    reminder_days: [...form.reminder_days].sort((a, b) => b - a),
    min_amount: form.min_amount === null ? null : form.min_amount.toFixed(2),
    amount_currency: form.min_amount === null ? null : form.amount_currency,
    is_active: form.is_active,
  };
}
