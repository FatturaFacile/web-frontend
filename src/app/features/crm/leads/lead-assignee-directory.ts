import { inject, Service, signal } from '@angular/core';
import { SettingsApiService, UserResource } from '@core';

/**
 * Tenant users used as lead assignees, loaded once from the existing
 * `settings/users` endpoint. When that endpoint is not reachable (e.g. 403
 * for non-admin users) `available` stays false and pickers fall back to a
 * free-text user id.
 */
@Service()
export class LeadAssigneeDirectory {
  private readonly api = inject(SettingsApiService);

  readonly users = signal<UserResource[]>([]);
  readonly available = signal(false);
  readonly loaded = signal(false);
  private requested = false;

  load(): void {
    if (this.requested) {
      return;
    }
    this.requested = true;
    this.api.getTenantUsers().subscribe({
      next: (res) => {
        const data = (res as { data?: unknown })?.data ?? res;
        const users = Array.isArray(data) ? (data as UserResource[]) : [];
        this.users.set(users.filter((u) => u.is_active !== false));
        this.available.set(true);
        this.loaded.set(true);
      },
      error: () => {
        this.available.set(false);
        this.loaded.set(true);
      },
    });
  }

  nameOf(id: string | null | undefined): string {
    if (!id) {
      return '';
    }
    return this.users().find((u) => u.id === id)?.name ?? id;
  }
}
