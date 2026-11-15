import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AccessOptions,
  AdminApiService,
  I18nService,
  PlatformTenantRecord,
  PlatformUserRecord,
  SaveTenantMemberPayload,
  UserTenantAccess,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError } from '../../../hr/shared/hr-http.util';
import { MemberAccessFormComponent } from './member-access-form.component';

/**
 * Platform administration: to which companies (tenants) a user has access, and with which role and module access in
 * each of them. A user can belong to several companies and switch between them.
 */
@Component({
  selector: 'app-user-tenants',
  imports: [
    FormsModule,
    MemberAccessFormComponent,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'userTenants.title' | translate"
      [subtitle]="'userTenants.subtitle' | translate"
    />
    <nz-card [nzTitle]="'userTenants.findUser' | translate" class="mb-3">
      <input
        nz-input
        class="mb-3"
        data-test="user-search"
        maxlength="100"
        [placeholder]="'userTenants.searchPlaceholder' | translate"
        [ngModel]="search()"
        (ngModelChange)="onSearch($event)"
      />
      <nz-table #users [nzData]="foundUsers()" [nzShowPagination]="false" nzSize="small">
        <tbody>
          @for (user of users.data; track user.id) {
            <tr data-test="user-row" [class.selected]="user.id === selectedUser()?.id">
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td>
                <button nz-button nzSize="small" type="button" data-test="select-user" (click)="selectUser(user)">
                  {{ 'userTenants.select' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    @if (selectedUser(); as user) {
      <nz-card [nzTitle]="('userTenants.accessOf' | translate) + ' ' + user.email">
        <div class="mb-3">
          <nz-select
            class="w-field-md"
            nzShowSearch
            data-test="tenant-select"
            [nzPlaceHolder]="'userTenants.pickTenant' | translate"
            [ngModel]="pickedTenantId()"
            (ngModelChange)="pickedTenantId.set($event)"
            (nzOnSearch)="loadTenants($event)"
          >
            @for (tenant of availableTenants(); track tenant.id) {
              <nz-option [nzValue]="tenant.id" [nzLabel]="tenant.name" />
            }
          </nz-select>
          <button
            nz-button
            nzType="primary"
            type="button"
            data-test="grant-access"
            [disabled]="pickedTenantId() === null"
            (click)="openGrant()"
          >
            {{ 'userTenants.grant' | translate }}
          </button>
        </div>
        <nz-table #access [nzData]="accesses()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'userTenants.tenant' | translate }}</th>
              <th>{{ 'memberAccess.role' | translate }}</th>
              <th>{{ 'memberAccess.modulesTitle' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of access.data; track row.tenant_id) {
              <tr data-test="access-row">
                <td>
                  {{ row.tenant_name }}
                  @if (row.suspended) {
                    <nz-tag nzColor="orange">{{ 'memberAccess.suspended' | translate }}</nz-tag>
                  }
                </td>
                <td>
                  <nz-tag>{{ roleLabel(row.role) }}</nz-tag>
                </td>
                <td>{{ customModules(row) }}</td>
                <td>
                  <button nz-button nzSize="small" type="button" data-test="edit-access" (click)="openEdit(row)">
                    {{ 'memberAccess.edit' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    data-test="remove-access"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'userTenants.confirmRemove' | translate"
                    (nzOnConfirm)="remove(row)"
                  >
                    {{ 'memberAccess.remove' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }

    <nz-modal
      [nzVisible]="dialog() !== null"
      [nzTitle]="'memberAccess.editTitle' | translate"
      [nzFooter]="null"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        @if (dialog(); as current) {
          <p>{{ current.tenantName }}</p>
          <app-member-access-form
            [roles]="options().roles"
            [modules]="options().modules"
            [initialRole]="current.access?.role ?? 'member'"
            [initialModules]="current.access?.modules ?? {}"
            [saving]="saving()"
            (saved)="save($event)"
          />
        }
      </ng-container>
    </nz-modal>
  `,
})
export class UserTenantsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly search = signal('');
  protected readonly foundUsers = signal<PlatformUserRecord[]>([]);
  protected readonly selectedUser = signal<PlatformUserRecord | null>(null);
  protected readonly accesses = signal<UserTenantAccess[]>([]);
  protected readonly tenants = signal<PlatformTenantRecord[]>([]);
  protected readonly pickedTenantId = signal<string | null>(null);
  protected readonly options = signal<AccessOptions>({ roles: [], modules: [], levels: [] });
  protected readonly saving = signal(false);
  protected readonly dialog = signal<{ tenantId: string; tenantName: string; access: UserTenantAccess | null } | null>(null);

  /** The tenants the user is not in yet. */
  protected readonly availableTenants = computed(() => {
    const member = new Set(this.accesses().map((row) => row.tenant_id));
    return this.tenants().filter((tenant) => !member.has(tenant.id));
  });

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.api.getAccessOptions().subscribe({
      next: (res) => this.options.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
    this.loadUsers('');
    this.loadTenants('');
  }

  protected onSearch(term: string): void {
    this.search.set(term);
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.loadUsers(term), 300);
  }

  protected loadUsers(term: string): void {
    this.api.listUsers({ search: term.trim() || undefined, per_page: 10 }).subscribe({
      next: (res) => this.foundUsers.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected loadTenants(term: string): void {
    this.api.listTenants({ search: term.trim() || undefined, per_page: 50 }).subscribe({
      next: (res) => this.tenants.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected selectUser(user: PlatformUserRecord): void {
    this.selectedUser.set(user);
    this.pickedTenantId.set(null);
    this.api.getUserTenants(user.id).subscribe({
      next: (res) => this.accesses.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected roleLabel(role: string): string {
    const key = `adminAccess.roles.${role}`;
    const text = this.i18n.translate(key);
    return text === key ? role : text;
  }

  protected customModules(row: UserTenantAccess): string {
    const entries = Object.entries(row.modules);
    return entries.length === 0
      ? this.i18n.translate('memberAccess.followsRole')
      : entries.map(([module, level]) => `${module}: ${this.i18n.translate('memberAccess.levels.' + level)}`).join(', ');
  }

  protected openGrant(): void {
    const tenant = this.tenants().find((candidate) => candidate.id === this.pickedTenantId());
    if (tenant) {
      this.dialog.set({ tenantId: tenant.id, tenantName: tenant.name, access: null });
    }
  }

  protected openEdit(row: UserTenantAccess): void {
    this.dialog.set({ tenantId: row.tenant_id, tenantName: row.tenant_name, access: row });
  }

  protected save(payload: SaveTenantMemberPayload): void {
    const user = this.selectedUser();
    const current = this.dialog();
    if (!user || !current) {
      return;
    }

    this.saving.set(true);
    this.api.saveUserTenant(user.id, current.tenantId, { role: payload.role, modules: payload.modules }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.accesses.set(res.data);
        this.dialog.set(null);
        this.pickedTenantId.set(null);
        this.message.success(this.i18n.translate('memberAccess.saved'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }

  protected remove(row: UserTenantAccess): void {
    const user = this.selectedUser();
    if (!user) {
      return;
    }
    this.api.removeUserTenant(user.id, row.tenant_id).subscribe({
      next: (res) => {
        this.accesses.set(res.data);
        this.message.success(this.i18n.translate('memberAccess.removed'));
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }
}
