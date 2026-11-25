import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PackageComponent } from './package.component';
import { PackageStore } from './package.store';
import {
  artifact,
  baseProviders,
  dossier,
  lookups,
  pack,
  report,
  wrap,
} from './statutory-financials.testing';
import { WorkspaceStore } from './workspace.store';

describe('PackageComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  const xbrl = artifact('x-1', {
    kind: 'xbrl_instance',
    file_name: 'accounts.xbrl',
    pdfa_conformance: null,
  });
  const verifiedReport = {
    profile: 'PDF/A-1b',
    compliant: false,
    verified_by: 'u-1',
    checks: [
      { id: 'fonts_embedded', passed: true, detail: null },
      { id: 'xmp_metadata', passed: false, detail: 'Missing pdfaid.' },
    ],
  };

  beforeEach(() => {
    canWrite = true;
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      getDossier: vi.fn(() => of(wrap(dossier('d-1')))),
      getPackage: vi.fn(() =>
        of(
          wrap({
            package: pack({
              tebeni_validation_report: report({
                status: 'invalid',
                errors: [
                  {
                    severity: 'error',
                    category: 'schema',
                    code: 'schema.bad',
                    params: {},
                    message: 'Schema error message.',
                  },
                  {
                    severity: 'error',
                    category: 'cross_statement',
                    code: 'x.bad',
                    params: {},
                    message: 'Totals differ.',
                  },
                ],
              }),
            }),
            artifacts: [xbrl, artifact('a-1', { file_name: 'management.pdf' })],
          }),
        ),
      ),
      exportXbrl: vi.fn(() => of(wrap(pack()))),
      generatePdfa: vi.fn(() => of(wrap({ package: pack(), artifacts: [xbrl, artifact('a-1')] }))),
      verifyArtifact: vi.fn(() =>
        of(wrap(artifact('a-1', { file_name: 'management.pdf', verification: verifiedReport }))),
      ),
      downloadArtifact: vi.fn(() => of(new Blob(['%PDF'], { type: 'application/pdf' }))),
    };
    TestBed.configureTestingModule({
      providers: [WorkspaceStore, ...baseProviders(api, () => canWrite)],
    });
  });

  async function render(status: 'validated' | 'locked' = 'validated') {
    api['getDossier']?.mockReturnValue(of(wrap(dossier('d-1', { status }))));
    await TestBed.inject(WorkspaceStore).load('d-1');
    const fixture = TestBed.createComponent(PackageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /** The button whose text is exactly the text, else the first that contains it. */
  const button = (root: HTMLElement, text: string) => {
    const buttons = Array.from(root.querySelectorAll('button'));
    return (buttons.find((entry) => (entry.textContent ?? '').trim() === text) ??
      buttons.find((entry) => (entry.textContent ?? '').includes(text))) as HTMLButtonElement;
  };

  it('shows the validation report with the status, the counts and the issues grouped by category', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('statutoryFinancials.validation.invalid');
    expect(text).toContain('statutoryFinancials.issueCategory.schema');
    expect(text).toContain('Schema error message.');
    expect(text).toContain('statutoryFinancials.issueCategory.cross_statement');
    expect(text).toContain('Totals differ.');
    expect(text).toContain('statutoryFinancials.issueCategory.notes');
    expect(text).toContain('The notes table is empty.');
    expect(text).toContain('itcc-ci-2024-11-04.xsd');
  });

  it('lists the stored PDF/A documents with size, short hash and conformance', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent as string;

    expect(text).toContain('management.pdf');
    expect(text).toContain('2.0 KB');
    expect(text).toContain('abcdef012345');
    expect(text).toContain('PDF/A-1b');
    expect(text).toContain('statutoryFinancials.artifact.notVerified');
    expect(text).not.toContain('accounts.xbrl');
  });

  it('validates and exports the XBRL and refreshes the dossier status', async () => {
    const fixture = await render();
    api['getDossier']?.mockClear();

    button(fixture.nativeElement as HTMLElement, 'exportXbrl').click();
    await fixture.whenStable();

    expect(api['exportXbrl']).toHaveBeenCalledWith('d-1');
    expect(api['getDossier']).toHaveBeenCalledWith('d-1');
  });

  it('downloads the XBRL instance through the blob endpoint', async () => {
    const fixture = await render();

    button(fixture.nativeElement as HTMLElement, 'downloadXbrl').click();
    await fixture.whenStable();

    expect(api['downloadArtifact']).toHaveBeenCalledWith('d-1', 'x-1');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('verifies a document and lists the checks with pass and fail', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    button(root, 'statutoryFinancials.action.verify').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['verifyArtifact']).toHaveBeenCalledWith('d-1', 'a-1');
    const text = root.textContent as string;
    expect(text).toContain('statutoryFinancials.artifact.notCompliant');
    expect(text).toContain('fonts_embedded');
    expect(text).toContain('xmp_metadata');
    expect(text).toContain('Missing pdfaid.');
    const checks = Array.from(root.querySelectorAll('.check-list li'));
    expect(checks).toHaveLength(2);
    expect(checks[0]?.textContent).toContain('statutoryFinancials.artifact.pass');
    expect(checks[1]?.textContent).toContain('statutoryFinancials.artifact.fail');
  });

  it('downloads a PDF/A document', async () => {
    const fixture = await render();

    button(fixture.nativeElement as HTMLElement, 'statutoryFinancials.action.download').click();
    await fixture.whenStable();

    expect(api['downloadArtifact']).toHaveBeenCalledWith('d-1', 'a-1');
  });

  it('generates each PDF/A document kind from its button', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    button(root, 'statutoryFinancials.pdfaKind.management_report').click();
    await fixture.whenStable();
    button(root, 'statutoryFinancials.pdfaKind.shareholders_minutes').click();
    await fixture.whenStable();

    expect(api['generatePdfa']).toHaveBeenNthCalledWith(1, 'd-1', { kinds: ['management_report'] });
    expect(api['generatePdfa']).toHaveBeenNthCalledWith(2, 'd-1', {
      kinds: ['shareholders_minutes'],
    });
  });

  it('sends the minutes with the meeting data from the generator', async () => {
    const fixture = await render();
    const store = fixture.debugElement.injector.get(PackageStore);
    const component = fixture.componentInstance as unknown as {
      generateMinutes(payload: { kinds: string[]; meeting?: object }): Promise<void>;
      minutesOpen(): boolean;
      openMinutes(): void;
    };
    component.openMinutes();
    expect(component.minutesOpen()).toBe(true);

    await component.generateMinutes({ kinds: ['board_minutes'], meeting: { chair: 'A. Rossi' } });

    expect(api['generatePdfa']).toHaveBeenCalledWith('d-1', {
      kinds: ['board_minutes'],
      meeting: { chair: 'A. Rossi' },
    });
    expect(component.minutesOpen()).toBe(false);
    expect(store.generating()).toBe(false);
  });

  it('keeps the generation and the export disabled when the dossier is locked', async () => {
    const fixture = await render('locked');
    const root = fixture.nativeElement as HTMLElement;

    expect(button(root, 'exportXbrl').disabled).toBe(true);
    expect(button(root, 'statutoryFinancials.pdfaKind.dossier').disabled).toBe(true);
    expect(button(root, 'statutoryFinancials.action.verify').disabled).toBe(false);
  });
});
