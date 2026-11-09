import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClientApiService,
  CoreQuote,
  I18nService,
  InventoryApiService,
  PermissionsService,
  SalesCycleApiService,
} from '@core';
import { icons } from '../../../../icons-provider';
import { CycleQuotesComponent } from './quotes.component';

const quote = (status: string): CoreQuote => ({
  id: 'q1',
  quote_number: 'QT-2026-0001',
  contact_id: 'c1',
  date: '2026-11-09',
  valid_until: '2026-12-09',
  currency: 'EUR',
  status,
  total_gross: '122.00',
  items: [],
});

describe('CycleQuotesComponent', () => {
  let fixture: ComponentFixture<CycleQuotesComponent>;
  let component: CycleQuotesComponent;

  const page = (data: unknown[]) => ({
    success: true,
    message: 'ok',
    data,
    meta: { current_page: 1, last_page: 1, per_page: 10, total: data.length, from: 1, to: data.length },
  });
  const api = {
    getQuotes: vi.fn(),
    getQuote: vi.fn(),
    convertQuoteToOrder: vi.fn(),
    reviseQuote: vi.fn(),
    expireQuotes: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const i18n = { translate: vi.fn((key: string) => key), currentLanguage: signal('it') };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getQuotes.mockReturnValue(of(page([quote('draft')])));
    api.getQuote.mockReturnValue(of({ success: true, message: 'ok', data: quote('draft') }));

    await TestBed.configureTestingModule({
      imports: [CycleQuotesComponent],
      providers: [
        provideNzIcons(icons),
        { provide: SalesCycleApiService, useValue: api },
        { provide: ClientApiService, useValue: { list: vi.fn().mockReturnValue(of(page([]))) } },
        {
          provide: InventoryApiService,
          useValue: {
            getProducts: vi.fn().mockReturnValue(of(page([]))),
            getWarehouses: vi.fn().mockReturnValue(of({ success: true, data: [] })),
          },
        },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: I18nService, useValue: i18n },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CycleQuotesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  it('loads quotes from /sales/quotes with the status filter', () => {
    expect(api.getQuotes).toHaveBeenCalledWith(expect.objectContaining({ page: 1, per_page: 10 }));
    component['facade'].setFilter({ status: 'expired' });
    expect(component['facade'].filterParams().status).toBe('expired');
  });

  it('offers actions only on open quotes (superseded and expired are read only)', () => {
    expect(component['isOpen'](quote('draft'))).toBe(true);
    expect(component['isOpen'](quote('sent'))).toBe(true);
    expect(component['isOpen'](quote('accepted'))).toBe(true);
    expect(component['isOpen'](quote('superseded'))).toBe(false);
    expect(component['isOpen'](quote('expired'))).toBe(false);
    expect(component['isOpen'](quote('converted'))).toBe(false);
  });

  it('converts a quote to an order and reports success', () => {
    api.convertQuoteToOrder.mockReturnValue(of({ success: true, message: 'ok', data: {} }));
    component['convert'](quote('accepted'));
    expect(api.convertQuoteToOrder).toHaveBeenCalledWith('q1');
    expect(message.success).toHaveBeenCalledWith('SC.QUOTES.CONVERTED');
  });

  it('shows the server message when converting an expired quote returns 422', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: { message: 'The quote has expired', errors: { quote: ['The quote has expired'] } },
    });
    api.convertQuoteToOrder.mockReturnValue(throwError(() => error));
    component['convert'](quote('expired'));
    expect(message.error).toHaveBeenCalledWith('The quote has expired');
  });

  it('creates a new revision', () => {
    api.reviseQuote.mockReturnValue(of({ success: true, message: 'ok', data: quote('draft') }));
    component['revise'](quote('sent'));
    expect(api.reviseQuote).toHaveBeenCalledWith('q1');
    expect(message.success).toHaveBeenCalledWith('SC.QUOTES.REVISED');
  });
});
