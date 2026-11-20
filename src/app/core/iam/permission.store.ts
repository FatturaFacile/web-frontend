import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { environment } from '@env';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import type { ApiResponse } from '../models';
import type { FieldPolicyEntry, FieldVisibility, PermissionSnapshot } from './iam.models';

const RANK: Record<FieldVisibility, number> = { visible: 0, masked: 1, hidden: 2 };

/**
 * The effective permissions and field policies of the signed-in user (`GET /profile/permissions`), as signals.
 * Authorization is deny-by-default: until the snapshot is loaded nothing is allowed, and a `403 permission_denied`
 * invalidates it (see iamErrorInterceptor) so the next check reloads the truth from the API.
 */
@Injectable({ providedIn: 'root' })
export class PermissionStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);

  private readonly state = signal<PermissionSnapshot | null>(null);
  private inflight: Promise<void> | null = null;
  private generation = 0;

  constructor() {
    // A new session or another company means another set of permissions: drop the snapshot and load the new one.
    effect(() => {
      const authenticated = this.auth.isAuthenticated();
      this.auth.activeTenantId();
      untracked(() => {
        this.invalidate();
        if (authenticated) {
          void this.load(true);
        }
      });
    });
  }

  readonly loaded = computed(() => this.state() !== null);
  readonly permissions = computed(() => this.state()?.permissions ?? []);
  readonly fieldPolicies = computed(() => this.state()?.field_policies ?? []);

  /** `*` and `module.*` grant, as on the server. Unknown or unloaded: denied. */
  hasPermission(key: string): boolean {
    const granted = this.permissions();
    if (granted.includes('*') || granted.includes(key)) {
      return true;
    }
    const module = key.split('.')[0];
    return granted.includes(`${module}.*`);
  }

  hasAnyPermission(keys: readonly string[]): boolean {
    return keys.some((key) => this.hasPermission(key));
  }

  /** The most restrictive visibility the policies of the roles give the field. */
  fieldVisibility(resource: string, field: string): FieldVisibility {
    let result: FieldVisibility = 'visible';
    for (const policy of this.fieldPolicies()) {
      if (policy.resource === resource && policy.field === field && RANK[policy.visibility] > RANK[result]) {
        result = policy.visibility;
      }
    }
    return result;
  }

  isFieldMasked(resource: string, field: string): boolean {
    return this.fieldVisibility(resource, field) === 'masked';
  }

  isFieldHidden(resource: string, field: string): boolean {
    return this.fieldVisibility(resource, field) === 'hidden';
  }

  policyFor(resource: string, field: string): FieldPolicyEntry | undefined {
    return this.fieldPolicies().find((p) => p.resource === resource && p.field === field);
  }

  /**
   * Loads the snapshot once (concurrent callers share the request). A forced load always starts a new request, and the
   * answer of a request that a newer one replaced is ignored, so a company switch never shows the old company's rights.
   */
  load(force = false): Promise<void> {
    if (!force && this.state() !== null) {
      return Promise.resolve();
    }
    if (!force && this.inflight) {
      return this.inflight;
    }
    const generation = ++this.generation;
    const request: Promise<void> = firstValueFrom(
      this.http.get<ApiResponse<PermissionSnapshot>>(`${environment.apiBaseUrl}/profile/permissions`),
    )
      .then((response) => {
        if (generation === this.generation) {
          this.state.set(response.data);
        }
      })
      .catch(() => {
        if (generation === this.generation) {
          this.state.set(null);
        }
      })
      .finally(() => {
        if (this.inflight === request) {
          this.inflight = null;
        }
      });
    this.inflight = request;
    return request;
  }

  /** Forgets the snapshot (tenant switch, logout, `permission_denied`). */
  invalidate(): void {
    this.state.set(null);
  }

  /** Forgets the snapshot and loads it again. */
  reload(): Promise<void> {
    this.invalidate();
    return this.load(true);
  }
}
