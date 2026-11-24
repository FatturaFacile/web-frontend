import { QueryFilterParams } from '../models';
import { GridModel } from './grid.model';

/**
 * Facade of a server-side paginated grid: paging, sorting, column filters, grouping and filter-list values all
 * run on the server (see {@link GridModel}). Subclasses only implement `fetch`.
 */
export abstract class ListFacade<T, F extends QueryFilterParams> extends GridModel<T, F> {
  protected constructor(debounceMs = 300) {
    super(debounceMs);
  }
}
