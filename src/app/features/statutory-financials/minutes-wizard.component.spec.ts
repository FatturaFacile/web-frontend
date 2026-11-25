import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SfPdfaPayload, TranslateService } from '@core';
import { MinutesWizardComponent } from './minutes-wizard.component';
import { dossier, lookups, translateSpy } from './statutory-financials.testing';
import { MinutesDraft } from './statutory-financials.util';

interface MinutesInternals {
  step(): number;
  problem(): string | null;
  draft(): MinutesDraft;
  patch(patch: Partial<MinutesDraft>): void;
  next(): void;
  previous(): void;
  submit(): void;
  close(): void;
  allocationTemplates(): { key: string }[];
}

describe('MinutesWizardComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translateSpy() }],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(MinutesWizardComponent);
    fixture.componentRef.setInput('dossier', dossier('d-1'));
    fixture.componentRef.setInput('templates', lookups.narrative_templates);
    fixture.detectChanges();
    const submitted: SfPdfaPayload[] = [];
    let closed = 0;
    fixture.componentInstance.submitted.subscribe((payload) => submitted.push(payload));
    fixture.componentInstance.closed.subscribe(() => closed++);
    return {
      wizard: fixture.componentInstance as unknown as MinutesInternals,
      submitted,
      closed: () => closed,
    };
  }

  it('asks for at least one kind of minutes before it goes on', () => {
    const { wizard } = create();
    wizard.patch({ board: false, shareholders: false });

    wizard.next();

    expect(wizard.problem()).toBe('kind_required');
    expect(wizard.step()).toBe(0);
  });

  it('asks for the meeting date before the review', () => {
    const { wizard } = create();
    wizard.next();
    expect(wizard.step()).toBe(1);

    wizard.next();

    expect(wizard.problem()).toBe('date_required');
    expect(wizard.step()).toBe(1);
  });

  it('offers the profit allocation template the API worded in the review', () => {
    const { wizard } = create();

    expect(wizard.allocationTemplates().map((template) => template.key)).toEqual([
      'profit_allocation.minutes',
    ]);
  });

  it('emits the chosen kinds with the meeting data', () => {
    const { wizard, submitted } = create();
    wizard.patch({ board: true, shareholders: true });
    wizard.next();
    wizard.patch({
      meeting_date: new Date(2026, 5, 30),
      meeting_place: 'Milano',
      chair: 'A. Rossi',
      secretary: 'B. Bianchi',
      attendees: ['A. Rossi', 'B. Bianchi'],
    });
    wizard.next();
    expect(wizard.step()).toBe(2);

    wizard.submit();

    expect(submitted).toEqual([
      {
        kinds: ['board_minutes', 'shareholders_minutes'],
        meeting: {
          meeting_date: '2026-06-30',
          meeting_place: 'Milano',
          chair: 'A. Rossi',
          secretary: 'B. Bianchi',
          attendees: ['A. Rossi', 'B. Bianchi'],
        },
      },
    ]);
  });

  it('goes back a step and resets when it is closed', () => {
    const { wizard, closed } = create();
    wizard.next();

    wizard.previous();
    expect(wizard.step()).toBe(0);

    wizard.next();
    wizard.close();
    expect(wizard.step()).toBe(0);
    expect(closed()).toBe(1);
  });
});
