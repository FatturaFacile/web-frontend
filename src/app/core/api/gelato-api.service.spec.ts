import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { GelatoApiService } from './gelato-api.service';

describe('GelatoApiService', () => {
  let service: GelatoApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/gelato`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GelatoApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GelatoApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('filters the ingredient catalog by category and search text', () => {
    service.getIngredients('NUT_PASTE', 'pist').subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/ingredients`);

    expect(request.request.params.get('category')).toBe('NUT_PASTE');
    expect(request.request.params.get('q')).toBe('pist');
    request.flush({ data: [] });
  });

  it('previews the lines of a recipe with the overrun', () => {
    service.preview('DAIRY_CREAM', [{ ingredient_id: 'i-1', grams: 160 }], { overrun_percent: 30 }).subscribe();
    const request = httpTesting.expectOne(`${base}/recipes/balance`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      category: 'DAIRY_CREAM',
      lines: [{ ingredient_id: 'i-1', grams: 160 }],
      overrun_percent: 30,
    });
    request.flush({ data: {} });
  });

  it('sends the targets and the pool of the auto balance', () => {
    service.autoBalance('FRUIT_SORBET', { weight: 3500, pod: 280 }, [{ ingredient_id: 'i-1' }]).subscribe();
    const request = httpTesting.expectOne(`${base}/recipes/balance`);

    expect(request.request.body.targets).toEqual({ weight: 3500, pod: 280 });
    expect(request.request.body.pool).toEqual([{ ingredient_id: 'i-1' }]);
    request.flush({ data: {} });
  });

  it('creates or replaces a recipe depending on the id', () => {
    service.saveRecipe({ code: 'R1' }).subscribe();
    expect(httpTesting.expectOne(`${base}/recipes`).request.method).toBe('POST');

    service.saveRecipe({ code: 'R1' }, 'r-1').subscribe();
    expect(httpTesting.expectOne(`${base}/recipes/r-1`).request.method).toBe('PUT');
  });

  it('starts a lot, adds HACCP readings and completes it', () => {
    service.startLot({ kind: 'base' }).subscribe();
    httpTesting.expectOne(`${base}/lots`).flush({ data: {} });

    service.addHaccpReadings('l-1', [{ at: '2027-03-01T08:00:00Z', temperature_celsius: 86, phase: 'heat' }]).subscribe();
    expect(httpTesting.expectOne(`${base}/lots/l-1/haccp-readings`).request.body.readings).toHaveLength(1);

    service.completeLot('l-1', { yield_grams: 60000 }).subscribe();
    httpTesting.expectOne(`${base}/lots/l-1/complete`).flush({ data: {} });
  });

  it('publishes the showcase and loads the allergen book', () => {
    service.publishShowcase('main', [{ slot_number: 1, recipe_id: 'r-1' }], 'CH').subscribe();
    const publish = httpTesting.expectOne(`${base}/showcase/main/publish`);
    expect(publish.request.body.jurisdiction).toBe('CH');
    publish.flush({ data: { id: 'b-1', version: 1 } });

    service.getBook('main').subscribe();
    httpTesting.expectOne(`${base}/showcase/main/book`).flush({ data: {} });
  });
});
