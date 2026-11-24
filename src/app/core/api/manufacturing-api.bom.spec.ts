import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { beforeEach, describe, expect, it } from 'vitest';
import { ManufacturingApiService } from './manufacturing-api.service';

describe('ManufacturingApiService (Mod 060)', () => {
  const base = `${environment.apiBaseUrl}/manufacturing`;
  let api: ManufacturingApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ManufacturingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('posts a revision', () => {
    api.createBomRevision({ source_bom_id: 'b', reason: 'r', components: [] }).subscribe();
    const req = http.expectOne(`${base}/boms/revisions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.source_bom_id).toBe('b');
    req.flush({});
  });

  it('requests the explosion with 1/0 booleans and drops empty params', () => {
    api.getBomExplosion('b', { quantity: 5, multi_level: true, flatten_phantoms: false }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/boms/b/explosion`);
    expect(req.request.params.get('quantity')).toBe('5');
    expect(req.request.params.get('multi_level')).toBe('1');
    expect(req.request.params.get('flatten_phantoms')).toBe('0');
    expect(req.request.params.has('date')).toBe(false);
    req.flush({});
  });

  it('requests the implosion, diff, cost allocation and origin', () => {
    api.getItemImplosion('i', '2026-01-01').subscribe();
    const imp = http.expectOne((r) => r.url === `${base}/items/i/implosion`);
    expect(imp.request.params.get('date')).toBe('2026-01-01');
    imp.flush({});

    api.getBomDiff('a', 'b').subscribe();
    http.expectOne(`${base}/boms/a/diff/b`).flush({});

    api.getBomCostAllocation('a').subscribe();
    http.expectOne(`${base}/boms/a/cost-allocation`).flush({});

    api.getBomPreferentialOrigin('a').subscribe();
    const origin = http.expectOne((r) => r.url === `${base}/boms/a/preferential-origin`);
    expect(origin.request.params.has('threshold_percentage')).toBe(false);
    origin.flush({});
  });

  it('posts mass replace, import and puts co-products', () => {
    api.massReplaceComponent({ obsolete_item_id: 'o', substitute_item_id: 's', reason: 'x', dry_run: true }).subscribe();
    const mr = http.expectOne(`${base}/boms/mass-replace`);
    expect(mr.request.body.dry_run).toBe(true);
    mr.flush({});

    api.importBom({ product_code: 'P', name: 'N', dry_run: true, rows: [] }).subscribe();
    http.expectOne(`${base}/boms/import`).flush({});

    api.updateBomCoProducts('a', { co_products: [] }).subscribe();
    const cp = http.expectOne(`${base}/boms/a/co-products`);
    expect(cp.request.method).toBe('PUT');
    cp.flush({});
  });
});
