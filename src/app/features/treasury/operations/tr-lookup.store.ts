import { inject, Service, signal } from '@angular/core';
import { BankAccountResource, TreasuryApiService } from '@core';

/** Cached bank accounts shared by the treasury operations pages. */
@Service()
export class TrLookupStore {
  private readonly api = inject(TreasuryApiService);
  readonly bankAccounts = signal<BankAccountResource[]>([]);
  private loaded = false;

  load(force = false): void {
    if (this.loaded && !force) {
      return;
    }
    this.loaded = true;
    this.api.getBankAccounts().subscribe({
      next: (res) => this.bankAccounts.set(res.data ?? []),
      error: () => (this.loaded = false),
    });
  }

  label(id: string | null | undefined): string {
    const account = this.bankAccounts().find((a) => a.id === id);
    return account ? `${account.bank_name} ${account.iban}` : (id ?? '');
  }
}
