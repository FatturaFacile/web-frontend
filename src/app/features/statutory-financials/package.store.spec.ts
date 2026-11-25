import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatutoryFinancialsApiService } from '@core';
import { PackageStore } from './package.store';
import { artifact, pack, wrap } from './statutory-financials.testing';

describe('PackageStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof PackageStore>;

  const xbrl = artifact('x-1', {
    kind: 'xbrl_instance',
    file_name: 'accounts.xbrl',
    pdfa_conformance: null,
  });

  beforeEach(() => {
    api = {
      getPackage: vi.fn(() => of(wrap({ package: pack(), artifacts: [xbrl, artifact('a-1')] }))),
      exportXbrl: vi.fn(() => of(wrap(pack({ validation_status: 'valid' })))),
      generatePdfa: vi.fn(() =>
        of(
          wrap({
            package: pack(),
            artifacts: [xbrl, artifact('a-1'), artifact('a-2', { kind: 'pdfa_board_minutes' })],
          }),
        ),
      ),
      verifyArtifact: vi.fn(() =>
        of(
          wrap(
            artifact('a-1', {
              verification: {
                profile: 'PDF/A-1b',
                compliant: false,
                verified_by: 'u-1',
                checks: [
                  { id: 'fonts_embedded', passed: true, detail: null },
                  { id: 'xmp_metadata', passed: false, detail: 'Missing pdfaid.' },
                ],
              },
            }),
          ),
        ),
      ),
      downloadArtifact: vi.fn(() => of(new Blob(['%PDF'], { type: 'application/pdf' }))),
    };
    TestBed.configureTestingModule({
      providers: [PackageStore, { provide: StatutoryFinancialsApiService, useValue: api }],
    });
    store = TestBed.inject(PackageStore);
  });

  it('loads the package and splits the XBRL artifact from the PDF/A documents', async () => {
    await store.load('d-1');

    expect(store.report()?.status).toBe('warnings');
    expect(store.xbrlArtifact()?.file_name).toBe('accounts.xbrl');
    expect(store.pdfaArtifacts().map((entry) => entry.id)).toEqual(['a-1']);
  });

  it('has no report before the first export', async () => {
    api['getPackage']?.mockReturnValue(of(wrap({ package: null, artifacts: [] })));

    await store.load('d-1');

    expect(store.report()).toBeNull();
    expect(store.xbrlArtifact()).toBeNull();
  });

  it('exports the XBRL and reads the artifacts again', async () => {
    const outcome = await store.exportXbrl('d-1');

    expect(api['exportXbrl']).toHaveBeenCalledWith('d-1');
    expect(outcome.ok).toBe(true);
    expect(api['getPackage']).toHaveBeenCalledWith('d-1');
    expect(store.xbrlArtifact()).not.toBeNull();
    expect(store.exporting()).toBe(false);
  });

  it('answers a refused export with its error key', async () => {
    api['exportXbrl']?.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { code: 'statements_not_generated' } }),
      ),
    );

    const outcome = await store.exportXbrl('d-1');

    expect(outcome.errorKey).toBe('statutoryFinancials.error.statements_not_generated');
    expect(store.exporting()).toBe(false);
  });

  it('generates PDF/A documents with the meeting data', async () => {
    const outcome = await store.generatePdfa('d-1', {
      kinds: ['board_minutes'],
      meeting: { meeting_date: '2026-06-30', chair: 'A. Rossi' },
    });

    expect(api['generatePdfa']).toHaveBeenCalledWith('d-1', {
      kinds: ['board_minutes'],
      meeting: { meeting_date: '2026-06-30', chair: 'A. Rossi' },
    });
    expect(outcome.ok).toBe(true);
    expect(store.pdfaArtifacts()).toHaveLength(2);
    expect(store.generating()).toBe(false);
  });

  it('answers a refused PDF/A generation with its error key', async () => {
    api['generatePdfa']?.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { code: 'pdfa_font_missing' } }),
      ),
    );

    const outcome = await store.generatePdfa('d-1', { kinds: ['dossier'] });

    expect(outcome.errorKey).toBe('statutoryFinancials.error.pdfa_font_missing');
  });

  it('verifies an artifact and keeps the checks in the list', async () => {
    await store.load('d-1');

    await store.verify('d-1', 'a-1');

    const verified = store.pdfaArtifacts().find((entry) => entry.id === 'a-1');
    expect(api['verifyArtifact']).toHaveBeenCalledWith('d-1', 'a-1');
    expect(verified?.verification?.compliant).toBe(false);
    expect(verified?.verification?.checks.map((check) => check.passed)).toEqual([true, false]);
    expect(store.working()).toBeNull();
  });

  it('downloads an artifact as a blob', async () => {
    const { outcome, blob } = await store.download('d-1', 'a-1');

    expect(api['downloadArtifact']).toHaveBeenCalledWith('d-1', 'a-1');
    expect(outcome.ok).toBe(true);
    expect(blob).toBeInstanceOf(Blob);
    expect(store.working()).toBeNull();
  });

  it('answers a refused download with the error key and no blob', async () => {
    api['downloadArtifact']?.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'artifact_missing' } })),
    );

    const { outcome, blob } = await store.download('d-1', 'a-1');

    expect(outcome.errorKey).toBe('statutoryFinancials.error.artifact_missing');
    expect(blob).toBeNull();
  });
});
