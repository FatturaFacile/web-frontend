import {
  CRYPTO_SHRED_PHRASE,
  JurisdictionZone,
  KeyEnvelopeStatus,
  KILL_SWITCH_PHRASE,
  KillSwitchAction,
  KmsHealth,
  KmsProviderType,
  TransferDecision,
} from './data-sovereignty.models';

/** The credential fields each KMS/HSM provider needs; the secrets are sent once and never read back. */
export const PROVIDER_CREDENTIAL_FIELDS: Record<Exclude<KmsProviderType, 'PLATFORM'>, string[]> = {
  SECUROSYS_PRIMUS_HSM: ['bearer_token', 'country_iso2'],
  AWS_KMS: ['access_key_id', 'secret_access_key', 'session_token'],
  AZURE_KEY_VAULT: ['access_token', 'region'],
  GOOGLE_CLOUD_EKM: ['access_token'],
  HASHICORP_VAULT: ['token', 'namespace', 'country_iso2'],
  KMIP_GENERIC: ['bearer_token', 'country_iso2'],
};

/** Credential fields that hold a secret and must be typed in a masked input. */
export const SECRET_CREDENTIAL_FIELDS = new Set([
  'bearer_token',
  'secret_access_key',
  'session_token',
  'access_token',
  'token',
]);

export function zoneColor(zone: JurisdictionZone): string {
  switch (zone) {
    case 'Strict-CH-Only':
      return 'red';
    case 'Strict-IT-Only':
      return 'green';
    default:
      return 'blue';
  }
}

export function zoneKey(zone: JurisdictionZone): string {
  switch (zone) {
    case 'Strict-CH-Only':
      return 'DATA_SOVEREIGNTY.ZONE_CH';
    case 'Strict-IT-Only':
      return 'DATA_SOVEREIGNTY.ZONE_IT';
    default:
      return 'DATA_SOVEREIGNTY.ZONE_EEA';
  }
}

export function statusKey(status: KeyEnvelopeStatus): string {
  return `DATA_SOVEREIGNTY.STATUS_${status}`;
}

export function statusColor(status: KeyEnvelopeStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'ROTATING':
      return 'processing';
    case 'SUSPENDED':
      return 'warning';
    default:
      return 'error';
  }
}

export function healthKey(health: KmsHealth): string {
  return `DATA_SOVEREIGNTY.HEALTH_${health}`;
}

export function healthColor(health: KmsHealth): string {
  return health === 'HEALTHY' ? 'success' : health === 'DEGRADED' ? 'error' : 'default';
}

export function decisionKey(decision: TransferDecision): string {
  return `DATA_SOVEREIGNTY.DECISION_${decision}`;
}

export function decisionColor(decision: TransferDecision): string {
  return decision === 'ALLOWED' ? 'success' : decision === 'BLOCKED' ? 'error' : 'warning';
}

export function providerKey(provider: KmsProviderType): string {
  return `DATA_SOVEREIGNTY.PROVIDER_${provider}`;
}

export function serviceKey(service: string): string {
  return `DATA_SOVEREIGNTY.SERVICE_${service.toUpperCase()}`;
}

export function operationKey(operation: string): string {
  return `DATA_SOVEREIGNTY.OP_${operation}`;
}

export function outcomeColor(outcome: string): string {
  return outcome === 'SUCCESS' ? 'success' : 'error';
}

/** The phrase a user has to type to confirm the kill-switch action. */
export function confirmationPhrase(action: KillSwitchAction): string {
  return action === 'CRYPTO_SHRED' ? CRYPTO_SHRED_PHRASE : KILL_SWITCH_PHRASE;
}

/** Whether the kill-switch form may be submitted: exact phrase, a six-digit code and a real reason. */
export function canConfirmKillSwitch(
  action: KillSwitchAction,
  phrase: string,
  mfaCode: string,
  reason: string,
): boolean {
  return (
    phrase.trim() === confirmationPhrase(action) &&
    /^\d{6}$/.test(mfaCode.trim()) &&
    reason.trim().length >= 10
  );
}

/** Lat/lon to the SVG space of the map (lon 5 to 19.5, lat 36 to 48.5), with latitude scaled for the projection. */
export function project(latitude: number, longitude: number): { x: number; y: number } {
  return { x: ((longitude - 5) / 14.5) * 520, y: ((48.5 - latitude) / 12.5) * 600 };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
