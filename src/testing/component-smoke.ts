import { Type } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

/** An empty, successful Laravel envelope that satisfies list, detail and report consumers alike. */
const EMPTY_ENVELOPE = {
  success: true,
  message: '',
  data: [],
  meta: { total: 0, current_page: 1, last_page: 1, per_page: 20 },
};

export interface SmokeResult {
  readonly fixture: ComponentFixture<unknown>;
  readonly requests: readonly string[];
}

/**
 * Creates a standalone page with the real services over a stubbed HTTP backend, answers every request with an empty
 * envelope and renders again. It proves that the page boots, that its template binds without throwing and that every
 * request it issues is answered without breaking the view.
 */
export async function renderPageWithEmptyBackend(component: Type<unknown>, inputs: Record<string, unknown> = {}): Promise<SmokeResult> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  }).compileComponents();

  const fixture = TestBed.createComponent(component);

  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }

  const http = TestBed.inject(HttpTestingController);
  const requests: string[] = [];

  fixture.detectChanges();

  for (let round = 0; round < 3; round++) {
    // Not whenStable(): a request that is still open keeps the zone unstable, and the grids reload after a debounce.
    await new Promise<void>((resolve) => setTimeout(resolve, 450));
    const pending = http.match(() => true);

    for (const request of pending) {
      requests.push(`${request.request.method} ${request.request.url}`);

      if (request.cancelled) {
        continue;
      }

      if (request.request.url.endsWith('.svg')) {
        request.flush('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');
      } else {
        request.flush(request.request.url.includes('/translations/') ? { translations: {} } : EMPTY_ENVELOPE);
      }
    }

    fixture.detectChanges();
  }

  return { fixture, requests };
}
