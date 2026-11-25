import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FranchiseNetworkApiService } from '@core';
import { AuditRunStore } from './audit-run.store';

const ok = (data: unknown = {}) => of({ success: true, message: '', data });

const audit = (overrides: Record<string, unknown> = {}) => ({
  id: 'au1',
  store_id: 's1',
  template_id: 't1',
  status: 'draft',
  notes: null,
  answers: [{ criterion_code: 'SIGN-EXTERIOR', score: '4', notes: 'ok' }],
  photos: [],
  ...overrides,
});

describe('AuditRunStore', () => {
  const api = {
    getAudit: vi.fn(),
    getLookups: vi.fn(),
    saveAuditAnswers: vi.fn(),
    submitAudit: vi.fn(),
    addAuditPhoto: vi.fn(),
    removeAuditPhoto: vi.fn(),
    auditPhotoBlob: vi.fn(),
  };
  let store: InstanceType<typeof AuditRunStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getAudit.mockReturnValue(ok(audit()));
    api.getLookups.mockReturnValue(ok({ audit_templates: [{ id: 't1', code: 'RETAIL-STANDARD', criteria: [] }] }));
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({
      providers: [AuditRunStore, { provide: FranchiseNetworkApiService, useValue: api }],
    });
    store = TestBed.inject(AuditRunStore);
  });

  it('loads the audit with its template and the answers already given', async () => {
    await store.load('au1');

    expect(store.template()?.code).toBe('RETAIL-STANDARD');
    expect(store.answers()['SIGN-EXTERIOR']).toEqual({ score: 4, notes: 'ok' });
  });

  it('keeps scores and notes in the store while the manager walks the shop', async () => {
    await store.load('au1');

    store.setScore('CLEAN-FLOOR', 3);
    store.setNote('CLEAN-FLOOR', 'Entrance mat is worn');

    expect(store.answers()['CLEAN-FLOOR']).toEqual({ score: 3, notes: 'Entrance mat is worn' });
  });

  it('saves only the criteria that have a score', async () => {
    await store.load('au1');
    store.setNote('LAYOUT-FLOW', 'note without a score');
    api.saveAuditAnswers.mockReturnValue(ok(audit()));

    await store.saveDraft();

    expect(api.saveAuditAnswers).toHaveBeenCalledWith(
      'au1',
      [{ criterion_code: 'SIGN-EXTERIOR', score: 4, notes: 'ok' }],
      null,
    );
  });

  it('saves the answers and then submits the audit', async () => {
    await store.load('au1');
    api.saveAuditAnswers.mockReturnValue(ok(audit()));
    api.submitAudit.mockReturnValue(ok(audit({ status: 'submitted', score_percent: '92.00', passed: true })));

    const outcome = await store.submit();

    expect(outcome.ok).toBe(true);
    expect(api.saveAuditAnswers).toHaveBeenCalledTimes(1);
    expect(store.audit()?.status).toBe('submitted');
  });

  it('reports an audit that still has criteria to score', async () => {
    await store.load('au1');
    api.saveAuditAnswers.mockReturnValue(ok(audit()));
    api.submitAudit.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'audit_incomplete', params: { missing: 3 } } })),
    );

    const outcome = await store.submit();

    expect(outcome.errorKey).toBe('franchiseNetwork.error.audit_incomplete');
    expect(outcome.params).toEqual({ missing: 3 });
    expect(store.saving()).toBe(false);
  });

  it('uploads a photo and builds its preview', async () => {
    await store.load('au1');
    const withPhoto = audit({ photos: [{ id: 'ph1', original_name: 'sign.jpg', criterion_code: 'SIGN-EXTERIOR', caption: null }] });
    api.addAuditPhoto.mockReturnValue(ok(withPhoto));
    api.auditPhotoBlob.mockReturnValue(of(new Blob(['x'], { type: 'image/jpeg' })));
    const file = new File(['x'], 'sign.jpg', { type: 'image/jpeg' });

    const outcome = await store.addPhoto(file, 'SIGN-EXTERIOR', null);

    expect(outcome.ok).toBe(true);
    expect(api.addAuditPhoto).toHaveBeenCalledWith('au1', file, 'SIGN-EXTERIOR', null);
    expect(store.previews()['ph1']).toBe('blob:preview');
  });

  it('removes a photo and releases its preview', async () => {
    await store.load('au1');
    api.addAuditPhoto.mockReturnValue(ok(audit({ photos: [{ id: 'ph1', original_name: 'a.jpg', criterion_code: null, caption: null }] })));
    api.auditPhotoBlob.mockReturnValue(of(new Blob(['x'])));
    await store.addPhoto(new File(['x'], 'a.jpg'), null, null);
    api.removeAuditPhoto.mockReturnValue(ok(audit()));

    await store.removePhoto('ph1');

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    expect(store.previews()['ph1']).toBeUndefined();
  });
});
