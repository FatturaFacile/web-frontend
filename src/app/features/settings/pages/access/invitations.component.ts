import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AccessApiService,
  AccessTeam,
  CustomRole,
  I18nService,
  InvitationRecord,
  InvitationStatus,
  SaveInvitationPayload,
  SettingsApiService,
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
import { reportAccessError, roleSelection, selectionPayload, systemRoleLabel } from './access-ui.util';
import { PlanLimitsComponent } from './plan-limits.component';

const STATUS_COLORS: Record<InvitationStatus, string> = {
  pending: 'blue',
  accepted: 'green',
  revoked: 'default',
  expired: 'orange',
};

/** Invitations by email: invite a person (new or existing account), send the link again or withdraw it. */
@Component({
  selector: 'app-access-invitations',
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
    PlanLimitsComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'access.invitations.title' | translate"
      [subtitle]="'access.invitations.subtitle' | translate"
    />
    <app-access-nav />
    <app-plan-limits [version]="limitsVersion()" />
    <nz-card>
      <div class="mb-3">
        <button nz-button nzType="primary" type="button" data-test="invite" (click)="openInvite()">
          {{ 'access.invitations.invite' | translate }}
        </button>
      </div>
      <nz-table #table [nzData]="invitations()" [nzLoading]="loading()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'memberAccess.email' | translate }}</th>
            <th>{{ 'memberAccess.role' | translate }}</th>
            <th>{{ 'access.invitations.status' | translate }}</th>
            <th>{{ 'access.invitations.expiresAt' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (invitation of table.data; track invitation.id) {
            <tr data-test="invitation-row">
              <td>{{ invitation.email }}</td>
              <td>{{ roleLabel(invitation) }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(invitation.status)" data-test="invitation-status">{{
                  'access.invitations.statuses.' + invitation.status | translate
                }}</nz-tag>
              </td>
              <td>{{ invitation.expires_at | date: 'short' }}</td>
              <td>
                @if (invitation.status === 'pending' || invitation.status === 'expired') {
                  <button nz-button nzSize="small" type="button" data-test="resend-invitation" (click)="resend(invitation)">
                    {{ 'access.invitations.resend' | translate }}
                  </button>
                }
                @if (invitation.status === 'pending') {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    data-test="revoke-invitation"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'access.invitations.confirmRevoke' | translate"
                    (nzOnConfirm)="revoke(invitation)"
                  >
                    {{ 'access.invitations.revoke' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5">{{ 'access.invitations.empty' | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="inviting()"
      [nzTitle]="'access.invitations.invite' | translate"
      [nzFooter]="null"
      (nzOnCancel)="inviting.set(false)"
    >
      <ng-container *nzModalContent>
        <label for="inv-email">{{ 'memberAccess.email' | translate }}</label>
        <input
          id="inv-email"
          nz-input
          type="email"
          class="mb-3"
          maxlength="255"
          autocomplete="off"
          [ngModel]="email()"
          (ngModelChange)="email.set($event)"
        />

        <label for="inv-role">{{ 'memberAccess.role' | translate }}</label>
        <nz-select id="inv-role" class="mb-3 w-100" [ngModel]="role()" (ngModelChange)="role.set($event)">
          @for (value of systemRoles(); track value) {
            <nz-option [nzValue]="value" [nzLabel]="systemLabel(value)" />
          }
          @for (custom of customRoles(); track custom.id) {
            <nz-option [nzValue]="'custom:' + custom.id" [nzLabel]="custom.name" />
          }
        </nz-select>

        @if (teams().length > 0) {
          <label for="inv-teams">{{ 'access.invitations.teams' | translate }}</label>
          <nz-select
            id="inv-teams"
            class="mb-3 w-100"
            nzMode="multiple"
            [ngModel]="teamIds()"
            (ngModelChange)="teamIds.set($event)"
          >
            @for (team of teams(); track team.id) {
              <nz-option [nzValue]="team.id" [nzLabel]="team.name" />
            }
          </nz-select>
        }

        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="send-invitation"
          [nzLoading]="saving()"
          [disabled]="!canSend()"
          (click)="send()"
        >
          {{ 'access.invitations.send' | translate }}
        </button>
      </ng-container>
    </nz-modal>
  `,
})
export class AccessInvitationsComponent implements OnInit {
  private readonly api = inject(AccessApiService);
  private readonly settingsApi = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly invitations = signal<InvitationRecord[]>([]);
  protected readonly systemRoles = signal<string[]>([]);
  protected readonly customRoles = signal<CustomRole[]>([]);
  protected readonly teams = signal<AccessTeam[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly inviting = signal(false);
  protected readonly limitsVersion = signal(0);
  protected readonly email = signal('');
  protected readonly role = signal('member');
  protected readonly teamIds = signal<string[]>([]);
  protected readonly canSend = computed(() => !this.saving() && this.email().trim() !== '');

  ngOnInit(): void {
    this.settingsApi.getAccessOptions().subscribe({
      next: (res) => this.systemRoles.set(res.data.roles),
      error: (err: unknown) => reportAccessError(err, this.message, this.i18n),
    });
    this.api.getRoles().subscribe({ next: (res) => this.customRoles.set(res.data.roles), error: () => undefined });
    this.api.getTeams().subscribe({ next: (res) => this.teams.set(res.data), error: () => undefined });
    this.reload();
  }

  protected systemLabel(role: string): string {
    return systemRoleLabel(this.i18n, role);
  }

  protected roleLabel(invitation: InvitationRecord): string {
    const custom = invitation.custom_role_id
      ? this.customRoles().find((role) => role.id === invitation.custom_role_id)
      : undefined;
    return custom?.name ?? this.systemLabel(invitation.role);
  }

  protected statusColor(status: InvitationStatus): string {
    return STATUS_COLORS[status] ?? 'default';
  }

  protected openInvite(): void {
    this.email.set('');
    this.role.set(roleSelection('member'));
    this.teamIds.set([]);
    this.inviting.set(true);
  }

  protected send(): void {
    const payload: SaveInvitationPayload = {
      email: this.email().trim(),
      ...selectionPayload(this.role()),
      ...(this.teamIds().length > 0 ? { team_ids: this.teamIds() } : {}),
    };

    this.saving.set(true);
    this.api.invite(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.inviting.set(false);
        this.message.success(this.i18n.translate('access.invitations.sent'));
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        reportAccessError(err, this.message, this.i18n);
      },
    });
  }

  protected resend(invitation: InvitationRecord): void {
    this.api.resendInvitation(invitation.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('access.invitations.resent'));
        this.reload();
      },
      error: (err: unknown) => reportAccessError(err, this.message, this.i18n),
    });
  }

  protected revoke(invitation: InvitationRecord): void {
    this.api.revokeInvitation(invitation.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('access.invitations.revoked'));
        this.reload();
      },
      error: (err: unknown) => reportAccessError(err, this.message, this.i18n),
    });
  }

  private reload(): void {
    this.loading.set(true);
    this.limitsVersion.update((value) => value + 1);
    this.api.getInvitations().subscribe({
      next: (res) => {
        this.invitations.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        reportAccessError(err, this.message, this.i18n);
      },
    });
  }
}
