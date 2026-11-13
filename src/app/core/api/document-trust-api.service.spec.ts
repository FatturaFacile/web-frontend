import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DocumentSignature,
  DocumentSigningSettings,
  EDocumentNetworkStatus,
  EDocumentTransmission,
  PreservationRecord,
  PreserveDocumentRequest,
  SendEDocumentRequest,
  SignDocumentRequest,
  UpdateDocumentSigningSettingsRequest,
  VerifySignatureResult,
} from '../models';
import { DocumentTrustApiService } from './document-trust-api.service';

describe('DocumentTrustApiService', () => {
  let service: DocumentTrustApiService;
  let httpMock: HttpTestingController;

  const mockNetworks: EDocumentNetworkStatus[] = [
    { network: 'peppol', label: 'Peppol AS4 Network', driver: 'peppol-directory', is_available: true },
    { network: 'ebill', label: 'Swiss eBill (SIX)', driver: 'ebill-b2b', is_available: true },
    { network: 'nso', label: 'Nodo Smistamento Ordini', driver: 'nso-sdi', is_available: false },
  ];

  const mockTransmission: EDocumentTransmission = {
    id: 'tx-1',
    network: 'peppol',
    document_reference: 'INV-2026-001',
    recipient_identifier: 'iso6523-actorid-upis::9906:it12345678901',
    payload_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'delivered',
    external_id: 'peppol-msg-999',
    driver: 'peppol-directory',
  };

  const mockSignature: DocumentSignature = {
    id: 'sig-1',
    document_type: 'invoice',
    document_id: 'inv-123',
    format: 'cades-bes-p7m',
    driver: 'cades',
    content_sha256: 'a1b2c3d4e5f6',
    created_at: '2026-11-09T10:00:00Z',
  };

  const mockPreservation: PreservationRecord = {
    id: 'pres-1',
    document_type: 'invoice',
    document_id: 'inv-123',
    provider: 'local',
    content_sha256: 'fedcba987654321',
    created_at: '2026-11-09T10:00:00Z',
    status: 'archived',
  };

  const mockSettings: DocumentSigningSettings = {
    driver: 'cades',
    certificate_expiry: '2027-12-31T23:59:59Z',
    certificate_subject: 'CN=Fattura Facile Srl, O=Fattura Facile, C=IT',
    is_certificate_valid: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DocumentTrustApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(DocumentTrustApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should list networks and get filtered transmissions', () => {
    service.getNetworks().subscribe((res) => {
      expect(res.data).toEqual(mockNetworks);
    });

    const netReq = httpMock.expectOne('/api/v1/edocument-networks');
    expect(netReq.request.method).toBe('GET');
    netReq.flush({ success: true, data: mockNetworks });

    service.getTransmissions({ network: 'peppol', status: 'delivered', document_reference: 'INV-2026', per_page: 50 }).subscribe((res) => {
      expect(res.data).toEqual([mockTransmission]);
    });

    const txReq = httpMock.expectOne(
      (req) =>
        req.url === '/api/v1/edocument-networks/transmissions' &&
        req.params.get('network') === 'peppol' &&
        req.params.get('status') === 'delivered' &&
        req.params.get('document_reference') === 'INV-2026' &&
        req.params.get('per_page') === '50',
    );
    expect(txReq.request.method).toBe('GET');
    txReq.flush({ success: true, data: [mockTransmission] });
  });

  it('should get single transmission and send document', () => {
    service.getTransmission('tx-1').subscribe((res) => {
      expect(res.data).toEqual(mockTransmission);
    });

    const getReq = httpMock.expectOne('/api/v1/edocument-networks/transmissions/tx-1');
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ success: true, data: mockTransmission });

    const sendPayload: SendEDocumentRequest = {
      document_reference: 'INV-2026-001',
      recipient_identifier: 'iso6523-actorid-upis::9906:it12345678901',
      payload_base64: 'PHhtbD48L3htbD4=',
    };

    service.sendDocument('peppol', sendPayload).subscribe((res) => {
      expect(res.data).toEqual(mockTransmission);
    });

    const sendReq = httpMock.expectOne('/api/v1/edocument-networks/peppol/transmissions');
    expect(sendReq.request.method).toBe('POST');
    expect(sendReq.request.body).toEqual(sendPayload);
    sendReq.flush({ success: true, data: mockTransmission });
  });

  it('should handle signatures, signing, and signature verification', () => {
    service.getSignatures('inv-123').subscribe((res) => {
      expect(res.data).toEqual([mockSignature]);
    });

    const sigReq = httpMock.expectOne(
      (req) => req.url === '/api/v1/document-trust/signatures' && req.params.get('document_id') === 'inv-123',
    );
    expect(sigReq.request.method).toBe('GET');
    sigReq.flush({ success: true, data: [mockSignature] });

    const signPayload: SignDocumentRequest = {
      document_type: 'invoice',
      document_id: 'inv-123',
    };

    service.signDocument(signPayload).subscribe((res) => {
      expect(res.data).toEqual(mockSignature);
    });

    const signPostReq = httpMock.expectOne('/api/v1/document-trust/signatures');
    expect(signPostReq.request.method).toBe('POST');
    expect(signPostReq.request.body).toEqual(signPayload);
    signPostReq.flush({ success: true, data: mockSignature });

    const mockVerifyResult: VerifySignatureResult = {
      signature_id: 'sig-1',
      document_type: 'invoice',
      document_id: 'inv-123',
      driver: 'cades',
      format: 'cades-bes-p7m',
      valid: true,
      content_changed: false,
      trust_chain_validated: false,
    };

    service.verifySignature('sig-1').subscribe((res) => {
      expect(res.data).toEqual(mockVerifyResult);
    });

    const verifyReq = httpMock.expectOne('/api/v1/document-trust/signatures/sig-1/verify');
    expect(verifyReq.request.method).toBe('POST');
    verifyReq.flush({ success: true, data: mockVerifyResult });
  });

  it('should handle preservation and signing settings', () => {
    service.getPreservationRecords('inv-123').subscribe((res) => {
      expect(res.data).toEqual([mockPreservation]);
    });

    const presReq = httpMock.expectOne(
      (req) => req.url === '/api/v1/document-trust/preservation' && req.params.get('document_id') === 'inv-123',
    );
    expect(presReq.request.method).toBe('GET');
    presReq.flush({ success: true, data: [mockPreservation] });

    const presPayload: PreserveDocumentRequest = {
      document_type: 'invoice',
      document_id: 'inv-123',
    };

    service.preserveDocument(presPayload).subscribe((res) => {
      expect(res.data).toEqual(mockPreservation);
    });

    const presPostReq = httpMock.expectOne('/api/v1/document-trust/preservation');
    expect(presPostReq.request.method).toBe('POST');
    expect(presPostReq.request.body).toEqual(presPayload);
    presPostReq.flush({ success: true, data: mockPreservation });

    service.getSigningSettings().subscribe((res) => {
      expect(res.data).toEqual(mockSettings);
    });

    const getSettingsReq = httpMock.expectOne('/api/v1/document-trust/settings');
    expect(getSettingsReq.request.method).toBe('GET');
    getSettingsReq.flush({ success: true, data: mockSettings });

    const updatePayload: UpdateDocumentSigningSettingsRequest = {
      driver: 'cades',
      certificate: '---CERT---',
      private_key: '---KEY---',
      passphrase: 'secret-password',
    };

    service.updateSigningSettings(updatePayload).subscribe((res) => {
      expect(res.data).toEqual(mockSettings);
    });

    const putSettingsReq = httpMock.expectOne('/api/v1/document-trust/settings');
    expect(putSettingsReq.request.method).toBe('PUT');
    expect(putSettingsReq.request.body).toEqual(updatePayload);
    putSettingsReq.flush({ success: true, data: mockSettings });
  });
});
