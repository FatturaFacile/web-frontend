import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService, SupportedLanguage } from '@core/i18n';
import { RfqApiService } from '@data-access/procurement/rfq-api.service';
import { ExternalRfqPortalView } from '@domain/procurement/rfq.models';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { SupplierBidPortalComponent } from './supplier-bid-portal.component';

function buildPortalView(): ExternalRfqPortalView {
  return {
    rfq: {
      id: 'rfq-1',
      rfq_number: 'RFQ-2026-000045',
      title: 'CNC Machined Flanges Q4',
      description: 'Supply machined stainless steel flanges.',
      status: 'bidding_open',
      currency_code: 'EUR',
      incoterms: 'DDP',
      submission_deadline: '2026-12-20T16:00:00Z',
      expected_delivery_date: '2027-01-15',
      sealed_bidding: true,
      lines: [
        {
          id: 'rfq-line-1',
          line_number: 1,
          item_code: 'FLG-100',
          description: 'Stainless Flange DN50',
          technical_specifications: 'ISO 9001 cert required',
          quantity: '10.0000',
          unit_of_measure: 'PCS',
          requested_delivery_date: '2027-01-10',
        },
        {
          id: 'rfq-line-2',
          line_number: 2,
          item_code: 'GSK-200',
          description: 'Graphite Gasket DN50',
          technical_specifications: null,
          quantity: '5.0000',
          unit_of_measure: 'PCS',
          requested_delivery_date: '2027-01-10',
        },
      ],
      attachments: [
        {
          id: 'att-1',
          file_name: 'drawing-dn50.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 20480,
        },
      ],
    },
    buyer_company: {
      name: 'FatturaFacile Manufacturing Srl',
      country: 'IT',
      vat_number: 'IT01234567890',
    },
    invitation: {
      id: 'inv-1',
      supplier_id: 'sup-1',
      supplier_name: 'Alpine Precision AG',
      status: 'viewed',
      token_expires_at: '2026-12-27T16:00:00Z',
      first_viewed_at: '2026-11-21T08:00:00Z',
      submitted_at: null,
      declined_reason: null,
    },
    bid: null,
    preferred_locale: 'en',
    is_open: true,
    can_submit: true,
  };
}

describe('SupplierBidPortalComponent', () => {
  let fixture: ComponentFixture<SupplierBidPortalComponent>;
  let component: SupplierBidPortalComponent;
  let langSignal: ReturnType<typeof signal<SupportedLanguage>>;
  let apiMock: {
    getPublicPortal: ReturnType<typeof vi.fn>;
    submitPublicBid: ReturnType<typeof vi.fn>;
    declinePublicInvitation: ReturnType<typeof vi.fn>;
    downloadPublicAttachment: ReturnType<typeof vi.fn>;
  };
  let messageMock: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let setLanguageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    langSignal = signal<SupportedLanguage>('en');
    setLanguageSpy = vi.fn((lang: SupportedLanguage) => {
      langSignal.set(lang);
      return Promise.resolve({});
    });

    apiMock = {
      getPublicPortal: vi.fn().mockReturnValue(of({ data: buildPortalView() })),
      submitPublicBid: vi.fn().mockReturnValue(of({ data: { id: 'bid-1', status: 'submitted' } })),
      declinePublicInvitation: vi.fn().mockReturnValue(of({ data: { status: 'declined' } })),
      downloadPublicAttachment: vi.fn().mockReturnValue(of(new Blob(['pdf'], { type: 'application/pdf' }))),
    };
    messageMock = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SupplierBidPortalComponent],
      providers: [
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: RfqApiService, useValue: apiMock },
        { provide: NzMessageService, useValue: messageMock },
        {
          provide: I18nService,
          useValue: {
            currentLanguage: langSignal,
            setLanguage: setLanguageSpy,
            translate: vi.fn((key: string) => key),
            instant: vi.fn((key: string) => key),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(SupplierBidPortalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tokenInput', 'magic-tok-123');
    fixture.detectChanges();
  });

  it('computes net totals, discounts, shipping landed cost, and respects is_no_bid toggles', () => {
    expect(component.hasValidBidLine()).toBe(false);

    component.updateLine('rfq-line-1', 'unit_price', 100);
    component.updateLine('rfq-line-1', 'discount_percent', 10);
    component.updateLine('rfq-line-2', 'unit_price', 50);
    component.shippingCost.set(45);

    // Line 1: 10 * 100 * 0.9 = 900; Line 2: 5 * 50 = 250 -> items 1150; landed 1195
    expect(component.itemsNetTotal()).toBeCloseTo(1150, 4);
    expect(component.totalLandedOffer()).toBeCloseTo(1195, 4);
    expect(component.hasValidBidLine()).toBe(true);

    component.updateLine('rfq-line-2', 'is_no_bid', true);
    expect(component.itemsNetTotal()).toBeCloseTo(900, 4);
    expect(component.totalLandedOffer()).toBeCloseTo(945, 4);
  });

  it('saves draft and submits final quote via public portal endpoints', () => {
    component.supplierQuoteReference.set('OFF-ALP-2026');
    component.updateLine('rfq-line-1', 'unit_price', 85);
    component.saveDraft();

    expect(apiMock.submitPublicBid).toHaveBeenCalledWith(
      'magic-tok-123',
      expect.objectContaining({
        action: 'draft',
        supplier_quote_reference: 'OFF-ALP-2026',
      }),
    );

    component.submitFinalQuote();

    expect(apiMock.submitPublicBid).toHaveBeenCalledWith(
      'magic-tok-123',
      expect.objectContaining({
        action: 'submit',
        currency_code: 'EUR',
      }),
    );
  });

  it('supports switching portal language and declining the invitation', () => {
    component.switchLanguage('de');
    expect(setLanguageSpy).toHaveBeenCalledWith('de');

    component.openDeclineModal();
    component.declineReason.set('Production capacity full');
    component.confirmDecline();

    expect(apiMock.declinePublicInvitation).toHaveBeenCalledWith(
      'magic-tok-123',
      'Production capacity full',
    );
    expect(component.canInteract()).toBe(false);
    expect(component.portalView()?.invitation.status).toBe('declined');
  });

  it('shows invalid/expired alert when token validation fails (401/410)', () => {
    apiMock.getPublicPortal.mockReturnValueOnce(throwError(() => ({ status: 410 })));
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.loadError()).toBe(true);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('RFQ.PORTAL.INVALID_OR_EXPIRED');
  });
});
