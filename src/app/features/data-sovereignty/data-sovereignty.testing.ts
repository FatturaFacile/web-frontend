import { ComponentFixture } from '@angular/core/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { icons } from '../../icons-provider';
import {
  AuditEntry,
  Envelope,
  KeyEnvelope,
  KeyEnvelopeResource,
  NodeCoordinates,
  SovereigntyDashboard,
  SovereigntyScope,
  TransferRule,
} from './data-sovereignty.models';

export const ok = <T>(data: T, meta?: Record<string, unknown>) =>
  of<Envelope<T>>({ success: true, message: '', data, meta });

export const q = (fixture: ComponentFixture<unknown>, selector: string): HTMLElement | null =>
  (fixture.nativeElement as HTMLElement).querySelector(selector);
export const all = (fixture: ComponentFixture<unknown>, selector: string): HTMLElement[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector));
export const byId = (fixture: ComponentFixture<unknown>, id: string): HTMLElement | null =>
  q(fixture, `[data-testid="${id}"]`);
/** Modals and drawers render in the overlay container, outside the fixture. */
export const inBody = (id: string): HTMLElement | null =>
  document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);

export async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

export function baseProviders(overrides: unknown[] = []): unknown[] {
  return [provideNzIcons(icons), provideNzI18n(en_US), provideNzDateFnsAdapter(), ...overrides];
}

const certifications = (country: string): string[] =>
  country === 'CH' ? ['ISO-27001', 'FINMA-2018-3'] : ['ISO-27001', 'ACN-QC2'];

export function node(
  code: string,
  city: string,
  region: string,
  country: string,
  latitude: number,
  longitude: number,
): NodeCoordinates {
  return {
    node_code: code,
    region_code: region,
    country_iso2: country,
    canton_or_region: region,
    city,
    provider_name: 'FatturaFacile Sovereign Cloud',
    certifications: certifications(country),
    latitude,
    longitude,
  };
}

export function scope(
  overrides: Partial<SovereigntyScope> & { site: 'lug' | 'mil' },
): SovereigntyScope {
  const swiss = overrides.site === 'lug';
  const make = (suffix: string): NodeCoordinates =>
    swiss
      ? node(`ch-lug-${suffix}`, 'Lugano', 'TI', 'CH', 46.0036778, 8.9510711)
      : node(`it-mil-${suffix}`, 'Milan', 'Lombardia', 'IT', 45.4642035, 9.1899817);

  return {
    policy_id: `policy-${overrides.site}`,
    scope_type: 'LEGAL_ENTITY_OVERRIDE',
    legal_entity_id: `entity-${overrides.site}`,
    legal_entity_name: swiss ? 'Lugano Holding SA' : 'Milano S.r.l.',
    legal_entity_country: swiss ? 'CH' : 'IT',
    jurisdiction_zone: swiss ? 'Strict-CH-Only' : 'Strict-IT-Only',
    compliance_frameworks: swiss
      ? ['nLPD Art. 16-17', 'FINMA Circ. 2018/3']
      : ['GDPR Art. 44-50', 'ACN/AgID'],
    locked: true,
    enforce_strict_egress_block: true,
    aggregated_non_pii_consolidation: true,
    key_envelope_id: null,
    nodes: {
      postgres_primary: make('01'),
      postgres_replicas: [make('02')],
      s3_dms: make('s3-01'),
      pgvector: make('vec-01'),
      ai_inference: make('ai-01'),
      backup_vault: make('bkp-01'),
      queue_broker: make('q-01'),
    },
    ...overrides,
  };
}

export function envelope(overrides: Partial<KeyEnvelope> = {}): KeyEnvelope {
  return {
    id: 'env-1',
    legal_entity_id: null,
    mode: 'BYOK',
    provider: 'SECUROSYS_PRIMUS_HSM',
    status: 'ACTIVE',
    key_version: 'v1',
    dek_cache_ttl_seconds: 300,
    rotation_interval_days: 90,
    last_rotated_at: '2026-11-01T10:00:00Z',
    next_rotation_due_at: '2027-01-30T10:00:00Z',
    rotation_due: false,
    revoked_at: null,
    kms_health: 'HEALTHY',
    last_kms_access_at: '2026-11-20T10:00:00Z',
    ...overrides,
  };
}

export function resource(overrides: Partial<KeyEnvelopeResource> = {}): KeyEnvelopeResource {
  return {
    id: 'env-1',
    legal_entity_id: null,
    mode: 'BYOK',
    provider_type: 'SECUROSYS_PRIMUS_HSM',
    external_key_uri: 'https://hsm.example.ch/v1/keys/ff',
    current_key_version: 'v2',
    status: 'ACTIVE',
    dek_cache_ttl_seconds: 300,
    rotation_interval_days: 90,
    last_rotated_at: '2026-11-21T10:00:00Z',
    next_rotation_due_at: '2027-02-19T10:00:00Z',
    revoked_at: null,
    revocation_reason: null,
    ...overrides,
  };
}

export function audit(operation: string, outcome = 'SUCCESS', id = operation): AuditEntry {
  return {
    id,
    operation,
    key_version: 'v1',
    outcome,
    latency_ms: 12,
    source_node_code: 'app-01',
    occurred_at: '2026-11-21T09:00:00Z',
  };
}

export function dashboardFixture(
  overrides: Partial<SovereigntyDashboard> = {},
): SovereigntyDashboard {
  return {
    scopes: [scope({ site: 'lug' }), scope({ site: 'mil' })],
    key_envelopes: [envelope()],
    kms_audit: {
      chain: { valid: true, checked: 2, broken_at: null },
      recent: [audit('UNWRAP_DEK'), audit('CACHE_HIT')],
    },
    egress_firewall: {
      blocked_last_30_days: 3,
      recent_blocked: [
        {
          id: 'b1',
          destination_country_iso2: 'US',
          purpose: 'webhook',
          target: 'https://hooks.example.us/x',
          reason: 'Transfer to US is BLOCKED under Strict-CH-Only.',
          occurred_at: '2026-11-20T08:00:00Z',
        },
      ],
    },
    ...overrides,
  };
}

export function ruleFixtures(): TransferRule[] {
  const rule = (
    zone: TransferRule['source_jurisdiction'],
    iso: string,
    name: string,
    ch: boolean,
    eu: boolean,
  ): TransferRule => ({
    id: `${zone}-${iso}`,
    is_statutory_baseline: true,
    source_jurisdiction: zone,
    destination_country_iso2: iso,
    destination_country_name: name,
    has_ch_adequacy: ch,
    has_eu_adequacy: eu,
    decision_status: (zone === 'Strict-CH-Only' ? ch : eu) ? 'ALLOWED' : 'BLOCKED',
    legal_basis_reference:
      zone === 'Strict-CH-Only' ? 'Art. 16 Abs. 1 nLPD / Annex 1 DSV' : 'GDPR Art. 45',
  });

  return [
    rule('Strict-CH-Only', 'DE', 'Germany', true, true),
    rule('Strict-CH-Only', 'US', 'United States', false, false),
    rule('Strict-IT-Only', 'CH', 'Switzerland', true, true),
    rule('Strict-IT-Only', 'CN', 'China', false, false),
  ];
}
