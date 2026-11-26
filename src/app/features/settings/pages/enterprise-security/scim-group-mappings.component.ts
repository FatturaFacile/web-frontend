import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { firstValueFrom } from 'rxjs';
import { EnterpriseAuthApiService, I18nService, ScimGroupMapping } from '@core';
import { TranslatePipe } from '@shared';
import { enterpriseErrorText } from './enterprise-security.util';

/**
 * Maps the groups of the identity provider to roles of the company. The members of a group receive the mapped role;
 * the owner is never assigned or changed by SCIM. Saving a mapping of a known group name updates it.
 */
@Component({
  selector: 'app-scim-group-mappings',
  imports: [ReactiveFormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzFormModule, NzInputModule, NzSelectModule, NzTableModule, TranslatePipe],
  template: `
    <nz-card [nzTitle]="'security.scim.groups.mappings.title' | translate" [nzLoading]="loading()" class="block">
      <p>{{ 'security.scim.groups.mappings.help' | translate }}</p>

      @if (errorText(); as text) {
        <nz-alert class="gap" nzType="error" nzShowIcon [nzMessage]="text" data-testid="mappings-error" />
      }

      <form nz-form nzLayout="inline" [formGroup]="form" (ngSubmit)="save()" class="form">
        <nz-form-item>
          <nz-form-label nzFor="scim-group-name">{{ 'security.scim.groups.mappings.group_name' | translate }}</nz-form-label>
          <nz-form-control>
            <input nz-input id="scim-group-name" formControlName="group_name" maxlength="255" autocomplete="off" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="scim-group-role">{{ 'security.scim.groups.mappings.role' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select id="scim-group-role" formControlName="role" style="width: 200px">
              @for (role of roles(); track role) {
                <nz-option [nzValue]="role" [nzLabel]="roleLabel(role)"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <button nz-button nzType="primary" type="submit" data-testid="mapping-save" [nzLoading]="saving()" [disabled]="form.invalid">
          {{ 'security.scim.groups.mappings.save' | translate }}
        </button>
      </form>

      <nz-table [nzData]="mappings()" [nzFrontPagination]="false" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'security.scim.groups.mappings.group_name' | translate }}</th>
            <th>{{ 'security.scim.groups.mappings.role' | translate }}</th>
            <th>{{ 'security.scim.groups.mappings.members' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (mapping of mappings(); track mapping.id) {
            <tr data-testid="mapping-row">
              <td>{{ mapping.group_name }}</td>
              <td>{{ roleLabel(mapping.role) }}</td>
              <td>
                @if (mapping.member_count === null) {
                  <span class="muted">{{ 'security.scim.groups.mappings.not_synced' | translate }}</span>
                } @else {
                  {{ mapping.member_count }}
                }
              </td>
              <td nzAlign="right">
                <button nz-button nzDanger nzType="link" nzSize="small" type="button" data-testid="mapping-delete" (click)="confirmDelete(mapping)">
                  {{ 'security.scim.groups.mappings.delete' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="4" class="muted center" data-testid="mappings-empty">{{ 'security.scim.groups.mappings.empty' | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .block { display: block; margin-top: 16px; }
    .gap { display: block; margin-bottom: 16px; }
    .form { margin-bottom: 16px; row-gap: 8px; }
    .muted { color: var(--text-secondary); }
    .center { text-align: center; }
  `,
})
export class ScimGroupMappingsComponent implements OnInit {
  private readonly api = inject(EnterpriseAuthApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  protected readonly mappings = signal<ScimGroupMapping[]>([]);
  protected readonly assignableRoles = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorText = signal<string | null>(null);

  /** Roles the API accepts; the mapped roles of the list are always selectable (an older role may be gone from the API list). */
  protected readonly roles = computed(() => [...new Set([...this.assignableRoles(), ...this.mappings().map((m) => m.role)])]);

  protected readonly form = this.fb.group({
    group_name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    role: this.fb.control('', [Validators.required]),
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorText.set(null);
    this.api.getScimGroupMappings().subscribe({
      next: (res) => {
        this.loading.set(false);
        this.mappings.set(res.data ?? []);
        this.assignableRoles.set(res.meta?.roles ?? []);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.errorText.set(enterpriseErrorText(err) ?? this.i18n.translate('security.scim.groups.mappings.load_error'));
      },
    });
  }

  protected roleLabel(role: string): string {
    const key = `adminAccess.roles.${role}`;
    const text = this.i18n.translate(key);
    return text === key ? role : text;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { group_name, role } = this.form.getRawValue();
    this.saving.set(true);
    this.errorText.set(null);
    this.api.upsertScimGroupMapping({ group_name: group_name.trim(), role }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('security.scim.groups.mappings.saved'));
        this.form.reset({ group_name: '', role: '' });
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.errorText.set(enterpriseErrorText(err) ?? this.i18n.translate('ENT_AUTH.ACTION_ERROR'));
      },
    });
  }

  protected confirmDelete(mapping: ScimGroupMapping): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('security.scim.groups.mappings.delete_confirm', { group: mapping.group_name }),
      nzOkText: this.i18n.translate('security.scim.groups.mappings.delete'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOkDanger: true,
      nzOnOk: () =>
        firstValueFrom(this.api.deleteScimGroupMapping(mapping.id))
          .then(() => {
            this.message.success(this.i18n.translate('security.scim.groups.mappings.removed'));
            this.load();
          })
          .catch((err: unknown) => {
            this.errorText.set(
              err instanceof HttpErrorResponse
                ? (enterpriseErrorText(err) ?? this.i18n.translate('ENT_AUTH.ACTION_ERROR'))
                : this.i18n.translate('ENT_AUTH.ACTION_ERROR'),
            );
          }),
    });
  }
}
