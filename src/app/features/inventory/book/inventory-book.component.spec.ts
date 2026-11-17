import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { InventoryBook, InventoryValuationApiService } from '@core';
import { httpError, inventoryTestProviders } from '../shared/inventory-valuation.testing';
import { InventoryBookComponent } from './inventory-book.component';

function book(difference: string): InventoryBook {
  return {
    meta: { year: 2026, as_of: '2026-12-31', generated_at: '2027-01-10T08:00:00Z', method_breakdown: { fifo: 1 } },
    rows: [
      {
        sku: 'SKU-1',
        name: 'Bolt',
        uom: 'pz',
        warehouse_id: 'w-1',
        lot_number: null,
        quantity: '6.0000',
        unit_cost: '5.0000',
        total_value: '30.00',
        valuation_method: 'fifo',
      },
    ],
    totals: { quantity: '6.0000', total_value: '30.00' },
    reconciliation: { gl_inventory_balance: '42.50', difference },
  };
}

describe('InventoryBookComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  function create() {
    const fixture = TestBed.createComponent(InventoryBookComponent);
    fixture.detectChanges();
    return fixture;
  }

  const query = (el: HTMLElement, testId: string) => el.querySelector(`[data-testid="${testId}"]`);

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      listWarehouses: vi.fn(() => of([{ id: 'w-1', name: 'Chiasso' }])),
      getBook: vi.fn(() => of(book('-12.50'))),
      downloadBookCsv: vi.fn(() => of({ blob: new Blob(['sku;name']), filename: 'inventory-book-2026.csv' })),
      createBookExport: vi.fn(() => of({ id: 'x-1', year: 2026, status: 'completed' })),
      listBookExports: vi.fn(() => of({ success: true, message: '', data: [], meta: { total: 0 } })),
      downloadBookExport: vi.fn(() => of({ blob: new Blob(['x']), filename: 'inventory-book-2026.csv' })),
    };
    TestBed.configureTestingModule({
      imports: [InventoryBookComponent],
      providers: [...inventoryTestProviders(), { provide: InventoryValuationApiService, useValue: api }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders rows, totals and highlights a non-zero GL difference', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    component.year.set(2026);
    component.warehouseId.set('w-1');

    component.generate();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(api['getBook']).toHaveBeenCalledWith({
      year: 2026,
      as_of: undefined,
      warehouse_id: 'w-1',
      require_closed: undefined,
    });
    expect(el.textContent).toContain('SKU-1');
    expect(query(el, 'book-difference')?.textContent).toContain('-12.50');
    expect(query(el, 'book-reconciled')).toBeNull();
  });

  it('shows the reconciled state when the difference is zero', () => {
    api['getBook'].mockReturnValue(of(book('0.00')));
    const fixture = create();
    fixture.componentInstance.generate();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(query(el, 'book-reconciled')).not.toBeNull();
    expect(query(el, 'book-difference')).toBeNull();
  });

  it('shows an alert for 409 (open period) and 422 (unknown year)', () => {
    api['getBook'].mockReturnValue(throwError(() => httpError(409, { message: 'Period 2026-12 is open' })));
    const fixture = create();
    const component = fixture.componentInstance;
    component.generate();
    fixture.detectChanges();
    expect(component.error()).toEqual({ key: 'INVENTORY.BOOK.ERROR_OPEN_PERIOD', detail: 'Period 2026-12 is open' });
    expect(query(fixture.nativeElement as HTMLElement, 'book-error')).not.toBeNull();

    api['getBook'].mockReturnValue(throwError(() => httpError(422, { message: 'Unknown year' })));
    component.generate();
    expect(component.error()?.key).toBe('INVENTORY.BOOK.ERROR_YEAR');
  });

  it('downloads the CSV as a file', () => {
    const createUrl = vi.fn(() => 'blob:csv');
    const revokeUrl = vi.fn();
    const original = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    onTestFinished(() => {
      Object.assign(URL, original);
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const fixture = create();
    fixture.componentInstance.year.set(2026);
    fixture.componentInstance.downloadCsv();
    vi.runAllTimers();

    expect(api['downloadBookCsv']).toHaveBeenCalledWith(expect.objectContaining({ year: 2026 }));
    expect(createUrl).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:csv');
    expect(fixture.componentInstance.downloadingCsv()).toBe(false);
  });

  it('recovers from a failed CSV download (error toast comes from the HTTP interceptor)', () => {
    api['downloadBookCsv'].mockReturnValue(throwError(() => httpError(500)));
    const fixture = create();
    fixture.componentInstance.downloadCsv();
    expect(fixture.componentInstance.downloadingCsv()).toBe(false);
  });

  it('creates an export and reloads the list', () => {
    const fixture = create();
    vi.advanceTimersByTime(1);
    const before = api['listBookExports'].mock.calls.length;

    fixture.componentInstance.year.set(2026);
    fixture.componentInstance.createExport();
    fixture.detectChanges();
    vi.advanceTimersByTime(500);

    expect(api['createBookExport']).toHaveBeenCalledWith(2026);
    expect(api['listBookExports'].mock.calls.length).toBeGreaterThan(before);
  });

  it('hides export actions on 403', () => {
    api['listBookExports'].mockReturnValue(throwError(() => httpError(403)));
    const fixture = create();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(query(el, 'create-export')).toBeNull();
    expect(el.textContent).toContain('INVENTORY.BOOK.EXPORT_FORBIDDEN');
  });
});
