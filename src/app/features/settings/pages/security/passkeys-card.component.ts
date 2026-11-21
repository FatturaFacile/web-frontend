import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService, IamApiService, PasskeyItem, PasskeyUnavailableError, WebAuthnService } from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe } from '@shared';
import { firstValueFrom } from 'rxjs';

/**
 * Passkeys of the signed-in user: register one on this device or a security key (the browser asks for a biometric or PIN
 * check), give it a name, and revoke it. The private key never leaves the authenticator.
 */
@Component({
  selector: 'app-passkeys-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, NzButtonModule, NzCardModule, NzIconModule, NzInputModule, NzModalModule, NzTableModule, TranslatePipe],
  template: `
    <nz-card [nzTitle]="'IAM.PASSKEYS_TITLE' | translate">
      <p>{{ 'IAM.PASSKEYS_HELP' | translate }}</p>

      <nz-table [nzData]="passkeys()" [nzFrontPagination]="false" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'IAM.PASSKEY_NAME' | translate }}</th>
            <th>{{ 'IAM.PASSKEY_CREATED' | translate }}</th>
            <th>{{ 'IAM.PASSKEY_LAST_USED' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (passkey of passkeys(); track passkey.id) {
            <tr>
              <td>{{ passkey.name }}</td>
              <td>{{ passkey.created_at | date: 'medium' }}</td>
              <td>{{ passkey.last_used_at ? (passkey.last_used_at | date: 'medium') : '—' }}</td>
              <td>
                <button nz-button nzSize="small" nzDanger (click)="confirmRevoke(passkey)" data-testid="revoke-passkey">
                  {{ 'IAM.PASSKEY_REVOKE' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>

      <button nz-button nzType="primary" [disabled]="!supported" [nzLoading]="adding()" (click)="nameModal.set(true)" data-testid="add-passkey">
        <span nz-icon nzType="key"></span> {{ 'IAM.PASSKEY_ADD' | translate }}
      </button>
    </nz-card>

    <nz-modal [(nzVisible)]="nameModal" [nzTitle]="'IAM.PASSKEY_NAME' | translate" (nzOnOk)="register()" (nzOnCancel)="nameModal.set(false)" [nzOkDisabled]="name().trim() === ''">
      <ng-container *nzModalContent>
        <input nz-input [ngModel]="name()" (ngModelChange)="name.set($event)" data-testid="passkey-name" />
      </ng-container>
    </nz-modal>
  `,
})
export class PasskeysCardComponent implements OnInit {
  private readonly api = inject(IamApiService);
  private readonly webauthn = inject(WebAuthnService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  protected readonly passkeys = signal<PasskeyItem[]>([]);
  protected readonly adding = signal(false);
  protected readonly nameModal = signal(false);
  protected readonly name = signal('');
  protected readonly supported = this.webauthn.isSupported();

  ngOnInit(): void {
    void this.load();
  }

  protected async register(): Promise<void> {
    const name = this.name().trim();
    this.nameModal.set(false);
    this.adding.set(true);
    try {
      const begun = await firstValueFrom(this.api.beginPasskeyRegistration());
      const credential = await this.webauthn.create(begun.data.options as never);
      await firstValueFrom(this.api.finishPasskeyRegistration(begun.data.ceremony_id, name, credential));
      this.name.set('');
      this.message.success(this.i18n.translate('IAM.PASSKEY_ADDED'));
      await this.load();
    } catch (error) {
      if (error instanceof PasskeyUnavailableError && error.reason !== 'cancelled') {
        this.message.error(this.i18n.translate('IAM.PASSKEY_UNAVAILABLE'));
      }
    } finally {
      this.adding.set(false);
    }
  }

  protected confirmRevoke(passkey: PasskeyItem): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('IAM.PASSKEY_REVOKE_CONFIRM', { name: passkey.name }),
      nzOkDanger: true,
      nzOnOk: async () => {
        await firstValueFrom(this.api.revokePasskey(passkey.id));
        await this.load();
      },
    });
  }

  private async load(): Promise<void> {
    this.passkeys.set((await firstValueFrom(this.api.passkeys())).data);
  }
}
