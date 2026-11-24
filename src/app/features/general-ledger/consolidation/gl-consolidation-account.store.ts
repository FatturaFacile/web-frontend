import { inject, Service, signal } from '@angular/core';
import { ChartAccountDetail, GeneralLedgerConsolidationApiService } from '@core';

/** Charts of accounts of the entities of a group, loaded on demand: a mapping or an intragroup entry names accounts of a member. */
@Service()
export class GlConsolidationAccountStore {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly requested = new Set<string>();

  readonly byTenant = signal<Record<string, ChartAccountDetail[]>>({});

  load(tenantId: string | null | undefined): void {
    if (!tenantId || this.requested.has(tenantId)) {
      return;
    }
    this.requested.add(tenantId);
    this.api.getMemberAccounts(tenantId).subscribe({
      next: (res) => this.byTenant.update((current) => ({ ...current, [tenantId]: res.data ?? [] })),
      error: () => this.requested.delete(tenantId),
    });
  }

  accountsOf(tenantId: string | null | undefined): ChartAccountDetail[] {
    return tenantId ? (this.byTenant()[tenantId] ?? []) : [];
  }

  label(tenantId: string | null | undefined, accountId: string | null | undefined): string {
    const account = this.accountsOf(tenantId).find((candidate) => candidate.id === accountId);
    return account ? `${account.account_code ?? ''} ${account.name}`.trim() : (accountId ?? '');
  }
}
