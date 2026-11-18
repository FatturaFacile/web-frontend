import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrossBorderReadiness, ForeignTradeApiService } from '@core';
import { CrossBorderFieldsComponent } from './cross-border-fields.component';
import { CrossBorderReadinessComponent } from './cross-border-readiness.component';

describe('CrossBorderFieldsComponent', () => {
  let fixture: ComponentFixture<CrossBorderFieldsComponent>;
  const incoterm = new FormControl<string | null>(null);
  const place = new FormControl<string | null>(null);

  function create(crossBorder: boolean, withCosts: boolean): void {
    fixture = TestBed.createComponent(CrossBorderFieldsComponent);
    fixture.componentRef.setInput('incoterm', incoterm);
    fixture.componentRef.setInput('place', place);
    fixture.componentRef.setInput('crossBorder', crossBorder);
    if (withCosts) {
      fixture.componentRef.setInput('freight', new FormControl<number | null>(null));
      fixture.componentRef.setInput('insurance', new FormControl<number | null>(null));
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CrossBorderFieldsComponent] }).compileComponents();
  });

  it('highlights the block with a warning only for a cross-border counterparty', () => {
    create(true, false);
    expect(fixture.nativeElement.querySelector('section.highlight')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('nz-alert')).not.toBeNull();

    fixture.destroy();
    create(false, false);
    expect(fixture.nativeElement.querySelector('section.highlight')).toBeNull();
    expect(fixture.nativeElement.querySelector('nz-alert')).toBeNull();
  });

  it('shows the freight and insurance fields only when their controls are given', () => {
    create(false, false);
    expect(fixture.nativeElement.querySelectorAll('nz-input-number').length).toBe(0);

    fixture.destroy();
    create(false, true);
    expect(fixture.nativeElement.querySelectorAll('nz-input-number').length).toBe(2);
  });
});

describe('CrossBorderReadinessComponent', () => {
  const getInvoiceReadiness = vi.fn();

  function create(): ComponentFixture<CrossBorderReadinessComponent> {
    const fixture = TestBed.createComponent(CrossBorderReadinessComponent);
    fixture.componentRef.setInput('invoiceId', 'inv-1');
    fixture.detectChanges();
    return fixture;
  }

  const base: CrossBorderReadiness = { cross_border: true, ready: true, issues: [], regime: { regime: 'ch_export_art_23_ltva', vat_exempt: true, reverse_charge: false, requires_vies: false, requires_intrastat: false, requires_customs_declaration: true } };

  beforeEach(async () => {
    getInvoiceReadiness.mockReset();
    await TestBed.configureTestingModule({
      imports: [CrossBorderReadinessComponent],
      providers: [{ provide: ForeignTradeApiService, useValue: { getInvoiceReadiness } }],
    }).compileComponents();
  });

  it('shows the missing customs data of an invoice line', () => {
    getInvoiceReadiness.mockReturnValue(of({ success: true, data: { ...base, ready: false, issues: [{ code: 'net_weight_missing', line: 1 }] } }));
    const fixture = create();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(getInvoiceReadiness).toHaveBeenCalledWith('inv-1');
    expect(fixture.nativeElement.querySelectorAll('ul.issues li').length).toBe(1);
    expect(text).toContain('2');
  });

  it('renders nothing for a domestic invoice and when the request fails', () => {
    getInvoiceReadiness.mockReturnValue(of({ success: true, data: { cross_border: false, ready: true, issues: [], regime: null } }));
    expect(create().nativeElement.querySelector('[data-testid="cross-border-readiness"]')).toBeNull();

    getInvoiceReadiness.mockReturnValue(throwError(() => new Error('boom')));
    expect(create().nativeElement.querySelector('[data-testid="cross-border-readiness"]')).toBeNull();
  });

  it('marks a complete cross-border invoice as ready', () => {
    getInvoiceReadiness.mockReturnValue(of({ success: true, data: base }));
    const fixture = create();

    expect(fixture.nativeElement.querySelector('[data-testid="cross-border-readiness"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('ul.issues')).toBeNull();
  });
});
