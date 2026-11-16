import { inject, Service } from '@angular/core';
import {
  DeliveryNoteFilterParams,
  DeliveryNoteResource,
  ListFacade,
  LogisticsApiService,
  StockTransferFilterParams,
  StockTransferResource,
} from '@core';

@Service()
export class DeliveryNoteFacade extends ListFacade<DeliveryNoteResource, DeliveryNoteFilterParams> {
  private readonly api = inject(LogisticsApiService);

  constructor() {
    super();
  }

  protected override fetch(params: DeliveryNoteFilterParams) {
    return this.api.listDeliveryNotes(params);
  }
}

@Service()
export class TransferFacade extends ListFacade<StockTransferResource, StockTransferFilterParams> {
  private readonly api = inject(LogisticsApiService);

  constructor() {
    super();
  }

  protected override fetch(params: StockTransferFilterParams) {
    return this.api.listTransfers(params);
  }
}
