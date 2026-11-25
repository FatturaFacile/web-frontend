import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { StatutoryFinancialsApiService } from './statutory-financials-api.service';

describe('StatutoryFinancialsApiService', () => {
  let service: StatutoryFinancialsApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/statutory-financials`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StatutoryFinancialsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StatutoryFinancialsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('reads the lookups in the requested locale', () => {
    service.getLookups('de').subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/lookups`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('locale')).toBe('de');
    request.flush({ data: {} });
  });

  it('lists dossiers with the filters and drops the empty ones', () => {
    service
      .listDossiers({ status: 'draft', standard: 'CH_CO_Art959', fiscal_year_id: '', page: 2 })
      .subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/dossiers`);
    expect(request.request.params.get('status')).toBe('draft');
    expect(request.request.params.get('standard')).toBe('CH_CO_Art959');
    expect(request.request.params.has('fiscal_year_id')).toBe(false);
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ data: [], meta: {} });
  });

  it('creates, updates, reads and deletes a dossier', () => {
    service
      .createDossier({ fiscal_year_id: 'fy-1', accounting_standard: 'IT_OIC_Ordinario' })
      .subscribe();
    const create = httpTesting.expectOne(`${base}/dossiers`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      fiscal_year_id: 'fy-1',
      accounting_standard: 'IT_OIC_Ordinario',
    });
    create.flush({ data: {} });

    service.updateDossier('d-1', { accounting_standard: 'IT_OIC_Abbreviato' }).subscribe();
    const update = httpTesting.expectOne(`${base}/dossiers/d-1`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ accounting_standard: 'IT_OIC_Abbreviato' });
    update.flush({ data: {} });

    service.getDossier('d-1').subscribe();
    const read = httpTesting.expectOne(`${base}/dossiers/d-1`);
    expect(read.request.method).toBe('GET');
    read.flush({ data: {} });

    service.deleteDossier('d-1').subscribe();
    const remove = httpTesting.expectOne(`${base}/dossiers/d-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ data: null });
  });

  it('sends the lifecycle target and only a non-empty filing reference', () => {
    service.transitionDossier('d-1', 'locked').subscribe();
    const lock = httpTesting.expectOne(`${base}/dossiers/d-1/transition`);
    expect(lock.request.method).toBe('POST');
    expect(lock.request.body).toEqual({ target: 'locked' });
    lock.flush({ data: {} });

    service.transitionDossier('d-1', 'filed', 'REA-2026-1').subscribe();
    const file = httpTesting.expectOne(`${base}/dossiers/d-1/transition`);
    expect(file.request.body).toEqual({ target: 'filed', reference: 'REA-2026-1' });
    file.flush({ data: {} });
  });

  it('asks the eligibility of a chosen standard', () => {
    service.getEligibility('d-1', 'IT_OIC_Micro').subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/dossiers/d-1/eligibility`);
    expect(request.request.params.get('standard')).toBe('IT_OIC_Micro');
    request.flush({ data: {} });
  });

  it('generates the statements, the cash flow with a method and reads the preview', () => {
    service.generate('d-1').subscribe();
    const generate = httpTesting.expectOne(`${base}/dossiers/d-1/generate`);
    expect(generate.request.method).toBe('POST');
    generate.flush({ data: {} });

    service.generateCashFlow('d-1', 'direct').subscribe();
    const direct = httpTesting.expectOne(`${base}/dossiers/d-1/cash-flow`);
    expect(direct.request.body).toEqual({ method: 'direct' });
    direct.flush({ data: {} });

    service.generateCashFlow('d-1').subscribe();
    const standard = httpTesting.expectOne(`${base}/dossiers/d-1/cash-flow`);
    expect(standard.request.body).toEqual({});
    standard.flush({ data: {} });

    service.getPreview('d-1').subscribe();
    httpTesting.expectOne(`${base}/dossiers/d-1/preview`).flush({ data: {} });
  });

  it('reads, populates and saves the notes', () => {
    service.getNotes('d-1').subscribe();
    httpTesting.expectOne(`${base}/dossiers/d-1/notes`).flush({ data: null });

    service.populateNotes('d-1', true).subscribe();
    const populate = httpTesting.expectOne(`${base}/dossiers/d-1/notes/populate`);
    expect(populate.request.method).toBe('POST');
    expect(populate.request.body).toEqual({ overwrite_narrative: true });
    populate.flush({ data: {} });

    service
      .updateNotes('d-1', {
        tables: { off_balance: { rows: [] } },
        sections: [{ key: 'intro', body: 'Text' }],
      })
      .subscribe();
    const update = httpTesting.expectOne(`${base}/dossiers/d-1/notes`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({
      tables: { off_balance: { rows: [] } },
      sections: [{ key: 'intro', body: 'Text' }],
    });
    update.flush({ data: {} });
  });

  it('reads, simulates and persists the indicators with the what-if wrapped', () => {
    service.getIndicators('d-1').subscribe();
    httpTesting.expectOne(`${base}/dossiers/d-1/indicators`).flush({ data: {} });

    service.simulateIndicators('d-1', { ebitda_change_percent: -10 }).subscribe();
    const simulate = httpTesting.expectOne(`${base}/dossiers/d-1/indicators/simulate`);
    expect(simulate.request.method).toBe('POST');
    expect(simulate.request.body).toEqual({ what_if: { ebitda_change_percent: -10 } });
    simulate.flush({ data: {} });

    service.saveIndicators('d-1').subscribe();
    const save = httpTesting.expectOne(`${base}/dossiers/d-1/indicators`);
    expect(save.request.method).toBe('POST');
    expect(save.request.body).toEqual({ what_if: {} });
    save.flush({ data: {} });
  });

  it('exports the XBRL, generates the PDF/A documents and verifies an artifact', () => {
    service.getPackage('d-1').subscribe();
    httpTesting.expectOne(`${base}/dossiers/d-1/package`).flush({ data: {} });

    service.exportXbrl('d-1').subscribe();
    const exported = httpTesting.expectOne(`${base}/dossiers/d-1/xbrl/export`);
    expect(exported.request.method).toBe('POST');
    exported.flush({ data: {} });

    service
      .generatePdfa('d-1', { kinds: ['board_minutes'], meeting: { chair: 'A. Rossi' } })
      .subscribe();
    const pdfa = httpTesting.expectOne(`${base}/dossiers/d-1/pdfa`);
    expect(pdfa.request.body).toEqual({
      kinds: ['board_minutes'],
      meeting: { chair: 'A. Rossi' },
    });
    pdfa.flush({ data: {} });

    service.verifyArtifact('d-1', 'a-1').subscribe();
    const verify = httpTesting.expectOne(`${base}/dossiers/d-1/artifacts/a-1/verify`);
    expect(verify.request.method).toBe('POST');
    verify.flush({ data: {} });
  });

  it('downloads an artifact as a blob', () => {
    let received: Blob | null = null;
    service.downloadArtifact('d-1', 'a-1').subscribe((blob) => (received = blob));
    const request = httpTesting.expectOne(`${base}/dossiers/d-1/artifacts/a-1/download`);
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(received).toBeInstanceOf(Blob);
  });
});
