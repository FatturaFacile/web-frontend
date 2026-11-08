import { Component, inject, OnInit, signal } from '@angular/core';
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
  PermissionsService,
  SettingsApiService,
  TenantMemberTwoFactorStatus,
  TwoFactorPolicyResponse,
} from '@core';
import { PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-tenant-security-policy',
  imports: [
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
  ],
  templateUrl: './tenant-security-policy.component.html',
  styleUrl: './tenant-security-policy.component.scss',
})
export class TenantSecurityPolicyComponent implements OnInit {
  private readonly settingsApi = inject(SettingsApiService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  protected readonly permissions = inject(PermissionsService);

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
      nzTitle: value ? 'Imporre 2FA a tutti i membri?' : 'Rendere il 2FA facoltativo?',
      nzContent: value
        ? 'Tutti i membri del tenant saranno obbligati a configurare l\'autenticazione a due fattori al prossimo accesso.'
        : 'I membri potranno scegliere individualmente se utilizzare il 2FA.',
      nzOkText: 'Conferma',
      nzOnOk: () => {
        this.isUpdatingPolicy.set(true);
        this.settingsApi.updateTwoFactorPolicy({ require_two_factor: value }).subscribe({
          next: (res) => {
            this.isUpdatingPolicy.set(false);
            this.requireTwoFactor.set(res.data.require_two_factor);
            this.message.success('Policy 2FA aggiornata con successo.');
          },
          error: (err: unknown) => {
            this.isUpdatingPolicy.set(false);
            this.requireTwoFactor.set(!value); // Revert switch on error
            const body = (err as { error?: { message?: string; detail?: string } })?.error;
            this.message.error(body?.detail || body?.message || 'Errore durante l\'aggiornamento della policy.');
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
      nzTitle: `Reimpostare il 2FA per ${member.name}?`,
      nzContent: `L'autenticazione a due fattori dell'utente ${member.email} verrà revocata. L'utente dovrà riconfigurarla se la policy è attiva.`,
      nzOkText: 'Reimposta 2FA',
      nzOkDanger: true,
      nzOnOk: () => {
        return this.settingsApi.resetUserTwoFactor(member.id).toPromise().then(() => {
          this.message.success(`2FA reimpostato per ${member.name}.`);
          this.loadPolicy();
        });
      },
    });
  }
}
