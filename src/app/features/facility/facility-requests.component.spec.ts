import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { AuthStore, FacilityApiService, FacilityServiceRequest, SettingsApiService, TranslateService } from '@core';
import { FacilityRequestsComponent } from './facility-requests.component';

describe('FacilityRequestsComponent', () => {
  const request = (overrides: Partial<FacilityServiceRequest>): FacilityServiceRequest => ({
    id: 'r-1',
    number: 'SR-2027-0001',
    category: 'repair',
    priority: 'high',
    status: 'new',
    title: 'Lampada rotta',
    description: null,
    building_id: null,
    space_id: null,
    requester_id: 'usr-9',
    assignee_id: null,
    asset_id: null,
    work_order_id: null,
    inspection_id: null,
    due_at: '2027-05-13T08:00:00+00:00',
    is_overdue: false,
    assigned_at: null,
    responded_at: null,
    resolved_at: null,
    closed_at: null,
    hold_reason: null,
    resolution_notes: null,
    created_at: '2027-05-12T08:00:00+00:00',
    ...overrides,
  });

  const api = {
    getServiceRequests: vi.fn(),
    getServiceRequestBoard: vi.fn(),
    getBuildings: vi.fn(),
    getSpaces: vi.fn(),
    getRequestComments: vi.fn(),
    addRequestComment: vi.fn(),
    createServiceRequest: vi.fn(),
    actOnServiceRequest: vi.fn(),
  };
  const settings = { getTenantUsers: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translate = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
  const auth = { user: () => ({ id: 'usr-1' }), activeRoles: () => ['technician'], userPermissions: () => [] as string[] };

  function create(): FacilityRequestsComponent {
    const fixture = TestBed.createComponent(FacilityRequestsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getServiceRequests.mockReturnValue(
      of({ data: [request({}), request({ id: 'r-2', number: 'SR-2027-0002', status: 'in_progress', priority: 'urgent', category: 'hvac', assignee_id: 'usr-1' }), request({ id: 'r-3', status: 'closed' })] }),
    );
    api.getServiceRequestBoard.mockReturnValue(of({ data: { by_status: {}, by_priority: { urgent: 1 }, overdue: 2, open: 3 } }));
    api.getBuildings.mockReturnValue(of({ data: [] }));
    api.getSpaces.mockReturnValue(of({ data: [] }));
    api.getRequestComments.mockReturnValue(of({ data: [] }));
    api.createServiceRequest.mockReturnValue(of({ data: request({}) }));
    api.actOnServiceRequest.mockImplementation((_id: string, action: string) => of({ data: request({ status: action === 'start' ? 'in_progress' : 'assigned' }) }));
    settings.getTenantUsers.mockReturnValue(of({ data: [{ id: 'usr-2', name: 'Paolo Tecnico' }] }));

    TestBed.configureTestingModule({
      imports: [FacilityRequestsComponent],
      providers: [
        { provide: FacilityApiService, useValue: api },
        { provide: SettingsApiService, useValue: settings },
        { provide: NzMessageService, useValue: message },
        { provide: TranslateService, useValue: translate },
        { provide: AuthStore, useValue: auth },
        provideNzIcons(icons),
      ],
    });
  });

  it('groups the open requests by status and leaves closed ones off the board', () => {
    const component = create();

    expect(component.byStatus().new).toHaveLength(1);
    expect(component.byStatus().in_progress).toHaveLength(1);
    expect(component.requests()).toHaveLength(2);
    expect(component.summary()?.overdue).toBe(2);
    expect(settings.getTenantUsers).toHaveBeenCalled();
  });

  it('filters the board by priority, search text and the requests assigned to the user', () => {
    const component = create();

    component.priority.set('urgent');
    expect(component.byStatus().new).toHaveLength(0);
    expect(component.byStatus().in_progress).toHaveLength(1);

    component.priority.set(null);
    component.search.set('0002');
    expect(component.byStatus().new).toHaveLength(0);

    component.search.set('');
    component.onlyMine.set(true);
    expect(component.byStatus().in_progress).toHaveLength(1);
    expect(component.byStatus().new).toHaveLength(0);
  });

  it('raises a request with the field names of the API form request', () => {
    const component = create();
    component.openCreate();
    component.createForm.patchValue({ category: 'hvac', priority: 'urgent', title: 'Niente aria condizionata', description: 'Sala 2', building_id: 'b-1', space_id: '' });

    component.create();

    expect(api.createServiceRequest).toHaveBeenCalledWith({ category: 'hvac', priority: 'urgent', title: 'Niente aria condizionata', description: 'Sala 2', building_id: 'b-1', space_id: null });
    expect(message.success).toHaveBeenCalledWith('FACILITY.REQUEST_SAVED');
    expect(component.createVisible()).toBe(false);
  });

  it('asks for a reason before holding a request and refuses an empty one', () => {
    const component = create();
    component.open(component.requests()[1]);

    component.askInput('hold');
    expect(component.inputInvalid()).toBe(true);
    component.submitInput();
    expect(api.actOnServiceRequest).not.toHaveBeenCalled();

    component.inputForm.patchValue({ text: 'Attesa ricambio' });
    component.submitInput();
    expect(api.actOnServiceRequest).toHaveBeenCalledWith('r-2', 'hold', { reason: 'Attesa ricambio' });
    expect(component.inputAction()).toBeNull();
  });

  it('assigns, starts and raises a work order through the status endpoints', () => {
    const component = create();
    component.open(component.requests()[0]);

    component.askInput('assign');
    component.inputForm.patchValue({ assignee_id: 'usr-2' });
    component.submitInput();
    expect(api.actOnServiceRequest).toHaveBeenCalledWith('r-1', 'assign', { assignee_id: 'usr-2' });

    component.act('start');
    expect(api.actOnServiceRequest).toHaveBeenCalledWith('r-1', 'start', {});

    component.askInput('raise-work-order');
    expect(component.inputInvalid()).toBe(false);
    component.submitInput();
    expect(api.actOnServiceRequest).toHaveBeenCalledWith('r-1', 'raise-work-order', { asset_id: null });
  });

  it('knows which requests belong to the user and which are still open', () => {
    const component = create();

    expect(component.isOpen(request({ status: 'on_hold' }))).toBe(true);
    expect(component.isOpen(request({ status: 'resolved' }))).toBe(false);
    expect(component.isOwn(request({ requester_id: 'usr-1' }))).toBe(true);
    expect(component.isOwn(request({ requester_id: 'usr-9' }))).toBe(false);
  });
});
