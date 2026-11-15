import { inject, Service, signal } from '@angular/core';
import { GeneralLedgerApiService, GlFiscalPeriod } from '@core';

export interface GlConsolidationPeriodOption {
  id: string;
  label: string;
}

/** Fiscal periods of the parent entity: a consolidation run or reconciliation is made for one of them. */
@Service()
export class GlConsolidationPeriodStore {
  private readonly api = inject(GeneralLedgerApiService);
  private loaded = false;

  readonly periods = signal<GlConsolidationPeriodOption[]>([]);

  load(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    this.api.getFiscalYears({ per_page: 100 }).subscribe({
      next: (res) => {
        const options = (res.data ?? []).flatMap((year) =>
          (year.periods ?? []).map((period: GlFiscalPeriod) => ({
            id: period.id,
            label: `${year.year_code} - ${period.period_name} (${period.start_date} / ${period.end_date})`,
          })),
        );
        this.periods.set(options);
      },
      error: () => (this.loaded = false),
    });
  }

  label(periodId: string): string {
    return this.periods().find((period) => period.id === periodId)?.label ?? periodId;
  }
}
