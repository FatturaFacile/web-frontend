import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { I18nService, PermissionsService } from '@core';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { i18nStub } from '../hr/recruiting/testing/recruiting-fixtures';
import { QuoteDetail, QuoteLineDto } from './cpq-quotes.models';
import { QuoteEditorComponent } from './quote-editor.component';

const base = `${environment.apiBaseUrl}/cpq/quotes`;

function lineDto(
  id: string,
  sectionId: string,
  price: string,
  extra: Partial<QuoteLineDto> = {},
): QuoteLineDto {
  return {
    id,
    section_id: sectionId,
    line_type: 'product',
    selection_mode: 'mandatory',
    alternative_group: null,
    is_default_selected: true,
    sku: null,
    description: `Line ${id}`,
    uom: null,
    quantity: '1.0000',
    unit_price: price,
    unit_cost: '40.0000',
    discount_percent: '0.0000',
    discount_fixed: '0.0000',
    tier_prices: null,
    tax_rate: '22.0000',
    sort_order: 0,
    ...extra,
  };
}

function quote(status: QuoteDetail['status'] = 'draft'): QuoteDetail {
  return {
    id: 'q1',
    root_quote_id: 'q1',
    parent_quote_id: null,
    quote_number: 'OFF-2026-00001.01',
    revision: 1,
    status,
    jurisdiction: 'IT',
    locale: 'it-IT',
    contact_id: null,
    customer_name: 'Acme',
    customer_email: null,
    currency: 'EUR',
    valid_until: null,
    payment_terms: null,
    incoterms: null,
    cover_letter: null,
    terms_and_conditions: null,
    header_discount_percent: '0.0000',
    min_margin_percent: null,
    requires_approval: false,
    auto_convert: false,
    signature_level: 'ses_otp',
    totals: {
      net: '150.00',
      tax: '33.00',
      gross: '183.00',
      cost: '80.00',
      margin_percent: '46.67',
    },
    issued_at: null,
    accepted_at: null,
    converted_sales_order_id: null,
    sections: [
      {
        id: 's1',
        title: 'Hardware',
        description: null,
        page_break_before: false,
        discount_percent: '0.0000',
        sort_order: 0,
      },
      {
        id: 's2',
        title: 'Services',
        description: null,
        page_break_before: false,
        discount_percent: '0.0000',
        sort_order: 1,
      },
    ],
    lines: [lineDto('a', 's1', '100.0000'), lineDto('b', 's2', '50.0000')],
  };
}

describe('QuoteEditorComponent', () => {
  let fixture: ComponentFixture<QuoteEditorComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.trim() ?? '';

  async function open(status: QuoteDetail['status'] = 'draft', canCosts = true): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [QuoteEditorComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: i18nStub() },
        {
          provide: PermissionsService,
          useValue: { canRead: () => canCosts, canWrite: () => canCosts },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'q1' }) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(QuoteEditorComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/q1`).flush({ data: quote(status) });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  describe('draft', () => {
    beforeEach(() => open());

    it('renders the sections, their lines and the totals', () => {
      expect(el().querySelectorAll('[data-section]')).toHaveLength(2);
      expect(el().querySelectorAll('[data-line]')).toHaveLength(2);
      expect(text('[data-test="total-net"]')).toBe('150.00');
      expect(text('[data-test="total-payable"]')).toBe('183.00');
    });

    it('recalculates the line, section subtotal and totals on every keystroke', async () => {
      const price = el().querySelector<HTMLInputElement>(
        '[data-line="a"] [data-test="unit-price"]',
      );
      expect(price).not.toBeNull();

      (price as HTMLInputElement).value = '200';
      (price as HTMLInputElement).dispatchEvent(new Event('input'));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(text('[data-line="a"] [data-test="line-net"]')).toBe('200.00');
      expect(text('[data-section="s1"] [data-test="section-subtotal"]')).toBe('200.00');
      expect(text('[data-test="total-net"]')).toBe('250.00');
      expect(text('[data-test="total-payable"]')).toBe('305.00');
      expect(el().querySelector<HTMLButtonElement>('[data-test="save"]')?.disabled).toBe(false);
    });

    it('moves a line into another section on drop and moves the subtotal with it', async () => {
      const target = fixture.debugElement.componentInstance as unknown as {
        dropLine: (e: CdkDragDrop<string>) => void;
      };

      target.dropLine({
        item: { data: 'a' },
        container: { data: 's2' },
        currentIndex: 0,
      } as unknown as CdkDragDrop<string>);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el().querySelector('[data-section="s2"] [data-line="a"]')).not.toBeNull();
      expect(el().querySelector('[data-section="s1"] [data-line]')).toBeNull();
      expect(text('[data-section="s1"] [data-test="section-subtotal"]')).toBe('0.00');
      expect(text('[data-section="s2"] [data-test="section-subtotal"]')).toBe('150.00');
      expect(text('[data-test="total-net"]')).toBe('150.00');
    });

    it('reorders the sections on drop', async () => {
      const target = fixture.debugElement.componentInstance as unknown as {
        dropSection: (e: CdkDragDrop<string>) => void;
      };

      target.dropSection({ previousIndex: 0, currentIndex: 1 } as unknown as CdkDragDrop<string>);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(
        [...el().querySelectorAll('[data-section]')].map((s) => s.getAttribute('data-section')),
      ).toEqual(['s2', 's1']);
    });

    it('adds a line with the quick-add buttons and switches it to optional', async () => {
      el()
        .querySelector<HTMLButtonElement>('[data-section="s1"] [data-test="add-product"]')
        ?.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el().querySelectorAll('[data-section="s1"] [data-line]')).toHaveLength(2);

      el()
        .querySelectorAll<HTMLElement>('[data-section="s1"] [data-line]')[1]
        .querySelector<HTMLElement>('[data-test="mode-optional"]')
        ?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el().querySelectorAll('[data-section="s1"] .line.off')).toHaveLength(1);
    });

    it('shows the margin drawer to the authorized and the issue button only once saved', async () => {
      expect(el().querySelector('[data-test="margin"]')).not.toBeNull();
      expect(el().querySelector<HTMLButtonElement>('[data-test="issue"]')?.disabled).toBe(false);

      el().querySelector<HTMLButtonElement>('[data-test="add-section"]')?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el().querySelector<HTMLButtonElement>('[data-test="issue"]')?.disabled).toBe(true);
    });
  });

  it('hides the margin drawer from roles without access', async () => {
    await open('draft', false);

    expect(el().querySelector('[data-test="margin"]')).toBeNull();
  });

  it('is read-only once issued and offers a new revision', async () => {
    await open('sent');

    expect(el().querySelector('[data-test="save"]')).toBeNull();
    expect(el().querySelector('[data-test="add-section"]')).toBeNull();
    expect(el().querySelector('[data-test="quick-add"]')).toBeNull();
    expect(el().querySelector('[data-test="revise"]')).not.toBeNull();
    expect(el().querySelector('[data-test="to-order"]')).toBeNull();
  });

  it('offers the conversions on an accepted quote', async () => {
    await open('accepted');

    expect(el().querySelector('[data-test="to-order"]')).not.toBeNull();
    expect(el().querySelector('[data-test="to-invoice"]')).not.toBeNull();
    expect(el().querySelector('[data-test="revise"]')).toBeNull();
  });
});
