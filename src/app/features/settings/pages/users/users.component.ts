import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AccessApiService,
  AccessOptions,
  AuthStore,
  CustomRole,
  EnterpriseAuthApiService,
  I18nService,
  IamApiService,
  PermissionsService,
  SaveTenantMemberPayload,
  SettingsApiService,
  UserResource,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom, Observable } from 'rxjs';
import { reportHttpError } from '../../../hr/shared/hr-http.util';
import { EntityAuditTimelineComponent } from '../../../security/audit-trail/entity-audit-timeline.component';
import { AccessNavComponent } from '../access/access-nav.component';
import { reportAccessError } from '../access/access-ui.util';
import { PlanLimitsComponent } from '../access/plan-limits.component';
import { MemberAccessFormComponent } from './member-access-form.component';

/**
 * Members of the active company: who belongs to it, with which role and with which access to each module.
 * The API refuses to change one's own membership, to touch an owner without being one, and to leave no owner.
 */
@Component({
  selector: 'app-tenant-users',
  imports: [
    AccessNavComponent,
    EntityAuditTimelineComponent,
    MemberAccessFormComponent,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    PlanLimitsComponent,
    RouterLink,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'memberAccess.title' | translate"
      [subtitle]="'memberAccess.subtitle' | translate"
    />
    <app-access-nav />
    <app-plan-limits [version]="limitsVersion()" />
    <nz-card [nzTitle]="'memberAccess.members' | translate">
      <div class="mb-3">
        <button nz-button nzType="primary" type="button" data-test="add-member" (click)="openAdd()">
          {{ 'memberAccess.add' | translate }}
        </button>
        <a nz-button routerLink="/settings/access/invitations" data-test="invite-member">
          {{ 'access.members.invite' | translate }}
        </a>
        <a nz-button routerLink="/settings/users/import" data-test="import-members">
          {{ 'access.members.import' | translate }}
        </a>
        @if (isPlatformAdmin()) {
          <a nz-button routerLink="/settings/admin/user-tenants" data-test="manage-tenants">
            {{ 'memberAccess.manageTenants' | translate }}
          </a>
          <a nz-button routerLink="/settings/admin/tenant-plan" data-test="manage-tenant-plan">
            {{ 'tenantPlan.title' | translate }}
          </a>
        }
      </div>
      <nz-table #table [nzData]="members()" [nzLoading]="loading()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'memberAccess.name' | translate }}</th>
            <th>{{ 'memberAccess.email' | translate }}</th>
            <th>{{ 'memberAccess.role' | translate }}</th>
            <th>{{ 'memberAccess.modulesTitle' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (member of table.data; track member.id) {
            <tr data-test="member-row">
              <td>
                {{ member.name }}
                @if (member.suspended) {
                  <nz-tag nzColor="orange">{{ 'memberAccess.suspended' | translate }}</nz-tag>
                }
                @if (member.locked) {
                  <nz-tag nzColor="red" data-test="member-locked" [attr.title]="lockedDetail(member)">
                    {{ 'security.lockout.locked_badge' | translate }}
                  </nz-tag>
                }
              </td>
              <td>{{ member.email }}</td>
              <td>
                <nz-tag data-test="member-role">{{ memberRoleLabel(member) }}</nz-tag>
              </td>
              <td>{{ customModules(member) }}</td>
              <td>
                @if (canViewAudit()) {
                  <button nz-button nzSize="small" type="button" data-test="member-history" (click)="openHistory(member)">
                    {{ 'AUDIT.TIMELINE.TITLE' | translate }}
                  </button>
                }
                @if (member.locked) {
                  <button nz-button nzSize="small" type="button" data-test="unlock-member" (click)="confirmUnlock(member)">
                    {{ 'security.lockout.unlock' | translate }}
                  </button>
                }
                @if (member.id !== currentUserId()) {
                  <button nz-button nzSize="small" type="button" data-test="revoke-member-sessions" (click)="confirmRevokeSessions(member)">
                    {{ 'security.sessions.revoke_user' | translate }}
                  </button>
                  <button nz-button nzSize="small" type="button" data-test="edit-member" (click)="openEdit(member)">
                    {{ 'memberAccess.edit' | translate }}
                  </button>
                  @if (member.suspended) {
                    <button nz-button nzSize="small" type="button" data-test="reactivate-member" (click)="reactivate(member)">
                      {{ 'access.members.reactivate' | translate }}
                    </button>
                  } @else {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      data-test="suspend-member"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'access.members.confirmSuspend' | translate"
                      (nzOnConfirm)="suspend(member)"
                    >
                      {{ 'access.members.suspend' | translate }}
                    </button>
                  }
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    data-test="remove-member"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'memberAccess.confirmRemove' | translate"
                    (nzOnConfirm)="remove(member)"
                  >
                    {{ 'memberAccess.remove' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="dialog() !== null"
      [nzTitle]="dialogTitle()"
      [nzFooter]="null"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        @if (dialog(); as current) {
          <app-member-access-form
            [roles]="options().roles"
            [modules]="options().modules"
            [initialRole]="current.member?.role ?? 'member'"
            [initialModules]="current.member?.modules ?? {}"
            [customRoles]="customRoles()"
            [initialCustomRoleId]="current.member?.custom_role_id ?? null"
            [showEmail]="current.member === null"
            [saving]="saving()"
            [submitLabelKey]="current.member === null ? 'memberAccess.add' : 'memberAccess.save'"
            (saved)="save($event)"
          />
        }
      </ng-container>
    </nz-modal>

    <nz-drawer
      [nzVisible]="history() !== null"
      nzPlacement="right"
      nzWidth="560px"
      [nzTitle]="history()?.name ?? ''"
      (nzOnClose)="history.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (history(); as current) {
          <app-entity-audit-timeline entityType="User" [entityId]="current.id" />
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class TenantUsersComponent implements OnInit {
  private readonly api = inject(SettingsApiService);
  private readonly accessApi = inject(AccessApiService);
  private readonly authStore = inject(AuthStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  private readonly enterpriseAuth = inject(EnterpriseAuthApiService);
  private readonly iam = inject(IamApiService);
  private readonly modals = inject(NzModalService);

  /** The member whose audit history is open (the audit trail keeps the lifecycle of every user). */
  protected readonly history = signal<UserResource | null>(null);
  protected readonly canViewAudit = computed(() => this.permissions.canRead('audit_trail'));
  protected readonly members = signal<UserResource[]>([]);
  protected readonly options = signal<AccessOptions>({ roles: [], modules: [], levels: [] });
  protected readonly customRoles = signal<CustomRole[]>([]);
  protected readonly limitsVersion = signal(0);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  /** The member being edited, or `null` to add a new one; `null` dialog means closed. */
  protected readonly dialog = signal<{ member: UserResource | null } | null>(null);
  protected readonly isPlatformAdmin = computed(() => this.authStore.user()?.is_platform_admin === true);
  protected readonly currentUserId = computed(() => this.authStore.user()?.id ?? null);
  protected readonly dialogTitle = computed(() =>
    this.i18n.translate(this.dialog()?.member ? 'memberAccess.editTitle' : 'memberAccess.addTitle'),
  );

  ngOnInit(): void {
    this.api.getAccessOptions().subscribe({
      next: (res) => this.options.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
    this.accessApi.getRoles().subscribe({
      next: (res) => this.customRoles.set(res.data.roles),
      // Without the custom roles the members are still listed with their base role.
      error: () => this.customRoles.set([]),
    });
    this.reload();
  }

  protected openHistory(member: UserResource): void {
    this.history.set(member);
  }

  /** Name of the custom role of the member, or the label of the system role. */
  protected memberRoleLabel(member: UserResource): string {
    const custom = member.custom_role_id ? this.customRoles().find((role) => role.id === member.custom_role_id) : undefined;
    return custom?.name ?? this.roleLabel(member.role);
  }

  protected roleLabel(role: string): string {
    const key = `adminAccess.roles.${role}`;
    const text = this.i18n.translate(key);
    return text === key ? role : text;
  }

  /** Short summary of the modules that do not follow the role. */
  protected customModules(member: UserResource): string {
    const entries = Object.entries(member.modules ?? {});
    return entries.length === 0
      ? this.i18n.translate('memberAccess.followsRole')
      : entries.map(([module, level]) => `${module}: ${this.i18n.translate('memberAccess.levels.' + level)}`).join(', ');
  }

  /** Tooltip of the locked badge: until when the account is locked and how many sign-ins failed. */
  protected lockedDetail(member: UserResource): string | null {
    const parts: string[] = [];
    if (member.locked_until) {
      const time = new Date(member.locked_until).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      parts.push(this.i18n.translate('security.lockout.locked_until', { time }));
    }
    if (member.failed_attempts) {
      parts.push(this.i18n.translate('security.lockout.failed_attempts', { count: member.failed_attempts }));
    }
    return parts.length > 0 ? parts.join(' - ') : null;
  }

  /** Asks to confirm, then lifts the lockout of the member (owners and administrators). */
  protected confirmUnlock(member: UserResource): void {
    this.modals.confirm({
      nzTitle: this.i18n.translate('security.lockout.unlock_title'),
      nzContent: this.i18n.translate('security.lockout.unlock_body', { name: member.name }),
      nzOkText: this.i18n.translate('security.lockout.unlock_confirm'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOnOk: () =>
        firstValueFrom(this.enterpriseAuth.unlockUser(member.id))
          .then(() => {
            this.message.success(this.i18n.translate('security.lockout.unlock_success'));
            this.reload();
          })
          .catch(() => {
            this.message.error(this.i18n.translate('security.lockout.unlock_error'));
          }),
    });
  }

  /** Signs the member out everywhere (browser sessions and API tokens). */
  protected confirmRevokeSessions(member: UserResource): void {
    this.modals.confirm({
      nzTitle: this.i18n.translate('security.sessions.revoke_user_confirm', { name: member.name }),
      nzOkText: this.i18n.translate('security.sessions.revoke_user'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOkDanger: true,
      nzOnOk: () =>
        firstValueFrom(this.iam.revokeUserSessions(member.id))
          .then((res) => {
            this.message.success(
              this.i18n.translate('security.sessions.revoked_user', {
                sessions: res.data?.sessions ?? 0,
                tokens: res.data?.tokens ?? 0,
              }),
            );
          })
          .catch((err: unknown) => reportAccessError(err, this.message, this.i18n)),
    });
  }

  protected openAdd(): void {
    this.dialog.set({ member: null });
  }

  protected openEdit(member: UserResource): void {
    this.dialog.set({ member });
  }

  protected save(payload: SaveTenantMemberPayload): void {
    const member = this.dialog()?.member ?? null;
    const request: Observable<unknown> =
      member === null ? this.api.addTenantUser(payload) : this.api.updateTenantUser(member.id, payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialog.set(null);
        this.message.success(this.i18n.translate('memberAccess.saved'));
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        reportAccessError(err, this.message, this.i18n);
      },
    });
  }

  protected remove(member: UserResource): void {
    this.api.removeTenantUser(member.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('memberAccess.removed'));
        this.reload();
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected suspend(member: UserResource): void {
    this.changeState(this.accessApi.suspendMember(member.id), 'access.members.suspended');
  }

  protected reactivate(member: UserResource): void {
    this.changeState(this.accessApi.reactivateMember(member.id), 'access.members.reactivated');
  }

  private changeState(request: Observable<unknown>, successKey: string): void {
    request.subscribe({
      next: () => {
        this.message.success(this.i18n.translate(successKey));
        this.reload();
      },
      error: (err: unknown) => reportAccessError(err, this.message, this.i18n),
    });
  }

  private reload(): void {
    this.loading.set(true);
    this.limitsVersion.update((value) => value + 1);
    this.api.getTenantUsers().subscribe({
      next: (res) => {
        this.members.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
