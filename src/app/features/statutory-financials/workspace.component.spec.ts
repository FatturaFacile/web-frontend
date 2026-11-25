import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SfStatus } from '@core';
import { baseProviders, dossier, lookups, summary, wrap } from './statutory-financials.testing';
import { WorkspaceComponent } from './workspace.component';
import { WorkspaceStore } from './workspace.store';

describe('WorkspaceComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    canWrite = true;
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      getDossier: vi.fn(() => of(wrap(dossier('d-1')))),
      transitionDossier: vi.fn(() => of(wrap(summary('d-1', { status: 'locked' })))),
    };
    TestBed.configureTestingModule({
      providers: [WorkspaceStore, ...baseProviders(api, () => canWrite)],
    });
  });

  async function render(status: SfStatus = 'draft', extra: Parameters<typeof dossier>[1] = {}) {
    api['getDossier']?.mockReturnValue(of(wrap(dossier('d-1', { status, ...extra }))));
    const fixture = TestBed.createComponent(WorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const action = (root: HTMLElement, name: string) =>
    Array.from(root.querySelectorAll('.toolbar button')).find((button) =>
      (button.textContent ?? '').includes(`statutoryFinancials.action.${name}`),
    ) as HTMLButtonElement;

  it('loads the dossier of the route and shows the title, the tags and the status steps', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent as string;

    expect(api['getDossier']).toHaveBeenCalledWith('d-1');
    expect(text).toContain('Accounts d-1');
    expect(text).toContain('statutoryFinancials.standard.IT_OIC_Ordinario');
    expect(text).toContain('statutoryFinancials.status.draft');
    expect(root.querySelectorAll('nz-steps nz-step')).toHaveLength(6);
  });

  it('has one tab for each part of the work', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    for (const tab of ['statements', 'notes', 'indicators', 'preview', 'package', 'settings']) {
      expect(text, tab).toContain(`statutoryFinancials.tab.${tab}`);
    }
  });

  it('enables lock only for a validated dossier and keeps reopen and file disabled', async () => {
    const validated = await render('validated');
    const root = validated.nativeElement as HTMLElement;

    expect(action(root, 'lock').disabled).toBe(false);
    expect(action(root, 'reopen').disabled).toBe(true);
    expect(action(root, 'file').disabled).toBe(true);
  });

  it('disables lock for a draft', async () => {
    const fixture = await render('draft');

    expect(action(fixture.nativeElement as HTMLElement, 'lock').disabled).toBe(true);
  });

  it('enables reopen and file for a locked dossier and says it is read-only', async () => {
    const fixture = await render('locked');
    const root = fixture.nativeElement as HTMLElement;

    expect(action(root, 'reopen').disabled).toBe(false);
    expect(action(root, 'file').disabled).toBe(false);
    expect(action(root, 'lock').disabled).toBe(true);
    expect(root.textContent).toContain('statutoryFinancials.workspace.readOnly');
  });

  it('disables every lifecycle action for a member who cannot write', async () => {
    canWrite = false;
    const fixture = await render('locked');
    const root = fixture.nativeElement as HTMLElement;

    expect(action(root, 'reopen').disabled).toBe(true);
    expect(action(root, 'file').disabled).toBe(true);
  });

  it('asks for the filing reference before it files', async () => {
    const fixture = await render('locked');
    const component = fixture.componentInstance as unknown as {
      openFiling(): void;
      file(): Promise<void>;
      reference: { set(value: string): void };
      filing(): boolean;
    };
    component.openFiling();
    expect(component.filing()).toBe(true);

    component.reference.set('  REA-2026-1  ');
    await component.file();

    expect(api['transitionDossier']).toHaveBeenCalledWith('d-1', 'filed', 'REA-2026-1');
    expect(component.filing()).toBe(false);
  });

  it('keeps the filing modal open and shows the refusal of the API', async () => {
    const fixture = await render('locked');
    api['transitionDossier']?.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { code: 'filing_requires_valid_xbrl' } }),
      ),
    );
    const component = fixture.componentInstance as unknown as {
      openFiling(): void;
      file(): Promise<void>;
      reference: { set(value: string): void };
      filing(): boolean;
    };
    component.openFiling();
    component.reference.set('REA-1');

    await component.file();
    fixture.detectChanges();

    expect(component.filing()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'statutoryFinancials.error.filing_requires_valid_xbrl',
    );
  });
});
