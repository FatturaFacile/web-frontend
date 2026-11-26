import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnterpriseAuthApiService, SecurityAuditEvent, SecurityAuditEventType, SettingsApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { formatAuditDate, SecurityAuditLogComponent } from './security-audit-log.component';

const envelope = <T>(data: T) => ({ success: true, message: '', data });

const types: SecurityAuditEventType[] = [
  { event_type: 'login_succeeded', translation_key: 'security.audit.event.login_succeeded', category: 'login', status: 'success' },
  { event_type: 'login_failed', translation_key: 'security.audit.event.login_failed', category: 'login', status: 'failure' },
  { event_type: 'password_changed', translation_key: 'security.audit.event.password_changed', category: 'password', status: 'success' },
];

const events: SecurityAuditEvent[] = [
  {
    id: 'e1',
    occurred_at: '2026-11-20T10:00:00Z',
    tenant_id: 't1',
    user_id: 'u1',
    actor_user_id: null,
    user: { id: 'u1', name: 'Anna Rossi', email: 'anna@acme.example' },
    event_type: 'login_failed',
    category: 'login',
    translation_key: 'security.audit.event.login_failed',
    status: 'failure',
    ip_address: '203.0.113.7',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    auth_method: 'password',
    mfa_method: null,
    reason: 'bad_password',
  },
  {
    id: 'e2',
    occurred_at: '2026-11-20T09:00:00Z',
    tenant_id: 't1',
    user_id: null,
    actor_user_id: null,
    user: null,
    event_type: 'something_new',
    category: 'other',
    translation_key: 'security.audit.event.something_new',
    status: 'success',
    ip_address: null,
    user_agent: null,
    auth_method: null,
    mfa_method: null,
    reason: null,
  },
];

const page = (data: SecurityAuditEvent[], total = data.length) => ({
  success: true,
  message: '',
  data,
  meta: { current_page: 1, per_page: 20, total, last_page: Math.max(1, Math.ceil(total / 20)) },
});

describe('SecurityAuditLogComponent', () => {
  const api = { getSecurityAudit: vi.fn(), getSecurityAuditEventTypes: vi.fn() };
  const settingsApi = { getTenantUsers: vi.fn() };

  function create() {
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: EnterpriseAuthApiService, useValue: api },
        { provide: SettingsApiService, useValue: settingsApi },
      ],
    });
    const fixture = TestBed.createComponent(SecurityAuditLogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getSecurityAudit.mockReturnValue(of(page(events, 45)));
    api.getSecurityAuditEventTypes.mockReturnValue(of(envelope(types)));
    settingsApi.getTenantUsers.mockReturnValue(of(envelope([{ id: 'u1', name: 'Anna Rossi', email: 'anna@acme.example' }])));
  });

  it('loads the first page with no filter and lists the events', () => {
    const { el, component } = create();

    expect(api.getSecurityAudit).toHaveBeenCalledWith({
      from: undefined,
      to: undefined,
      user_id: undefined,
      event_type: undefined,
      status: undefined,
      auth_method: undefined,
      page: 1,
      per_page: 20,
    });
    expect(el.querySelectorAll('[data-testid="audit-row"]').length).toBe(2);
    expect(component['total']()).toBe(45);
  });

  it('groups the event types by category for the filter', () => {
    const { component } = create();

    expect(component['eventTypeGroups']().map((group) => [group.category, group.items.length])).toEqual([
      ['login', 2],
      ['password', 1],
    ]);
  });

  it('shows the status tag, the user and the device of an event, and the raw type when there is no label', () => {
    const { el, component } = create();

    const rows = el.querySelectorAll('[data-testid="audit-row"]');
    expect(rows[0].textContent).toContain('Anna Rossi');
    expect(rows[0].textContent).toContain('Chrome / Windows');
    expect(rows[0].textContent).toContain('203.0.113.7');
    expect(rows[1].textContent).toContain('something_new');
    expect(component['eventLabel']('security.audit.event.something_new', 'something_new')).toBe('something_new');
  });

  it('applies every filter to the query and goes back to the first page', () => {
    const { component } = create();
    component['page'].set(3);
    component['range'].set([new Date(2026, 10, 1), new Date(2026, 10, 30)]);
    component['userId'].set('u1');
    component['eventTypes'].set(['login_failed', 'login_succeeded']);
    component['status'].set('failure');
    component['authMethod'].set('sso_saml');

    component['apply']();

    expect(api.getSecurityAudit).toHaveBeenLastCalledWith({
      from: '2026-11-01',
      to: '2026-11-30',
      user_id: 'u1',
      event_type: ['login_failed', 'login_succeeded'],
      status: 'failure',
      auth_method: 'sso_saml',
      page: 1,
      per_page: 20,
    });
  });

  it('resets the filters', () => {
    const { component } = create();
    component['userId'].set('u1');
    component['status'].set('failure');

    component['reset']();

    expect(component['userId']()).toBeNull();
    expect(component['status']()).toBeNull();
    expect(api.getSecurityAudit).toHaveBeenLastCalledWith(expect.objectContaining({ user_id: undefined, status: undefined, page: 1 }));
  });

  it('keeps the filters when the page changes and asks the server for that page', () => {
    const { component } = create();
    component['status'].set('failure');
    api.getSecurityAudit.mockClear();

    component['onPage'](2);

    expect(api.getSecurityAudit).toHaveBeenCalledWith(expect.objectContaining({ page: 2, status: 'failure' }));
  });

  it('returns to the first page when the page size changes', () => {
    const { component } = create();
    component['page'].set(4);

    component['onPageSize'](50);

    expect(api.getSecurityAudit).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, per_page: 50 }));
  });

  it('shows the empty state', () => {
    api.getSecurityAudit.mockReturnValue(of(page([])));
    const { el } = create();

    expect(el.querySelector('[data-testid="audit-empty"]')).not.toBeNull();
  });

  it('shows the reason of a failed load and keeps working without the event types', () => {
    api.getSecurityAudit.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { detail: 'Audit unavailable' } })));
    api.getSecurityAuditEventTypes.mockReturnValue(throwError(() => new Error('no types')));
    const { el, component } = create();

    expect(el.querySelector('[data-testid="audit-error"]')?.textContent).toContain('Audit unavailable');
    expect(component['types']()).toEqual([]);
    expect(component['loading']()).toBe(false);
  });

  it('formats a date as the filters of the API expect', () => {
    expect(formatAuditDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
