import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ProductCatalogApiService } from './product-catalog-api.service';

describe('ProductCatalogApiService', () => {
  let api: ProductCatalogApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/catalog`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ProductCatalogApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('lists the products with the filters as query parameters, dropping the empty ones', () => {
    api.listProducts({ q: 'chair', product_type: '', kind: 'variants', page: 2 }).subscribe();

    const request = http.expectOne((req) => req.url === `${base}/products`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('q')).toBe('chair');
    expect(request.request.params.get('kind')).toBe('variants');
    expect(request.request.params.has('product_type')).toBe(false);
    request.flush({ success: true, message: '', data: [], meta: {} });
  });

  it('creates, changes and deletes a product', () => {
    api.createProduct({ sku: 'A', name: 'B' }).subscribe();
    const created = http.expectOne(`${base}/products`);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual({ sku: 'A', name: 'B' });
    created.flush({});

    api.updateProduct('p-1', { name: 'C' }).subscribe();
    const updated = http.expectOne(`${base}/products/p-1`);
    expect(updated.request.method).toBe('PUT');
    updated.flush({});

    api.deleteProduct('p-1').subscribe();
    expect(http.expectOne(`${base}/products/p-1`).request.method).toBe('DELETE');
  });

  it('manages the attributes', () => {
    api.listAttributes().subscribe();
    http.expectOne(`${base}/attributes`).flush({});

    api.createAttribute({ code: 'size', name: { en: 'Size' }, values: [] }).subscribe();
    expect(http.expectOne(`${base}/attributes`).request.method).toBe('POST');

    api.updateAttribute('a-1', { name: { en: 'Sizes' } }).subscribe();
    expect(http.expectOne(`${base}/attributes/a-1`).request.method).toBe('PUT');

    api.deleteAttribute('a-1').subscribe();
    expect(http.expectOne(`${base}/attributes/a-1`).request.method).toBe('DELETE');
  });

  it('previews, generates and reprices a variant matrix', () => {
    const request = {
      axes: [{ attribute_id: 'a-1', value_ids: ['v-1'] }],
      generate_barcodes: true,
    };

    api.previewMatrix('p-1', request).subscribe();
    const preview = http.expectOne(`${base}/products/p-1/matrix/preview`);
    expect(preview.request.body).toEqual(request);
    preview.flush({});

    api.generateMatrix('p-1', request).subscribe();
    expect(http.expectOne(`${base}/products/p-1/matrix/generate`).request.method).toBe('POST');

    api.repriceVariants('p-1').subscribe();
    expect(http.expectOne(`${base}/products/p-1/matrix/reprice`).request.method).toBe('POST');
  });

  it('saves the kit components, explodes a product and explodes commercial lines', () => {
    api
      .saveKitComponents('p-1', [{ component_id: 'c-1', quantity: '2', is_optional: false }])
      .subscribe();
    const kit = http.expectOne(`${base}/products/p-1/kit-components`);
    expect(kit.request.method).toBe('PUT');
    expect(kit.request.body).toEqual({
      components: [{ component_id: 'c-1', quantity: '2', is_optional: false }],
    });
    kit.flush({});

    api.explodeProduct('p-1', '3', true).subscribe();
    const exploded = http.expectOne((req) => req.url === `${base}/products/p-1/explosion`);
    expect(exploded.request.params.get('quantity')).toBe('3');
    expect(exploded.request.params.get('include_optional')).toBe('1');
    exploded.flush({});

    api.explodeLines([{ product_id: 'p-1', quantity: '2' }]).subscribe();
    const lines = http.expectOne(`${base}/kits/explode`);
    expect(lines.request.body).toEqual({ lines: [{ product_id: 'p-1', quantity: '2' }] });
    lines.flush({});
  });

  it('saves the packaging hierarchy and converts a quantity', () => {
    const payload = { uom_rounding: 'half_up' as const, uom_precision: 4, levels: [] };

    api.savePackagings('p-1', payload).subscribe();
    const saved = http.expectOne(`${base}/products/p-1/packagings`);
    expect(saved.request.method).toBe('PUT');
    expect(saved.request.body).toEqual(payload);
    saved.flush({});

    api.convert('p-1', '48', 'BASE').subscribe();
    const converted = http.expectOne(`${base}/products/p-1/convert`);
    expect(converted.request.body).toEqual({ quantity: '48', unit: 'BASE' });
    converted.flush({});
  });

  it('imports a file as a multipart form with its mode', () => {
    const file = new File(['sku,name'], 'catalog.csv', { type: 'text/csv' });

    api.importFile(file, 'partial').subscribe();

    const request = http.expectOne(`${base}/import`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBe(true);
    expect((request.request.body as FormData).get('mode')).toBe('partial');
    expect((request.request.body as FormData).get('file')).toBeInstanceOf(File);
    request.flush({});
  });

  it('downloads the export and the template as blobs in the format asked', () => {
    api.exportCatalog('csv').subscribe();
    const exported = http.expectOne((req) => req.url === `${base}/export`);
    expect(exported.request.responseType).toBe('blob');
    expect(exported.request.params.get('format')).toBe('csv');
    exported.flush(new Blob(['sku']));

    api.downloadTemplate('xlsx').subscribe();
    const template = http.expectOne((req) => req.url === `${base}/import/template`);
    expect(template.request.params.get('format')).toBe('xlsx');
    template.flush(new Blob(['sku']));
  });

  it('reads the lookups, the customs codes and the import schema', () => {
    api.getLookups().subscribe();
    http.expectOne(`${base}/lookups`).flush({});

    api.searchCustomsCodes('8517').subscribe();
    const codes = http.expectOne((req) => req.url === `${base}/customs-codes`);
    expect(codes.request.params.get('q')).toBe('8517');
    codes.flush({});

    api.getImportSchema().subscribe();
    http.expectOne(`${base}/import/schema`).flush({});
  });
});
