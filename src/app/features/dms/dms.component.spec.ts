import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  DmsAiSettingsResource,
  DmsApiService,
  DmsAuditEntry,
  DmsDocumentResource,
  DmsDocumentVersionResource,
  DmsExtractionResource,
  DmsFolderResource,
  DmsResolvedLink,
  DmsRetentionPolicyResource,
  DmsTagResource,
} from '@core';
import { DmsComponent } from './dms.component';

describe('DmsComponent', () => {
  let fixture: ComponentFixture<DmsComponent>;
  let component: DmsComponent;

  const mockDocuments: DmsDocumentResource[] = [
    {
      id: 'doc-001-uuid',
      title: 'Fattura Attiva 2026-001',
      description: 'Documento contabile vendita',
      document_type: 'Invoice',
      folder_id: 'fld-1',
      folder_name: 'Fatture Clienti',
      status: 'published',
      is_legal_hold: false,
      latest_version: {
        id: 'ver-1',
        document_id: 'doc-001-uuid',
        version_number: 1,
        original_name: 'fattura_001.pdf',
        size: 204800,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    },
  ];

  const mockFolders: DmsFolderResource[] = [
    {
      id: 'fld-1',
      name: 'Fatture Clienti',
      access_roles: ['admin', 'accountant', 'sales'],
      documents_count: 14,
    },
  ];

  const mockVersions: DmsDocumentVersionResource[] = [
    {
      id: 'ver-1',
      document_id: 'doc-001-uuid',
      version_number: 1,
      original_name: 'fattura_001.pdf',
      size: 204800,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      created_at: '2026-11-09T10:00:00Z',
    },
  ];

  const mockLinks: DmsResolvedLink[] = [
    {
      id: 'lnk-1',
      document_id: 'doc-001-uuid',
      target_type: 'Invoice',
      target_id: 'inv-42',
      target_label: 'Fattura F-2026-42',
    },
  ];

  const mockExtractions: DmsExtractionResource[] = [
    {
      id: 'extr-1',
      document_id: 'doc-001-uuid',
      field_name: 'Partita IVA',
      extracted_value: 'CHE-123.456.789',
      confidence: 96,
      status: 'pending',
    },
  ];

  const mockAuditTrail: DmsAuditEntry[] = [
    {
      id: 'aud-1',
      document_id: 'doc-001-uuid',
      event_type: 'document.created',
      actor_id: 'usr-1',
      actor_name: 'Admin User',
      created_at: '2026-11-09T10:00:00Z',
    },
  ];

  const mockRetentionPolicies: DmsRetentionPolicyResource[] = [
    {
      id: 'ret-1',
      name: 'Conservazione Fiscale 10 Anni',
      document_type: 'Invoice',
      retention_months: 120,
      action: 'archive',
      is_active: true,
    },
  ];

  const mockTags: DmsTagResource[] = [
    { id: 'tag-1', name: 'Contabilità', color: 'blue' },
  ];

  const mockAiSettings: DmsAiSettingsResource = {
    is_ocr_enabled: true,
    min_confidence: 85,
    auto_tagging: true,
  };

  const mockDmsApi = {
    getDocuments: vi.fn().mockReturnValue(of({ success: true, data: mockDocuments, meta: { total: 1 } })),
    createDocument: vi.fn().mockReturnValue(of({ success: true, data: mockDocuments[0] })),
    deleteDocument: vi.fn().mockReturnValue(of(null)),
    checkOutDocument: vi.fn().mockReturnValue(of({ success: true, data: { ...mockDocuments[0], checked_out_by: 'usr-1' } })),
    checkInDocument: vi.fn().mockReturnValue(of({ success: true, data: mockVersions[0] })),
    placeLegalHold: vi.fn().mockReturnValue(of({ success: true, data: { ...mockDocuments[0], is_legal_hold: true } })),
    releaseLegalHold: vi.fn().mockReturnValue(of({ success: true, data: { ...mockDocuments[0], is_legal_hold: false } })),
    getDocumentVersions: vi.fn().mockReturnValue(of({ success: true, data: mockVersions })),
    verifyVersion: vi.fn().mockReturnValue(of({ success: true, data: { is_valid: true } })),
    getDocumentLinks: vi.fn().mockReturnValue(of({ success: true, data: mockLinks })),
    linkDocument: vi.fn().mockReturnValue(of({ success: true, data: mockLinks[0] })),
    removeLink: vi.fn().mockReturnValue(of(null)),
    getDocumentExtractions: vi.fn().mockReturnValue(of({ success: true, data: mockExtractions })),
    confirmExtraction: vi.fn().mockReturnValue(of({ success: true, data: { ...mockExtractions[0], status: 'confirmed' } })),
    rejectExtraction: vi.fn().mockReturnValue(of({ success: true, data: { ...mockExtractions[0], status: 'rejected' } })),
    getDocumentAuditTrail: vi.fn().mockReturnValue(of({ success: true, data: mockAuditTrail })),
    getFolders: vi.fn().mockReturnValue(of({ success: true, data: mockFolders })),
    createFolder: vi.fn().mockReturnValue(of({ success: true, data: mockFolders[0] })),
    deleteFolder: vi.fn().mockReturnValue(of(null)),
    getRetentionPolicies: vi.fn().mockReturnValue(of({ success: true, data: mockRetentionPolicies })),
    createRetentionPolicy: vi.fn().mockReturnValue(of({ success: true, data: mockRetentionPolicies[0] })),
    deleteRetentionPolicy: vi.fn().mockReturnValue(of(null)),
    getTags: vi.fn().mockReturnValue(of({ success: true, data: mockTags })),
    createTag: vi.fn().mockReturnValue(of({ success: true, data: mockTags[0] })),
    deleteTag: vi.fn().mockReturnValue(of(null)),
    getAiSettings: vi.fn().mockReturnValue(of({ success: true, data: mockAiSettings })),
    updateAiSettings: vi.fn().mockReturnValue(of({ success: true, data: mockAiSettings })),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DmsComponent],
      providers: [
        { provide: DmsApiService, useValue: mockDmsApi },
        { provide: NzMessageService, useValue: mockMessage },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DmsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes component and loads folders and documents', () => {
    expect(component).toBeTruthy();
    expect(mockDmsApi.getFolders).toHaveBeenCalled();
    expect(mockDmsApi.getDocuments).toHaveBeenCalled();
    expect(component.documents().length).toBe(1);
    expect(component.documents()[0].title).toBe('Fattura Attiva 2026-001');
  });

  it('submits create document modal form', () => {
    component.openCreateDocModal();
    expect(component.createDocModalVisible()).toBe(true);

    component.docForm.patchValue({
      title: 'Nuovo Contratto Partner',
      document_type: 'Contract',
      description: 'Accordo commerciale',
      original_name: 'partner_agreement.pdf',
    });

    component.submitCreateDoc();
    expect(mockDmsApi.createDocument).toHaveBeenCalled();
    expect(component.createDocModalVisible()).toBe(false);
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('handles check-out and check-in lifecycle', () => {
    const doc = component.documents()[0];
    component.openCheckOutModal(doc);
    expect(component.checkOutModalVisible()).toBe(true);

    component.checkOutReason.set('Revisione clausole');
    component.submitCheckOut();
    expect(mockDmsApi.checkOutDocument).toHaveBeenCalledWith(doc.id, { reason: 'Revisione clausole' });
    expect(component.checkOutModalVisible()).toBe(false);

    component.openCheckInModal(doc);
    expect(component.checkInModalVisible()).toBe(true);
    component.submitCheckIn();
    expect(mockDmsApi.checkInDocument).toHaveBeenCalled();
    expect(component.checkInModalVisible()).toBe(false);
  });

  it('applies and releases legal hold protection', () => {
    const doc = component.documents()[0];
    component.openLegalHoldModal(doc);
    expect(component.legalHoldModalVisible()).toBe(true);

    component.legalHoldReason.set('Verifica fiscale GdF');
    component.submitLegalHold();
    expect(mockDmsApi.placeLegalHold).toHaveBeenCalledWith(doc.id, { reason: 'Verifica fiscale GdF' });
    expect(component.legalHoldModalVisible()).toBe(false);

    component.releaseLegalHold(doc);
    expect(mockDmsApi.releaseLegalHold).toHaveBeenCalledWith(doc.id);
  });

  it('opens detail drawer, verifies SHA-256 integrity and confirms OCR extraction', () => {
    const doc = component.documents()[0];
    component.openDrawer(doc);
    expect(component.drawerVisible()).toBe(true);
    expect(mockDmsApi.getDocumentVersions).toHaveBeenCalledWith(doc.id);
    expect(mockDmsApi.getDocumentExtractions).toHaveBeenCalledWith(doc.id);

    // Verify SHA-256
    const version = mockVersions[0];
    component.verifySha256(version);
    expect(mockDmsApi.verifyVersion).toHaveBeenCalledWith(doc.id, version.id);
    expect(mockMessage.success).toHaveBeenCalled();

    // Confirm extraction
    const extr = mockExtractions[0];
    component.confirmExtraction(extr);
    expect(mockDmsApi.confirmExtraction).toHaveBeenCalledWith(extr.id, { confirmed_value: extr.extracted_value });
  });

  it('switches to folders, retention, and AI tabs', () => {
    component.onTabChange(1);
    expect(mockDmsApi.getFolders).toHaveBeenCalled();

    component.openCreateFolderModal();
    component.folderForm.patchValue({ name: 'DDT Fornitori 2026' });
    component.submitCreateFolder();
    expect(mockDmsApi.createFolder).toHaveBeenCalled();

    component.onTabChange(2);
    expect(mockDmsApi.getRetentionPolicies).toHaveBeenCalled();

    component.openCreatePolicyModal();
    component.policyForm.patchValue({
      name: 'Conservazione Contratti 10y',
      document_type: 'Contract',
      retention_months: 120,
    });
    component.submitCreatePolicy();
    expect(mockDmsApi.createRetentionPolicy).toHaveBeenCalled();

    component.onTabChange(3);
    expect(mockDmsApi.getTags).toHaveBeenCalled();
    expect(mockDmsApi.getAiSettings).toHaveBeenCalled();
  });
});
