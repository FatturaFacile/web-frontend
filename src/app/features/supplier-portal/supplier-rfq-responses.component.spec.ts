import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierPortalApiService, SupplierRfqComparison, SupplierRfqSummary, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { SupplierRfqResponsesComponent } from './supplier-rfq-responses.component';

describe('SupplierRfqResponsesComponent', () => {
  let fixture: ComponentFixture<SupplierRfqResponsesComponent>;
  let component: SupplierRfqResponsesComponent;

  const summary: SupplierRfqSummary = {
    id: 'rfq-1',
    rfq_number: 'RFQ-2027-0001',
    title: 'Bearings',
    status: 'issued',
    response_deadline: '2027-06-20',
    is_open: true,
    currency: 'EUR',
    invited_count: 3,
    responded_count: 2,
    declined_count: 1,
  };

  const comparison: SupplierRfqComparison = {
    rfq: { id: 'rfq-1', rfq_number: 'RFQ-2027-0001', title: 'Bearings', status: 'issued', response_deadline: '2027-06-20', is_open: true, currency: 'EUR' },
    lines: [
      {
        rfq_line_id: 'line-1',
        description: 'Bearing 6204',
        quantity: '100.0000',
        offers: [
          { quote_id: 'q-2', supplier_id: 'sup-2', unit_price: '1.1000', line_total: '110.00' },
          { quote_id: 'q-1', supplier_id: 'sup-1', unit_price: '1.2550', line_total: '125.50' },
        ],
        best_unit_price: '1.1000',
      },
    ],
    quotes: [
      { quote_id: 'q-2', supplier_id: 'sup-2', supplier_name: 'Cheap Srl', total_amount: '110.00', lines_quoted: 1, covers_all_lines: true, status: 'received', risk_level: 'high' },
      { quote_id: 'q-1', supplier_id: 'sup-1', supplier_name: 'Reliable Spa', total_amount: '125.50', lines_quoted: 1, covers_all_lines: true, status: 'received', risk_level: 'none' },
    ],
    invitations: [],
    recommended_quote_id: 'q-1',
    awarded_quote_id: null,
  };

  const apiSpy = { getRfqResponses: vi.fn(), getRfqComparison: vi.fn() };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiSpy.getRfqResponses.mockReturnValue(of({ data: [summary] }));
    apiSpy.getRfqComparison.mockReturnValue(of({ data: comparison }));

    await TestBed.configureTestingModule({
      imports: [SupplierRfqResponsesComponent],
      providers: [
        { provide: SupplierPortalApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SupplierRfqResponsesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists the requests with their answers', () => {
    expect(component.rfqs()).toEqual([summary]);
    expect(fixture.nativeElement.textContent).toContain('RFQ-2027-0001');
  });

  it('loads the comparison of a request and shows the recommended quote, not the cheapest one', () => {
    component.compare(summary);
    fixture.detectChanges();

    expect(apiSpy.getRfqComparison).toHaveBeenCalledWith('rfq-1');
    expect(component.comparison()?.recommended_quote_id).toBe('q-1');

    const recommended = fixture.nativeElement.querySelectorAll('tr.recommended');
    expect(recommended).toHaveLength(1);
    expect(recommended[0].textContent).toContain('Reliable Spa');
  });

  it('finds the offer of a supplier on a line, and nothing when it did not price it', () => {
    const line = comparison.lines[0];

    expect(component.offerFor(line, 'q-1')?.unit_price).toBe('1.2550');
    expect(component.offerFor(line, 'q-9')).toBeNull();
  });
});
