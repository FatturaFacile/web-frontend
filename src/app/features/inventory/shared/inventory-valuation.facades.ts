import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import {
  CostLayer,
  CostLayerFilterParams,
  InventoryBookExport,
  InventoryBookExportFilterParams,
  InventoryValuationApiService,
  LandedCostDocument,
  LandedCostFilterParams,
  ListFacade,
} from '@core';

/** Paginated landed cost documents (provided per page component). */
@Injectable()
export class LandedCostFacade extends ListFacade<LandedCostDocument, LandedCostFilterParams> {
  private readonly api = inject(InventoryValuationApiService);

  constructor() {
    super();
  }

  protected override fetch(params: LandedCostFilterParams) {
    return this.api.listLandedCosts(params);
  }
}

/** Cost layers with item / warehouse / lot / open-only filters. */
@Injectable()
export class CostLayerFacade extends ListFacade<CostLayer, CostLayerFilterParams> {
  private readonly api = inject(InventoryValuationApiService);

  constructor() {
    super();
  }

  protected override fetch(params: CostLayerFilterParams) {
    return this.api.getCostLayers(params);
  }
}

/** Persisted (immutable) inventory book exports. */
@Injectable()
export class InventoryBookExportFacade extends ListFacade<InventoryBookExport, InventoryBookExportFilterParams> {
  private readonly api = inject(InventoryValuationApiService);
  /** Set when the API answers 403: export actions are hidden. */
  readonly forbidden = signal(false);

  constructor() {
    super();
  }

  protected override fetch(params: InventoryBookExportFilterParams) {
    return this.api.listBookExports(params).pipe(
      tap({
        next: () => this.forbidden.set(false),
        error: (err: unknown) => this.forbidden.set(err instanceof HttpErrorResponse && err.status === 403),
      }),
    );
  }
}
