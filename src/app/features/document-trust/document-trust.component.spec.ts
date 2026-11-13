import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DocumentSignature,
  DocumentSigningSettings,
  DocumentTrustApiService,
  EDocumentNetworkStatus,
  EDocumentTransmission,
  PreservationRecord,
  TranslateService,
  VerifySignatureResult,
} from '@core';
import { icons } from '../../icons-provider';
import { DocumentTrustComponent } from './document-trust.component';

describe('DocumentTrustComponent', () => {
  let component: DocumentTrustComponent;
  let fixture: ComponentFixture<DocumentTrustComponent>;
  let apiMock: Partial<Record<keyof DocumentTrustApiService, ReturnType<typeof vi.fn>>>;
  let messageMock: Partial<Record<keyof NzMessageService, ReturnType<typeof vi.fn>>>;

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
    document_id: '5b2c7e90-1d34-4f68-8a0b-9c1d2e3f4a5b',
    format: 'cades-bes-p7m',
    driver: 'cades',
    content_sha256: 'a1b2c3d4e5f6a1b2c3d4e5f6',
    created_at: '2026-11-09T10:00:00Z',
  };

  const mockPreservation: PreservationRecord = {
    id: 'pres-1',
    document_type: 'invoice',
    document_id: '5b2c7e90-1d34-4f68-8a0b-9c1d2e3f4a5b',
    provider: 'local',
    content_sha256: 'fedcba9876543210fedcba9876543210',
    created_at: '2026-11-09T10:00:00Z',
    status: 'archived',
  };

  const mockSettings: DocumentSigningSettings = {
    driver: 'cades',
    certificate_expiry: '2027-12-31T23:59:59Z',
    certificate_subject: 'CN=Fattura Facile Srl, O=Fattura Facile, C=IT',
    is_certificate_valid: true,
  };

  beforeEach(async () => {
    apiMock = {
      getNetworks: vi.fn().mockReturnValue(of({ success: true, data: mockNetworks })),
      getTransmissions: vi.fn().mockReturnValue(of({ success: true, data: [mockTransmission], meta: { total: 1, last_page: 1 } })),
      getTransmission: vi.fn().mockReturnValue(of({ success: true, data: mockTransmission })),
      sendDocument: vi.fn().mockReturnValue(of({ success: true, data: mockTransmission })),
      getSignatures: vi.fn().mockReturnValue(of({ success: true, data: [mockSignature], meta: { total: 1, last_page: 1 } })),
      signDocument: vi.fn().mockReturnValue(of({ success: true, data: mockSignature })),
      verifySignature: vi.fn().mockReturnValue(
        of({
          success: true,
          data: {
            signature_id: 'sig-1',
            document_type: 'invoice',
            document_id: '5b2c7e90-1d34-4f68-8a0b-9c1d2e3f4a5b',
            driver: 'cades',
            format: 'cades-bes-p7m',
            valid: true,
            content_changed: false,
            trust_chain_validated: false,
          } as VerifySignatureResult,
        }),
      ),
      getPreservationRecords: vi.fn().mockReturnValue(of({ success: true, data: [mockPreservation], meta: { total: 1, last_page: 1 } })),
      preserveDocument: vi.fn().mockReturnValue(of({ success: true, data: mockPreservation })),
      getSigningSettings: vi.fn().mockReturnValue(of({ success: true, data: mockSettings })),
      updateSigningSettings: vi.fn().mockReturnValue(of({ success: true, data: mockSettings })),
    };

    messageMock = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };

    const translateMock = {
      instant: vi.fn((key: string) => key),
      translate: vi.fn((key: string) => key),
      currentLang: vi.fn().mockReturnValue('en'),
      get: vi.fn().mockReturnValue(of('')),
      onLangChange: of({ lang: 'en' }),
    };

    await TestBed.configureTestingModule({
      imports: [DocumentTrustComponent],
      providers: [
        { provide: DocumentTrustApiService, useValue: apiMock },
        { provide: NzMessageService, useValue: messageMock },
        { provide: TranslateService, useValue: translateMock },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentTrustComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  it('should initialize and load networks, transmissions, signatures, preservation records, and settings', async () => {
    expect(component).toBeTruthy();
    expect(apiMock['getNetworks']).toHaveBeenCalled();
    expect(component.networks().length).toBe(3);
    expect(apiMock['getTransmissions']).toHaveBeenCalled();
    expect(component.transmissionGrid.items().length).toBe(1);
    expect(component.transmissionGrid.totalCount()).toBe(1);
    // the lookups need a document UUID: nothing is requested until one is typed
    expect(apiMock['getSignatures']).not.toHaveBeenCalled();
    component.lookupDocumentId.set('5b2c7e90-1d34-4f68-8a0b-9c1d2e3f4a5b');
    component.loadSignatures();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(apiMock['getSignatures']).toHaveBeenCalledWith('5b2c7e90-1d34-4f68-8a0b-9c1d2e3f4a5b', expect.anything());
    expect(component.signatureGrid.items().length).toBe(1);
    component.preservationLookupDocumentId.set('5b2c7e90-1d34-4f68-8a0b-9c1d2e3f4a5b');
    component.loadPreservationRecords();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(apiMock['getPreservationRecords']).toHaveBeenCalledWith('5b2c7e90-1d34-4f68-8a0b-9c1d2e3f4a5b', expect.anything());
    expect(component.preservationGrid.items().length).toBe(1);
    expect(apiMock['getSigningSettings']).toHaveBeenCalled();
    expect(component.signingSettings()?.driver).toBe('cades');
  });

  it('should filter transmissions and open details drawer', async () => {
    component.filterNetwork.set('peppol');
    component.filterStatus.set('delivered');
    component.filterRef.set('INV-2026');
    component.onFilterChange();
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(apiMock['getTransmissions']).toHaveBeenCalledWith(
      expect.objectContaining({
        network: 'peppol',
        status: 'delivered',
        document_reference: 'INV-2026',
        page: 1,
      }),
    );

    component.openTransmissionDetails(mockTransmission);
    expect(apiMock['getTransmission']).toHaveBeenCalledWith('tx-1');
    expect(component.selectedTransmission()?.id).toBe('tx-1');
    expect(component.isTransmissionDrawerVisible()).toBe(true);

    component.closeTransmissionDrawer();
    expect(component.isTransmissionDrawerVisible()).toBe(false);
    expect(component.selectedTransmission()).toBeNull();
  });

  it('should submit send document form with base64 payload', () => {
    component.openSendModal('peppol');
    expect(component.isSendModalVisible()).toBe(true);
    expect(component.sendForm.value.network).toBe('peppol');

    component.sendForm.patchValue({
      document_reference: 'INV-2026-999',
      recipient_identifier: 'iso6523-actorid-upis::9906:it99999999999',
      payload: '<Invoice>Test Payload</Invoice>',
    });

    component.submitSendDocument();

    expect(apiMock['sendDocument']).toHaveBeenCalledWith(
      'peppol',
      expect.objectContaining({
        document_reference: 'INV-2026-999',
        recipient_identifier: 'iso6523-actorid-upis::9906:it99999999999',
      }),
    );
    expect(messageMock['success']).toHaveBeenCalled();
    expect(component.isSendModalVisible()).toBe(false);
  });

  it('should not submit send form if invalid', () => {
    component.openSendModal();
    component.sendForm.patchValue({
      document_reference: '',
      recipient_identifier: '',
      payload: '',
    });
    component.submitSendDocument();
    expect(apiMock['sendDocument']).not.toHaveBeenCalled();
  });

  it('should sign document and refresh signatures list', async () => {
    component.openSignModal();
    expect(component.isSignModalVisible()).toBe(true);

    component.signForm.patchValue({
      document_type: 'invoice',
      document_id: '8d1f0a52-3b6e-4c11-9a7e-1f2d3c4b5a69',
    });

    component.submitSignDocument();

    expect(apiMock['signDocument']).toHaveBeenCalledWith({
      document_type: 'invoice',
      document_id: '8d1f0a52-3b6e-4c11-9a7e-1f2d3c4b5a69',
    });
    expect(messageMock['success']).toHaveBeenCalled();
    expect(component.isSignModalVisible()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(apiMock['getSignatures']).toHaveBeenCalledWith('8d1f0a52-3b6e-4c11-9a7e-1f2d3c4b5a69', expect.anything());
  });

  it('should verify signature and open verification modal', () => {
    component.verifySignature(mockSignature);

    expect(apiMock['verifySignature']).toHaveBeenCalledWith('sig-1');
    expect(component.verificationResult()?.valid).toBe(true);
    expect(component.isVerificationModalVisible()).toBe(true);

    component.closeVerificationModal();
    expect(component.isVerificationModalVisible()).toBe(false);
    expect(component.verificationResult()).toBeNull();
  });

  it('should preserve document and refresh preservation list', async () => {
    component.openPreserveModal();
    expect(component.isPreserveModalVisible()).toBe(true);

    component.preserveForm.patchValue({
      document_type: 'invoice',
      document_id: '0b8f6c1e-7a52-4d3b-9c64-2e1f0a9b8c7d',
    });

    component.submitPreserveDocument();

    expect(apiMock['preserveDocument']).toHaveBeenCalledWith({
      document_type: 'invoice',
      document_id: '0b8f6c1e-7a52-4d3b-9c64-2e1f0a9b8c7d',
    });
    expect(messageMock['success']).toHaveBeenCalled();
    expect(component.isPreserveModalVisible()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(apiMock['getPreservationRecords']).toHaveBeenCalledWith('0b8f6c1e-7a52-4d3b-9c64-2e1f0a9b8c7d', expect.anything());
  });

  it('should update signing settings', () => {
    component.settingsForm.patchValue({
      driver: 'cades',
      certificate: '---CERT---',
      private_key: '---KEY---',
      passphrase: 'secret-password',
    });

    component.submitSettings();

    expect(apiMock['updateSigningSettings']).toHaveBeenCalledWith({
      driver: 'cades',
      certificate: '---CERT---',
      private_key: '---KEY---',
      passphrase: 'secret-password',
    });
    expect(messageMock['success']).toHaveBeenCalled();
  });

  it('should return correct badge colors for statuses and networks', () => {
    expect(component.getStatusBadgeColor('delivered')).toBe('success');
    expect(component.getStatusBadgeColor('pending')).toBe('processing');
    expect(component.getStatusBadgeColor('failed')).toBe('error');
    expect(component.getStatusBadgeColor('unknown')).toBe('default');

    expect(component.getNetworkBadgeColor('peppol')).toBe('blue');
    expect(component.getNetworkBadgeColor('ebill')).toBe('green');
    expect(component.getNetworkBadgeColor('nso')).toBe('purple');
    expect(component.getNetworkBadgeColor('other')).toBe('cyan');
  });

  it('should handle API errors gracefully', () => {
    apiMock['sendDocument']!.mockReturnValue(throwError(() => ({ error: { message: 'Provider contract missing' } })));
    component.openSendModal('peppol');
    component.sendForm.patchValue({
      document_reference: 'INV-FAIL',
      recipient_identifier: 'test-id',
      payload: 'test',
    });
    component.submitSendDocument();
    expect(messageMock['error']).toHaveBeenCalledWith('Provider contract missing');

    apiMock['signDocument']!.mockReturnValue(throwError(() => ({ error: { message: 'Certificate expired' } })));
    component.openSignModal();
    component.signForm.patchValue({
      document_type: 'invoice',
      document_id: '3f2b1c9a-5d4e-4a67-8b90-1c2d3e4f5a6b',
    });
    component.submitSignDocument();
    expect(messageMock['error']).toHaveBeenCalledWith('Certificate expired');

    apiMock['verifySignature']!.mockReturnValue(throwError(() => ({ error: { message: 'Signature corrupted' } })));
    component.verifySignature(mockSignature);
    expect(messageMock['error']).toHaveBeenCalledWith('Signature corrupted');
  });
});
