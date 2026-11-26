import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, output, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { firstValueFrom } from 'rxjs';
import { AuthApiService, I18nService, TrustedDevice } from '@core';
import { TranslatePipe } from '@shared';

/**
 * Devices the user chose to remember at a second factor challenge: they skip it until they expire. The user can remove
 * one device or all of them; the next sign-in on a removed device asks for the second factor again.
 */
@Component({
  selector: 'app-trusted-devices-card',
  imports: [DatePipe, NzAlertModule, NzButtonModule, NzCardModule, NzIconModule, NzTableModule, TranslatePipe],
  template: `
    <nz-card [nzTitle]="'security.mfa.trusted.title' | translate" [nzLoading]="loading()" [nzExtra]="extraTpl">
      <ng-template #extraTpl>
        @if (enabled() && devices().length > 0) {
          <button nz-button nzDanger nzType="default" type="button" data-testid="revoke-all-devices" (click)="confirmRevokeAll()">
            <nz-icon nzType="delete" /> {{ 'security.mfa.trusted.revoke_all' | translate }}
          </button>
        }
      </ng-template>

      @if (loadFailed()) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="'security.mfa.trusted.load_error' | translate" />
      } @else if (!enabled()) {
        <nz-alert nzType="info" nzShowIcon [nzMessage]="'security.mfa.trusted.disabled' | translate" data-testid="trusted-disabled" />
      } @else {
        <p>{{ 'security.mfa.trusted.description' | translate }}</p>
        <nz-table [nzData]="devices()" [nzFrontPagination]="false" [nzShowPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'security.mfa.trusted.column.device' | translate }}</th>
              <th>{{ 'security.mfa.trusted.column.ip' | translate }}</th>
              <th>{{ 'security.mfa.trusted.column.last_used' | translate }}</th>
              <th>{{ 'security.mfa.trusted.column.created' | translate }}</th>
              <th>{{ 'security.mfa.trusted.column.expires' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (device of devices(); track device.id) {
              <tr data-testid="trusted-device-row">
                <td>{{ device.label }}</td>
                <td>
                  <code>{{ device.ip_address || '-' }}</code>
                </td>
                <td>{{ device.last_used_at ? (device.last_used_at | date: 'dd/MM/yyyy HH:mm') : '-' }}</td>
                <td>{{ device.created_at | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>{{ device.expires_at | date: 'dd/MM/yyyy' }}</td>
                <td nzAlign="right">
                  <button nz-button nzDanger nzType="link" nzSize="small" type="button" data-testid="revoke-device" (click)="confirmRevoke(device)">
                    {{ 'security.mfa.trusted.revoke' | translate }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="empty" data-testid="trusted-empty">{{ 'security.mfa.trusted.empty' | translate }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-card>
  `,
  styles: `
    .empty { color: var(--text-secondary); text-align: center; }
  `,
})
export class TrustedDevicesCardComponent implements OnInit {
  private readonly api = inject(AuthApiService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** Emits the number of devices left after a removal, so the page can refresh the status counters. */
  readonly changed = output<number>();

  protected readonly devices = signal<TrustedDevice[]>([]);
  protected readonly enabled = signal(true);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api.getTrustedDevices().subscribe({
      next: (res) => {
        this.loading.set(false);
        this.devices.set(res.data ?? []);
        this.enabled.set(res.meta?.enabled ?? true);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected confirmRevoke(device: TrustedDevice): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('security.mfa.trusted.revoke_confirm'),
      nzOkText: this.i18n.translate('security.mfa.trusted.revoke'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOkDanger: true,
      nzOnOk: () =>
        firstValueFrom(this.api.revokeTrustedDevice(device.id)).then(() => {
          this.devices.update((list) => list.filter((item) => item.id !== device.id));
          this.message.success(this.i18n.translate('security.mfa.trusted.revoked_toast'));
          this.changed.emit(this.devices().length);
        }),
    });
  }

  protected confirmRevokeAll(): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('security.mfa.trusted.revoke_all_confirm'),
      nzOkText: this.i18n.translate('security.mfa.trusted.revoke_all'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOkDanger: true,
      nzOnOk: () =>
        firstValueFrom(this.api.revokeAllTrustedDevices()).then(() => {
          this.devices.set([]);
          this.message.success(this.i18n.translate('security.mfa.trusted.revoked_all_toast'));
          this.changed.emit(0);
        }),
    });
  }
}
