import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AccessApiService,
  AccessOptions,
  AuthStore,
  CustomRole,
  I18nService,
  SaveTenantMemberPayload,
  SettingsApiService,
  UserResource,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import { reportHttpError } from '../../../hr/shared/hr-http.util';
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
    MemberAccessFormComponent,
    NzButtonModule,
    NzCardModule,
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
              </td>
              <td>{{ member.email }}</td>
              <td>
                <nz-tag data-test="member-role">{{ memberRoleLabel(member) }}</nz-tag>
              </td>
              <td>{{ customModules(member) }}</td>
              <td>
                @if (member.id !== currentUserId()) {
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
  `,
})
export class TenantUsersComponent implements OnInit {
  private readonly api = inject(SettingsApiService);
  private readonly accessApi = inject(AccessApiService);
  private readonly authStore = inject(AuthStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

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
