import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  PermissionsService,
  SettingsApiService,
  TenantMemberTwoFactorStatus,
  TwoFactorPolicyResponse,
} from '@core';
import { PageHeaderComponent, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

@Component({
  selector: 'app-tenant-security-policy',
  styleUrl: './tenant-security-policy.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    FormsModule,
    NzCardModule,
    NzTableModule,
    NzSwitchModule,
    NzTagModule,
    NzButtonModule,
    NzAlertModule,
    NzDividerModule,
    NzModalModule,
    NzIconModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './tenant-security-policy.component.html',
})
export class TenantSecurityPolicyComponent implements OnInit {
  private readonly settingsApi = inject(SettingsApiService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  protected readonly permissions = inject(PermissionsService);
  private readonly i18n = inject(I18nService);

  protected readonly policy = signal<TwoFactorPolicyResponse | null>(null);
  protected readonly members = signal<TenantMemberTwoFactorStatus[]>([]);
  protected readonly requireTwoFactor = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isUpdatingPolicy = signal(false);

  ngOnInit(): void {
    this.loadPolicy();
  }

  loadPolicy(): void {
    this.isLoading.set(true);
    this.settingsApi.getTwoFactorPolicy().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.policy.set(res.data);
        this.requireTwoFactor.set(res.data.require_two_factor);
        this.members.set(res.data.members || []);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  onPolicyToggle(value: boolean): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate(value ? 'TENANT_SECURITY.ENFORCE_TITLE' : 'TENANT_SECURITY.RELAX_TITLE'),
      nzContent: this.i18n.translate(value ? 'TENANT_SECURITY.ENFORCE_BODY' : 'TENANT_SECURITY.RELAX_BODY'),
      nzOkText: this.i18n.translate('TENANT_SECURITY.CONFIRM'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOnOk: () => {
        this.isUpdatingPolicy.set(true);
        this.settingsApi.updateTwoFactorPolicy({ require_two_factor: value }).subscribe({
          next: (res) => {
            this.isUpdatingPolicy.set(false);
            this.requireTwoFactor.set(res.data.require_two_factor);
            this.message.success(this.i18n.translate('TENANT_SECURITY.UPDATED'));
          },
          error: (err: unknown) => {
            this.isUpdatingPolicy.set(false);
            this.requireTwoFactor.set(!value); // Revert switch on error
            const body = (err as { error?: { message?: string; detail?: string } })?.error;
            this.message.error(body?.detail || body?.message || this.i18n.translate('TENANT_SECURITY.UPDATE_FAILED'));
          },
        });
      },
      nzOnCancel: () => {
        this.requireTwoFactor.set(!value); // Revert UI
      },
    });
  }

  resetUser2FA(member: TenantMemberTwoFactorStatus): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('TENANT_SECURITY.RESET_TITLE', { name: member.name }),
      nzContent: this.i18n.translate('TENANT_SECURITY.RESET_BODY', { email: member.email }),
      nzOkText: this.i18n.translate('TENANT_SECURITY.RESET'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOkDanger: true,
      nzOnOk: () => {
        return firstValueFrom(this.settingsApi.resetUserTwoFactor(member.id)).then(() => {
          this.message.success(this.i18n.translate('TENANT_SECURITY.RESET_DONE', { name: member.name }));
          this.loadPolicy();
        });
      },
    });
  }
}
