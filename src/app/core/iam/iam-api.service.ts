import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import type { ApiResponse } from '../models';
import type {
  AbacRuleDto,
  FieldPolicyEntry,
  PasskeyCeremony,
  PasskeyItem,
  PermissionCatalog,
  RoleDto,
  SaveRolePayload,
} from './iam.models';

/** Roles, ABAC rules, field policies, assignments, passkeys and session revocation of the IAM engine (Mod 004). */
@Injectable({ providedIn: 'root' })
export class IamApiService {
  private readonly http = inject(HttpClient);
  private readonly settings = `${environment.apiBaseUrl}/settings`;
  private readonly auth = `${environment.apiBaseUrl}/auth`;

  catalog(): Observable<ApiResponse<{ catalog: PermissionCatalog }>> {
    return this.http.get<ApiResponse<{ catalog: PermissionCatalog }>>(`${this.settings}/permissions/catalog`);
  }

  roles(): Observable<ApiResponse<RoleDto[]>> {
    return this.http.get<ApiResponse<RoleDto[]>>(`${this.settings}/roles`);
  }

  role(id: string): Observable<ApiResponse<RoleDto>> {
    return this.http.get<ApiResponse<RoleDto>>(`${this.settings}/roles/${id}`);
  }

  createRole(payload: SaveRolePayload): Observable<ApiResponse<RoleDto>> {
    return this.http.post<ApiResponse<RoleDto>>(`${this.settings}/roles`, payload);
  }

  /** `etag` makes the update fail with 412 when somebody else changed the role meanwhile. */
  updateRole(id: string, payload: SaveRolePayload, etag?: string): Observable<ApiResponse<RoleDto>> {
    return this.http.put<ApiResponse<RoleDto>>(`${this.settings}/roles/${id}`, payload, {
      headers: etag ? { 'If-Match': etag } : {},
    });
  }

  deleteRole(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.settings}/roles/${id}`);
  }

  cloneRole(id: string, name: string): Observable<ApiResponse<RoleDto>> {
    return this.http.post<ApiResponse<RoleDto>>(`${this.settings}/roles/${id}/clone`, { name });
  }

  abacRules(roleId: string): Observable<ApiResponse<AbacRuleDto[]>> {
    return this.http.get<ApiResponse<AbacRuleDto[]>>(`${this.settings}/roles/${roleId}/abac-rules`);
  }

  saveAbacRules(roleId: string, rules: AbacRuleDto[]): Observable<ApiResponse<null>> {
    return this.http.put<ApiResponse<null>>(`${this.settings}/roles/${roleId}/abac-rules`, { rules });
  }

  fieldPolicies(roleId: string): Observable<ApiResponse<FieldPolicyEntry[]>> {
    return this.http.get<ApiResponse<FieldPolicyEntry[]>>(`${this.settings}/roles/${roleId}/field-policies`);
  }

  saveFieldPolicies(roleId: string, policies: FieldPolicyEntry[]): Observable<ApiResponse<null>> {
    return this.http.put<ApiResponse<null>>(`${this.settings}/roles/${roleId}/field-policies`, { policies });
  }

  assignRoles(userId: string, roleIds: string[], companyId?: string | null): Observable<ApiResponse<null>> {
    return this.http.put<ApiResponse<null>>(`${this.settings}/users/${userId}/roles`, {
      role_ids: roleIds,
      company_id: companyId ?? null,
    });
  }

  revokeUserSessions(userId: string): Observable<ApiResponse<{ tokens: number; sessions: number }>> {
    return this.http.post<ApiResponse<{ tokens: number; sessions: number }>>(`${this.settings}/users/${userId}/revoke-sessions`, {});
  }

  // --- Passkeys ---
  passkeys(): Observable<ApiResponse<PasskeyItem[]>> {
    return this.http.get<ApiResponse<PasskeyItem[]>>(`${this.auth}/passkeys`);
  }

  beginPasskeyRegistration(): Observable<ApiResponse<PasskeyCeremony<PublicKeyCredentialCreationOptionsJSON>>> {
    return this.http.post<ApiResponse<PasskeyCeremony<PublicKeyCredentialCreationOptionsJSON>>>(`${this.auth}/passkeys/options`, {});
  }

  finishPasskeyRegistration(ceremonyId: string, name: string, credential: unknown): Observable<ApiResponse<PasskeyItem>> {
    return this.http.post<ApiResponse<PasskeyItem>>(`${this.auth}/passkeys`, { ceremony_id: ceremonyId, name, credential });
  }

  revokePasskey(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.auth}/passkeys/${id}`);
  }

  beginPasskeyLogin(): Observable<ApiResponse<PasskeyCeremony<PublicKeyCredentialRequestOptionsJSON>>> {
    return this.http.post<ApiResponse<PasskeyCeremony<PublicKeyCredentialRequestOptionsJSON>>>(`${this.auth}/passkeys/login/options`, {});
  }

  finishPasskeyLogin(ceremonyId: string, credential: unknown, tenantId?: string | null): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.auth}/passkeys/login`, {
      ceremony_id: ceremonyId,
      credential,
      tenant_id: tenantId ?? null,
    });
  }
}
