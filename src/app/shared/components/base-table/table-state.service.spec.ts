import { describe, it, expect, beforeEach } from 'vitest';
import { TableStateService } from './table-state.service';

interface TestItem {
  id: string;
  name: string;
  amount: number;
}

interface TestFilter extends Record<string, unknown> {
  status?: string;
  category?: string;
}

describe('TableStateService', () => {
  let service: TableStateService<TestItem, TestFilter>;

  beforeEach(() => {
    service = new TableStateService<TestItem, TestFilter>();
  });

  it('should initialize with default pagination and empty states', () => {
    expect(service.pageIndex()).toBe(1);
    expect(service.pageSize()).toBe(15);
    expect(service.total()).toBe(0);
    expect(service.sort()).toBeNull();
    expect(service.search()).toBe('');
    expect(service.selectedItems()).toEqual([]);
    expect(service.hasActiveFilters()).toBe(false);
  });

  it('should update page and page size', () => {
    service.setPage(3);
    expect(service.pageIndex()).toBe(3);

    service.setPageSize(50);
    expect(service.pageSize()).toBe(50);
    expect(service.pageIndex()).toBe(1); // resets to page 1 on page size change
  });

  it('should update sorting state', () => {
    service.setSort('amount', 'ascend');
    expect(service.sort()).toEqual({ key: 'amount', order: 'ascend' });

    service.setSort('amount', null);
    expect(service.sort()).toBeNull();
  });

  it('should update filters and reset page to 1', () => {
    service.setPage(4);
    service.setFilter('status', 'active');

    expect(service.filters()['status']).toBe('active');
    expect(service.pageIndex()).toBe(1);
    expect(service.hasActiveFilters()).toBe(true);

    service.setFilter('status', undefined);
    expect(service.filters()['status']).toBeUndefined();
    expect(service.hasActiveFilters()).toBe(false);
  });

  it('should manage row selections', () => {
    const item1: TestItem = { id: '1', name: 'Alpha', amount: 100 };
    const item2: TestItem = { id: '2', name: 'Beta', amount: 200 };

    service.toggleItem(item1);
    expect(service.selectedCount()).toBe(1);
    expect(service.isItemSelected(item1)).toBe(true);
    expect(service.isItemSelected(item2)).toBe(false);

    service.toggleItem(item1);
    expect(service.selectedCount()).toBe(0);
    expect(service.isItemSelected(item1)).toBe(false);

    service.selectAll([item1, item2]);
    expect(service.selectedCount()).toBe(2);

    service.selectAll([item1, item2]);
    expect(service.selectedCount()).toBe(0);
  });

  it('should produce query parameters for backend requests', () => {
    service.setPageSize(25);
    service.setSearch('invoice');
    service.setSort('name', 'descend');
    service.setFilter('status', 'paid');
    service.setPage(2);

    const params = service.toBackendQueryParams();
    expect(params).toEqual({
      page: 2,
      per_page: 25,
      search: 'invoice',
      sort_by: 'name',
      sort_dir: 'desc',
      status: 'paid',
    });
  });
});
