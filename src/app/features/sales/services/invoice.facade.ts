import { inject, Service } from '@angular/core';
import { InvoiceApiService, InvoiceFilterParams, InvoiceResource, ListFacade } from '@core';

@Service()
export class InvoiceFacade extends ListFacade<
  InvoiceResource,
  InvoiceFilterParams
> {
  private readonly api = inject(InvoiceApiService);

  constructor() {
    super();
  }

  protected override fetch(params: InvoiceFilterParams) {
    return this.api.list(params);
  }
}

