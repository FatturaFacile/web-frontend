import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AccessApiService,
  AuthStore,
  DelegationRecord,
  DelegationStatus,
  I18nService,
  SaveDelegationPayload,
  SettingsApiService,
  UserResource,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AccessNavComponent } from './access-nav.component';
import { moduleLabel, reportAccessError } from './access-ui.util';

const STATUS_COLORS: Record<DelegationStatus, string> = {
  active: 'green',
  scheduled: 'blue',
  expired: 'default',
  revoked: 'red',
};

/** Temporary delegations: for a period, a person acts with the role (or some modules) of another one. */
@Component({
  selector: 'app-access-delegations',
  imports: [
    AccessNavComponent,
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'access.delegations.title' | translate"
      [subtitle]="'access.delegations.subtitle' | translate"
    />
    <app-access-nav />
    <nz-card>
      <div class="mb-3">
        <button nz-button nzType="primary" type="button" data-test="add-delegation" (click)="openAdd()">
          {{ 'access.delegations.add' | translate }}
        </button>
      </div>
      <nz-table #table [nzData]="delegations()" [nzLoading]="loading()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'access.delegations.delegator' | translate }}</th>
            <th>{{ 'access.delegations.delegate' | translate }}</th>
            <th>{{ 'access.delegations.period' | translate }}</th>
            <th>{{ 'access.delegations.scope' | translate }}</th>
            <th>{{ 'access.invitations.status' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (delegation of table.data; track delegation.id) {
            <tr data-test="delegation-row">
              <td>{{ delegation.delegator.name }}</td>
              <td>{{ delegation.delegate.name }}</td>
              <td>{{ delegation.starts_at | date: 'short' }} - {{ delegation.ends_at | date: 'short' }}</td>
              <td>{{ scope(delegation) }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(delegation.status)">{{
                  'access.delegations.statuses.' + delegation.status | translate
                }}</nz-tag>
              </td>
              <td>
                @if (delegation.status === 'active' || delegation.status === 'scheduled') {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    data-test="revoke-delegation"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'access.delegations.confirmRevoke' | translate"
                    (nzOnConfirm)="revoke(delegation)"
                  >
                    {{ 'access.invitations.revoke' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6">{{ 'access.delegations.empty' | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="creating()"
      [nzTitle]="'access.delegations.add' | translate"
      [nzFooter]="null"
      (nzOnCancel)="creating.set(false)"
    >
      <ng-container *nzModalContent>
        <label for="del-delegate">{{ 'access.delegations.delegate' | translate }}</label>
        <nz-select id="del-delegate" class="mb-3 w-100" nzShowSearch [ngModel]="delegateId()" (ngModelChange)="delegateId.set($event)">
          @for (member of delegateOptions(); track member.id) {
            <nz-option [nzValue]="member.id" [nzLabel]="member.name + ' (' + member.email + ')'" />
          }
        </nz-select>

        <label for="del-start">{{ 'access.delegations.startsAt' | translate }}</label>
        <input
          id="del-start"
          nz-input
          type="datetime-local"
          class="mb-3"
          [ngModel]="startsAt()"
          (ngModelChange)="startsAt.set($event)"
        />

        <label for="del-end">{{ 'access.delegations.endsAt' | translate }}</label>
        <input
          id="del-end"
          nz-input
          type="datetime-local"
          class="mb-3"
          [ngModel]="endsAt()"
          (ngModelChange)="endsAt.set($event)"
        />

        <label for="del-modules">{{ 'access.delegations.modules' | translate }}</label>
        <nz-select
          id="del-modules"
          class="mb-1 w-100"
          nzMode="multiple"
          [ngModel]="moduleCodes()"
          (ngModelChange)="moduleCodes.set($event)"
        >
          @for (module of modules(); track module) {
            <nz-option [nzValue]="module" [nzLabel]="label(module)" />
          }
        </nz-select>
        <p class="text-xs mb-3">{{ 'access.delegations.modulesHint' | translate }}</p>

        <label for="del-reason">{{ 'access.delegations.reason' | translate }}</label>
        <textarea
          id="del-reason"
          nz-input
          class="mb-3"
          rows="2"
          maxlength="500"
          [ngModel]="reason()"
          (ngModelChange)="reason.set($event)"
        ></textarea>

        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="save-delegation"
          [nzLoading]="saving()"
          [disabled]="!canSave()"
          (click)="save()"
        >
          {{ 'access.delegations.create' | translate }}
        </button>
      </ng-container>
    </nz-modal>
  `,
})
export class AccessDelegationsComponent implements OnInit {
  private readonly api = inject(AccessApiService);
  private readonly settingsApi = inject(SettingsApiService);
  private readonly authStore = inject(AuthStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly delegations = signal<DelegationRecord[]>([]);
  protected readonly members = signal<UserResource[]>([]);
  protected readonly modules = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly creating = signal(false);
  protected readonly delegateId = signal<string | null>(null);
  protected readonly startsAt = signal('');
  protected readonly endsAt = signal('');
  protected readonly moduleCodes = signal<string[]>([]);
  protected readonly reason = signal('');
  /** The delegator is the signed-in user: a person cannot delegate to themselves. */
  protected readonly delegateOptions = computed(() => {
    const me = this.authStore.user()?.id;
    return this.members().filter((member) => member.id !== me);
  });
  protected readonly canSave = computed(
    () => !this.saving() && !!this.delegateId() && this.startsAt() !== '' && this.endsAt() !== '' && this.startsAt() < this.endsAt(),
  );

  ngOnInit(): void {
    this.settingsApi.getTenantUsers().subscribe({ next: (res) => this.members.set(res.data), error: () => undefined });
    this.settingsApi.getAccessOptions().subscribe({ next: (res) => this.modules.set(res.data.modules), error: () => undefined });
    this.reload();
  }

  protected label(module: string): string {
    return moduleLabel(this.i18n, module);
  }

  protected scope(delegation: DelegationRecord): string {
    return delegation.modules && delegation.modules.length > 0
      ? delegation.modules.map((module) => this.label(module)).join(', ')
      : this.i18n.translate('access.delegations.allModules');
  }

  protected statusColor(status: DelegationStatus): string {
    return STATUS_COLORS[status] ?? 'default';
  }

  protected openAdd(): void {
    this.delegateId.set(null);
    this.startsAt.set('');
    this.endsAt.set('');
    this.moduleCodes.set([]);
    this.reason.set('');
    this.creating.set(true);
  }

  protected save(): void {
    const delegateId = this.delegateId();
    if (!delegateId) {
      return;
    }
    const payload: SaveDelegationPayload = {
      delegate_id: delegateId,
      starts_at: new Date(this.startsAt()).toISOString(),
      ends_at: new Date(this.endsAt()).toISOString(),
      ...(this.moduleCodes().length > 0 ? { modules: this.moduleCodes() } : {}),
      ...(this.reason().trim() !== '' ? { reason: this.reason().trim() } : {}),
    };

    this.saving.set(true);
    this.api.createDelegation(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.creating.set(false);
        this.message.success(this.i18n.translate('access.delegations.saved'));
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        reportAccessError(err, this.message, this.i18n);
      },
    });
  }

  protected revoke(delegation: DelegationRecord): void {
    this.api.revokeDelegation(delegation.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('access.delegations.revoked'));
        this.reload();
      },
      error: (err: unknown) => reportAccessError(err, this.message, this.i18n),
    });
  }

  private reload(): void {
    this.loading.set(true);
    this.api.getDelegations().subscribe({
      next: (res) => {
        this.delegations.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        reportAccessError(err, this.message, this.i18n);
      },
    });
  }
}
