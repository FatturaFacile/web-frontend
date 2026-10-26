import { inject, Service } from '@angular/core';
import { ClientApiService, ContactFilterParams, ContactResource, ListFacade } from '@core';

@Service()
export class ClientFacade extends ListFacade<ContactResource, ContactFilterParams> {
  private readonly api = inject(ClientApiService);

  constructor() {
    super();
  }

  protected override fetch(params: ContactFilterParams) {
    return this.api.list(params);
  }
}
