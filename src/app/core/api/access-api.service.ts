import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AcceptInvitationPayload,
  AcceptInvitationResult,
  AccessAuditEvent,
  AccessAuditType,
  AccessMatrix,
  AccessTeam,
  ApiResponse,
  CustomRole,
  CustomRolesResponse,
  DelegationRecord,
  ImportReport,
  InvitationPreview,
  InvitationRecord,
  PaginatedResponse,
  PlanLimits,
  SaveCustomRolePayload,
  SaveDelegationPayload,
  SaveInvitationPayload,
  SaveTeamPayload,
  UserResource,
} from '../models';

/** Roles, teams, delegations, invitations, import, limits and history of the access management of the company. */
@Service()
export class AccessApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/settings`;
  private readonly publicBase = `${environment.apiBaseUrl}/auth`;

  // --- Members ---
  suspendMember(userId: string): Observable<ApiResponse<UserResource>> {
    return this.http.post<ApiResponse<UserResource>>(`${this.base}/users/${userId}/suspend`, {});
  }

  reactivateMember(userId: string): Observable<ApiResponse<UserResource>> {
    return this.http.post<ApiResponse<UserResource>>(`${this.base}/users/${userId}/reactivate`, {});
  }

  // --- Invitations ---
  getInvitations(): Observable<ApiResponse<InvitationRecord[]>> {
    return this.http.get<ApiResponse<InvitationRecord[]>>(`${this.base}/invitations`);
  }

  invite(payload: SaveInvitationPayload): Observable<ApiResponse<InvitationRecord>> {
    return this.http.post<ApiResponse<InvitationRecord>>(`${this.base}/invitations`, payload);
  }

  resendInvitation(id: string): Observable<ApiResponse<InvitationRecord>> {
    return this.http.post<ApiResponse<InvitationRecord>>(`${this.base}/invitations/${id}/resend`, {});
  }

  revokeInvitation(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/invitations/${id}`);
  }

  // --- CSV import ---
  /** `dryRun` only checks the file and returns the report of every row without changing anything. */
  importUsers(file: File, dryRun: boolean, defaultRole?: string): Observable<ApiResponse<ImportReport>> {
    const form = new FormData();
    form.append('file', file);
    form.append('dry_run', dryRun ? '1' : '0');
    if (defaultRole) {
      form.append('default_role', defaultRole);
    }
    return this.http.post<ApiResponse<ImportReport>>(`${this.base}/users/import`, form);
  }

  // --- Custom roles ---
  getRoles(): Observable<ApiResponse<CustomRolesResponse>> {
    return this.http.get<ApiResponse<CustomRolesResponse>>(`${this.base}/access/roles`);
  }

  createRole(payload: SaveCustomRolePayload): Observable<ApiResponse<CustomRole>> {
    return this.http.post<ApiResponse<CustomRole>>(`${this.base}/access/roles`, payload);
  }

  updateRole(id: string, payload: SaveCustomRolePayload): Observable<ApiResponse<CustomRole>> {
    return this.http.put<ApiResponse<CustomRole>>(`${this.base}/access/roles/${id}`, payload);
  }

  deleteRole(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/access/roles/${id}`);
  }

  getMatrix(): Observable<ApiResponse<AccessMatrix>> {
    return this.http.get<ApiResponse<AccessMatrix>>(`${this.base}/access/matrix`);
  }

  // --- Teams ---
  getTeams(): Observable<ApiResponse<AccessTeam[]>> {
    return this.http.get<ApiResponse<AccessTeam[]>>(`${this.base}/access/teams`);
  }

  createTeam(payload: SaveTeamPayload): Observable<ApiResponse<AccessTeam>> {
    return this.http.post<ApiResponse<AccessTeam>>(`${this.base}/access/teams`, payload);
  }

  updateTeam(id: string, payload: SaveTeamPayload): Observable<ApiResponse<AccessTeam>> {
    return this.http.put<ApiResponse<AccessTeam>>(`${this.base}/access/teams/${id}`, payload);
  }

  setTeamMembers(id: string, userIds: string[]): Observable<ApiResponse<AccessTeam>> {
    return this.http.put<ApiResponse<AccessTeam>>(`${this.base}/access/teams/${id}/members`, { user_ids: userIds });
  }

  deleteTeam(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/access/teams/${id}`);
  }

  // --- Delegations ---
  getDelegations(): Observable<ApiResponse<DelegationRecord[]>> {
    return this.http.get<ApiResponse<DelegationRecord[]>>(`${this.base}/access/delegations`);
  }

  createDelegation(payload: SaveDelegationPayload): Observable<ApiResponse<DelegationRecord>> {
    return this.http.post<ApiResponse<DelegationRecord>>(`${this.base}/access/delegations`, payload);
  }

  revokeDelegation(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/access/delegations/${id}`);
  }

  // --- Limits and history ---
  getLimits(): Observable<ApiResponse<PlanLimits>> {
    return this.http.get<ApiResponse<PlanLimits>>(`${this.base}/access/limits`);
  }

  /** Paginated by the interceptor: `data` is the page items and `meta` the pagination block. */
  getAudit(params: { type?: AccessAuditType | null; per_page?: number; page?: number }): Observable<PaginatedResponse<AccessAuditEvent>> {
    const query: Record<string, string> = {};
    if (params.type) {
      query['type'] = params.type;
    }
    if (params.per_page) {
      query['per_page'] = String(params.per_page);
    }
    if (params.page) {
      query['page'] = String(params.page);
    }
    return this.http.get<PaginatedResponse<AccessAuditEvent>>(`${this.base}/access/audit`, { params: query });
  }

  // --- Public invitation links (the token is the credential) ---
  previewInvitation(token: string): Observable<ApiResponse<InvitationPreview>> {
    return this.http.get<ApiResponse<InvitationPreview>>(`${this.publicBase}/invitations/${encodeURIComponent(token)}`);
  }

  /** New address: name and password. Existing account: no body, the session of that account is the credential. */
  acceptInvitation(token: string, payload?: AcceptInvitationPayload): Observable<ApiResponse<AcceptInvitationResult>> {
    return this.http.post<ApiResponse<AcceptInvitationResult>>(
      `${this.publicBase}/invitations/${encodeURIComponent(token)}/accept`,
      payload ?? {},
    );
  }
}
