import { computed, inject, Service, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { DataSovereigntyApiService } from './data-sovereignty-api.service';
import {
  AttestationBundle,
  AuditEntry,
  ByokConfiguration,
  ChainCheck,
  Handshake,
  KeyEnvelope,
  KeyEnvelopeResource,
  KillSwitchRequest,
  NodeCoordinates,
  SovereignNode,
  SovereigntyDashboard,
  SovereigntyScope,
  TransferRule,
  TransferVerdict,
} from './data-sovereignty.models';

/** A site of the map: every service of a policy that sits in the same data center. */
export interface MapSite {
  key: string;
  city: string;
  region: string;
  country: string;
  provider: string;
  latitude: number;
  longitude: number;
  certifications: string[];
  services: string[];
  healthy: boolean;
}

const SERVICE_KEYS: (keyof SovereigntyScope['nodes'])[] = [
  'postgres_primary',
  'postgres_replicas',
  's3_dms',
  'pgvector',
  'ai_inference',
  'backup_vault',
  'queue_broker',
];

/**
 * Signal state of the data sovereignty area: the posture of the tenant (geo-sharding per legal entity, key envelopes, KMS
 * audit, blocked egress), the node catalogue, the adequacy matrix and the outcome of the last actions. Every action returns
 * the observable already wired to the signals, so a component only subscribes and tells the user what happened.
 */
@Service()
export class DataSovereigntyStore {
  private readonly api = inject(DataSovereigntyApiService);

  readonly dashboard = signal<SovereigntyDashboard | null>(null);
  readonly nodes = signal<SovereignNode[]>([]);
  readonly auditEntries = signal<AuditEntry[]>([]);
  readonly auditChain = signal<ChainCheck | null>(null);
  readonly auditOperation = signal<string | null>(null);
  readonly rules = signal<TransferRule[]>([]);
  readonly verdict = signal<TransferVerdict | null>(null);
  readonly attestation = signal<AttestationBundle | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly failed = signal(false);

  readonly scopes = computed(() => this.dashboard()?.scopes ?? []);
  readonly envelopes = computed(() => this.dashboard()?.key_envelopes ?? []);
  readonly blockedAttempts = computed(() => this.dashboard()?.egress_firewall.recent_blocked ?? []);
  readonly blockedLast30Days = computed(
    () => this.dashboard()?.egress_firewall.blocked_last_30_days ?? 0,
  );

  /** The zone of the tenant default, or of the first entity when there is no default. */
  readonly primaryScope = computed<SovereigntyScope | null>(
    () =>
      this.scopes().find((scope) => scope.scope_type === 'TENANT_DEFAULT') ??
      this.scopes()[0] ??
      null,
  );

  /** The envelope that protects the data of the tenant default, or the first one. */
  readonly primaryEnvelope = computed<KeyEnvelope | null>(
    () =>
      this.envelopes().find((envelope) => envelope.legal_entity_id === null) ??
      this.envelopes()[0] ??
      null,
  );

  readonly isLocked = computed(() =>
    this.envelopes().some(
      (envelope) =>
        envelope.status === 'SUSPENDED' || envelope.status === 'REVOKED_CRYPTO_SHREDDED',
    ),
  );

  /** Distinct data centers across every scope, with the services they host, for the map. */
  readonly sites = computed<MapSite[]>(() => {
    const sites = new Map<string, MapSite>();
    const healthy = !this.isLocked();

    for (const scope of this.scopes()) {
      for (const key of SERVICE_KEYS) {
        const value = scope.nodes[key];
        const nodes: NodeCoordinates[] = Array.isArray(value) ? value : [value];

        for (const node of nodes) {
          if (node.latitude === null || node.longitude === null) {
            continue;
          }

          const siteKey = `${node.country_iso2}-${node.city}`;
          const site = sites.get(siteKey) ?? {
            key: siteKey,
            city: node.city,
            region: node.canton_or_region,
            country: node.country_iso2,
            provider: node.provider_name,
            latitude: node.latitude,
            longitude: node.longitude,
            certifications: node.certifications,
            services: [],
            healthy,
          };

          if (!site.services.includes(key)) {
            site.services.push(key);
          }

          sites.set(siteKey, site);
        }
      }
    }

    return [...sites.values()];
  });

  loadDashboard(): Observable<SovereigntyDashboard | null> {
    this.loading.set(true);
    this.failed.set(false);

    return this.api.dashboard().pipe(
      map((response) => response.data),
      tap((dashboard) => {
        this.dashboard.set(dashboard);
        this.auditEntries.set(dashboard.kms_audit.recent);
        this.auditChain.set(dashboard.kms_audit.chain);
      }),
      catchError(() => {
        this.failed.set(true);

        return of(null);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  loadNodes(): Observable<SovereignNode[]> {
    return this.api.nodes().pipe(
      map((response) => response.data),
      tap((nodes) => this.nodes.set(nodes)),
    );
  }

  loadAudit(operation: string | null): Observable<AuditEntry[]> {
    this.auditOperation.set(operation);

    return this.api.auditLogs({ operation, perPage: 50 }).pipe(
      tap((response) => {
        this.auditEntries.set(response.data);
        this.auditChain.set((response.meta?.['chain'] as ChainCheck | undefined) ?? null);
      }),
      map((response) => response.data),
    );
  }

  loadRules(): Observable<TransferRule[]> {
    return this.api.rules().pipe(
      map((response) => response.data),
      tap((rules) => this.rules.set(rules)),
    );
  }

  validateTransfer(request: {
    purpose: string;
    target: string;
    destination_country_iso2?: string | null;
  }): Observable<TransferVerdict> {
    this.busy.set(true);

    return this.api.validateTransfer(request).pipe(
      map((response) => response.data),
      tap((verdict) => this.verdict.set(verdict)),
      finalize(() => this.busy.set(false)),
    );
  }

  /** Tests the HSM handshake without storing anything. */
  testHandshake(configuration: ByokConfiguration): Observable<Handshake> {
    this.busy.set(true);

    return this.api.configureByok({ ...configuration, dry_run: true }).pipe(
      map((response) => response.data.handshake),
      finalize(() => this.busy.set(false)),
    );
  }

  configure(configuration: ByokConfiguration): Observable<KeyEnvelopeResource | null> {
    this.busy.set(true);

    return this.api.configureByok({ ...configuration, dry_run: false }).pipe(
      map((response) => response.data.envelope),
      finalize(() => this.busy.set(false)),
    );
  }

  rotate(envelopeId: string): Observable<KeyEnvelopeResource> {
    this.busy.set(true);

    return this.api.rotate(envelopeId).pipe(
      map((response) => response.data),
      tap((envelope) => this.replaceEnvelope(envelope)),
      finalize(() => this.busy.set(false)),
    );
  }

  killSwitch(envelopeId: string, request: KillSwitchRequest): Observable<KeyEnvelopeResource> {
    this.busy.set(true);

    return this.api.killSwitch(envelopeId, request).pipe(
      map((response) => response.data),
      tap((envelope) => this.replaceEnvelope(envelope)),
      finalize(() => this.busy.set(false)),
    );
  }

  generateAttestation(legalEntityId?: string | null): Observable<AttestationBundle> {
    this.busy.set(true);

    return this.api.generateAttestation(legalEntityId).pipe(
      map((response) => response.data),
      tap((attestation) => this.attestation.set(attestation)),
      finalize(() => this.busy.set(false)),
    );
  }

  private replaceEnvelope(updated: KeyEnvelopeResource): void {
    this.dashboard.update((dashboard) => {
      if (dashboard === null) {
        return dashboard;
      }

      return {
        ...dashboard,
        key_envelopes: dashboard.key_envelopes.map((envelope) =>
          envelope.id === updated.id
            ? {
                ...envelope,
                status: updated.status,
                key_version: updated.current_key_version,
                dek_cache_ttl_seconds: updated.dek_cache_ttl_seconds,
                last_rotated_at: updated.last_rotated_at,
                next_rotation_due_at: updated.next_rotation_due_at,
                revoked_at: updated.revoked_at,
                rotation_due: false,
              }
            : envelope,
        ),
      };
    });
  }
}
