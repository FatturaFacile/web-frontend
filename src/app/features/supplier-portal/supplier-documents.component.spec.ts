import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierDocument, SupplierPortalApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { SupplierDocumentsComponent } from './supplier-documents.component';
import { expiryColor } from './supplier-portal.utils';

describe('SupplierDocumentsComponent', () => {
  let fixture: ComponentFixture<SupplierDocumentsComponent>;
  let component: SupplierDocumentsComponent;

  const document: SupplierDocument = {
    id: 'doc-1',
    supplier_id: 'sup-1',
    supplier_name: 'Fornitore Spa',
    requirement_id: 'req-1',
    requirement_code: 'DURC',
    requirement_name: 'DURC',
    status: 'submitted',
    issued_at: '2027-06-01',
    expires_at: null,
    is_expired: false,
    has_file: true,
    submitted_via: 'portal',
  };

  const apiSpy = {
    getDocuments: vi.fn(),
    getDocumentRequirements: vi.fn(),
    seedDocumentRequirements: vi.fn(),
    acceptDocument: vi.fn(),
    rejectDocument: vi.fn(),
    downloadDocument: vi.fn(),
  };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiSpy.getDocuments.mockReturnValue(of({ data: [document] }));
    apiSpy.getDocumentRequirements.mockReturnValue(of({ data: [] }));
    apiSpy.seedDocumentRequirements.mockReturnValue(of({ created: 10 }));
    apiSpy.acceptDocument.mockReturnValue(of({ data: { ...document, status: 'accepted' } }));
    apiSpy.rejectDocument.mockReturnValue(of({ data: { ...document, status: 'rejected' } }));

    await TestBed.configureTestingModule({
      imports: [SupplierDocumentsComponent],
      providers: [
        { provide: SupplierPortalApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SupplierDocumentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts with the documents waiting for review', () => {
    expect(apiSpy.getDocuments).toHaveBeenCalledWith(expect.objectContaining({ status: 'submitted', expiring_within_days: undefined }));
    expect(component.documents()).toHaveLength(1);
  });

  it('filters the documents expiring within the chosen days', () => {
    component.setStatusFilter('accepted');
    component.setExpiringFilter(30);

    expect(apiSpy.getDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'accepted', expiring_within_days: 30 }));
  });

  it('accepts a document with the expiry read from the file', () => {
    component.openAccept(document);
    component.acceptForm.patchValue({ expires_at: '2027-12-01' });
    component.confirmAccept();

    expect(apiSpy.acceptDocument).toHaveBeenCalledWith('doc-1', { reference: null, issued_at: '2027-06-01', expires_at: '2027-12-01' });
    expect(component.acceptVisible()).toBe(false);
  });

  it('needs a reason to reject a document', () => {
    component.openReject(document);
    component.confirmReject();
    expect(apiSpy.rejectDocument).not.toHaveBeenCalled();

    component.rejectForm.patchValue({ reason: 'Illegible scan' });
    component.confirmReject();

    expect(apiSpy.rejectDocument).toHaveBeenCalledWith('doc-1', { reason: 'Illegible scan' });
  });

  it('creates the default document types and reloads them', () => {
    component.seedDefaults();

    expect(apiSpy.seedDocumentRequirements).toHaveBeenCalled();
    expect(messageSpy.success).toHaveBeenCalledWith('SUPPLIER_PORTAL.DEFAULT_TYPES_CREATED');
    expect(apiSpy.getDocumentRequirements).toHaveBeenCalledTimes(2);
  });

  it('colours the days left before an expiry', () => {
    expect(expiryColor(-1)).toBe('red');
    expect(expiryColor(0)).toBe('orange');
    expect(expiryColor(30)).toBe('orange');
    expect(expiryColor(31)).toBe('green');
    expect(expiryColor(null)).toBe('default');
  });
});
