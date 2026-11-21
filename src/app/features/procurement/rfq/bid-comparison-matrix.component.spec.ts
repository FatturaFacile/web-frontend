import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService } from '@core/i18n';
import { RfqApiService } from '@data-access/procurement/rfq-api.service';
import { BidComparisonMatrix } from '@domain/procurement/rfq.models';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { BidComparisonMatrixComponent } from './bid-comparison-matrix.component';

function buildOpenMatrix(): BidComparisonMatrix {
  return {
    rfq_id: 'rfq-1',
    rfq_number: 'RFQ-2026-000010',
    title: 'Precision Bearings & Motors',
    status: 'under_evaluation',
    currency_code: 'EUR',
    submission_deadline: '2026-12-01T12:00:00Z',
    sealed_bidding: false,
    is_sealed: false,
    can_award: true,
    evaluation_weights: {
      price_weight: 60,
      lead_time_weight: 25,
      supplier_rating_weight: 15,
    },
    invitations: [
      {
        id: 'inv-a',
        supplier_id: 'sup-a',
        supplier_name: 'Alpha Mechanics GmbH',
        supplier_rating_score: 80,
        status: 'bid_submitted',
        invited_at: '2026-11-20T10:00:00Z',
        first_viewed_at: '2026-11-20T11:00:00Z',
        submitted_at: '2026-11-21T09:00:00Z',
        declined_reason: null,
        notified_outcome_at: null,
      },
      {
        id: 'inv-b',
        supplier_id: 'sup-b',
        supplier_name: 'Beta Drives Srl',
        supplier_rating_score: 92,
        status: 'bid_submitted',
        invited_at: '2026-11-20T10:00:00Z',
        first_viewed_at: '2026-11-20T12:00:00Z',
        submitted_at: '2026-11-21T10:00:00Z',
        declined_reason: null,
        notified_outcome_at: null,
      },
    ],
    columns: [
      {
        bid_id: 'bid-a',
        supplier_id: 'sup-a',
        supplier_name: 'Alpha Mechanics GmbH',
        supplier_code: 'SUP-A',
        supplier_rating_grade: 'B',
        supplier_rating_score: 80,
        quote_reference: 'QT-A1',
        currency_code: 'EUR',
        exchange_rate_to_rfq: '1.000000',
        payment_terms_days: 30,
        incoterms: 'DDP',
        shipping_cost: '25.0000',
        valid_until: '2027-01-15',
        general_notes: null,
        total_net_amount: '1200.0000',
        total_landed_cost: '1225.0000',
        normalized_landed_cost: '1225.0000',
        weighted_overall_score: '89.50',
        quoted_line_count: 2,
        covers_all_lines: true,
        is_lowest_total_cost: true,
        is_highest_score: false,
        status: 'submitted',
        submitted_at: '2026-11-21T09:00:00Z',
      },
      {
        bid_id: 'bid-b',
        supplier_id: 'sup-b',
        supplier_name: 'Beta Drives Srl',
        supplier_code: 'SUP-B',
        supplier_rating_grade: 'A',
        supplier_rating_score: 92,
        quote_reference: 'QT-B1',
        currency_code: 'EUR',
        exchange_rate_to_rfq: '1.000000',
        payment_terms_days: 45,
        incoterms: 'DDP',
        shipping_cost: '10.0000',
        valid_until: '2027-01-15',
        general_notes: null,
        total_net_amount: '1300.0000',
        total_landed_cost: '1310.0000',
        normalized_landed_cost: '1310.0000',
        weighted_overall_score: '91.20',
        quoted_line_count: 2,
        covers_all_lines: true,
        is_lowest_total_cost: false,
        is_highest_score: true,
        status: 'submitted',
        submitted_at: '2026-11-21T10:00:00Z',
      },
    ],
    rows: [
      {
        rfq_line_id: 'line-1',
        line_number: 1,
        item_id: null,
        custom_item_code: 'BRG-01',
        description: 'Ball Bearing SKF 6204',
        technical_specifications: null,
        quantity: '10.0000',
        unit_of_measure: 'PCS',
        target_unit_price: '55.0000',
        requested_delivery_date: '2026-12-15',
        awarded_supplier_id: null,
        awarded_bid_line_id: null,
        generated_purchase_order_id: null,
        best_unit_price: '50.0000',
        recommended_bid_line_id: 'bid-a-l1',
        cells: [
          {
            bid_id: 'bid-a',
            supplier_id: 'sup-a',
            supplier_bid_line_id: 'bid-a-l1',
            is_no_bid: false,
            quoted_quantity: '10.0000',
            unit_price: '50.0000',
            discount_percent: '0.00',
            net_unit_price: '50.0000',
            line_total_net: '500.0000',
            normalized_net_unit_price: '50.0000',
            normalized_line_total_net: '500.0000',
            lead_time_days: 5,
            promised_delivery_date: null,
            supplier_notes: null,
            price_score: '100.00',
            lead_time_score: '100.00',
            supplier_rating_score: '80.00',
            line_weighted_score: '97.00',
            is_lowest_price: true,
            is_fastest_delivery: true,
            is_highest_score: true,
            is_awarded: false,
          },
          {
            bid_id: 'bid-b',
            supplier_id: 'sup-b',
            supplier_bid_line_id: 'bid-b-l1',
            is_no_bid: false,
            quoted_quantity: '10.0000',
            unit_price: '65.0000',
            discount_percent: '0.00',
            net_unit_price: '65.0000',
            line_total_net: '650.0000',
            normalized_net_unit_price: '65.0000',
            normalized_line_total_net: '650.0000',
            lead_time_days: 7,
            promised_delivery_date: null,
            supplier_notes: null,
            price_score: '76.92',
            lead_time_score: '71.43',
            supplier_rating_score: '92.00',
            line_weighted_score: '77.81',
            is_lowest_price: false,
            is_fastest_delivery: false,
            is_highest_score: false,
            is_awarded: false,
          },
        ],
      },
      {
        rfq_line_id: 'line-2',
        line_number: 2,
        item_id: null,
        custom_item_code: 'MTR-02',
        description: 'Servo Motor 400W',
        technical_specifications: null,
        quantity: '2.0000',
        unit_of_measure: 'PCS',
        target_unit_price: '360.0000',
        requested_delivery_date: '2026-12-15',
        awarded_supplier_id: null,
        awarded_bid_line_id: null,
        generated_purchase_order_id: null,
        best_unit_price: '325.0000',
        recommended_bid_line_id: 'bid-b-l2',
        cells: [
          {
            bid_id: 'bid-a',
            supplier_id: 'sup-a',
            supplier_bid_line_id: 'bid-a-l2',
            is_no_bid: false,
            quoted_quantity: '2.0000',
            unit_price: '350.0000',
            discount_percent: '0.00',
            net_unit_price: '350.0000',
            line_total_net: '700.0000',
            normalized_net_unit_price: '350.0000',
            normalized_line_total_net: '700.0000',
            lead_time_days: 14,
            promised_delivery_date: null,
            supplier_notes: null,
            price_score: '92.86',
            lead_time_score: '35.71',
            supplier_rating_score: '80.00',
            line_weighted_score: '76.64',
            is_lowest_price: false,
            is_fastest_delivery: false,
            is_highest_score: false,
            is_awarded: false,
          },
          {
            bid_id: 'bid-b',
            supplier_id: 'sup-b',
            supplier_bid_line_id: 'bid-b-l2',
            is_no_bid: false,
            quoted_quantity: '2.0000',
            unit_price: '325.0000',
            discount_percent: '0.00',
            net_unit_price: '325.0000',
            line_total_net: '650.0000',
            normalized_net_unit_price: '325.0000',
            normalized_line_total_net: '650.0000',
            lead_time_days: 5,
            promised_delivery_date: null,
            supplier_notes: null,
            price_score: '100.00',
            lead_time_score: '100.00',
            supplier_rating_score: '92.00',
            line_weighted_score: '98.80',
            is_lowest_price: true,
            is_fastest_delivery: true,
            is_highest_score: true,
            is_awarded: false,
          },
        ],
      },
    ],
    recommendations: {
      lowest_total_cost_bid_id: 'bid-a',
      highest_score_bid_id: 'bid-b',
      optimal_split_line_awards: [
        { rfq_line_id: 'line-1', supplier_bid_line_id: 'bid-a-l1', supplier_id: 'sup-a', bid_id: 'bid-a' },
        { rfq_line_id: 'line-2', supplier_bid_line_id: 'bid-b-l2', supplier_id: 'sup-b', bid_id: 'bid-b' },
      ],
      lowest_price_split_line_awards: [
        { rfq_line_id: 'line-1', supplier_bid_line_id: 'bid-a-l1', supplier_id: 'sup-a', bid_id: 'bid-a' },
        { rfq_line_id: 'line-2', supplier_bid_line_id: 'bid-b-l2', supplier_id: 'sup-b', bid_id: 'bid-b' },
      ],
    },
  };
}

describe('BidComparisonMatrixComponent', () => {
  let fixture: ComponentFixture<BidComparisonMatrixComponent>;
  let component: BidComparisonMatrixComponent;
  let apiMock: {
    getComparisonMatrix: ReturnType<typeof vi.fn>;
    awardRfq: ReturnType<typeof vi.fn>;
  };
  let messageMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = {
      getComparisonMatrix: vi.fn().mockReturnValue(of({ data: buildOpenMatrix() })),
      awardRfq: vi.fn().mockReturnValue(
        of({ data: { rfq: { id: 'rfq-1', status: 'awarded' }, purchase_orders: [{ id: 'po-1' }] } }),
      ),
    };
    messageMock = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [BidComparisonMatrixComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: RfqApiService, useValue: apiMock },
        { provide: NzMessageService, useValue: messageMock },
        {
          provide: I18nService,
          useValue: {
            currentLanguage: signal<'en'>('en'),
            translate: vi.fn((key: string) => key),
            instant: vi.fn((key: string) => key),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(BidComparisonMatrixComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('rfqIdInput', 'rfq-1');
    fixture.detectChanges();
  });

  it('applies Lowest Total Cost preset as a full single-supplier award', () => {
    component.applyLowestTotalPreset();

    expect(component.selectedCount()).toBe(2);
    expect(component.resolvedAwardMode()).toBe('full');
    expect(component.groupedPoPreviews()).toHaveLength(1);
    expect(component.groupedPoPreviews()[0].supplier_id).toBe('sup-a');
    expect(component.groupedPoPreviews()[0].net_subtotal).toBe(1200);
    expect(component.winnerCount()).toBe(1);
    expect(component.regretCount()).toBe(1);

    component.confirmAward();

    expect(apiMock.awardRfq).toHaveBeenCalledWith('rfq-1', {
      award_mode: 'full',
      supplier_id: 'sup-a',
      bid_id: 'bid-a',
      notes: null,
    });
  });

  it('applies Optimal Split Award preset across multiple winning suppliers and groups PO previews', () => {
    component.applyOptimalSplitPreset();

    expect(component.selectedCount()).toBe(2);
    expect(component.resolvedAwardMode()).toBe('split');
    expect(component.groupedPoPreviews()).toHaveLength(2);
    expect(component.winnerCount()).toBe(2);
    expect(component.regretCount()).toBe(0);

    component.awardNotes.set('Approved split procurement');
    component.confirmAward();

    expect(apiMock.awardRfq).toHaveBeenCalledWith('rfq-1', {
      award_mode: 'split',
      line_awards: [
        { rfq_line_id: 'line-1', supplier_bid_line_id: 'bid-a-l1' },
        { rfq_line_id: 'line-2', supplier_bid_line_id: 'bid-b-l2' },
      ],
      notes: 'Approved split procurement',
    });
  });

  it('switches from full award to split award when user overrides a single line cell', () => {
    component.applyLowestTotalPreset();
    expect(component.resolvedAwardMode()).toBe('full');

    const row2 = buildOpenMatrix().rows[1];
    const betaLine2Cell = row2.cells[1];
    component.selectCell(row2, betaLine2Cell);

    expect(component.resolvedAwardMode()).toBe('split');
    expect(component.groupedPoPreviews()).toHaveLength(2);
  });

  it('shows sealed bidding banner and disables awarding while sealed', () => {
    const sealed = buildOpenMatrix();
    sealed.sealed_bidding = true;
    sealed.is_sealed = true;
    sealed.can_award = false;
    sealed.rows.forEach((row) => {
      row.cells = [];
    });

    apiMock.getComparisonMatrix.mockReturnValueOnce(of({ data: sealed }));
    component.ngOnInit();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('RFQ.MATRIX.SEALED_BANNER');
    expect(text).not.toContain('RFQ.MATRIX.PRESET_LOWEST_TOTAL');
  });
});
