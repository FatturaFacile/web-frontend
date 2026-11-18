import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthStore,
  CpqApiService,
  CpqApprovalOverview,
  CpqApprovalRequest,
  CpqMarginTotals,
  CpqPublicSigningView,
  CpqRevisionDiff,
  CpqRevisionSummary,
  I18nService,
} from '@core';
import { CpqApprovalPanelComponent } from './approval-panel.component';
import { CpqMarginSimulatorComponent } from './margin-simulator.component';
import { CpqRevisionDiffComponent } from './revision-diff.component';
import { CpqSignatureLinkComponent } from './signature-link.component';
import { QuoteSignatureComponent } from '../../quote-signature/quote-signature.component';

const envelope = <T>(data: T) => ({ success: true, message: 'ok', data });

const totals = (overrides: Partial<CpqMarginTotals> = {}): CpqMarginTotals => ({
  list_total: '1000.00',
  line_discount_total: '0.00',
  global_discount_percent: '0.00',
  global_discount_amount: '0.00',
  surcharge_amount: '0.00',
  net_total: '1000.00',
  cost_total: '600.00',
  margin_amount: '400.00',
  margin_percent: '40.00',
  ...overrides,
});

const api = {
  getMargin: vi.fn(),
  simulate: vi.fn(),
  getRevisions: vi.fn(),
  diff: vi.fn(),
  getApprovals: vi.fn(),
  submitForApproval: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  createSignatureLink: vi.fn(),
  getSignatureRequests: vi.fn(),
  verifySignature: vi.fn(),
  getPublicSigning: vi.fn(),
  getPublicPdf: vi.fn(),
  signPublic: vi.fn(),
  requestPublicChanges: vi.fn(),
};
const i18n = {
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('it'),
  languages: [{ code: 'en', label: 'English', flag: '' }, { code: 'it', label: 'Italiano', flag: '' }, { code: 'de', label: 'Deutsch', flag: '' }, { code: 'fr', label: 'Français', flag: '' }],
  setLanguage: vi.fn().mockResolvedValue({}),
};
const role = signal('sales_manager');

async function setup<T>(component: new () => T, inputs: Record<string, unknown> = {}, extra: unknown[] = []): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [
      { provide: CpqApiService, useValue: api },
      { provide: I18nService, useValue: i18n },
      { provide: AuthStore, useValue: { activeRole: role } },
      ...(extra as []),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(component);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

const text = (fixture: ComponentFixture<unknown>): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
const query = (fixture: ComponentFixture<unknown>, selector: string): HTMLElement | null =>
  (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);

beforeEach(() => {
  vi.clearAllMocks();
  role.set('sales_manager');
});

describe('CpqMarginSimulatorComponent', () => {
  it('shows cost and margin and simulates a target margin', async () => {
    api.getMargin.mockReturnValue(of(envelope({ lines: [], totals: totals() })));
    api.simulate.mockReturnValue(
      of(envelope({ mode: 'target_margin_percent', current: totals(), simulated: totals({ margin_percent: '25.00', net_total: '800.00' }), global_discount_percent: '20.00', achievable: true })),
    );
    const fixture = await setup(CpqMarginSimulatorComponent, { quoteId: 'q1' });

    expect(query(fixture, '[data-test="figures"]')).not.toBeNull();
    expect(text(fixture)).toContain('600.00');

    fixture.componentInstance['form'].setValue({ mode: 'target_margin_percent', value: 25 });
    fixture.componentInstance['run']();
    fixture.detectChanges();

    expect(api.simulate).toHaveBeenCalledWith('q1', { mode: 'target_margin_percent', value: 25 });
    expect(text(fixture)).toContain('20.00 %');
    expect(query(fixture, '[data-test="not-achievable"]')).toBeNull();
  });

  it('warns when the target cannot be reached', async () => {
    api.getMargin.mockReturnValue(of(envelope({ lines: [], totals: totals() })));
    api.simulate.mockReturnValue(of(envelope({ mode: 'target_margin_percent', current: totals(), simulated: totals(), global_discount_percent: '0.00', achievable: false })));
    const fixture = await setup(CpqMarginSimulatorComponent, { quoteId: 'q1' });

    fixture.componentInstance['run']();
    fixture.detectChanges();

    expect(query(fixture, '[data-test="not-achievable"]')).not.toBeNull();
  });

  it('hides cost and margin when the API forbids them to the role', async () => {
    api.getMargin.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const fixture = await setup(CpqMarginSimulatorComponent, { quoteId: 'q1' });

    expect(query(fixture, '[data-test="cost-hidden"]')).not.toBeNull();
    expect(query(fixture, '[data-test="figures"]')).toBeNull();
    expect(query(fixture, '[data-test="simulate"]')).toBeNull();
  });
});

describe('CpqRevisionDiffComponent', () => {
  const revisions: CpqRevisionSummary[] = [
    { id: 'q1', quote_number: 'Q-1', revision_number: 1, status: 'superseded', is_current_revision: false, revision_notes: null, total_net: '1000.00', total_gross: '1081.00', created_at: null },
    { id: 'q2', quote_number: 'Q-2', revision_number: 2, status: 'draft', is_current_revision: true, revision_notes: 'Lower price', total_net: '900.00', total_gross: '972.90', created_at: null },
  ];
  const diff: CpqRevisionDiff = {
    from: { id: 'q1', quote_number: 'Q-1', revision_number: 1, status: 'superseded', revision_notes: null },
    to: { id: 'q2', quote_number: 'Q-2', revision_number: 2, status: 'draft', revision_notes: 'Lower price' },
    items: {
      added: [{ description: 'Accessory B', product_id: null, quantity: '1.0000', unit_price: '50.0000', discount_percentage: '0.00', line_total: '50.00' }],
      removed: [],
      modified: [{ description: 'Press', product_id: null, changes: { unit_price: { from: '1000.0000', to: '900.0000' } } }],
    },
    totals: { total_net: { from: '1000.00', to: '900.00', delta: '-100.00' } },
  };

  it('lists the revisions and compares the last two by default', async () => {
    api.getRevisions.mockReturnValue(of(envelope(revisions)));
    api.diff.mockReturnValue(of(envelope(diff)));
    const fixture = await setup(CpqRevisionDiffComponent, { quoteId: 'q2' });

    expect(text(fixture)).toContain('Rev 2');
    expect(text(fixture)).toContain('Lower price');
    expect(fixture.componentInstance['form'].getRawValue()).toEqual({ from: 'q1', to: 'q2' });

    fixture.componentInstance['compare']();
    fixture.detectChanges();

    expect(api.diff).toHaveBeenCalledWith('q1', 'q2');
    expect(query(fixture, '[data-test="added"]')).not.toBeNull();
    expect(query(fixture, '[data-test="modified"]')?.textContent).toContain('unit_price: 1000.0000 → 900.0000');
    expect(query(fixture, '[data-test="totals"]')?.textContent).toContain('-100.00');
  });

  it('does not compare a revision with itself', async () => {
    api.getRevisions.mockReturnValue(of(envelope(revisions)));
    const fixture = await setup(CpqRevisionDiffComponent, { quoteId: 'q2' });

    fixture.componentInstance['form'].setValue({ from: 'q2', to: 'q2' });
    fixture.componentInstance['compare']();

    expect(api.diff).not.toHaveBeenCalled();
  });
});

describe('CpqApprovalPanelComponent', () => {
  const request = (status: CpqApprovalRequest['status']): CpqApprovalRequest => ({
    id: 'r1',
    quote_id: 'q1',
    level: 1,
    required_role: 'sales_manager',
    status,
    triggers: [{ type: 'max_line_discount_percent', limit: '10.00', actual: '15.00' }],
    requested_by: null,
    approved_by: null,
    rejected_by: null,
    decided_at: null,
    rejection_reason: null,
  });
  const overview = (status: CpqApprovalRequest['status'] | null, cleared: boolean): CpqApprovalOverview => ({
    evaluation: { required_level: status === null ? 0 : 1, breaches: [] },
    cleared,
    requests: status === null ? [] : [request(status)],
  });

  it('shows the pending banner and lets a manager approve', async () => {
    api.getApprovals.mockReturnValue(of(envelope(overview('pending', false))));
    api.approve.mockReturnValue(of(envelope(request('approved'))));
    const fixture = await setup(CpqApprovalPanelComponent, { quoteId: 'q1' });
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    expect(query(fixture, '[data-test="banner-pending"]')).not.toBeNull();
    expect(text(fixture)).toContain('15.00 / 10.00');
    expect(query(fixture, '[data-test="approve"]')).not.toBeNull();
    expect(query(fixture, '[data-test="submit"]')).toBeNull();

    fixture.componentInstance['approve']();

    expect(api.approve).toHaveBeenCalledWith('q1');
    expect(changed).toHaveBeenCalled();
  });

  it('does not offer the decision to a sales person, who can only submit', async () => {
    role.set('sales');
    api.getApprovals.mockReturnValue(of(envelope(overview(null, false))));
    const fixture = await setup(CpqApprovalPanelComponent, { quoteId: 'q1' });

    expect(query(fixture, '[data-test="approve"]')).toBeNull();
    expect(query(fixture, '[data-test="submit"]')).not.toBeNull();
  });

  it('rejects with a mandatory reason', async () => {
    api.getApprovals.mockReturnValue(of(envelope(overview('pending', false))));
    api.reject.mockReturnValue(of(envelope(request('rejected'))));
    const fixture = await setup(CpqApprovalPanelComponent, { quoteId: 'q1' });

    fixture.componentInstance['rejecting'].set(true);
    fixture.componentInstance['reject']();
    expect(api.reject).not.toHaveBeenCalled();

    fixture.componentInstance['rejectForm'].setValue({ reason: 'Margin too thin' });
    fixture.componentInstance['reject']();
    expect(api.reject).toHaveBeenCalledWith('q1', 'Margin too thin');
  });

  it('shows the rejected banner', async () => {
    api.getApprovals.mockReturnValue(of(envelope(overview('rejected', false))));
    const fixture = await setup(CpqApprovalPanelComponent, { quoteId: 'q1' });

    expect(query(fixture, '[data-test="banner-rejected"]')).not.toBeNull();
  });
});

describe('CpqSignatureLinkComponent', () => {
  it('creates a link in the chosen language and flags a signed quote that changed', async () => {
    api.getSignatureRequests.mockReturnValue(
      of(envelope([{ id: 'r1', quote_id: 'q1', locale: 'de', status: 'signed', expires_at: 'x', signer_name: 'Anna', signer_role: 'CEO', purchase_order_number: null, signature_type: 'typed', selected_optional_item_ids: [], change_request: null, signed_at: 'y', ip_address: '1.2.3.4', payload_hash: 'abc', pdf_hash: 'def' }])),
    );
    api.createSignatureLink.mockReturnValue(of(envelope({ request: {}, token: 'tok', url: 'https://app/quote-signature/tok' })));
    api.verifySignature.mockReturnValue(of(envelope({ valid: false, expected_hash: 'abc', actual_hash: 'zzz' })));
    const fixture = await setup(CpqSignatureLinkComponent, { quoteId: 'q1' });

    fixture.componentInstance['form'].setValue({ locale: 'de' });
    fixture.componentInstance['create']();
    fixture.detectChanges();
    expect(api.createSignatureLink).toHaveBeenCalledWith('q1', 'de');
    expect(text(fixture)).toContain('https://app/quote-signature/tok');

    query(fixture, '[data-test="verify"]')?.click();
    fixture.detectChanges();
    expect(query(fixture, '[data-test="integrity-broken"]')).not.toBeNull();
  });
});

describe('QuoteSignatureComponent', () => {
  const view = (allowOptional: boolean): CpqPublicSigningView => ({
    locale: 'de',
    expires_at: '2027-12-01T00:00:00Z',
    quote: {
      quote_number: 'Q-1',
      date: '2027-11-23',
      valid_until: null,
      currency: 'EUR',
      status: 'draft',
      allow_optional_selection: allowOptional,
      total_net: '1000.00',
      total_tax: '81.00',
      total_gross: '1081.00',
      items: [
        { id: 'l1', description: 'Press', quantity: '1', unit_price: '1000', tax_rate: '8.10', discount_percentage: '0', line_total: '1000.00', is_optional: false, is_selected: true, specs: ['Color: Red'] },
        { id: 'l2', description: 'Warranty', quantity: '1', unit_price: '200', tax_rate: '8.10', discount_percentage: '0', line_total: '200.00', is_optional: true, is_selected: false, specs: [] },
      ],
    },
  });
  const route = { snapshot: { paramMap: convertToParamMap({ token: 'tok' }) } };

  const open = async (allowOptional = true) => {
    api.getPublicSigning.mockReturnValue(of(envelope(view(allowOptional))));
    api.getPublicPdf.mockReturnValue(of(new Blob(['%PDF'])));
    URL.createObjectURL = vi.fn(() => 'blob:pdf');
    URL.revokeObjectURL = vi.fn();

    return setup(QuoteSignatureComponent, {}, [{ provide: ActivatedRoute, useValue: route }]);
  };

  it('shows the quote in the language of the link and the specs of the lines', async () => {
    const fixture = await open();

    expect(i18n.setLanguage).toHaveBeenCalledWith('de');
    expect(text(fixture)).toContain('Color: Red');
    expect(query(fixture, '[data-test="pdf"]')).not.toBeNull();
  });

  it('shows an unavailable message for an invalid link', async () => {
    api.getPublicSigning.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422 })));
    const fixture = await setup(QuoteSignatureComponent, {}, [{ provide: ActivatedRoute, useValue: route }]);

    expect(query(fixture, '[data-test="invalid"]')).not.toBeNull();
  });

  it('cannot sign before the terms are accepted and the signature is given', async () => {
    const fixture = await open();
    const component = fixture.componentInstance;

    expect(component['canSign']()).toBe(false);
    component['form'].patchValue({ signer_name: 'Anna', signer_role: 'CEO', typed_signature: 'Anna Keller' });
    expect(component['canSign']()).toBe(false);
    component['form'].patchValue({ accept_terms: true });
    expect(component['canSign']()).toBe(true);
  });

  it('signs with the selected optional lines and the signer details', async () => {
    api.signPublic.mockReturnValue(of(envelope({})));
    const fixture = await open();
    const component = fixture.componentInstance;

    component['toggle']({ id: 'l2' } as never, true);
    component['form'].patchValue({ signer_name: 'Anna', signer_role: 'CEO', purchase_order_number: 'PO-7', typed_signature: 'Anna Keller', accept_terms: true });
    component['sign']();
    fixture.detectChanges();

    expect(api.signPublic).toHaveBeenCalledWith('tok', {
      signer_name: 'Anna',
      signer_role: 'CEO',
      purchase_order_number: 'PO-7',
      signature_type: 'typed',
      signature_data: 'Anna Keller',
      selected_optional_item_ids: ['l2'],
      accept_terms: true,
    });
    expect(query(fixture, '[data-test="signed"]')).not.toBeNull();
  });

  it('does not send the optional selection when the quote does not allow it', async () => {
    api.signPublic.mockReturnValue(of(envelope({})));
    const fixture = await open(false);
    const component = fixture.componentInstance;

    component['form'].patchValue({ signer_name: 'Anna', signer_role: 'CEO', typed_signature: 'Anna', accept_terms: true });
    component['sign']();

    expect(api.signPublic.mock.calls[0][1].selected_optional_item_ids).toBeNull();
  });

  it('shows the server message when the signature is refused', async () => {
    api.signPublic.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'This signature link has expired.' } })));
    const fixture = await open();
    const component = fixture.componentInstance;

    component['form'].patchValue({ signer_name: 'Anna', signer_role: 'CEO', typed_signature: 'Anna', accept_terms: true });
    component['sign']();
    fixture.detectChanges();

    expect(query(fixture, '[data-test="error"]')?.textContent).toContain('This signature link has expired.');
  });

  it('asks changes instead of signing', async () => {
    api.requestPublicChanges.mockReturnValue(of(envelope({})));
    const fixture = await open();
    const component = fixture.componentInstance;

    component['requesting'].set(true);
    component['changesForm'].setValue({ message: 'Add delivery' });
    component['requestChanges']();
    fixture.detectChanges();

    expect(api.requestPublicChanges).toHaveBeenCalledWith('tok', 'Add delivery');
    expect(query(fixture, '[data-test="changes-sent"]')).not.toBeNull();
  });
});
