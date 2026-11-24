import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientApiService, Lead, LeadApiService, SettingsApiService } from '@core';
import { icons } from '../../../icons-provider';
import { LeadDetailComponent } from './lead-detail.component';
import { httpError, i18nStub, messageStub } from './lead-test.utils';

const BASE: Lead = {
  id: 'lead-1',
  first_name: 'Anna',
  last_name: 'Rossi',
  company_name: 'Rossi Impianti',
  email: 'anna@rossi.it',
  phone: null,
  status: 'new',
  score: 35,
  rating: 'cold',
  score_breakdown: [
    { rule_id: 'r1', code: 'INDUSTRY_IT', points: 25 },
    { rule_id: 'r2', code: 'NO_PHONE', points: -5 },
  ],
};

describe('LeadDetailComponent', () => {
  let api: {
    getLead: ReturnType<typeof vi.fn>;
    listEvents: ReturnType<typeof vi.fn>;
    addEvent: ReturnType<typeof vi.fn>;
    rescore: ReturnType<typeof vi.fn>;
    route: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      getLead: vi.fn().mockReturnValue(of(BASE)),
      listEvents: vi.fn().mockReturnValue(of([])),
      addEvent: vi.fn(),
      rescore: vi.fn(),
      route: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        provideNzDateFnsAdapter(),
        i18nStub(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 'lead-1' })) },
        },
        { provide: LeadApiService, useValue: api },
        { provide: ClientApiService, useValue: { list: () => of({ data: [] }) } },
        { provide: SettingsApiService, useValue: { getTenantUsers: () => of({ data: [] }) } },
        { provide: NzMessageService, useValue: messageStub() },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(LeadDetailComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('lists every applied rule with its points', () => {
    const fixture = render();
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('table.breakdown tbody tr'),
    );
    const cells = rows.map((r) =>
      Array.from(r.querySelectorAll('td')).map((td) => td.textContent?.trim()),
    );
    expect(cells).toEqual([
      ['INDUSTRY_IT', '+25'],
      ['NO_PHONE', '-5'],
    ]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-lead-rating-tag')?.textContent,
    ).toContain('CRM.LEADS.RATING.COLD');
  });

  it('adding an event posts it and refreshes score and rating', () => {
    const fixture = render();
    const cmp = fixture.componentInstance;
    api.addEvent.mockReturnValue(of({ id: 'e1' }));
    api.getLead.mockReturnValue(of({ ...BASE, score: 75, rating: 'hot' }));
    api.listEvents.mockReturnValue(
      of([
        {
          id: 'e1',
          lead_id: 'lead-1',
          type: 'catalog_downloaded',
          occurred_at: '2026-11-10T10:00:00Z',
        },
      ]),
    );

    cmp.eventForm.setValue({
      type: 'catalog_downloaded',
      occurred_at: null,
      metadata: '{"campaign":"spring"}',
    });
    cmp.addEvent();
    fixture.detectChanges();

    expect(api.addEvent).toHaveBeenCalledWith('lead-1', {
      type: 'catalog_downloaded',
      metadata: { campaign: 'spring' },
    });
    expect(cmp.lead()?.score).toBe(75);
    expect(cmp.lead()?.rating).toBe('hot');
    expect(cmp.events()).toHaveLength(1);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-lead-score-badge')?.textContent?.trim()).toBe('75');
    expect(el.querySelector('nz-timeline')?.textContent).toContain(
      'CRM.LEADS.EVENTS.TYPES.CATALOG_DOWNLOADED',
    );
  });

  it('rejects metadata that is not a JSON object without calling the API', () => {
    const cmp = render().componentInstance;
    cmp.eventForm.controls.metadata.setValue('[1,2]');
    cmp.addEvent();
    expect(api.addEvent).not.toHaveBeenCalled();
  });

  it('shows the not-found state on 404', () => {
    api.getLead.mockReturnValue(throwError(() => httpError(404)));
    const fixture = render();
    expect(fixture.componentInstance.notFound()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('CRM.LEADS.NOT_FOUND');
  });

  it('rescore updates the lead in place', () => {
    const fixture = render();
    api.rescore.mockReturnValue(of({ ...BASE, score: 90, rating: 'hot' }));
    fixture.componentInstance.rescore();
    expect(api.rescore).toHaveBeenCalledWith('lead-1');
    expect(fixture.componentInstance.lead()?.rating).toBe('hot');
  });
});
