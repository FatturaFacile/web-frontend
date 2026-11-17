import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsService, ProfessionalsApiService } from '@core';
import { HubTab } from '../resource-hub/hub.types';
import { ManualFeeNoteComponent } from './manual-fee-note.page';

describe('ManualFeeNoteComponent', () => {
  const api = { createFeeNote: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.createFeeNote.mockReturnValue(of({ data: { id: 'n1' } }));
    TestBed.configureTestingModule({
      imports: [ManualFeeNoteComponent],
      providers: [
        { provide: ProfessionalsApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
      ],
    });
  });

  it('sends the typed amounts as numbers and leaves empty rates null', () => {
    const fixture = TestBed.createComponent(ManualFeeNoteComponent);
    const tab = (fixture.componentInstance as unknown as { tabs(): HubTab[] }).tabs()[0];
    if (tab.kind !== 'form') {
      throw new Error('form tab expected');
    }
    tab.submit({ client_id: 'c1', note_number: '1/2026', date: '2026-01-10', taxable_fees: '1000.50', cpa_rate: '4' }).subscribe();
    expect(api.createFeeNote).toHaveBeenCalledWith({
      client_id: 'c1',
      legal_case_id: null,
      note_number: '1/2026',
      date: '2026-01-10',
      taxable_fees: 1000.5,
      cpa_rate: 4,
      ritenuta_rate: null,
      vat_rate: null,
    });
  });
});
