import { inject, Injectable, signal } from '@angular/core';
import { Lead, LeadApiService, LeadFilterParams, ListFacade } from '@core';
import { tap } from 'rxjs';

/** Server-side paginated lead list; provided per page so filters reset on leave. */
@Injectable()
export class LeadFacade extends ListFacade<Lead, LeadFilterParams> {
  private readonly api = inject(LeadApiService);

  /** True when the last load failed (drives the retry message). */
  readonly error = signal(false);

  constructor() {
    super();
  }

  /** Replaces every filter at once (URL is the source of truth). */
  replaceFilters(filters: LeadFilterParams): void {
    this.filterParams.set(filters);
    this.pageIndex.set(1);
  }

  protected override fetch(params: LeadFilterParams) {
    return this.api.listLeads(params).pipe(
      tap({
        next: () => this.error.set(false),
        error: () => this.error.set(true),
      }),
    );
  }
}
