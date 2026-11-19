import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LeadRatingTagComponent } from './lead-rating-tag.component';
import { LeadScoreBadgeComponent } from './lead-score-badge.component';
import { i18nStub } from './lead-test.utils';

describe('lead score display', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [i18nStub()] });
  });

  function tag(rating: string | null) {
    const f = TestBed.createComponent(LeadRatingTagComponent);
    f.componentRef.setInput('rating', rating);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  function badge(score: number | null, rating: string | null = null) {
    const f = TestBed.createComponent(LeadScoreBadgeComponent);
    f.componentRef.setInput('score', score);
    f.componentRef.setInput('rating', rating);
    f.detectChanges();
    return f.nativeElement.querySelector('.badge') as HTMLElement;
  }

  it.each([
    ['cold', 'CRM.LEADS.RATING.COLD'],
    ['warm', 'CRM.LEADS.RATING.WARM'],
    ['hot', 'CRM.LEADS.RATING.HOT'],
  ])('rating tag %s always renders its text label', (rating, label) => {
    const el = tag(rating);
    const t = el.querySelector('nz-tag') as HTMLElement;
    expect(t.getAttribute('data-rating')).toBe(rating);
    expect(t.textContent?.trim()).toBe(label);
  });

  it('rating tag renders a dash without rating', () => {
    expect(tag(null).textContent?.trim()).toBe('-');
  });

  it('uses the backend rating verbatim, never derived from the score', () => {
    // A score of 95 tagged "cold" by the server stays cold: thresholds live on the backend.
    const b = badge(95, 'cold');
    expect(b.classList.contains('cold')).toBe(true);
    expect(b.classList.contains('hot')).toBe(false);
  });

  it('score badge shows a clamped 0-100 integer with an accessible label', () => {
    expect(badge(72.4, 'warm').textContent?.trim()).toBe('72');
    expect(badge(140).textContent?.trim()).toBe('100');
    expect(badge(-5).textContent?.trim()).toBe('0');
    const b = badge(72, 'warm');
    expect(b.getAttribute('aria-label')).toBe('CRM.LEADS.SCORE_ARIA');
    expect(b.classList.contains('warm')).toBe(true);
  });

  it('score badge shows a dash when the lead is not scored', () => {
    const b = badge(null);
    expect(b.textContent?.trim()).toBe('-');
    expect(b.getAttribute('aria-label')).toBe('CRM.LEADS.SCORE_NONE');
  });
});
