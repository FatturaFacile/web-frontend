import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessApiService, SettingsApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { AccessInvitationsComponent } from './invitations.component';

const invitation = (id: string, status: string, email = `${id}@example.test`) => ({
  id,
  email,
  role: 'member',
  custom_role_id: null,
  modules: null,
  team_ids: [],
  status,
  invited_by: 'me',
  expires_at: '2026-12-01T10:00:00Z',
  accepted_at: null,
  last_sent_at: null,
  created_at: null,
});
const invitations = [invitation('i1', 'pending'), invitation('i2', 'expired'), invitation('i3', 'accepted'), invitation('i4', 'revoked')];

interface Page {
  email: { set(v: string): void };
  role: { set(v: string): void };
  teamIds: { set(v: string[]): void };
  inviting(): boolean;
  openInvite(): void;
  send(): void;
  resend(value: (typeof invitations)[number]): void;
  revoke(value: (typeof invitations)[number]): void;
}

describe('AccessInvitationsComponent', () => {
  const api = {
    getInvitations: vi.fn(),
    getRoles: vi.fn(),
    getTeams: vi.fn(),
    getLimits: vi.fn(),
    invite: vi.fn(),
    resendInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
  };
  const settingsApi = { getAccessOptions: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: AccessApiService, useValue: api },
        { provide: SettingsApiService, useValue: settingsApi },
        { provide: NzMessageService, useValue: message },
      ],
    });
    const fixture = TestBed.createComponent(AccessInvitationsComponent);
    fixture.detectChanges();
    return { page: fixture.componentInstance as unknown as Page, fixture };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getInvitations.mockReturnValue(of({ success: true, message: '', data: invitations }));
    api.getRoles.mockReturnValue(of({ success: true, message: '', data: { roles: [], base_roles: [], modules: [], levels: [] } }));
    api.getTeams.mockReturnValue(of({ success: true, message: '', data: [] }));
    api.getLimits.mockReturnValue(of({ success: true, message: '', data: { plan_code: 'starter', max_users: 5, active_users: 1, pending_invitations: 1, max_custom_roles: 0, custom_roles: 0 } }));
    settingsApi.getAccessOptions.mockReturnValue(of({ success: true, message: '', data: { roles: ['member', 'admin'], modules: [], levels: [] } }));
  });

  it('offers resend and revoke only where they make sense', () => {
    const { fixture } = setup();
    const rows = Array.from(fixture.nativeElement.querySelectorAll('[data-test="invitation-row"]')) as HTMLElement[];
    const has = (row: HTMLElement, test: string): boolean => row.querySelector(`[data-test="${test}"]`) !== null;

    expect(rows.length).toBe(4);
    expect([has(rows[0], 'resend-invitation'), has(rows[0], 'revoke-invitation')]).toEqual([true, true]);
    expect([has(rows[1], 'resend-invitation'), has(rows[1], 'revoke-invitation')]).toEqual([true, false]);
    expect([has(rows[2], 'resend-invitation'), has(rows[2], 'revoke-invitation')]).toEqual([false, false]);
    expect([has(rows[3], 'resend-invitation'), has(rows[3], 'revoke-invitation')]).toEqual([false, false]);
  });

  it('resends an invitation and reloads the list', () => {
    api.resendInvitation.mockReturnValue(of({ success: true, message: '', data: invitations[0] }));
    const { page } = setup();

    page.resend(invitations[0]);

    expect(api.resendInvitation).toHaveBeenCalledWith('i1');
    expect(message.success).toHaveBeenCalled();
    expect(api.getInvitations).toHaveBeenCalledTimes(2);
  });

  it('revokes an invitation', () => {
    api.revokeInvitation.mockReturnValue(of({ success: true, message: '', data: null }));
    const { page } = setup();

    page.revoke(invitations[0]);

    expect(api.revokeInvitation).toHaveBeenCalledWith('i1');
    expect(api.getInvitations).toHaveBeenCalledTimes(2);
  });

  it('invites with a system role or a custom role id', () => {
    api.invite.mockReturnValue(of({ success: true, message: '', data: invitations[0] }));
    const { page } = setup();

    page.openInvite();
    page.email.set(' new@example.test ');
    page.role.set('admin');
    page.send();
    expect(api.invite).toHaveBeenLastCalledWith({ email: 'new@example.test', role: 'admin' });
    expect(page.inviting()).toBe(false);

    page.openInvite();
    page.email.set('other@example.test');
    page.role.set('custom:r1');
    page.teamIds.set(['t1']);
    page.send();
    expect(api.invite).toHaveBeenLastCalledWith({ email: 'other@example.test', custom_role_id: 'r1', team_ids: ['t1'] });
  });

  it('shows the plan limit message when the invitation is refused with 409', () => {
    api.invite.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { title: 'Plan limit reached', detail: 'The subscription plan allows at most 5 users.' } }),
      ),
    );
    const { page } = setup();

    page.openInvite();
    page.email.set('new@example.test');
    page.send();

    expect(message.error).toHaveBeenCalledWith('Plan limit reached: The subscription plan allows at most 5 users.');
    expect(page.inviting()).toBe(true);
  });
});
