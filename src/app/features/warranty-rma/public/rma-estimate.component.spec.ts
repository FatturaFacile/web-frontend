import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService, PublicEstimate, PublicRmaApiService } from '@core';
import { httpError, i18nStub } from '../testing/rma-fixtures';
import { RmaEstimateComponent } from './rma-estimate.component';

const estimate: PublicEstimate = {
  rma_number: 'RMA-2026-000123',
  status: 'awaiting_estimate_approval',
  serial_number: 'SN123',
  product_name: 'Printer X',
  reported_symptom: 'No power',
  diagnosis_summary: 'Power supply failure',
  warranty_status: 'out_of_warranty_billable',
  lines: [{ description: 'PSU', qty: '1.0000', unit_price: '120.00', total_price: '120.00' }],
  labour_total: '60.00',
  parts_total: '120.00',
  total: '180.00',
  currency: 'CHF',
  decision: null,
  expires_at: '2026-12-15T00:00:00Z',
  company_name: 'Repair Lab SA',
};

describe('RmaEstimateComponent (public)', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  async function setup(token = 'tok') {
    await TestBed.configureTestingModule({
      imports: [RmaEstimateComponent],
      providers: [
        { provide: PublicRmaApiService, useValue: api },
        { provide: I18nService, useValue: i18nStub() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token }) } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RmaEstimateComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    api = {
      getEstimate: vi.fn().mockReturnValue(of({ data: estimate })),
      acceptEstimate: vi.fn(),
      declineEstimate: vi.fn(),
    };
  });

  it('shows the read-only estimate with prices only', async () => {
    const fixture = await setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(api['getEstimate']).toHaveBeenCalledWith('tok');
    expect(text).toContain('RMA-2026-000123');
    expect(text).toContain('Power supply failure');
    expect(text).toContain('Repair Lab SA');
    expect(text).toMatch(/180[.,]00\s*CHF/);
    expect(text).not.toContain('unit_cost');
  });

  it('requires the customer name before accepting', async () => {
    const fixture = await setup();
    await fixture.componentInstance.decide('approved');
    expect(api['acceptEstimate']).not.toHaveBeenCalled();
    expect(fixture.componentInstance.nameError()).toBe('RMA.PUBLIC.NAME_REQUIRED');
  });

  it('accepts with the name and disables further decisions', async () => {
    api['acceptEstimate'].mockReturnValue(
      of({ data: { decision: 'approved', status: 'awaiting_parts' } }),
    );
    const fixture = await setup();
    fixture.componentInstance.name.set('Mario Rossi');
    await fixture.componentInstance.decide('approved');
    fixture.detectChanges();
    expect(api['acceptEstimate']).toHaveBeenCalledWith('tok', { accepted_by_name: 'Mario Rossi' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('RMA.PUBLIC.DECISION_APPROVED');
    const buttons = Array.from(
      el.querySelectorAll('.public-decision button'),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBe(2);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });

  it('declines with name and optional reason', async () => {
    api['declineEstimate'].mockReturnValue(
      of({ data: { decision: 'declined', status: 'ready_for_return' } }),
    );
    const fixture = await setup();
    fixture.componentInstance.name.set('Mario Rossi');
    fixture.componentInstance.reason.set('Too expensive');
    await fixture.componentInstance.decide('declined');
    fixture.detectChanges();
    expect(api['declineEstimate']).toHaveBeenCalledWith('tok', {
      declined_by_name: 'Mario Rossi',
      reason: 'Too expensive',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'RMA.PUBLIC.DECISION_DECLINED',
    );
  });

  it('shows a neutral page for an invalid or expired token (404)', async () => {
    api['getEstimate'].mockReturnValue(httpError(404, { message: 'Not found', code: 'not_found' }));
    const fixture = await setup('expired');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(fixture.componentInstance.state()).toBe('invalid');
    expect(text).toContain('RMA.PUBLIC.INVALID_LINK');
    expect(text).not.toContain('Not found');
    expect(api['getEstimate']).toHaveBeenCalledTimes(1);
  });

  it('shows the existing decision when it was already decided (409)', async () => {
    api['acceptEstimate'].mockReturnValue(httpError(409, { code: 'already_decided' }));
    const fixture = await setup();
    api['getEstimate'].mockReturnValue(of({ data: { ...estimate, decision: 'declined' } }));
    fixture.componentInstance.name.set('Mario Rossi');
    await fixture.componentInstance.decide('approved');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('RMA.ERRORS.ALREADY_DECIDED');
    expect(el.textContent).toContain('RMA.PUBLIC.DECISION_DECLINED');
    const buttons = Array.from(
      el.querySelectorAll('.public-decision button'),
    ) as HTMLButtonElement[];
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });

  it('renders an already decided estimate with disabled buttons on load', async () => {
    api['getEstimate'].mockReturnValue(of({ data: { ...estimate, decision: 'approved' } }));
    const fixture = await setup();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.public-decision button'),
    ) as HTMLButtonElement[];
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});
