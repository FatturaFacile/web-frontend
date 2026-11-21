import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProposalLine, ProposalView } from '@core';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProposalPortalStore } from './proposal-portal.store';

const base = `${environment.apiBaseUrl}/public/proposals/tok`;

function line(
  id: string,
  mode: ProposalLine['selection_mode'],
  selected: boolean,
  extra: Partial<ProposalLine> = {},
): ProposalLine {
  return {
    id,
    section_id: 's1',
    line_type: 'product',
    selection_mode: mode,
    alternative_group: null,
    sku: null,
    description: id,
    long_description: null,
    uom: null,
    quantity: '1',
    unit_price: '100.00',
    tax_rate: '22.0000',
    selected,
    net: selected ? '100.00' : '0.00',
    ...extra,
  };
}

function proposal(lines: ProposalLine[], net: string, status = 'sent'): ProposalView {
  return {
    quote_number: 'OFF-2026-00001.01',
    status,
    currency: 'EUR',
    locale: 'it-IT',
    customer_name: 'Acme',
    valid_until: null,
    payment_terms: null,
    incoterms: null,
    cover_letter: null,
    terms_and_conditions: null,
    signature_level: 'ses_otp',
    sections: [
      { id: 's1', title: 'Hardware', description: null, page_break_before: false, subtotal: net },
    ],
    lines,
    tax_breakdown: [{ rate: '22.0000', net, tax: '0.00' }],
    totals: { net, tax: '0.00', gross: net, rounding: '0.00', payable: net },
    has_signed_document: false,
  };
}

describe('ProposalPortalStore', () => {
  let store: ProposalPortalStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProposalPortalStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ProposalPortalStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const alternatives = [
    line('std', 'alternative_group', true, { alternative_group: 'warranty' }),
    line('ext', 'alternative_group', false, { alternative_group: 'warranty' }),
  ];
  const lines = [line('base', 'mandatory', true), line('opt', 'optional', false), ...alternatives];

  function open(view: ProposalView = proposal(lines, '200.00')): void {
    store.load('tok');
    http.expectOne(base).flush({ data: view });
  }

  it('loads the proposal and exposes the choices as signals', () => {
    open();

    expect(store.loading()).toBe(false);
    expect(store.view()?.quote_number).toBe('OFF-2026-00001.01');
    expect(store.open()).toBe(true);
    expect(store.selections()).toEqual({ opt: false, std: true, ext: false });
    expect(store.alternativeGroups().map((g) => g.group)).toEqual(['warranty']);
    expect(store.linesOf('s1')).toHaveLength(4);
  });

  it('sends every choice when an optional line is toggled and replaces the totals with the recalculated proposal', () => {
    open();

    store.setOptional('opt', true);
    expect(store.recalculating()).toBe(true);
    const req = http.expectOne(`${base}/selections`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ selections: { opt: true, std: true, ext: false } });
    req.flush({
      data: proposal(
        [line('base', 'mandatory', true), line('opt', 'optional', true), ...alternatives],
        '300.00',
      ),
    });

    expect(store.recalculating()).toBe(false);
    expect(store.view()?.totals.net).toBe('300.00');
    expect(store.selections()['opt']).toBe(true);
  });

  it('switches exactly one line of an alternative group on', () => {
    open();

    store.chooseAlternative('warranty', 'ext');
    const req = http.expectOne(`${base}/selections`);
    expect(req.request.body).toEqual({ selections: { opt: false, std: false, ext: true } });
    req.flush({ data: proposal(lines, '200.00') });
  });

  it('offers the PIN gate on a refused link, then reloads with the session header', () => {
    store.load('tok');
    http.expectOne(base).flush({}, { status: 404, statusText: 'Not Found' });
    expect(store.pinRequired()).toBe(true);
    expect(store.invalid()).toBe(false);

    store.unlock('123456');
    http.expectOne(`${base}/verify-pin`).flush({ data: { session: 'sess-1' } });
    const reload = http.expectOne(base);
    expect(reload.request.headers.get('X-Proposal-Session')).toBe('sess-1');
    reload.flush({ data: proposal(lines, '200.00') });
    expect(store.pinRequired()).toBe(false);
    expect(store.view()).not.toBeNull();
  });

  it('flags a wrong PIN and keeps the gate open', () => {
    store.load('tok');
    http.expectOne(base).flush({}, { status: 404, statusText: 'Not Found' });

    store.unlock('000000');
    http.expectOne(`${base}/verify-pin`).flush({}, { status: 404, statusText: 'Not Found' });

    expect(store.pinInvalid()).toBe(true);
    expect(store.pinRequired()).toBe(true);
  });

  it('runs the one-time code signature and reloads the accepted proposal', () => {
    open();

    store.startSignature({ signer_name: 'Jane', otp_channel: 'email', consent: true });
    http
      .expectOne(`${base}/signature`)
      .flush({ data: { envelope_id: 'env-1', otp_sent: true, channel: 'email' } });
    expect(store.signatureStep()?.envelope_id).toBe('env-1');

    store.confirmCode('123456');
    const complete = http.expectOne(`${base}/signature/complete`);
    expect(complete.request.body).toEqual({ envelope_id: 'env-1', otp: '123456' });
    complete.flush({
      data: {
        quote_number: 'OFF-2026-00001.01',
        status: 'accepted',
        signed_document_hash: 'a',
        audit_certificate_hash: 'b',
      },
    });
    http
      .expectOne(base)
      .flush({ data: { ...proposal(lines, '200.00', 'accepted'), has_signed_document: true } });

    expect(store.outcome()).toBe('signed');
    expect(store.accepted()).toBe(true);
    expect(store.open()).toBe(false);
  });

  it('keeps the signature open when the code is wrong', () => {
    open();
    store.startSignature({ signer_name: 'Jane', otp_channel: 'email', consent: true });
    http.expectOne(`${base}/signature`).flush({ data: { envelope_id: 'env-1', otp_sent: true } });

    store.confirmCode('000000');
    http
      .expectOne(`${base}/signature/complete`)
      .flush({}, { status: 404, statusText: 'Not Found' });

    expect(store.codeInvalid()).toBe(true);
    expect(store.outcome()).toBeNull();
    expect(store.open()).toBe(true);
  });

  it('rejects with the reason and closes the proposal', () => {
    open();

    store.reject('Too expensive');
    const req = http.expectOne(`${base}/reject`);
    expect(req.request.body).toEqual({ reason: 'Too expensive' });
    req.flush({ data: { status: 'rejected' } });

    expect(store.outcome()).toBe('rejected');
    expect(store.open()).toBe(false);
  });
});
