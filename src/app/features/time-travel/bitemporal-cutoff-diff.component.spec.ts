import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeTravelApiService } from '@core/api/time-travel-api.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TtBackdatedEntry, TtCutOffDiff } from '@core/models/time-travel.model';
import { TimeTravelContextService } from '@core/services/time-travel-context.service';
import { BitemporalCutoffDiffComponent } from './bitemporal-cutoff-diff.component';

const i18n = {
  dictionaryLocale: () => 'en',
  translate: (key: string, params?: Record<string, string | number>) => (params ? `${key} ${JSON.stringify(params)}` : key),
};

const entry: TtBackdatedEntry = {
  event_id: 'ev-1',
  event_type: 'JournalEntryPosted',
  aggregate_type: 'general_ledger',
  aggregate_id: 'je-1',
  valid_at: '2025-12-20T00:00:00Z',
  recorded_at: '2026-02-10T09:30:00Z',
  actor_user_id: 'u-1',
  actor_name: 'Maria Rossi',
  source_document: 'FT-2025-0099',
  amount_delta: '1500.00',
  cryptographic_chain_hash: 'b'.repeat(64),
  payload: { amount: '1500.00' },
};

const diff: TtCutOffDiff = {
  domain: 'trial_balance',
  valid_at: '2025-12-31T23:59:59Z',
  known_at_from: '2026-01-15T00:00:00Z',
  known_at_to: '2026-03-31T00:00:00Z',
  rows: [
    { key: 'a-1', label: '1000 Cash', status: 'unchanged', before: '100.00', after: '100.00', delta: '0.00' },
    { key: 'a-2', label: '4000 Revenue', status: 'backdated', before: '-500.00', after: '-2000.00', delta: '-1500.00' },
  ],
  backdated_entries: [entry],
  totals: { before: '-400.00', after: '-1900.00', delta: '-1500.00' },
};

describe('BitemporalCutoffDiffComponent', () => {
  let api: { cutOffDiff: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { cutOffDiff: vi.fn(() => of({ success: true, message: '', data: diff })) };
    TestBed.configureTestingModule({
      providers: [
        { provide: TimeTravelApiService, useValue: api },
        { provide: I18nService, useValue: i18n },
      ],
    });
  });

  async function create(activate = true) {
    const context = TestBed.inject(TimeTravelContextService);
    if (activate) {
      context.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T00:00:00Z'));
      context.enableDiff(new Date('2026-03-31T00:00:00Z'));
    }
    const fixture = TestBed.createComponent(BitemporalCutoffDiffComponent);
    fixture.componentRef.setInput('domain', 'trial_balance');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, context };
  }

  it('requests the diff of both known-at instants for the economic date', async () => {
    await create();

    expect(api.cutOffDiff).toHaveBeenCalledTimes(1);
    const query = api.cutOffDiff.mock.calls[0][0];
    expect(query.domain).toBe('trial_balance');
    expect(query.valid_at).toBe('2025-12-31T23:59:59.000Z');
    expect(query.known_at_from).toBe('2026-01-15T00:00:00.000Z');
    expect(query.known_at_to).toBe('2026-03-31T00:00:00.000Z');
  });

  it('does not call the API outside the diff mode', async () => {
    await create(false);

    expect(api.cutOffDiff).not.toHaveBeenCalled();
  });

  it('does not call the API for an inverted range', async () => {
    const context = TestBed.inject(TimeTravelContextService);
    context.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-03-31T00:00:00Z'));
    context.enableDiff(new Date('2026-01-15T00:00:00Z'));
    const fixture = TestBed.createComponent(BitemporalCutoffDiffComponent);
    fixture.componentRef.setInput('domain', 'trial_balance');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.cutOffDiff).not.toHaveBeenCalled();
  });

  it('renders each line with its status badge and the backdated entry', async () => {
    const { root } = await create();

    expect(root.querySelector('[data-testid="tt-status-unchanged"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tt-status-backdated"]')).not.toBeNull();
    const backdated = root.querySelector('[data-testid="tt-backdated-table"]');
    expect(backdated?.textContent).toContain('JournalEntryPosted');
    expect(backdated?.textContent).toContain('FT-2025-0099');
    expect(backdated?.textContent).toContain('Maria Rossi');
  });

  it('opens the audit trail drawer with the chain hash of the entry', async () => {
    const { fixture, root } = await create();

    (root.querySelector('[data-testid="tt-open-trail"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const trail = document.querySelector('[data-testid="tt-audit-trail"]');
    expect(trail).not.toBeNull();
    expect(trail?.textContent).toContain('JournalEntryPosted');
    expect(trail?.querySelector('code')?.getAttribute('title')).toBe(entry.cryptographic_chain_hash);
  });

  it('shows the failure of the API as a translated alert', async () => {
    api.cutOffDiff.mockReturnValue(throwError(() => new Error('boom')));

    const { root } = await create();

    expect(root.querySelector('[data-testid="tt-diff-error"]')).not.toBeNull();
  });
});
