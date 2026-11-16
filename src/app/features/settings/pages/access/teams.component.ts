import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccessApiService, AccessTeam, CustomRole, I18nService, SaveTeamPayload, SettingsApiService, UserResource } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { switchMap } from 'rxjs';
import { AccessNavComponent } from './access-nav.component';
import { reportAccessError } from './access-ui.util';

interface TeamDraft {
  team: AccessTeam | null;
}

/** Teams of the company: a group of members, optionally sharing a custom role. */
@Component({
  selector: 'app-access-teams',
  imports: [
    AccessNavComponent,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'access.teams.title' | translate" [subtitle]="'access.teams.subtitle' | translate" />
    <app-access-nav />
    <nz-card>
      <div class="mb-3">
        <button nz-button nzType="primary" type="button" data-test="add-team" (click)="openAdd()">
          {{ 'access.teams.add' | translate }}
        </button>
      </div>
      <nz-table #table [nzData]="teams()" [nzLoading]="loading()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'access.teams.name' | translate }}</th>
            <th>{{ 'access.teams.role' | translate }}</th>
            <th>{{ 'access.teams.members' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (team of table.data; track team.id) {
            <tr data-test="team-row">
              <td>
                <strong>{{ team.name }}</strong>
                @if (team.description) {
                  <br /><small>{{ team.description }}</small>
                }
              </td>
              <td>{{ roleName(team.custom_role_id) }}</td>
              <td>{{ memberNames(team) }}</td>
              <td>
                <button nz-button nzSize="small" type="button" data-test="edit-team" (click)="openEdit(team)">
                  {{ 'memberAccess.edit' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="small"
                  nzDanger
                  type="button"
                  data-test="delete-team"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'access.teams.confirmDelete' | translate"
                  (nzOnConfirm)="remove(team)"
                >
                  {{ 'memberAccess.remove' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="4">{{ 'access.teams.empty' | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal [nzVisible]="dialog() !== null" [nzTitle]="dialogTitle()" [nzFooter]="null" (nzOnCancel)="dialog.set(null)">
      <ng-container *nzModalContent>
        <label for="team-name">{{ 'access.teams.name' | translate }}</label>
        <input id="team-name" nz-input class="mb-3" maxlength="120" [ngModel]="name()" (ngModelChange)="name.set($event)" />

        <label for="team-description">{{ 'access.roles.description' | translate }}</label>
        <textarea
          id="team-description"
          nz-input
          class="mb-3"
          rows="2"
          maxlength="500"
          [ngModel]="description()"
          (ngModelChange)="description.set($event)"
        ></textarea>

        <label for="team-role">{{ 'access.teams.role' | translate }}</label>
        <nz-select
          id="team-role"
          class="mb-3 w-100"
          nzAllowClear
          [nzPlaceHolder]="'access.teams.noRole' | translate"
          [ngModel]="customRoleId()"
          (ngModelChange)="customRoleId.set($event ?? null)"
        >
          @for (role of customRoles(); track role.id) {
            <nz-option [nzValue]="role.id" [nzLabel]="role.name" />
          }
        </nz-select>

        <label for="team-members">{{ 'access.teams.members' | translate }}</label>
        <nz-select
          id="team-members"
          class="mb-3 w-100"
          nzMode="multiple"
          [ngModel]="memberIds()"
          (ngModelChange)="memberIds.set($event)"
        >
          @for (member of members(); track member.id) {
            <nz-option [nzValue]="member.id" [nzLabel]="member.name + ' (' + member.email + ')'" />
          }
        </nz-select>

        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="save-team"
          [nzLoading]="saving()"
          [disabled]="!canSave()"
          (click)="save()"
        >
          {{ 'memberAccess.save' | translate }}
        </button>
      </ng-container>
    </nz-modal>
  `,
})
export class AccessTeamsComponent implements OnInit {
  private readonly api = inject(AccessApiService);
  private readonly settingsApi = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly teams = signal<AccessTeam[]>([]);
  protected readonly customRoles = signal<CustomRole[]>([]);
  protected readonly members = signal<UserResource[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialog = signal<TeamDraft | null>(null);
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly customRoleId = signal<string | null>(null);
  protected readonly memberIds = signal<string[]>([]);
  protected readonly canSave = computed(() => !this.saving() && this.name().trim() !== '');
  protected readonly dialogTitle = computed(() =>
    this.i18n.translate(this.dialog()?.team ? 'access.teams.editTitle' : 'access.teams.addTitle'),
  );

  ngOnInit(): void {
    this.api.getRoles().subscribe({ next: (res) => this.customRoles.set(res.data.roles), error: () => undefined });
    this.settingsApi.getTenantUsers().subscribe({ next: (res) => this.members.set(res.data), error: () => undefined });
    this.reload();
  }

  protected roleName(id: string | null): string {
    return (id ? this.customRoles().find((role) => role.id === id)?.name : null) ?? '-';
  }

  protected memberNames(team: AccessTeam): string {
    return team.member_ids
      .map((id) => this.members().find((member) => member.id === id)?.name)
      .filter((name): name is string => !!name)
      .join(', ');
  }

  protected openAdd(): void {
    this.fill(null);
  }

  protected openEdit(team: AccessTeam): void {
    this.fill(team);
  }

  protected save(): void {
    const team = this.dialog()?.team ?? null;
    const payload: SaveTeamPayload = {
      name: this.name().trim(),
      description: this.description().trim() || null,
      custom_role_id: this.customRoleId(),
    };
    const saved = team === null ? this.api.createTeam(payload) : this.api.updateTeam(team.id, payload);

    this.saving.set(true);
    saved.pipe(switchMap((res) => this.api.setTeamMembers(res.data.id, this.memberIds()))).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialog.set(null);
        this.message.success(this.i18n.translate('access.teams.saved'));
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        reportAccessError(err, this.message, this.i18n);
      },
    });
  }

  protected remove(team: AccessTeam): void {
    this.api.deleteTeam(team.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('access.teams.deleted'));
        this.reload();
      },
      error: (err: unknown) => reportAccessError(err, this.message, this.i18n),
    });
  }

  private fill(team: AccessTeam | null): void {
    this.name.set(team?.name ?? '');
    this.description.set(team?.description ?? '');
    this.customRoleId.set(team?.custom_role_id ?? null);
    this.memberIds.set([...(team?.member_ids ?? [])]);
    this.dialog.set({ team });
  }

  private reload(): void {
    this.loading.set(true);
    this.api.getTeams().subscribe({
      next: (res) => {
        this.teams.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        reportAccessError(err, this.message, this.i18n);
      },
    });
  }
}
