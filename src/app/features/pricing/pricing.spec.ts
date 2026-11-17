import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarginDocumentCheck, MarginStatus, PricingApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { DocumentMarginGuardComponent } from './document-margin-guard.component';
import { MarginBadgeComponent } from './margin-badge.component';
import { MarginOverrideModalComponent } from './margin-override-modal.component';
import {
  applyDiscountCascade,
  canConfirmDocument,
  effectiveDiscountPercent,
  parseDiscountCascade,
  previewCascade,
  roundPrice,
  worstMarginStatus,
} from './pricing.util';

const translateSpy = {
  instant: vi.fn().mockImplementation((key: string) => key),
  translate: vi.fn().mockImplementation((key: string) => key),
};
const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

function provide(api: Record<string, unknown>): void {
  TestBed.configureTestingModule({
    providers: [
      { provide: PricingApiService, useValue: api },
      { provide: TranslateService, useValue: translateSpy },
      { provide: NzMessageService, useValue: messageSpy },
      provideNzIcons(icons),
    ],
  });
}

describe('discount cascade', () => {
  it('parses the commercial notation and refuses malformed ones', () => {
    expect(parseDiscountCascade('30+5+2')).toEqual([30, 5, 2]);
    expect(parseDiscountCascade(' 12,5 + 2 ')).toEqual([12.5, 2]);
    expect(parseDiscountCascade('')).toEqual([]);
    expect(parseDiscountCascade('20+')).toBeNull();
    expect(parseDiscountCascade('abc')).toBeNull();
    expect(parseDiscountCascade('120')).toBeNull();
  });

  it('chains multiplicatively (100 - 20% - 5% = 76) and adds up additively (75)', () => {
    expect(applyDiscountCascade(100, [20, 5])).toBe(76);
    expect(applyDiscountCascade(100, [20, 5], 'ADDITIVE')).toBe(75);
    expect(effectiveDiscountPercent([20, 5])).toBe(24);
    expect(effectiveDiscountPercent([20, 5], 'ADDITIVE')).toBe(25);
  });

  it('rounds to the nearest 0.05 for Swiss prices', () => {
    expect(roundPrice(19.3903, 'SWISS_005')).toBe(19.4);
    expect(roundPrice(19.3749, 'SWISS_005')).toBe(19.35);
    expect(roundPrice(10.005, 'HALF_UP_001')).toBe(10.01);
    expect(roundPrice(10.0049, 'NONE')).toBe(10.0049);
  });

  it('previews the net price live, with rounding, and flags an invalid notation', () => {
    const preview = previewCascade(19.99, '3', 'MULTIPLICATIVE', 'SWISS_005');
    expect(preview.valid).toBe(true);
    expect(preview.net).toBe(19.3903);
    expect(preview.rounded).toBe(19.4);
    expect(preview.steps).toEqual([{ percent: 3, price: 19.3903 }]);

    const chained = previewCascade(100, '30+5+2', 'MULTIPLICATIVE', 'NONE');
    expect(chained.steps.map((step) => step.price)).toEqual([70, 66.5, 65.17]);
    expect(chained.effectivePercent).toBe(34.83);

    expect(previewCascade(100, '30+x', 'MULTIPLICATIVE', 'NONE').valid).toBe(false);
  });
});

describe('margin guardrail states', () => {
  it('shows the weakest status and blocks only without an approval', () => {
    expect(worstMarginStatus(['OK', 'WARNING'])).toBe('WARNING');
    expect(worstMarginStatus(['OK', 'BLOCKED', 'WARNING'])).toBe('BLOCKED');
    expect(worstMarginStatus([])).toBe('OK');
    expect(canConfirmDocument('BLOCKED', false)).toBe(false);
    expect(canConfirmDocument('BLOCKED', true)).toBe(true);
    expect(canConfirmDocument('WARNING', false)).toBe(true);
  });
});

describe('MarginBadgeComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translateSpy }, provideNzIcons(icons)],
    });
  });

  it.each([
    ['OK', 'green'],
    ['WARNING', 'orange'],
    ['BLOCKED', 'red'],
  ] as [MarginStatus, string][])('renders the %s state in %s', (status, color) => {
    const fixture = TestBed.createComponent(MarginBadgeComponent);
    fixture.componentRef.setInput('status', status);
    fixture.componentRef.setInput('percent', '20.00');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.color()).toBe(color);
    expect(element.querySelector('[data-status]')?.getAttribute('data-status')).toBe(status);
    expect(element.textContent).toContain(`PRICING.MARGIN_${status}`);
    expect(element.textContent).toContain('20 %');
  });
});

describe('DocumentMarginGuardComponent', () => {
  function create(check: MarginDocumentCheck | Error): {
    element: HTMLElement;
    blocked: boolean[];
    checkSpy: ReturnType<typeof vi.fn>;
  } {
    const checkSpy = vi
      .fn()
      .mockReturnValue(check instanceof Error ? throwError(() => check) : of({ data: check }));
    provide({ checkDocumentMargin: checkSpy, approveMarginOverride: vi.fn() });

    const fixture = TestBed.createComponent(DocumentMarginGuardComponent);
    const blocked: boolean[] = [];
    fixture.componentInstance.blockedChange.subscribe((value) => blocked.push(value));
    fixture.componentRef.setInput('documentType', 'sales_order');
    fixture.componentRef.setInput('documentId', 'o-1');
    fixture.detectChanges();

    return { element: fixture.nativeElement as HTMLElement, blocked, checkSpy };
  }

  it('blocks the document and offers the override when the margin is below the minimum', () => {
    const { element, blocked, checkSpy } = create({
      status: 'BLOCKED',
      margin_percent: '20.00',
      threshold_percent: '30.00',
      has_approval: false,
    });

    expect(checkSpy).toHaveBeenCalledWith('sales_order', 'o-1');
    expect(blocked).toEqual([true]);
    expect(element.querySelector('[data-status="BLOCKED"]')).not.toBeNull();
    expect(element.textContent).toContain('PRICING.OVERRIDE_REQUEST');
  });

  it('lets an approved document through and hides the override action', () => {
    const { element, blocked } = create({
      status: 'BLOCKED',
      margin_percent: '20.00',
      threshold_percent: '30.00',
      has_approval: true,
    });

    expect(blocked).toEqual([false]);
    expect(element.textContent).not.toContain('PRICING.OVERRIDE_REQUEST');
  });

  it('shows a green badge and no override for a healthy margin', () => {
    const { element, blocked } = create({
      status: 'OK',
      margin_percent: '60.00',
      threshold_percent: '30.00',
      has_approval: false,
    });

    expect(blocked).toEqual([false]);
    expect(element.querySelector('[data-status="OK"]')).not.toBeNull();
  });

  it('does not guard the document when the pricing module cannot be read', () => {
    const { element, blocked } = create(new Error('forbidden'));

    expect(blocked).toEqual([false]);
    expect(element.querySelector('[data-testid="margin-guard"]')).toBeNull();
  });
});

describe('MarginOverrideModalComponent', () => {
  function create(request: unknown): {
    component: MarginOverrideModalComponent;
    api: { approveMarginOverride: ReturnType<typeof vi.fn> };
  } {
    const api = { approveMarginOverride: vi.fn().mockReturnValue(request) };
    provide(api);
    const fixture = TestBed.createComponent(MarginOverrideModalComponent);
    fixture.componentRef.setInput('documentType', 'sales_order');
    fixture.componentRef.setInput('documentId', 'o-1');
    fixture.detectChanges();

    return { component: fixture.componentInstance, api };
  }

  it('sends the approval with the notes and reports it', () => {
    const { component, api } = create(of({ data: {} }));
    const approved = vi.fn();
    component.approved.subscribe(approved);

    component.notes = 'Strategic customer';
    component.approve();

    expect(api.approveMarginOverride).toHaveBeenCalledWith(
      'sales_order',
      'o-1',
      'Strategic customer',
    );
    expect(approved).toHaveBeenCalled();
    expect(messageSpy.success).toHaveBeenCalledWith('PRICING.OVERRIDE_APPROVED');
  });

  it('keeps the document blocked and reports the failure when the role may not authorize', () => {
    const { component } = create(throwError(() => new Error('403')));
    const approved = vi.fn();
    component.approved.subscribe(approved);

    component.approve();

    expect(approved).not.toHaveBeenCalled();
    expect(messageSpy.error).toHaveBeenCalledWith('PRICING.ACTION_ERROR');
  });
});
