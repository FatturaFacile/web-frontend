import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AppCanDirective, I18nService, IamApiService, RoleDto } from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { firstValueFrom } from 'rxjs';

/** `settings/roles`: system roles (read only) and the custom roles of the company, with create, clone and delete. */
@Component({
  selector: 'app-roles-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppCanDirective,
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'IAM.ROLES_TITLE' | translate" [subtitle]="'IAM.ROLES_SUBTITLE' | translate" />

    <div class="toolbar">
      <button *appCan="'settings.roles.create'" nz-button nzType="primary" (click)="startCreate()" data-testid="new-role">
        {{ 'IAM.ROLE_NEW' | translate }}
      </button>
    </div>

    <nz-table [nzData]="roles()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
      <thead>
        <tr>
          <th>{{ 'IAM.ROLE_NAME' | translate }}</th>
          <th>{{ 'IAM.ROLE_PERMISSIONS' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (role of roles(); track role.id) {
          <tr>
            <td>
              <a [routerLink]="[role.id]">{{ role.name }}</a>
              @if (role.is_system) {
                <nz-tag nzColor="blue">{{ 'IAM.ROLE_SYSTEM' | translate }}</nz-tag>
              }
            </td>
            <td>{{ role.permissions?.length ?? 0 }}</td>
            <td class="actions">
              <button *appCan="'settings.roles.create'" nz-button nzSize="small" (click)="startClone(role)">{{ 'IAM.ROLE_CLONE' | translate }}</button>
              @if (!role.is_system) {
                <button *appCan="'settings.roles.delete'" nz-button nzSize="small" nzDanger (click)="confirmDelete(role)">{{ 'IAM.ROLE_DELETE' | translate }}</button>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal [(nzVisible)]="nameModal" [nzTitle]="'IAM.ROLE_NAME' | translate" (nzOnOk)="submitName()" (nzOnCancel)="nameModal.set(false)" [nzOkDisabled]="name().trim() === ''">
      <ng-container *nzModalContent>
        <input nz-input [ngModel]="name()" (ngModelChange)="name.set($event)" data-testid="role-name" />
      </ng-container>
    </nz-modal>
  `,
  styles: ['.toolbar { margin-bottom: 12px; } .actions { display: flex; gap: 8px; }'],
})
export class RolesListComponent implements OnInit {
  private readonly api = inject(IamApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  protected readonly roles = signal<RoleDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly nameModal = signal(false);
  protected readonly name = signal('');
  private cloneOf: RoleDto | null = null;

  ngOnInit(): void {
    void this.load();
  }

  protected startCreate(): void {
    this.cloneOf = null;
    this.name.set('');
    this.nameModal.set(true);
  }

  protected startClone(role: RoleDto): void {
    this.cloneOf = role;
    this.name.set(`${role.name} ${this.i18n.translate('IAM.ROLE_COPY_SUFFIX')}`);
    this.nameModal.set(true);
  }

  protected async submitName(): Promise<void> {
    const name = this.name().trim();
    const source = this.cloneOf;
    this.nameModal.set(false);
    try {
      const created = source
        ? await firstValueFrom(this.api.cloneRole(source.id, name))
        : await firstValueFrom(this.api.createRole({ name, permissions: [] }));
      void this.router.navigate(['/settings/roles', created.data.id]);
    } catch {
      // The global error interceptor reports the problem; the list stays as it was.
      await this.load();
    }
  }

  protected confirmDelete(role: RoleDto): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('IAM.ROLE_DELETE_CONFIRM', { name: role.name }),
      nzOkDanger: true,
      nzOnOk: async () => {
        try {
          await firstValueFrom(this.api.deleteRole(role.id));
          this.message.success(this.i18n.translate('IAM.ROLE_DELETED'));
        } finally {
          await this.load();
        }
      },
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.roles.set((await firstValueFrom(this.api.roles())).data);
    } finally {
      this.loading.set(false);
    }
  }
}
