import { Component, inject, model } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { I18nService, LeadSourceSecrets } from '@core';
import { translateOr, TranslateOrPipe } from '../leads/lead-i18n';

/**
 * Shows a lead source's webhook secret and API key exactly once. The secrets
 * only live in the bound signal: closing the modal sets it back to null, and
 * they are never logged or written to storage.
 */
@Component({
  selector: 'app-lead-secret-modal',
  imports: [NzAlertModule, NzButtonModule, NzIconModule, NzModalModule, TranslateOrPipe],
  template: `
    <nz-modal
      [nzVisible]="!!secrets()"
      [nzTitle]="'CRM.LEAD_SOURCES.SECRETS.TITLE' | translateOr: 'Source credentials'"
      [nzMaskClosable]="false"
      [nzFooter]="footerTpl"
      (nzOnCancel)="close()"
    >
      <ng-container *nzModalContent>
        @if (secrets(); as s) {
          <nz-alert
            nzType="warning"
            nzShowIcon
            class="warn"
            [nzMessage]="
              'CRM.LEAD_SOURCES.SECRETS.WARNING'
                | translateOr: 'Copy these values now: they will not be shown again.'
            "
          />
          <p class="source">{{ s.source_name }}</p>
          <dl>
            @for (row of rows(s); track row.key) {
              <dt>{{ row.label }}</dt>
              <dd>
                <code>{{ row.value }}</code>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [attr.aria-label]="('COMMON.COPY' | translateOr: 'Copy') + ' ' + row.label"
                  (click)="copy(row.value)"
                >
                  <nz-icon nzType="copy" /> {{ 'COMMON.COPY' | translateOr: 'Copy' }}
                </button>
              </dd>
            }
          </dl>
        }
      </ng-container>
      <ng-template #footerTpl>
        <button nz-button nzType="primary" type="button" (click)="close()">
          {{ 'CRM.LEAD_SOURCES.SECRETS.DONE' | translateOr: 'I have copied them' }}
        </button>
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .warn {
      margin-bottom: 16px;
    }
    .source {
      font-weight: 600;
    }
    dl {
      margin: 0;
    }
    dt {
      font-weight: 600;
      margin-top: 12px;
    }
    dd {
      margin: 4px 0 0;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    code {
      flex: 1;
      word-break: break-all;
      background: #f5f5f5;
      padding: 4px 8px;
      border-radius: 4px;
    }
  `,
})
export class LeadSecretModalComponent {
  private readonly clipboard = inject(Clipboard);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly secrets = model<LeadSourceSecrets | null>(null);

  protected rows(s: LeadSourceSecrets): { key: string; label: string; value: string }[] {
    const t = (key: string, fb: string) => translateOr(this.i18n, key, fb);
    return [
      { key: 'url', label: t('CRM.LEAD_SOURCES.WEBHOOK_URL', 'Webhook URL'), value: s.webhook_url },
      { key: 'secret', label: t('CRM.LEAD_SOURCES.WEBHOOK_SECRET', 'Webhook secret'), value: s.webhook_secret },
      { key: 'api-key', label: t('CRM.LEAD_SOURCES.API_KEY', 'API key'), value: s.api_key },
    ].filter((r): r is { key: string; label: string; value: string } => !!r.value);
  }

  protected copy(value: string): void {
    if (this.clipboard.copy(value)) {
      this.message.success(translateOr(this.i18n, 'COMMON.COPIED', 'Copied to clipboard'));
    }
  }

  close(): void {
    this.secrets.set(null);
  }
}
