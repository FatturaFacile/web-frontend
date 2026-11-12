import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { DmsApiService } from './dms-api.service';
import {
  DmsPlaceLegalHoldRequest,
  DmsStoreDocumentRequest,
  DmsStoreFolderRequest,
  DmsStoreRetentionPolicyRequest,
} from '../models';

describe('DmsApiService', () => {
  let service: DmsApiService;
  let httpTesting: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DmsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DmsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('fetches documents list with filters', () => {
    service
      .getDocuments({ search: 'Contratto', status: 'published', page: 1, per_page: 20 })
      .subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.data[0].title).toBe('Contratto Fornitura 2026');
      });

    const req = httpTesting.expectOne((r) => r.url === `${base}/dms/documents`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('search')).toBe('Contratto');
    expect(req.request.params.get('status')).toBe('published');

    req.flush({
      success: true,
      data: [{ id: 'doc-1', title: 'Contratto Fornitura 2026', status: 'published', legal_hold: false }],
      meta: { current_page: 1, total: 1 },
    });
  });

  it('creates a new document in DMS', () => {
    const payload: DmsStoreDocumentRequest = {
      title: 'Fattura Immediata 102',
      document_type: 'Invoice',
      folder_id: 'folder-1',
      file: new File(['pdf'], 'fattura.pdf', { type: 'application/pdf' }),
    };

    service.createDocument(payload).subscribe((res) => {
      expect(res.data.id).toBe('doc-102');
      expect(res.data.title).toBe(payload.title);
    });

    const req = httpTesting.expectOne(`${base}/dms/documents`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).name).toBe('fattura.pdf');
    expect(body.get('title')).toBe('Fattura Immediata 102');
    expect(body.get('folder_id')).toBe('folder-1');

    req.flush({ success: true, data: { id: 'doc-102', title: payload.title, status: 'draft', legal_hold: false } });
  });

  it('handles check-out and check-in lifecycle', () => {
    service.checkOutDocument('doc-1', { note: 'Aggiornamento clausole' }).subscribe((res) => {
      expect(res.data.checked_out_by).toBe('user-me');
    });

    const reqOut = httpTesting.expectOne(`${base}/dms/documents/doc-1/check-out`);
    expect(reqOut.request.method).toBe('POST');
    expect(reqOut.request.body).toEqual({ note: 'Aggiornamento clausole' });
    reqOut.flush({ success: true, data: { id: 'doc-1', checked_out_by: 'user-me' } });

    service
      .checkInDocument('doc-1', { file: new File(['v2'], 'doc_v2.pdf'), comment: 'Seconda versione' })
      .subscribe((res) => {
        expect(res.data.version_number).toBe(2);
      });

    const reqIn = httpTesting.expectOne(`${base}/dms/documents/doc-1/check-in`);
    expect(reqIn.request.method).toBe('POST');
    const inBody = reqIn.request.body as FormData;
    expect((inBody.get('file') as File).name).toBe('doc_v2.pdf');
    expect(inBody.get('comment')).toBe('Seconda versione');
    reqIn.flush({
      success: true,
      data: { id: 'v2', document_id: 'doc-1', version_number: 2, sha256: 'sha256-hash' },
    });
  });

  it('places and releases legal hold', () => {
    const payload: DmsPlaceLegalHoldRequest = {
      reason: 'Audit tributario Agenzia Entrate',
    };

    service.placeLegalHold('doc-1', payload).subscribe((res) => {
      expect(res.data.legal_hold).toBe(true);
    });

    const reqHold = httpTesting.expectOne(`${base}/dms/documents/doc-1/legal-hold`);
    expect(reqHold.request.method).toBe('POST');
    reqHold.flush({ success: true, data: { id: 'doc-1', legal_hold: true } });

    service.releaseLegalHold('doc-1').subscribe((res) => {
      expect(res.data.legal_hold).toBe(false);
    });

    const reqRelease = httpTesting.expectOne(`${base}/dms/documents/doc-1/legal-hold`);
    expect(reqRelease.request.method).toBe('DELETE');
    reqRelease.flush({ success: true, data: { id: 'doc-1', legal_hold: false } });
  });

  it('manages folders and retention policies', () => {
    const folderPayload: DmsStoreFolderRequest = {
      name: 'Fatture Passive 2026',
      access_roles: ['accountant', 'admin'],
    };

    service.createFolder(folderPayload).subscribe((res) => {
      expect(res.data.id).toBe('fld-1');
    });

    const reqFld = httpTesting.expectOne(`${base}/dms/folders`);
    expect(reqFld.request.method).toBe('POST');
    reqFld.flush({ success: true, data: { id: 'fld-1', ...folderPayload } });

    const retPayload: DmsStoreRetentionPolicyRequest = {
      name: 'Conservazione Fiscale 10 Anni',
      document_type: 'Invoice',
      retention_months: 120,
      action: 'archive',
      is_active: true,
    };

    service.createRetentionPolicy(retPayload).subscribe((res) => {
      expect(res.data.id).toBe('ret-1');
    });

    const reqRet = httpTesting.expectOne(`${base}/dms/retention-policies`);
    expect(reqRet.request.method).toBe('POST');
    reqRet.flush({ success: true, data: { id: 'ret-1', ...retPayload } });
  });
});
