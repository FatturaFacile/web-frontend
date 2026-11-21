import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { I18nService, ProposalLine, ProposalView } from '@core';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { i18nStub } from '../hr/recruiting/testing/recruiting-fixtures';
import { ProposalPortalComponent } from './proposal-portal.component';

const base = `${environment.apiBaseUrl}/public/proposals/tok`;

function line(
  id: string,
  mode: ProposalLine['selection_mode'],
  selected: boolean,
  net: string,
): ProposalLine {
  return {
    id,
    section_id: 's1',
    line_type: 'product',
    selection_mode: mode,
    alternative_group: mode === 'alternative_group' ? 'warranty' : null,
    sku: null,
    description: `Line ${id}`,
    long_description: null,
    uom: null,
    quantity: '1',
    unit_price: net,
    tax_rate: '22.0000',
    selected,
    net: selected ? net : '0.00',
  };
}

function view(optionalOn: boolean): ProposalView {
  const net = optionalOn ? '150.00' : '100.00';
  return {
    quote_number: 'OFF-2026-00001.01',
    status: 'sent',
    currency: 'CHF',
    locale: 'it-CH',
    customer_name: 'Acme AG',
    valid_until: null,
    payment_terms: null,
    incoterms: null,
    cover_letter: 'Dear customer',
    terms_and_conditions: null,
    signature_level: 'ses_otp',
    sections: [
      { id: 's1', title: 'Hardware', description: null, page_break_before: false, subtotal: net },
    ],
    lines: [line('a', 'mandatory', true, '100.00'), line('b', 'optional', optionalOn, '50.00')],
    tax_breakdown: [{ rate: '8.1000', net, tax: optionalOn ? '12.15' : '8.10' }],
    totals: {
      net,
      tax: optionalOn ? '12.15' : '8.10',
      gross: net,
      rounding: '0.00',
      payable: optionalOn ? '162.15' : '108.10',
    },
    has_signed_document: false,
  };
}

describe('ProposalPortalComponent', () => {
  let fixture: ComponentFixture<ProposalPortalComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.trim() ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProposalPortalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: i18nStub() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token: 'tok' }) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProposalPortalComponent);
    fixture.detectChanges();
    http.expectOne(base).flush({ data: view(false) });
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('renders the proposal with the live totals and the VAT breakdown', () => {
    expect(text('[data-test="number"]')).toBe('OFF-2026-00001.01');
    expect(text('[data-test="total-net"]')).toBe('100.00');
    expect(text('[data-test="total-payable"]')).toBe('108.10');
    expect(el().querySelectorAll('[data-test="tax-row"]')).toHaveLength(1);
    expect(el().querySelector('[data-test="signature"]')).not.toBeNull();
  });

  it('recalculates the summary when the customer switches an optional line on', async () => {
    const checkbox = el().querySelector<HTMLInputElement>(
      '[data-test="optional"] input[type="checkbox"]',
    );
    expect(checkbox).not.toBeNull();

    checkbox?.click();
    const req = http.expectOne(`${base}/selections`);
    expect(req.request.body).toEqual({ selections: { b: true } });
    req.flush({ data: view(true) });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text('[data-test="total-net"]')).toBe('150.00');
    expect(text('[data-test="total-payable"]')).toBe('162.15');
    expect(el().querySelector('tr[data-line="b"]')?.classList.contains('off')).toBe(false);
  });

  it('shows the rejection form only after the customer asks for it', async () => {
    expect(el().querySelector('#reject-reason')).toBeNull();

    el().querySelector<HTMLButtonElement>('[data-test="start-reject"]')?.click();
    fixture.detectChanges();

    expect(el().querySelector('#reject-reason')).not.toBeNull();
    expect(el().querySelector<HTMLButtonElement>('[data-test="confirm-reject"]')?.disabled).toBe(
      true,
    );
  });
});
