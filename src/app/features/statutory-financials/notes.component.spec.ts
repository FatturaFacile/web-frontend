import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesComponent } from './notes.component';
import { NotesStore } from './notes.store';
import { baseProviders, dossier, lookups, notes, wrap } from './statutory-financials.testing';
import { WorkspaceStore } from './workspace.store';

describe('NotesComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    canWrite = true;
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      getDossier: vi.fn(() => of(wrap(dossier('d-1')))),
      getNotes: vi.fn(() => of(wrap(notes()))),
      populateNotes: vi.fn(() => of(wrap(notes()))),
      updateNotes: vi.fn(() => of(wrap(notes()))),
    };
    TestBed.configureTestingModule({
      providers: [WorkspaceStore, ...baseProviders(api, () => canWrite)],
    });
  });

  async function render(status: 'draft' | 'locked' = 'draft') {
    api['getDossier']?.mockReturnValue(of(wrap(dossier('d-1', { status }))));
    await TestBed.inject(WorkspaceStore).load('d-1');
    const fixture = TestBed.createComponent(NotesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('shows only the tables the standard lists, in its order', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const titles = Array.from(root.querySelectorAll('.ant-card-head-title')).map((title) =>
      (title.textContent ?? '').trim(),
    );

    expect(titles).toEqual([
      'statutoryFinancials.notes.table.fixed_assets',
      'statutoryFinancials.notes.table.maturity',
      'statutoryFinancials.notes.table.off_balance',
    ]);
    expect(root.textContent).not.toContain('statutoryFinancials.notes.table.equity');
  });

  it('shows the sources, the fallback badge and only the sections of the standard', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('Mod 019 fixed assets register');
    expect(text).toContain('Mod 017 due dates');
    expect(text).toContain('statutoryFinancials.notes.fallback');
    expect(text).toContain('Introduction');
    expect(text).toContain('Accounting policies');
    expect(text).not.toContain('Not for this standard');
    expect(text).toContain('statutoryFinancials.notes.edited');
  });

  it('shows the empty state while the notes are not populated', async () => {
    api['getNotes']?.mockReturnValue(of(wrap(null)));
    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'statutoryFinancials.empty.notes',
    );
  });

  it('turns a cell edit into an update of the table and saves only the edited tables', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const store = fixture.debugElement.injector.get(NotesStore);
    const save = () =>
      Array.from(root.querySelectorAll('.toolbar button')).find((button) =>
        (button.textContent ?? '').includes('statutoryFinancials.action.save'),
      ) as HTMLButtonElement;
    expect(save().disabled).toBe(true);

    const amount = root.querySelector('input[aria-label="amount #1"]') as HTMLInputElement;
    type(amount, '7.50');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(store.dirtyTables()).toEqual(['off_balance']);
    expect(store.tables().off_balance?.rows[0]?.amount).toBe('7.50');
    expect(save().disabled).toBe(false);

    save().click();
    await fixture.whenStable();

    const payload = api['updateNotes']?.mock.calls[0]?.[1];
    expect(Object.keys(payload.tables)).toEqual(['off_balance']);
    expect(payload.tables.off_balance.rows[0].amount).toBe('7.50');
  });

  it('blocks the save while a decimal is invalid', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    type(root.querySelector('input[aria-label="amount #1"]') as HTMLInputElement, '7,5');
    await fixture.whenStable();
    fixture.detectChanges();

    const save = Array.from(root.querySelectorAll('.toolbar button')).find((button) =>
      (button.textContent ?? '').includes('statutoryFinancials.action.save'),
    ) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(root.querySelector('input[aria-label="amount #1"]')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('adds a row to an editable table', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const store = fixture.debugElement.injector.get(NotesStore);

    const add = Array.from(root.querySelectorAll('button')).find((button) =>
      (button.textContent ?? '').includes('statutoryFinancials.action.addRow'),
    ) as HTMLButtonElement;
    add.click();
    await fixture.whenStable();

    expect(store.tables().off_balance?.rows).toHaveLength(2);
  });

  it('populates from the subledgers with the overwrite flag off', async () => {
    const fixture = await render();
    const populate = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.toolbar button'),
    ).find((button) => (button.textContent ?? '').includes('populateNotes')) as HTMLButtonElement;

    populate.click();
    await fixture.whenStable();

    expect(api['populateNotes']).toHaveBeenCalledWith('d-1', false);
  });

  it('is read-only when the dossier is locked', async () => {
    const fixture = await render('locked');
    const root = fixture.nativeElement as HTMLElement;
    const populate = Array.from(root.querySelectorAll('.toolbar button')).find((button) =>
      (button.textContent ?? '').includes('populateNotes'),
    ) as HTMLButtonElement;

    expect(populate.disabled).toBe(true);
    expect(root.querySelector('input[aria-label="amount #1"]')).toBeNull();
  });
});
