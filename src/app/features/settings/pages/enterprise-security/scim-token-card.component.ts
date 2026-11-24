import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { environment } from '@env';
import { EnterpriseAuthApiService, ScimTokenStatus, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { enterpriseErrorText } from './enterprise-security.util';

/**
 * SCIM 2.0 provisioning of the tenant: token status, rotation and revocation. The plain token is returned once by the
 * API: it lives in a component signal only while it is shown and is cleared on dismiss, it is never persisted.
 */
@Component({
  selector: 'app-scim-token-card',
  imports: [DatePipe, FormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzDescriptionsModule, NzInputModule, NzInputNumberModule, NzPopconfirmModule, NzTagModule, TranslatePipe],
  template: `
    <nz-card [nzTitle]="'ENT_AUTH.SCIM_TITLE' | translate" [nzLoading]="loading()">
      <p>{{ 'ENT_AUTH.SCIM_INTRO' | translate }}</p>

      @if (errorText(); as text) {
        <nz-alert nzType="error" [nzMessage]="text" nzShowIcon class="gap"></nz-alert>
      }

      @if (plainToken(); as token) {
        <nz-alert nzType="warning" nzShowIcon class="gap" [nzMessage]="'ENT_AUTH.SCIM_TOKEN_ONCE' | translate" [nzDescription]="tokenTpl"></nz-alert>
        <ng-template #tokenTpl>
          <input nz-input readonly [value]="token" [attr.aria-label]="'ENT_AUTH.SCIM_TOKEN' | translate" />
          <div class="actions">
            <button nz-button type="button" (click)="copyToken()">{{ 'ENT_AUTH.COPY' | translate }}</button>
            <button nz-button type="button" nzType="primary" (click)="dismissToken()">{{ 'ENT_AUTH.SCIM_TOKEN_DISMISS' | translate }}</button>
          </div>
        </ng-template>
      }

      @if (status(); as current) {
        <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
          <nz-descriptions-item [nzTitle]="'ENT_AUTH.STATUS' | translate">
            <nz-tag [nzColor]="current.configured ? 'green' : 'default'">{{ (current.configured ? 'ENT_AUTH.SCIM_CONFIGURED' : 'ENT_AUTH.SCIM_NOT_CONFIGURED') | translate }}</nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'ENT_AUTH.SCIM_TOKEN_HINT' | translate">{{ current.token_hint ?? '-' }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'ENT_AUTH.SCIM_CREATED_AT' | translate">{{ current.created_at ? (current.created_at | date: 'short') : '-' }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'ENT_AUTH.SCIM_LAST_USED_AT' | translate">{{ current.last_used_at ? (current.last_used_at | date: 'short') : '-' }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'ENT_AUTH.SCIM_EXPIRES_AT' | translate">{{ current.expires_at ? (current.expires_at | date: 'short') : '-' }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'ENT_AUTH.SCIM_BASE_URL' | translate"><code>{{ scimBaseUrl }}</code></nz-descriptions-item>
        </nz-descriptions>
      }

      <div class="rotate">
        <label for="scim-expiry">{{ 'ENT_AUTH.SCIM_EXPIRES_IN_DAYS' | translate }}</label>
        <nz-input-number id="scim-expiry" [(ngModel)]="expiresInDays" [nzMin]="1" [nzMax]="730"></nz-input-number>
        <button nz-button nzType="primary" type="button" [nzLoading]="working()" nz-popconfirm [nzPopconfirmTitle]="'ENT_AUTH.SCIM_ROTATE_CONFIRM' | translate" (nzOnConfirm)="rotate()">
          {{ (status()?.configured ? 'ENT_AUTH.SCIM_ROTATE' : 'ENT_AUTH.SCIM_CREATE') | translate }}
        </button>
        @if (status()?.configured) {
          <button nz-button nzDanger type="button" [disabled]="working()" nz-popconfirm [nzPopconfirmTitle]="'ENT_AUTH.SCIM_REVOKE_CONFIRM' | translate" (nzOnConfirm)="revoke()">
            {{ 'ENT_AUTH.SCIM_REVOKE' | translate }}
          </button>
        }
      </div>
    </nz-card>
  `,
  styles: `
    .gap { margin-bottom: 16px; display: block; }
    .rotate { display: flex; gap: 12px; align-items: center; margin-top: 16px; flex-wrap: wrap; }
    .actions { display: flex; gap: 8px; margin-top: 8px; }
  `,
})
export class ScimTokenCardComponent implements OnInit {
  private readonly api = inject(EnterpriseAuthApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly scimBaseUrl = `${environment.apiBaseUrl}/scim/v2`;
  readonly status = signal<ScimTokenStatus | null>(null);
  readonly plainToken = signal<string | null>(null);
  readonly loading = signal(false);
  readonly working = signal(false);
  readonly errorText = signal<string | null>(null);
  expiresInDays: number | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getScimToken().subscribe({
      next: (response) => {
        this.status.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorText.set(enterpriseErrorText(error) ?? this.translate.instant('ENT_AUTH.ACTION_ERROR'));
      },
    });
  }

  rotate(): void {
    this.working.set(true);
    this.errorText.set(null);
    this.api.rotateScimToken({ expires_in_days: this.expiresInDays }).subscribe({
      next: (response) => {
        const { token, ...status } = response.data;
        this.status.set(status);
        this.plainToken.set(token);
        this.working.set(false);
        this.message.success(this.translate.instant('ENT_AUTH.SCIM_ROTATED'));
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.errorText.set(enterpriseErrorText(error) ?? this.translate.instant('ENT_AUTH.ACTION_ERROR'));
      },
    });
  }

  revoke(): void {
    this.working.set(true);
    this.errorText.set(null);
    this.api.revokeScimToken().subscribe({
      next: () => {
        this.working.set(false);
        this.plainToken.set(null);
        this.message.success(this.translate.instant('ENT_AUTH.SCIM_REVOKED'));
        this.load();
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.errorText.set(enterpriseErrorText(error) ?? this.translate.instant('ENT_AUTH.ACTION_ERROR'));
      },
    });
  }

  copyToken(): void {
    const token = this.plainToken();
    if (token) {
      void navigator.clipboard?.writeText(token);
      this.message.success(this.translate.instant('ENT_AUTH.COPIED'));
    }
  }

  dismissToken(): void {
    this.plainToken.set(null);
  }
}
