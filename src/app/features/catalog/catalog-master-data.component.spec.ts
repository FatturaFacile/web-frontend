import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogApiService, I18nService, PermissionsService } from '@core';
import { icons } from '../../icons-provider';
import { CatalogMasterDataComponent } from './catalog-master-data.component';

const ok = (data: unknown = []) => of({ success: true, message: 'ok', data });

describe('CatalogMasterDataComponent', () => {
  const api = {
    getPaymentTerms: vi.fn(),
    getBrands: vi.fn(),
    getCategories: vi.fn(),
    getUnits: vi.fn(),
    createPaymentTerm: vi.fn(),
    updatePaymentTerm: vi.fn(),
    getPaymentTermSchedule: vi.fn(),
    createBrand: vi.fn(),
    updateCategory: vi.fn(),
    createUnit: vi.fn(),
    deleteUnit: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const i18n = { translate: vi.fn((key: string) => key), currentLanguage: signal('it') };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getPaymentTerms.mockReturnValue(ok([{ id: 't1', code: '30DF', name: '30 days', days: 30 }]));
    api.getBrands.mockReturnValue(ok([]));
    api.getCategories.mockReturnValue(ok([{ id: 'c1', name: 'Tools', parent_id: null }]));
    api.getUnits.mockReturnValue(ok([]));

    await TestBed.configureTestingModule({
      imports: [CatalogMasterDataComponent],
      providers: [
        provideNzIcons(icons),
        { provide: CatalogApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: I18nService, useValue: i18n },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();
  });

  it('loads the four master data lists', () => {
    const component = TestBed.createComponent(CatalogMasterDataComponent).componentInstance;
    expect(api.getPaymentTerms).toHaveBeenCalled();
    expect(api.getBrands).toHaveBeenCalled();
    expect(api.getCategories).toHaveBeenCalled();
    expect(api.getUnits).toHaveBeenCalled();
    expect(component['terms']()).toHaveLength(1);
  });

  it('creates a payment term with the SDI terms code and early-payment discount as strings', () => {
    const component = TestBed.createComponent(CatalogMasterDataComponent).componentInstance;
    component['openTerm'](null);
    component['termDraft'] = {
      code: '60DFEM',
      name: '60 days end of month',
      days: 60,
      end_of_month: true,
      discount_percent: '2.00',
      discount_days: 10,
      sdi_terms_code: 'TP02',
    };
    expect(component['termValid']()).toBe(true);
    api.createPaymentTerm.mockReturnValue(ok({}));
    component['saveTerm']();
    expect(api.createPaymentTerm).toHaveBeenCalledWith({
      code: '60DFEM',
      name: '60 days end of month',
      days: 60,
      end_of_month: true,
      discount_percent: '2.00',
      discount_days: 10,
      sdi_terms_code: 'TP02',
    });
  });

  it('rejects an invalid discount percentage', () => {
    const component = TestBed.createComponent(CatalogMasterDataComponent).componentInstance;
    component['openTerm'](null);
    component['termDraft'].code = 'X';
    component['termDraft'].name = 'X';
    component['termDraft'].discount_percent = 'abc';
    expect(component['termValid']()).toBe(false);
  });

  it('loads the schedule of a term for an amount', () => {
    const component = TestBed.createComponent(CatalogMasterDataComponent).componentInstance;
    api.getPaymentTermSchedule.mockReturnValue(ok({ installments: [] }));
    component['scheduleAmount'] = '500.00';
    component['openSchedule']({ id: 't1', code: '30DF', name: '30 days' });
    expect(api.getPaymentTermSchedule).toHaveBeenCalledWith('t1', { amount: '500.00' });
  });

  it('requires a code for units and saves a category with its parent', () => {
    const component = TestBed.createComponent(CatalogMasterDataComponent).componentInstance;
    component['openSimple']('unit');
    component['simpleName'] = 'Kilogram';
    expect(component['simpleValid']()).toBe(false);
    component['simpleCode'] = 'KG';
    expect(component['simpleValid']()).toBe(true);
    api.createUnit.mockReturnValue(ok({}));
    component['saveSimple']();
    expect(api.createUnit).toHaveBeenCalledWith({ code: 'KG', name: 'Kilogram' });

    component['openSimple']('category', { id: 'c2', name: 'Sub', parent_id: 'c1' });
    api.updateCategory.mockReturnValue(ok({}));
    component['saveSimple']();
    expect(api.updateCategory).toHaveBeenCalledWith('c2', { name: 'Sub', parent_id: 'c1' });
  });
});
