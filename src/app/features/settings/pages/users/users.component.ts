import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore, I18nService, SettingsApiService, UserResource, SaveTenantMemberPayload, AccessOptions } from '@core';
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
import { MemberAccessFormComponent } from './member-access-form.component';

/**
 * Members of the active company: who belongs to it, with which role and with which access to each module.
 * The API refuses to change one's own membership, to touch an owner without being one, and to leave no owner.
 */
@Component({
  selector: 'app-tenant-users',
  imports: [
    MemberAccessFormComponent,
    NzButtonModule,
    NzCardModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'memberAccess.title' | translate"
      [subtitle]="'memberAccess.subtitle' | translate"
    />
    <nz-card [nzTitle]="'memberAccess.members' | translate">
      <div class="mb-3">
        <button nz-button nzType="primary" type="button" data-test="add-member" (click)="openAdd()">
          {{ 'memberAccess.add' | translate }}
        </button>
        @if (isPlatformAdmin()) {
          <a nz-button routerLink="/settings/admin/user-tenants" data-test="manage-tenants">
            {{ 'memberAccess.manageTenants' | translate }}
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
                <nz-tag>{{ roleLabel(member.role) }}</nz-tag>
              </td>
              <td>{{ customModules(member) }}</td>
              <td>
                @if (member.id !== currentUserId()) {
                  <button nz-button nzSize="small" type="button" data-test="edit-member" (click)="openEdit(member)">
                    {{ 'memberAccess.edit' | translate }}
                  </button>
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
  private readonly authStore = inject(AuthStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly members = signal<UserResource[]>([]);
  protected readonly options = signal<AccessOptions>({ roles: [], modules: [], levels: [] });
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
    this.reload();
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
        reportHttpError(err, this.message, this.i18n);
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

  private reload(): void {
    this.loading.set(true);
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
