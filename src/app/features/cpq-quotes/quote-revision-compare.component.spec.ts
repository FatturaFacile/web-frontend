import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { I18nService } from '@core';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { i18nStub } from '../hr/recruiting/testing/recruiting-fixtures';
import { QuoteDetail, RevisionDiff } from './cpq-quotes.models';
import { QuoteRevisionCompareComponent } from './quote-revision-compare.component';

const base = `${environment.apiBaseUrl}/cpq/quotes`;

function revision(id: string, number: number, status: QuoteDetail['status']): QuoteDetail {
  return {
    id,
    root_quote_id: 'r1',
    parent_quote_id: number > 1 ? 'r1' : null,
    quote_number: `OFF-2026-00001.0${number}`,
    revision: number,
    status,
    issued_at: '2026-11-01T10:00:00Z',
  } as unknown as QuoteDetail;
}

const DIFF: RevisionDiff = {
  from: 'OFF-2026-00001.01',
  to: 'OFF-2026-00001.02',
  sections: { added: [], removed: [], modified: [] },
  lines: {
    added: [{ description: 'Setup' }],
    removed: [{ description: 'Cable' }],
    modified: [
      { key: 'l1', label: 'Server', changes: { quantity: { from: '1.0000', to: '2.0000' } } },
    ],
  },
  totals: {
    net: { from: '120.00', to: '230.00', delta: '110.00' },
    tax: { from: '26.40', to: '50.60', delta: '24.20' },
    gross: { from: '146.40', to: '280.60', delta: '134.20' },
  },
};

describe('QuoteRevisionCompareComponent', () => {
  let fixture: ComponentFixture<QuoteRevisionCompareComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuoteRevisionCompareComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: i18nStub() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'v2' }) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(QuoteRevisionCompareComponent);
    fixture.detectChanges();

    http.expectOne(`${base}/v2`).flush({ data: revision('v2', 2, 'sent') });
    const list = http.expectOne((r) => r.url === base && r.params.get('root_quote_id') === 'r1');
    list.flush({
      data: {
        items: [revision('v2', 2, 'sent'), revision('v1', 1, 'superseded')],
        total: 2,
        per_page: 100,
        current_page: 1,
      },
    });
    // The current revision is compared with the previous one at once.
    http.expectOne(`${base}/v1/compare/v2`).flush({ data: DIFF });
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lists the revisions in order on the timeline', () => {
    const items = [...el().querySelectorAll('[data-test="revision"]')].map((a) =>
      a.textContent?.trim(),
    );

    expect(items).toEqual(['OFF-2026-00001.01', 'OFF-2026-00001.02']);
  });

  it('shows added, removed and modified lines in the unified view', () => {
    const rows = [...el().querySelectorAll('[data-test="unified"] .row')].map((r) =>
      r.getAttribute('data-kind'),
    );

    expect(rows).toEqual(['added', 'removed', 'modified']);
    expect(el().querySelector('[data-test="change"]')?.textContent).toContain('1.0000 → 2.0000');
  });

  it('shows the net and gross variance', () => {
    expect(el().querySelector('[data-total="net"]')?.textContent).toContain('110.00');
    expect(el().querySelector('[data-total="gross"]')?.textContent).toContain('134.20');
  });

  it('switches to the side by side view', async () => {
    el().querySelectorAll<HTMLElement>('[data-test="layout"] label')[1].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el().querySelector('[data-test="side"]')).not.toBeNull();
    expect(el().querySelector('[data-test="side-from"] [data-kind="removed"]')).not.toBeNull();
    expect(el().querySelector('[data-test="side-from"] [data-kind="added"]')).toBeNull();
    expect(el().querySelector('[data-test="side-to"] [data-kind="added"]')).not.toBeNull();
  });
});
