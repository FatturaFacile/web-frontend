import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ConstructionTradesExtraApiService } from './construction-trades-extra-api.service';

describe('ConstructionTradesExtraApiService', () => {
  let service: ConstructionTradesExtraApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/construction-trades`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConstructionTradesExtraApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ConstructionTradesExtraApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('reads, updates and fills a price list', () => {
    service.getPriceList('pl-1').subscribe();
    httpTesting.expectOne(`${base}/price-lists/pl-1`).flush({ success: true, message: '', data: { id: 'pl-1' } });

    service.updatePriceList('pl-1', { name: 'NPK 2026' }).subscribe();
    const upd = httpTesting.expectOne(`${base}/price-lists/pl-1`);
    expect(upd.request.method).toBe('PUT');
    upd.flush({ success: true, message: '', data: { id: 'pl-1' } });

    service
      .addPriceItem('pl-1', { position_code: '113', unit: 'm2', unit_price: '12.5000', descriptions: { it: 'Scavo' } })
      .subscribe();
    httpTesting.expectOne(`${base}/price-lists/pl-1/items`).flush({ success: true, message: '', data: { id: 'i1' } });

    service.importPriceList('pl-1', new File(['a;b'], 'items.csv')).subscribe();
    const imp = httpTesting.expectOne(`${base}/price-lists/pl-1/import`);
    expect(imp.request.body instanceof FormData).toBe(true);
    imp.flush({ success: true, message: '', data: { id: 'pl-1' } });
  });

  it('manages work cycles', () => {
    service.getWorkCycles({ page: 2 }).subscribe();
    const list = httpTesting.expectOne((r) => r.url === `${base}/work-cycles`);
    expect(list.request.params.get('page')).toBe('2');
    list.flush({ success: true, message: '', data: [], meta: {} });

    service
      .createWorkCycle({
        name: 'Muro',
        unit: 'm2',
        descriptions: { it: 'Muro' },
        steps: [{ descriptions: { it: 'Posa' }, unit_price: '5.0000' }],
      })
      .subscribe();
    httpTesting.expectOne(`${base}/work-cycles`).flush({ success: true, message: '', data: { id: 'w1' } });

    service.getWorkCycle('w1').subscribe();
    httpTesting.expectOne(`${base}/work-cycles/w1`).flush({ success: true, message: '', data: { id: 'w1' } });
  });

  it('covers bid tender specification and settlement', () => {
    service.getTenderSpecification('b1').subscribe();
    httpTesting.expectOne(`${base}/bids/b1/tender-specification`).flush({ success: true, message: '', data: { id: 'b1' } });

    service.getSettlement('b1').subscribe();
    httpTesting.expectOne(`${base}/bids/b1/settlement`).flush({ success: true, message: '', data: { id: 'b1' } });

    service.approveSettlement('b1').subscribe();
    const approve = httpTesting.expectOne(`${base}/bids/b1/settlement/approve`);
    expect(approve.request.method).toBe('POST');
    approve.flush({ success: true, message: '', data: { id: 'b1' } });
  });

  it('updates subcontractors, subcontracts, diary entries and site documents', () => {
    service.updateSubcontractor('s1', { name: 'Edilizia SA' }).subscribe();
    expect(httpTesting.expectOne(`${base}/subcontractors/s1`).request.method).toBe('PUT');

    service.setSubcontractStatus('sc1', 'completed').subscribe();
    const status = httpTesting.expectOne(`${base}/subcontracts/sc1/status`);
    expect(status.request.body).toEqual({ status: 'completed' });

    service.getSubcontract('sc1').subscribe();
    httpTesting.expectOne(`${base}/subcontracts/sc1`);

    service.updateDiaryEntry('d1', { work_performed: 'Getto' }).subscribe();
    expect(httpTesting.expectOne(`${base}/diary/d1`).request.method).toBe('PUT');

    service.deleteSiteDocument('doc1').subscribe();
    expect(httpTesting.expectOne(`${base}/site-documents/doc1`).request.method).toBe('DELETE');
  });
});
