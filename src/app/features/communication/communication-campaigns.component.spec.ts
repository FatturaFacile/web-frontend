import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { CommunicationApiService, CommunicationCampaign, CrmApiService, TranslateService } from '@core';
import { CommunicationCampaignsComponent } from './communication-campaigns.component';
import { isCampaignOpen, localDateTimeToIso } from './communication-inbox.util';

describe('CommunicationCampaignsComponent', () => {
  let component: CommunicationCampaignsComponent;
  let fixture: ComponentFixture<CommunicationCampaignsComponent>;

  const campaign: CommunicationCampaign = {
    id: 'camp-1',
    name: 'Spring',
    channel: 'email',
    purpose: 'marketing',
    segment_id: 'seg-1',
    subject: 'Hi',
    body: 'Hello {{ name }}',
    status: 'draft',
    scheduled_at: null,
    started_at: null,
    completed_at: null,
    recipients_count: 0,
    sent_count: 0,
    failed_count: 0,
    suppressed_count: 0,
    created_at: '2026-11-09T09:00:00Z',
    updated_at: '2026-11-09T09:00:00Z',
  };

  const apiSpy = {
    getCampaigns: vi.fn(),
    createCampaign: vi.fn(),
    updateCampaign: vi.fn(),
    deleteCampaign: vi.fn(),
    previewCampaign: vi.fn(),
    scheduleCampaign: vi.fn(),
    sendCampaign: vi.fn(),
    cancelCampaign: vi.fn(),
    getCampaignRecipients: vi.fn(),
  };
  const crmSpy = { getSegments: vi.fn() };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiSpy.getCampaigns.mockReturnValue(of({ data: [campaign] }));
    apiSpy.createCampaign.mockReturnValue(of({ data: campaign }));
    apiSpy.updateCampaign.mockReturnValue(of({ data: campaign }));
    apiSpy.deleteCampaign.mockReturnValue(of(undefined));
    apiSpy.previewCampaign.mockReturnValue(of({ data: { total: 3, deliverable: 1, suppressed: { opted_out: 2 } } }));
    apiSpy.scheduleCampaign.mockReturnValue(of({ data: { ...campaign, status: 'scheduled' } }));
    apiSpy.sendCampaign.mockReturnValue(of({ data: { ...campaign, status: 'completed' } }));
    apiSpy.cancelCampaign.mockReturnValue(of({ data: { ...campaign, status: 'cancelled' } }));
    apiSpy.getCampaignRecipients.mockReturnValue(of({ data: [{ id: 'r-1', contact_id: 'c-1', lead_id: null, address: 'a@example.com', status: 'sent', suppression_reason: null, delivery_log_id: 'd-1', error: null, sent_at: '2026-11-09T10:00:00Z' }] }));
    crmSpy.getSegments.mockReturnValue(of({ data: [{ id: 'seg-1', name: 'Everyone', entity: 'contacts', filters: [] }] }));

    await TestBed.configureTestingModule({
      imports: [CommunicationCampaignsComponent],
      providers: [
        { provide: CommunicationApiService, useValue: apiSpy },
        { provide: CrmApiService, useValue: crmSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunicationCampaignsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads campaigns and segments', () => {
    expect(component.campaigns()).toHaveLength(1);
    expect(component.segments()).toHaveLength(1);
  });

  it('creates a campaign with the API payload shape', () => {
    component.openCreate();
    component.form.patchValue({ name: ' Spring ', segment_id: 'seg-1', subject: '', body: 'Hello' });
    component.create();

    expect(apiSpy.createCampaign).toHaveBeenCalledWith({ name: 'Spring', channel: 'email', segment_id: 'seg-1', subject: null, body: 'Hello' });
    expect(component.createVisible()).toBe(false);
  });

  it('does not create an invalid campaign', () => {
    component.openCreate();
    component.create();

    expect(apiSpy.createCampaign).not.toHaveBeenCalled();
  });

  it('shows the audience preview with the suppression reasons', () => {
    component.showPreview(campaign);

    expect(component.preview()?.deliverable).toBe(1);
    expect(component.suppressionReasons(component.preview()!)).toEqual(['opted_out']);
  });

  it('schedules with an ISO instant, sends and cancels', () => {
    component.openSchedule(campaign);
    component.scheduleAt.set('2027-01-15T10:30');
    component.schedule();
    expect(apiSpy.scheduleCampaign).toHaveBeenCalledWith('camp-1', localDateTimeToIso('2027-01-15T10:30'));
    expect(component.scheduleTarget()).toBeNull();

    component.send(campaign);
    expect(apiSpy.sendCampaign).toHaveBeenCalledWith('camp-1');

    component.cancel(campaign);
    expect(apiSpy.cancelCampaign).toHaveBeenCalledWith('camp-1');
  });

  it('edits an open campaign with PUT instead of creating a new one', () => {
    component.openEdit(campaign);
    expect(component.form.getRawValue().name).toBe('Spring');
    component.form.patchValue({ name: 'Summer' });
    component.create();
    expect(apiSpy.updateCampaign).toHaveBeenCalledWith('camp-1', expect.objectContaining({ name: 'Summer' }));
    expect(apiSpy.createCampaign).not.toHaveBeenCalled();
  });

  it('deletes a campaign and reloads the list', () => {
    component.remove(campaign);
    expect(apiSpy.deleteCampaign).toHaveBeenCalledWith('camp-1');
    expect(apiSpy.getCampaigns).toHaveBeenCalledTimes(2);
  });

  it('only draft and scheduled campaigns are open', () => {
    expect(isCampaignOpen('draft')).toBe(true);
    expect(isCampaignOpen('scheduled')).toBe(true);
    expect(isCampaignOpen('completed')).toBe(false);
    expect(isCampaignOpen('sending')).toBe(false);
  });

  it('opens the send log of a campaign and filters it by status', () => {
    component.openSendLog(campaign);
    expect(apiSpy.getCampaignRecipients).toHaveBeenCalledWith('camp-1', undefined);
    expect(component.sendLog()).toHaveLength(1);

    component.setSendLogStatus('failed');
    expect(apiSpy.getCampaignRecipients).toHaveBeenLastCalledWith('camp-1', 'failed');
  });
});
