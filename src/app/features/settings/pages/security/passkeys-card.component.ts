import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService, IamApiService, PasskeyItem, PasskeyUnavailableError, WebAuthnService } from '@core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
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
  imports: [DatePipe, FormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzIconModule, NzInputModule, NzModalModule, NzTableModule, TranslatePipe],
  template: `
    <nz-card [nzTitle]="'IAM.PASSKEYS_TITLE' | translate">
      <p>{{ 'IAM.PASSKEYS_HELP' | translate }}</p>

      @if (lastFactor()) {
        <nz-alert class="gap" nzType="info" nzShowIcon [nzMessage]="'security.mfa.passkey.last_factor' | translate" data-testid="passkey-last-factor" />
      }

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
                <button nz-button nzSize="small" (click)="openRename(passkey)" data-testid="rename-passkey">
                  {{ 'security.mfa.passkey.rename' | translate }}
                </button>
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

    <nz-modal
      [nzVisible]="renameTarget() !== null"
      [nzTitle]="'security.mfa.passkey.rename_title' | translate"
      (nzOnOk)="rename()"
      (nzOnCancel)="renameTarget.set(null)"
      [nzOkDisabled]="renameValue().trim() === ''"
    >
      <ng-container *nzModalContent>
        <label for="passkey-rename-input">{{ 'security.mfa.passkey.name_label' | translate }}</label>
        <input nz-input id="passkey-rename-input" [ngModel]="renameValue()" (ngModelChange)="renameValue.set($event)" maxlength="255" data-testid="passkey-rename-input" />
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="recoveryCodes().length > 0"
      [nzTitle]="'security.mfa.passkey.recovery_title' | translate"
      [nzMaskClosable]="false"
      [nzClosable]="false"
      [nzCancelText]="null"
      (nzOnOk)="recoveryCodes.set([])"
      (nzOnCancel)="recoveryCodes.set([])"
    >
      <ng-container *nzModalContent>
        <nz-alert class="gap" nzType="warning" nzShowIcon [nzMessage]="'security.mfa.passkey.recovery_hint' | translate" />
        <div class="codes" data-testid="passkey-recovery-codes">
          @for (code of recoveryCodes(); track $index) {
            <div class="code">{{ code }}</div>
          }
        </div>
        <button nz-button nzBlock type="button" data-testid="copy-passkey-recovery" (click)="copyRecoveryCodes()">
          <span nz-icon nzType="copy"></span> {{ 'TWO_FACTOR.COPY_CODES' | translate }}
        </button>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .gap { display: block; margin-bottom: 16px; }
    .codes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
    .code { padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-md, 6px); font-family: monospace; text-align: center; }
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
  protected readonly renameTarget = signal<PasskeyItem | null>(null);
  protected readonly renameValue = signal('');
  protected readonly recoveryCodes = signal<string[]>([]);
  protected readonly lastFactor = signal(false);
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
      const registered = await firstValueFrom(this.api.finishPasskeyRegistration(begun.data.ceremony_id, name, credential));
      this.name.set('');
      // The recovery codes come once, with the first factor of the user.
      const codes = (registered.data?.recovery_codes ?? []).filter((code) => code && code !== '-');
      if (codes.length > 0) {
        this.recoveryCodes.set(codes);
      }
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
        try {
          await firstValueFrom(this.api.revokePasskey(passkey.id));
          this.lastFactor.set(false);
          await this.load();
        } catch (error) {
          if (error instanceof HttpErrorResponse && error.status === 403 && (error.error as { code?: unknown } | null)?.code === 'mfa_cannot_be_disabled') {
            this.lastFactor.set(true);
            return;
          }
          throw error;
        }
      },
    });
  }

  protected openRename(passkey: PasskeyItem): void {
    this.renameValue.set(passkey.name);
    this.renameTarget.set(passkey);
  }

  protected async rename(): Promise<void> {
    const target = this.renameTarget();
    const name = this.renameValue().trim();
    if (target === null || name === '') {
      return;
    }
    this.renameTarget.set(null);
    try {
      const updated = await firstValueFrom(this.api.renamePasskey(target.id, name));
      this.passkeys.update((list) => list.map((item) => (item.id === target.id ? { ...item, name: updated.data?.name ?? name } : item)));
      this.message.success(this.i18n.translate('security.mfa.passkey.renamed_toast'));
    } catch {
      // The global error handling already reported the failure; the list keeps the old name.
    }
  }

  protected copyRecoveryCodes(): void {
    if (navigator?.clipboard) {
      void navigator.clipboard.writeText(this.recoveryCodes().join('\n')).then(() => {
        this.message.success(this.i18n.translate('TWO_FACTOR.CODES_COPIED'));
      });
    }
  }

  private async load(): Promise<void> {
    this.passkeys.set((await firstValueFrom(this.api.passkeys())).data);
  }
}
