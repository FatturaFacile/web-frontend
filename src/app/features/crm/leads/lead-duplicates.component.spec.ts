import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadApiService, LeadDuplicateCandidate } from '@core';
import { icons } from '../../../icons-provider';
import { conflictingFields, LeadDuplicatesComponent } from './lead-duplicates.component';
import { httpError, i18nStub, messageStub } from './lead-test.utils';

const DUP: LeadDuplicateCandidate = {
  id: 'dup-1',
  lead: {
    id: 'lead-new',
    first_name: 'Anna',
    last_name: 'Rossi',
    company_name: 'Rossi Impianti SRL',
    email: 'anna@rossi.it',
    phone: '+39 02 1234',
    status: 'new',
    score: 40,
    rating: 'warm',
  },
  candidate: {
    type: 'lead',
    id: 'lead-old',
    summary: { first_name: 'Anna', last_name: 'Rossi', company_name: 'Rossi Impianti', email: 'anna@rossi.it' },
  },
  match_type: 'email',
  confidence: 0.98,
  status: 'pending',
};

const OTHER: LeadDuplicateCandidate = { ...DUP, id: 'dup-2', match_type: 'company_fuzzy', confidence: 0.86 };

describe('LeadDuplicatesComponent', () => {
  let api: {
    listDuplicates: ReturnType<typeof vi.fn>;
    mergeDuplicate: ReturnType<typeof vi.fn>;
    dismissDuplicate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      listDuplicates: vi.fn().mockReturnValue(
        of({ data: [DUP, OTHER], meta: { total: 2, current_page: 1 } }),
      ),
      mergeDuplicate: vi.fn().mockReturnValue(of({})),
      dismissDuplicate: vi.fn().mockReturnValue(of({})),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        i18nStub(),
        { provide: LeadApiService, useValue: api },
        { provide: NzMessageService, useValue: messageStub() },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(LeadDuplicatesComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('loads pending duplicates and renders lead vs candidate side by side', () => {
    const fixture = render();
    expect(api.listDuplicates).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.side-by-side')).toHaveLength(2);
    expect(el.textContent).toContain('Confidence: 98%');
    expect(el.textContent).toContain('Rossi Impianti SRL');
  });

  it('merges with the chosen survivor and removes the row', () => {
    const fixture = render();
    const cmp = fixture.componentInstance;
    cmp.openMerge(DUP);
    cmp.survivor.set('candidate');
    cmp.confirmMerge();

    expect(api.mergeDuplicate).toHaveBeenCalledWith('dup-1', { survivor: 'candidate' });
    expect(cmp.items().map((d) => d.id)).toEqual(['dup-2']);
    expect(cmp.merging()).toBeNull();
  });

  it('sends field_choices when fields are picked individually', () => {
    const cmp = render().componentInstance;
    cmp.openMerge(DUP);
    cmp.pickFields.set(true);
    cmp['setChoice']('company_name', 'candidate');

    expect(cmp.buildMergePayload()).toEqual({ survivor: 'lead', field_choices: { company_name: 'candidate' } });
  });

  it('dismiss removes the row', () => {
    const cmp = render().componentInstance;
    cmp.dismiss(OTHER);
    expect(api.dismissDuplicate).toHaveBeenCalledWith('dup-2');
    expect(cmp.items().map((d) => d.id)).toEqual(['dup-1']);
  });

  it('a failed merge keeps the row and shows a message on it', () => {
    api.mergeDuplicate.mockReturnValue(throwError(() => httpError(500, { message: 'Merge failed' })));
    const fixture = render();
    const cmp = fixture.componentInstance;
    cmp.openMerge(DUP);
    cmp.confirmMerge();
    fixture.detectChanges();

    expect(cmp.items().map((d) => d.id)).toEqual(['dup-1', 'dup-2']);
    expect(cmp.rowErrors()['dup-1']).toBe('Merge failed');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Merge failed');
  });

  it('conflictingFields lists only differing candidate values', () => {
    expect(conflictingFields(DUP).map((r) => r.field)).toEqual(['company_name']);
  });
});
