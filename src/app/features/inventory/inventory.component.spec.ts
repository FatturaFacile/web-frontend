import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { AuthStore, I18nService, InventoryApiService, ProductItem, TranslateService } from '@core';
import { InventoryComponent } from './inventory.component';

describe('InventoryComponent', () => {
  let fixture: ComponentFixture<InventoryComponent>;
  let component: InventoryComponent;

  const mockProducts: ProductItem[] = [
    {
      id: 'prod-1',
      sku: 'SKU-001',
      name: 'Widget A',
      warehouse: 'Milano (IT)',
      quantity: 50,
      unit_of_measure: 'Pz',
      price: 19.99,
      currency: 'EUR',
      hs_code: '84713000',
    },
  ];

  const mockInventoryApi = {
    getProducts: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockProducts,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    createProduct: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockProducts[0],
      }),
    ),
    deleteProduct: vi.fn().mockReturnValue(
      of({
        success: true,
        data: null,
      }),
    ),
  };

  const mockTranslate = {
    instant: vi.fn((k: string) => k),
    translate: vi.fn((k: string) => k),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  const mockAuthStore = {
    activeJurisdiction: vi.fn().mockReturnValue('IT'),
    activeCurrency: vi.fn().mockReturnValue('EUR'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [InventoryComponent],
      providers: [
        provideNzIcons(icons),
        { provide: InventoryApiService, useValue: mockInventoryApi },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: TranslateService, useValue: mockTranslate },
        { provide: I18nService, useValue: mockTranslate },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryComponent);
    component = fixture.componentInstance;
  });

  it('loads products on initialization', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(mockInventoryApi.getProducts).toHaveBeenCalledWith({
      page: 1,
      per_page: 10,
      search: undefined,
    });
    expect(component.products()).toEqual(mockProducts);
    expect(component.total()).toBe(1);
  });

  it('filters products on search', () => {
    fixture.detectChanges();
    const event = { target: { value: 'Widget' } } as unknown as Event;
    component.onSearch(event);

    expect(component.searchTerm()).toBe('Widget');
    expect(component.pageIndex()).toBe(1);
    expect(mockInventoryApi.getProducts).toHaveBeenCalledWith({
      page: 1,
      per_page: 10,
      search: 'Widget',
    });
  });

  it('opens create modal with default values based on tenant jurisdiction', () => {
    fixture.detectChanges();
    component.openCreateModal();

    expect(component.createModalVisible()).toBe(true);
    expect(component.productForm.get('warehouse')?.value).toBe('Milano (IT)');
  });

  it('submits create product successfully', () => {
    fixture.detectChanges();
    component.openCreateModal();
    component.productForm.patchValue({
      sku: 'SKU-002',
      name: 'Widget B',
      warehouse: 'Milano (IT)',
      quantity: 10,
      unit_of_measure: 'Pz',
      price: 25.5,
    });

    component.submitCreateProduct();

    expect(mockInventoryApi.createProduct).toHaveBeenCalledWith({
      sku: 'SKU-002',
      name: 'Widget B',
      warehouse: 'Milano (IT)',
      quantity: 10,
      unit_of_measure: 'Pz',
      price: 25.5,
      currency: 'EUR',
      hs_code: undefined,
    });
    expect(mockMessage.success).toHaveBeenCalledWith('inventory.messages.created');
    expect(component.createModalVisible()).toBe(false);
  });

  it('deletes product and reloads list', () => {
    fixture.detectChanges();
    component.deleteProduct(mockProducts[0]);

    expect(mockInventoryApi.deleteProduct).toHaveBeenCalledWith('prod-1');
    expect(mockMessage.success).toHaveBeenCalledWith('inventory.messages.deleted');
  });
});
