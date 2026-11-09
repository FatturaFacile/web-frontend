import { inject, Service, signal } from '@angular/core';
import { ChartAccountDetail, Dimension, GeneralLedgerApiService } from '@core';

/** Cached lookups (accounts, cost centres, profit centres) shared by the general ledger pages. */
@Service()
export class GlLookupStore {
  private readonly api = inject(GeneralLedgerApiService);

  readonly accounts = signal<ChartAccountDetail[]>([]);
  readonly costCenters = signal<Dimension[]>([]);
  readonly profitCenters = signal<Dimension[]>([]);
  private loaded = false;

  load(force = false): void {
    if (this.loaded && !force) {
      return;
    }
    this.loaded = true;
    this.api.getAccountList({ per_page: 500 }).subscribe({
      next: (res) => this.accounts.set(res.data ?? []),
      error: () => (this.loaded = false),
    });
    this.api.getCostCenters().subscribe({ next: (res) => this.costCenters.set(res.data ?? []) });
    this.api.getProfitCenters().subscribe({ next: (res) => this.profitCenters.set(res.data ?? []) });
  }

  accountLabel(id: string | null | undefined): string {
    const account = this.accounts().find((a) => a.id === id);
    return account ? `${account.account_code ?? ''} ${account.name}`.trim() : (id ?? '');
  }
}
