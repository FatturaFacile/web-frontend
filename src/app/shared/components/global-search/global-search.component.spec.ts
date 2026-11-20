import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollaborationApiService } from '@core/api/collaboration-api.service';
import { TranslateService } from '@core/i18n/i18n.service';
import type { CollaborationSearchResult } from '@core/models/collaboration.model';
import { GlobalSearchComponent } from './global-search.component';
import { GlobalSearchService } from './global-search.service';

const hits: CollaborationSearchResult[] = [
  { type: 'contact', type_label: 'Contact', id: 'c1', title: 'Acme Srl', subtitle: 'info@acme.test', path: '/crm/clients' },
  { type: 'invoice', type_label: 'Invoice', id: 'i1', title: 'INV-1', subtitle: null, path: '/sales/invoices' },
];

describe('GlobalSearchComponent', () => {
  const api = { search: vi.fn() };
  const translateSpy = { instant: vi.fn((key: string) => key), translate: vi.fn((key: string) => key) };

  function setup() {
    TestBed.configureTestingModule({
      imports: [GlobalSearchComponent],
      providers: [provideRouter([]), { provide: CollaborationApiService, useValue: api }, { provide: TranslateService, useValue: translateSpy }],
    });
    const fixture = TestBed.createComponent(GlobalSearchComponent);
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance, search: TestBed.inject(GlobalSearchService), element: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    api.search.mockReturnValue(of({ data: hits }));
  });

  afterEach(() => vi.useRealTimers());

  it('opens and closes with Ctrl+K and closes with Escape', () => {
    const { fixture, search, element } = setup();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true }));
    fixture.detectChanges();
    expect(search.isOpen()).toBe(true);
    expect(element.querySelector('[role="dialog"]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(search.isOpen()).toBe(false);
    expect(element.querySelector('[role="dialog"]')).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, shiftKey: true }));
    expect(search.isOpen()).toBe(true);
  });

  it('waits for two characters and debounces the API call', () => {
    const { fixture, component, search } = setup();
    search.open();
    fixture.detectChanges();

    component.onInput('a');
    vi.advanceTimersByTime(300);
    expect(api.search).not.toHaveBeenCalled();

    component.onInput('ac');
    component.onInput('acm');
    vi.advanceTimersByTime(300);

    expect(api.search).toHaveBeenCalledTimes(1);
    expect(api.search).toHaveBeenCalledWith({ q: 'acm' });
    expect(component.results()).toEqual(hits);
    expect(component.activeIndex()).toBe(0);
  });

  it('moves with the arrow keys and opens the selected record', () => {
    const { fixture, component, search } = setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    search.open();
    fixture.detectChanges();
    component.onInput('acme');
    vi.advanceTimersByTime(300);

    component.onInputKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(component.activeIndex()).toBe(1);
    component.onInputKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(component.activeIndex()).toBe(0);
    component.onInputKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(component.activeIndex()).toBe(1);

    component.onInputKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(navigate).toHaveBeenCalledWith('/sales/invoices');
    expect(search.isOpen()).toBe(false);
    expect(component.query()).toBe('');
  });

  it('shows an error state when the search fails', () => {
    api.search.mockReturnValue(throwError(() => new Error('boom')));
    const { fixture, component, search, element } = setup();
    search.open();
    fixture.detectChanges();

    component.onInput('acme');
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(component.hasError()).toBe(true);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('COLLAB.LOAD_ERROR');
  });
});
