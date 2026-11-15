import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientApiService, I18nService, WarrantyRmaApiService } from '@core';
import { RmaNotifier } from '../../state/action-result';
import { SerialLookupStore } from '../../state/serial-lookup.store';
import { httpError, i18nStub, lookupFixture, rmaFixture } from '../../testing/rma-fixtures';
import { SerialLookupComponent } from './serial-lookup.component';

describe('SerialLookupComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  async function setup(serial: string) {
    await TestBed.configureTestingModule({
      imports: [SerialLookupComponent],
      providers: [
        provideRouter([]),
        SerialLookupStore,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ serial }) } },
        },
        { provide: WarrantyRmaApiService, useValue: api },
        {
          provide: ClientApiService,
          useValue: { list: vi.fn().mockReturnValue(of({ data: [] })) },
        },
        { provide: I18nService, useValue: i18nStub() },
        { provide: RmaNotifier, useValue: { success: vi.fn(), conflict: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SerialLookupComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    api = {
      lookupSerial: vi.fn().mockReturnValue(of({ data: lookupFixture() })),
      issueRma: vi.fn(),
    };
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
  });

  it('renders the warranty card with RMA history and the issue button', async () => {
    const fixture = await setup('SN123');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('RMA.LOOKUP.IN_WARRANTY');
    expect(el.textContent).toContain('RMA.POLICY.STATUTORY_CH_24M');
    expect(el.textContent).toContain('120');
    expect(el.textContent).toContain('RMA-2026-000100');
    expect(el.textContent).toContain('RMA.ISSUE.BUTTON');
  });

  it('shows "serial not found" with a create passport action', async () => {
    api['lookupSerial'].mockReturnValue(httpError(404, { code: 'serial_not_found' }));
    const fixture = await setup('XYZ');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('RMA.ERRORS.SERIAL_NOT_FOUND');
    expect(el.textContent).toContain('RMA.PASSPORT.CREATE');
    expect(fixture.componentInstance.passportPrefill().serial_number).toBe('XYZ');
  });

  it('prefills the passport from the stock hint when the passport is missing', async () => {
    api['lookupSerial'].mockReturnValue(
      httpError(404, {
        code: 'passport_missing',
        stock_hint: { stock_serial_number_id: 'ss-1', serial_number: 'SN9' },
      }),
    );
    const fixture = await setup('SN9');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'RMA.ERRORS.PASSPORT_MISSING',
    );
    expect(fixture.componentInstance.passportPrefill()).toEqual({
      serial_number: 'SN9',
      stock_serial_number_id: 'ss-1',
      product_id: null,
    });
  });

  it('shows the label with barcode and the once-only tracking link after issuing an RMA', async () => {
    api['issueRma'].mockReturnValue(
      of({
        data: {
          ...rmaFixture({ status: 'awaiting_arrival' }),
          label: {
            rma_number: 'RMA-2026-000123',
            serial_number: 'SN123',
            product_name: null,
            customer_name: 'ACME SA',
            return_address: null,
            barcode_payload: 'RMA-2026-000123',
            tracking_url: 'https://app.test/rma-tracking?rma=RMA-2026-000123&token=raw',
            tracking_token: 'raw',
          },
        },
      }),
    );
    const fixture = await setup('SN123');
    await fixture.componentInstance.store.issueRma({
      equipment_passport_id: 'pp-1',
      reported_symptom: 'No power',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const overlay = document.body;
    expect(overlay.querySelector('.rma-label-barcode')).not.toBeNull();
    expect(overlay.querySelectorAll('.rma-label-barcode rect').length).toBeGreaterThan(10);
    expect(overlay.textContent).toContain(
      'https://app.test/rma-tracking?rma=RMA-2026-000123&token=raw',
    );

    fixture.componentInstance.store.dismissLabel();
    fixture.detectChanges();
    expect(fixture.componentInstance.store.issuedLabel()).toBeNull();
  });
});
