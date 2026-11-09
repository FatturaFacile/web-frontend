import { inject, Service } from '@angular/core';
import {
  BackorderLine,
  CoreDeliveryNote,
  CoreOrder,
  CoreQuote,
  ListFacade,
  SalesCycleApiService,
  SalesListFilterParams,
  SalesReturn,
} from '@core';

@Service()
export class CycleQuotesFacade extends ListFacade<CoreQuote, SalesListFilterParams> {
  private readonly api = inject(SalesCycleApiService);

  constructor() {
    super();
  }

  protected override fetch(params: SalesListFilterParams) {
    return this.api.getQuotes(params);
  }
}

@Service()
export class CycleOrdersFacade extends ListFacade<CoreOrder, SalesListFilterParams> {
  private readonly api = inject(SalesCycleApiService);

  constructor() {
    super();
  }

  protected override fetch(params: SalesListFilterParams) {
    return this.api.getOrders(params);
  }
}

@Service()
export class CycleDeliveryNotesFacade extends ListFacade<CoreDeliveryNote, SalesListFilterParams> {
  private readonly api = inject(SalesCycleApiService);

  constructor() {
    super();
  }

  protected override fetch(params: SalesListFilterParams) {
    return this.api.getDeliveryNotes(params);
  }
}

@Service()
export class CycleReturnsFacade extends ListFacade<SalesReturn, SalesListFilterParams> {
  private readonly api = inject(SalesCycleApiService);

  constructor() {
    super();
  }

  protected override fetch(params: SalesListFilterParams) {
    return this.api.getReturns(params);
  }
}

@Service()
export class CycleBackordersFacade extends ListFacade<BackorderLine, SalesListFilterParams> {
  private readonly api = inject(SalesCycleApiService);

  constructor() {
    super();
  }

  protected override fetch(params: SalesListFilterParams) {
    return this.api.getBackorders(params);
  }
}
