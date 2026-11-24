import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessApiService, AuthStore, SettingsApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { AccessAuditComponent } from './audit.component';
import { AccessDelegationsComponent } from './delegations.component';
import { AccessTeamsComponent } from './teams.component';

const members = [
  { id: 'me', name: 'Ada', email: 'ada@example.test', role: 'owner', is_active: true },
  { id: 'u2', name: 'Bruno', email: 'bruno@example.test', role: 'member', is_active: true },
];
const wrap = <T>(data: T) => of({ success: true, message: '', data });

describe('access pages', () => {
  const api = {
    getTeams: vi.fn(),
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    setTeamMembers: vi.fn(),
    deleteTeam: vi.fn(),
    getRoles: vi.fn(),
    getDelegations: vi.fn(),
    createDelegation: vi.fn(),
    revokeDelegation: vi.fn(),
    getAudit: vi.fn(),
  };
  const settingsApi = { getTenantUsers: vi.fn(), getAccessOptions: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  function configure(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: AccessApiService, useValue: api },
        { provide: SettingsApiService, useValue: settingsApi },
        { provide: NzMessageService, useValue: message },
        { provide: AuthStore, useValue: { user: () => ({ id: 'me' }) } },
      ],
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getRoles.mockReturnValue(wrap({ roles: [{ id: 'r1', name: 'Bookkeeper' }], base_roles: [], modules: [], levels: [] }));
    settingsApi.getTenantUsers.mockReturnValue(wrap(members));
    settingsApi.getAccessOptions.mockReturnValue(wrap({ roles: [], modules: ['crm'], levels: [] }));
  });

  describe('teams', () => {
    interface Page {
      name: { set(v: string): void };
      customRoleId: { set(v: string | null): void };
      memberIds: { set(v: string[]): void };
      openAdd(): void;
      save(): void;
      remove(team: { id: string }): void;
      memberNames(team: { member_ids: string[] }): string;
    }

    function setup() {
      configure();
      api.getTeams.mockReturnValue(wrap([{ id: 't1', name: 'Sales', description: null, custom_role_id: 'r1', member_ids: ['u2'] }]));
      const fixture = TestBed.createComponent(AccessTeamsComponent);
      fixture.detectChanges();
      return { page: fixture.componentInstance as unknown as Page, fixture };
    }

    it('lists the teams with their members', () => {
      const { page, fixture } = setup();

      expect(fixture.nativeElement.querySelectorAll('[data-test="team-row"]').length).toBe(1);
      expect(page.memberNames({ member_ids: ['u2'] })).toBe('Bruno');
    });

    it('creates a team and then sets its members', () => {
      api.createTeam.mockReturnValue(wrap({ id: 't2' }));
      api.setTeamMembers.mockReturnValue(wrap({ id: 't2' }));
      const { page } = setup();

      page.openAdd();
      page.name.set(' Support ');
      page.customRoleId.set('r1');
      page.memberIds.set(['u2']);
      page.save();

      expect(api.createTeam).toHaveBeenCalledWith({ name: 'Support', description: null, custom_role_id: 'r1' });
      expect(api.setTeamMembers).toHaveBeenCalledWith('t2', ['u2']);
      expect(message.success).toHaveBeenCalled();
    });

    it('deletes a team', () => {
      api.deleteTeam.mockReturnValue(wrap(null));
      const { page } = setup();

      page.remove({ id: 't1' });

      expect(api.deleteTeam).toHaveBeenCalledWith('t1');
    });
  });

  describe('delegations', () => {
    interface Page {
      delegateId: { set(v: string | null): void };
      startsAt: { set(v: string): void };
      endsAt: { set(v: string): void };
      moduleCodes: { set(v: string[]): void };
      canSave(): boolean;
      delegateOptions(): { id: string }[];
      openAdd(): void;
      save(): void;
      revoke(d: { id: string }): void;
    }
    const delegation = (id: string, status: string) => ({
      id,
      delegator: members[0],
      delegate: members[1],
      role: 'owner',
      modules: null,
      reason: null,
      starts_at: '2026-12-01T08:00:00Z',
      ends_at: '2026-12-10T08:00:00Z',
      revoked_at: null,
      status,
    });

    function setup() {
      configure();
      api.getDelegations.mockReturnValue(wrap([delegation('d1', 'active'), delegation('d2', 'expired')]));
      const fixture = TestBed.createComponent(AccessDelegationsComponent);
      fixture.detectChanges();
      return { page: fixture.componentInstance as unknown as Page, fixture };
    }

    it('offers revoke only on active or scheduled delegations and never lists the signed in user as delegate', () => {
      const { page, fixture } = setup();

      expect(fixture.nativeElement.querySelectorAll('[data-test="revoke-delegation"]').length).toBe(1);
      expect(page.delegateOptions().map((m) => m.id)).toEqual(['u2']);
    });

    it('needs a delegate and an end after the start', () => {
      const { page } = setup();

      page.openAdd();
      page.delegateId.set('u2');
      page.startsAt.set('2026-12-02T09:00');
      page.endsAt.set('2026-12-01T09:00');
      expect(page.canSave()).toBe(false);

      page.endsAt.set('2026-12-03T09:00');
      expect(page.canSave()).toBe(true);
    });

    it('creates a delegation limited to some modules', () => {
      api.createDelegation.mockReturnValue(wrap(delegation('d3', 'scheduled')));
      const { page } = setup();

      page.openAdd();
      page.delegateId.set('u2');
      page.startsAt.set('2026-12-02T09:00');
      page.endsAt.set('2026-12-03T09:00');
      page.moduleCodes.set(['crm']);
      page.save();

      const payload = api.createDelegation.mock.calls[0][0] as { delegate_id: string; modules: string[]; starts_at: string };
      expect(payload.delegate_id).toBe('u2');
      expect(payload.modules).toEqual(['crm']);
      expect(payload.starts_at).toMatch(/Z$/);
    });

    it('shows the reason of a refused delegation', () => {
      api.createDelegation.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'Delegation not valid', detail: 'Overlaps another one.' } })),
      );
      const { page } = setup();

      page.openAdd();
      page.delegateId.set('u2');
      page.startsAt.set('2026-12-02T09:00');
      page.endsAt.set('2026-12-03T09:00');
      page.save();

      expect(message.error).toHaveBeenCalledWith('Delegation not valid: Overlaps another one.');
    });

    it('revokes a delegation', () => {
      api.revokeDelegation.mockReturnValue(wrap(null));
      const { page } = setup();

      page.revoke({ id: 'd1' });

      expect(api.revokeDelegation).toHaveBeenCalledWith('d1');
    });
  });

  describe('audit', () => {
    interface Page {
      filter(type: string | null): void;
      goTo(page: number): void;
      summary(event: object): string;
    }
    const event = { id: 'e1', event: 'role.created', type: 'access.role', subject_id: 'r1', actor: { id: 'me', name: 'Ada', email: 'ada@example.test' }, old_values: null, new_values: { name: 'Bookkeeper' }, ip_address: null, created_at: '2026-11-01T10:00:00Z' };

    function setup() {
      configure();
      api.getAudit.mockReturnValue(of({ success: true, message: '', data: [event], meta: { current_page: 1, last_page: 3, per_page: 20, total: 45, from: 1, to: 20 } }));
      const fixture = TestBed.createComponent(AccessAuditComponent);
      fixture.detectChanges();
      return { page: fixture.componentInstance as unknown as Page, fixture };
    }

    it('loads the first page and shows the events', () => {
      const { page, fixture } = setup();

      expect(api.getAudit).toHaveBeenCalledWith({ type: null, per_page: 20, page: 1 });
      expect(fixture.nativeElement.querySelectorAll('[data-test="audit-row"]').length).toBe(1);
      expect(page.summary(event)).toBe('{"name":"Bookkeeper"}');
    });

    it('filters by type from the first page and paginates', () => {
      const { page } = setup();

      page.goTo(3);
      expect(api.getAudit).toHaveBeenLastCalledWith({ type: null, per_page: 20, page: 3 });

      page.filter('access.team');
      expect(api.getAudit).toHaveBeenLastCalledWith({ type: 'access.team', per_page: 20, page: 1 });

      page.filter(null);
      expect(api.getAudit).toHaveBeenLastCalledWith({ type: null, per_page: 20, page: 1 });
    });
  });
});
