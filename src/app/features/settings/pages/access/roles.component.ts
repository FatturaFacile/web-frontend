import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AccessApiService, CustomRole, CustomRolesResponse, I18nService, SaveCustomRolePayload } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import { reportAccessError, systemRoleLabel } from './access-ui.util';
import { AccessNavComponent } from './access-nav.component';
import { PlanLimitsComponent } from './plan-limits.component';
import { RoleFormComponent } from './role-form.component';

/** Custom roles of the company: a base system role plus a level for every module, assignable to members and teams. */
@Component({
  selector: 'app-access-roles',
  imports: [
    AccessNavComponent,
    NzButtonModule,
    NzCardModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    PlanLimitsComponent,
    RoleFormComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'access.roles.title' | translate" [subtitle]="'access.roles.subtitle' | translate" />
    <app-access-nav />
    <app-plan-limits [version]="limitsVersion()" />
    <nz-card>
      <div class="mb-3">
        <button nz-button nzType="primary" type="button" data-test="add-role" (click)="openAdd()">
          {{ 'access.roles.add' | translate }}
        </button>
      </div>
      <nz-table #table [nzData]="data().roles" [nzLoading]="loading()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'access.roles.name' | translate }}</th>
            <th>{{ 'access.roles.description' | translate }}</th>
            <th>{{ 'access.roles.baseRole' | translate }}</th>
            <th>{{ 'access.roles.members' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (role of table.data; track role.id) {
            <tr data-test="role-row">
              <td>{{ role.name }}</td>
              <td>{{ role.description }}</td>
              <td>
                <nz-tag>{{ baseLabel(role.base_role) }}</nz-tag>
              </td>
              <td>{{ role.members }}</td>
              <td>
                <button nz-button nzSize="small" type="button" data-test="edit-role" (click)="openEdit(role)">
                  {{ 'memberAccess.edit' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="small"
                  nzDanger
                  type="button"
                  data-test="delete-role"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'access.roles.confirmDelete' | translate"
                  (nzOnConfirm)="remove(role)"
                >
                  {{ 'memberAccess.remove' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5">{{ 'access.roles.empty' | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal [nzVisible]="dialog() !== null" [nzTitle]="dialogTitle()" [nzFooter]="null" (nzOnCancel)="dialog.set(null)">
      <ng-container *nzModalContent>
        @if (dialog(); as current) {
          <app-role-form
            [role]="current.role"
            [baseRoles]="data().base_roles"
            [modules]="data().modules"
            [saving]="saving()"
            (saved)="save($event)"
          />
        }
      </ng-container>
    </nz-modal>
  `,
})
export class AccessRolesComponent implements OnInit {
  private readonly api = inject(AccessApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly data = signal<CustomRolesResponse>({ roles: [], base_roles: [], modules: [], levels: [] });
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly limitsVersion = signal(0);
  /** The role being edited, or `null` to create one; a `null` dialog means closed. */
  protected readonly dialog = signal<{ role: CustomRole | null } | null>(null);
  protected readonly dialogTitle = computed(() =>
    this.i18n.translate(this.dialog()?.role ? 'access.roles.editTitle' : 'access.roles.addTitle'),
  );

  ngOnInit(): void {
    this.reload();
  }

  protected baseLabel(role: string): string {
    return systemRoleLabel(this.i18n, role);
  }

  protected openAdd(): void {
    this.dialog.set({ role: null });
  }

  protected openEdit(role: CustomRole): void {
    this.dialog.set({ role });
  }

  protected save(payload: SaveCustomRolePayload): void {
    const role = this.dialog()?.role ?? null;
    const request: Observable<unknown> =
      role === null ? this.api.createRole(payload) : this.api.updateRole(role.id, payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialog.set(null);
        this.message.success(this.i18n.translate('access.roles.saved'));
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        reportAccessError(err, this.message, this.i18n);
      },
    });
  }

  protected remove(role: CustomRole): void {
    this.api.deleteRole(role.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('access.roles.deleted'));
        this.reload();
      },
      error: (err: unknown) => reportAccessError(err, this.message, this.i18n),
    });
  }

  private reload(): void {
    this.loading.set(true);
    this.limitsVersion.update((value) => value + 1);
    this.api.getRoles().subscribe({
      next: (res) => {
        this.data.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        reportAccessError(err, this.message, this.i18n);
      },
    });
  }
}
