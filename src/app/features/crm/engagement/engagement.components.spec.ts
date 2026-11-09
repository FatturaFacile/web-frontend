import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrmApiService, I18nService, PermissionsService } from '@core';
import { icons } from '../../../icons-provider';
import { ActivitiesComponent } from './activities/activities.component';
import { CampaignsComponent } from './campaigns/campaigns.component';
import { ScoringRulesComponent } from './scoring/scoring-rules.component';
import { SegmentsComponent } from './segments/segments.component';

const page = (data: unknown[]) => ({
  success: true,
  message: 'ok',
  data,
  meta: { current_page: 1, last_page: 1, per_page: 15, total: data.length },
});
const ok = (data: unknown = {}) => of({ success: true, message: 'ok', data });

describe('CRM engagement pages', () => {
  const api = {
    getActivities: vi.fn(),
    createActivity: vi.fn(),
    completeActivity: vi.fn(),
    updateActivity: vi.fn(),
    getCampaigns: vi.fn(),
    getCampaignMembers: vi.fn(),
    getCampaignRoi: vi.fn(),
    getSegments: vi.fn(),
    addCampaignMembers: vi.fn(),
    sendCampaign: vi.fn(),
    createSegment: vi.fn(),
    getSegmentMembers: vi.fn(),
    getLeadScoringRules: vi.fn(),
    createLeadScoringRule: vi.fn(),
    recalculateLeadScores: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const i18n = { translate: vi.fn((key: string) => key), currentLanguage: signal('it') };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getActivities.mockReturnValue(of(page([])));
    api.getCampaigns.mockReturnValue(of(page([])));
    api.getSegments.mockReturnValue(ok([]));
    api.getLeadScoringRules.mockReturnValue(ok([]));
    api.getCampaignMembers.mockReturnValue(ok([]));
    api.getCampaignRoi.mockReturnValue(ok({}));

    await TestBed.configureTestingModule({
      imports: [ActivitiesComponent, CampaignsComponent, SegmentsComponent, ScoringRulesComponent],
      providers: [
        provideNzIcons(icons),
        { provide: CrmApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: I18nService, useValue: i18n },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();
  });

  it('creates an activity with a reminder as an ISO timestamp and a linked record', () => {
    const fixture = TestBed.createComponent(ActivitiesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['openCreate']();
    component['draft'] = {
      subject: 'Call back',
      type: 'call',
      priority: 'high',
      due_date: '2026-11-12',
      reminder_at: '2026-11-12T09:30',
      related_type: 'lead',
      related_id: 'l1',
      notes: '',
    };
    expect(component['valid']()).toBe(true);
    api.createActivity.mockReturnValue(ok());
    component['save']();
    const payload = api.createActivity.mock.calls[0][0];
    expect(payload).toMatchObject({
      subject: 'Call back',
      type: 'call',
      priority: 'high',
      due_date: '2026-11-12',
      related_type: 'lead',
      related_id: 'l1',
      notes: null,
    });
    expect(payload.reminder_at).toBe(new Date('2026-11-12T09:30').toISOString());
  });

  it('requires the related record id when a related type is chosen', () => {
    const fixture = TestBed.createComponent(ActivitiesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['draft'] = { ...component['draft'], subject: 'x', related_type: 'account', related_id: '' };
    expect(component['valid']()).toBe(false);
  });

  it('completes an activity with the outcome and cancels an open one', () => {
    const fixture = TestBed.createComponent(ActivitiesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const activity = { id: 'a1', subject: 'S', type: 'task' as const, status: 'pending' };
    component['openComplete'](activity);
    component['outcome'] = 'Agreed';
    api.completeActivity.mockReturnValue(ok());
    component['complete']();
    expect(api.completeActivity).toHaveBeenCalledWith('a1', 'Agreed');

    api.updateActivity.mockReturnValue(ok());
    component['cancel'](activity);
    expect(api.updateActivity).toHaveBeenCalledWith('a1', { status: 'cancelled' });
    expect(component['isOpen']({ ...activity, status: 'completed' })).toBe(false);
  });

  it('adds a segment as campaign members and sends the email', () => {
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const campaign = { id: 'cp1', name: 'Spring' };
    component['memberKind'] = 'segment';
    component['memberRef'] = 's1';
    api.addCampaignMembers.mockReturnValue(ok());
    component['addMember'](campaign);
    expect(api.addCampaignMembers).toHaveBeenCalledWith('cp1', { segment_id: 's1' });

    component['subject'] = 'Hello';
    component['body'] = 'Body';
    api.sendCampaign.mockReturnValue(ok());
    component['send'](campaign);
    expect(api.sendCampaign).toHaveBeenCalledWith('cp1', { subject: 'Hello', body: 'Body' });
  });

  it('saves a segment with its filters as [field, operator, value] triples', () => {
    const fixture = TestBed.createComponent(SegmentsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['open'](null);
    component['name'] = 'Italian clients';
    component['entity'] = 'contacts';
    component['filters'] = [{ field: 'country', operator: '=', value: 'IT' }];
    expect(component['valid']()).toBe(true);
    api.createSegment.mockReturnValue(ok());
    component['save']();
    expect(api.createSegment).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Italian clients', entity: 'contacts', filters: [['country', '=', 'IT']] }),
    );
  });

  it('validates field and activity scoring rules and recalculates', () => {
    const fixture = TestBed.createComponent(ScoringRulesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['open'](null);
    component['draft'].name = 'Has phone';
    expect(component['valid']()).toBe(false);
    component['draft'].field = 'phone';
    component['draft'].operator = 'filled';
    expect(component['valid']()).toBe(true);

    component['draft'].rule_type = 'activity';
    expect(component['valid']()).toBe(false);
    component['draft'].activity_type = 'call';
    expect(component['valid']()).toBe(true);

    api.recalculateLeadScores.mockReturnValue(ok());
    component['recalculate']();
    expect(api.recalculateLeadScores).toHaveBeenCalled();
  });
});
