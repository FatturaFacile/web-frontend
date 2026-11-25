import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatutoryFinancialsApiService } from '@core';
import { NotesStore } from './notes.store';
import { notes, wrap } from './statutory-financials.testing';

describe('NotesStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof NotesStore>;

  beforeEach(() => {
    api = {
      getNotes: vi.fn(() => of(wrap(notes()))),
      populateNotes: vi.fn(() => of(wrap(notes({ populated_at: '2026-03-01T00:00:00Z' })))),
      updateNotes: vi.fn(() => of(wrap(notes()))),
    };
    TestBed.configureTestingModule({
      providers: [NotesStore, { provide: StatutoryFinancialsApiService, useValue: api }],
    });
    store = TestBed.inject(NotesStore);
  });

  it('loads the notes with their sources', async () => {
    await store.load('d-1');

    expect(store.populated()).toBe(true);
    expect(store.sources()['fixed_assets']).toBe('Mod 019 fixed assets register');
    expect(store.sections()).toHaveLength(3);
    expect(store.dirty()).toBe(false);
  });

  it('is not populated when the dossier has no notes yet', async () => {
    api['getNotes']?.mockReturnValue(of(wrap(null)));

    await store.load('d-1');

    expect(store.populated()).toBe(false);
    expect(store.tables()).toEqual({});
  });

  it('populates from the subledgers and passes the overwrite flag', async () => {
    const outcome = await store.populate('d-1', true);

    expect(api['populateNotes']).toHaveBeenCalledWith('d-1', true);
    expect(outcome.ok).toBe(true);
    expect(store.notes()?.populated_at).toBe('2026-03-01T00:00:00Z');
    expect(store.populating()).toBe(false);
  });

  it('answers the refusal of the populate with its error key', async () => {
    api['populateNotes']?.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { code: 'statements_not_generated' } }),
      ),
    );

    const outcome = await store.populate('d-1');

    expect(outcome.errorKey).toBe('statutoryFinancials.error.statements_not_generated');
  });

  it('lays the edited rows over the stored table and marks it dirty', async () => {
    await store.load('d-1');

    store.setRows('off_balance', [{ type: 'guarantee', description: 'Edited', amount: '7.00' }]);

    expect(store.dirtyTables()).toEqual(['off_balance']);
    expect(store.dirty()).toBe(true);
    expect(store.tables().off_balance?.rows).toEqual([
      { type: 'guarantee', description: 'Edited', amount: '7.00' },
    ]);
    expect(store.tables().off_balance?.manual).toBe(true);
    expect(store.notes()?.quantitative_tables.off_balance?.rows[0]?.description).toBe(
      'Bank guarantee',
    );
  });

  it('edits one figure of the maturity table', async () => {
    await store.load('d-1');

    store.setMaturity('payables', 'beyond_5y', '9.00');

    const maturity = store.tables().maturity;
    expect(maturity?.payables.beyond_5y).toBe('9.00');
    expect(maturity?.payables.within_1y).toBe('80.00');
    expect(maturity?.receivables.within_1y).toBe('100.00');
  });

  it('edits a narrative section and marks it as edited', async () => {
    await store.load('d-1');

    store.setSectionBody('intro', 'New introduction');

    expect(store.dirtySections()).toEqual(['intro']);
    expect(store.sections().find((section) => section.key === 'intro')?.body).toBe(
      'New introduction',
    );
  });

  it('saves only the edited tables and sections and clears the drafts', async () => {
    await store.load('d-1');
    store.setRows('off_balance', [{ type: 'a', description: 'b', amount: '1.00' }]);
    store.setSectionBody('policies', 'Updated policies');

    const outcome = await store.save('d-1');

    expect(outcome.ok).toBe(true);
    const [, payload] = api['updateNotes']?.mock.calls[0] ?? [];
    expect(Object.keys(payload.tables)).toEqual(['off_balance']);
    expect(payload.sections).toEqual([
      { key: 'policies', title: 'Accounting policies', body: 'Updated policies' },
    ]);
    expect(store.dirty()).toBe(false);
    expect(store.saving()).toBe(false);
  });

  it('keeps the drafts when the save is refused', async () => {
    await store.load('d-1');
    store.setSectionBody('intro', 'x');
    api['updateNotes']?.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'dossier_locked' } })),
    );

    const outcome = await store.save('d-1');

    expect(outcome.ok).toBe(false);
    expect(store.dirty()).toBe(true);
  });

  it('discards the drafts', async () => {
    await store.load('d-1');
    store.setSectionBody('intro', 'x');
    store.setRows('off_balance', []);

    store.discard();

    expect(store.dirty()).toBe(false);
  });
});
