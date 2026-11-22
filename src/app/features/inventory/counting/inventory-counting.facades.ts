import { inject, Injectable } from '@angular/core';
import { CountSession, CountSessionFilterParams, InventoryCountApiService, ListFacade } from '@core';

/** Paginated count sessions (provided per page component). */
@Injectable()
export class CountSessionFacade extends ListFacade<CountSession, CountSessionFilterParams> {
  private readonly api = inject(InventoryCountApiService);

  constructor() {
    super();
  }

  protected override fetch(params: CountSessionFilterParams) {
    return this.api.listSessions(params);
  }
}
