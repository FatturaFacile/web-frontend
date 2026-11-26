import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ScimSyncStatus } from '@core';
import { TranslatePipe } from '@shared';

/** Provisioning counters of the identity provider: last sync, users and groups provisioned and the last error. */
@Component({
  selector: 'app-scim-sync-status',
  imports: [DatePipe, NzAlertModule, NzCardModule, NzDescriptionsModule, NzTagModule, TranslatePipe],
  template: `
    <nz-card [nzTitle]="'security.scim.groups.sync.title' | translate" class="block">
      @if (sync(); as current) {
        <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
          <nz-descriptions-item [nzTitle]="'security.scim.groups.sync.last_sync' | translate">
            <span data-testid="sync-last">
              {{ current.last_sync_at ? (current.last_sync_at | date: 'short') : ('security.scim.groups.sync.never' | translate) }}
            </span>
            @if (current.last_status) {
              <nz-tag class="status" [nzColor]="current.last_status === 'success' ? 'green' : 'red'">
                {{ 'security.scim.groups.logs.status_' + current.last_status | translate }}
              </nz-tag>
            }
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'security.scim.groups.sync.users' | translate">
            <span data-testid="sync-users">{{ current.users_provisioned }}</span>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'security.scim.groups.sync.groups' | translate">
            <span data-testid="sync-groups">{{ current.groups_provisioned }}</span>
          </nz-descriptions-item>
        </nz-descriptions>

        @if (current.last_error; as error) {
          <nz-alert
            class="error"
            nzType="error"
            nzShowIcon
            data-testid="sync-error"
            [nzMessage]="'security.scim.groups.sync.last_error' | translate"
            [nzDescription]="errorTpl"
          />
          <ng-template #errorTpl>
            <div>{{ error.message }}</div>
            <small>
              @if (error.resource) {
                {{ error.resource }}
              }
              @if (error.operation) {
                / {{ error.operation }}
              }
              @if (error.at) {
                - {{ error.at | date: 'short' }}
              }
            </small>
          </ng-template>
        } @else {
          <p class="no-error" data-testid="sync-no-error">{{ 'security.scim.groups.sync.no_error' | translate }}</p>
        }
      }
    </nz-card>
  `,
  styles: `
    .block { display: block; margin-top: 16px; }
    .status { margin-left: 8px; }
    .error { display: block; margin-top: 16px; }
    .no-error { margin: 16px 0 0; color: var(--text-secondary); }
  `,
})
export class ScimSyncStatusComponent {
  readonly sync = input<ScimSyncStatus | null | undefined>(null);
}
