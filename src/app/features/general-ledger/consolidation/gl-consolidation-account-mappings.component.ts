import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  applyServerErrors,
  ConsolidationAccountMapping,
  ConsolidationGroup,
  GeneralLedgerConsolidationApiService,
  I18nService,
  PermissionsService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlConsolidationAccountStore } from './gl-consolidation-account.store';
import { memberName, nullable } from './gl-consolidation.util';

/** Mapping of the accounts of each entity to the account codes of the group chart. */
@Component({
  selector: 'app-gl-consolidation-account-mappings',
  styleUrl: './gl-consolidation.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    GlErrorAlertComponent,
    TranslatePipe,
  ],
  template: `
    <app-gl-error-alert [error]="error()" />
    <div class="toolbar">
      <span class="muted">
        {{ (group().require_account_mapping ? 'GL.CONS_MAPPING_REQUIRED_HINT' : 'GL.CONS_MAPPING_OPTIONAL_HINT') | translate }}
      </span>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()" appIconAction="create"></button>
      }
    </div>
    <nz-table #table nzSize="small" [nzData]="mappings()" [nzLoading]="loading()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'GL.CONS_ENTITY' | translate }}</th>
          <th>{{ 'GL.CONS_ENTITY_ACCOUNT' | translate }}</th>
          <th>{{ 'GL.CONS_GROUP_ACCOUNT_CODE' | translate }}</th>
          <th>{{ 'GL.CONS_GROUP_ACCOUNT_NAME' | translate }}</th>
          <th>{{ 'GL.COL_ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (mapping of table.data; track mapping.id) {
          <tr>
            <td>{{ name(mapping.member_tenant_id) }}</td>
            <td>{{ accounts.label(mapping.member_tenant_id, mapping.account_id) }}</td>
            <td>{{ mapping.group_account_code }}</td>
            <td>{{ mapping.group_account_name }}</td>
            <td>
              @if (canWrite) {
                <button
                  nz-button
                  nzSize="small"
                  nzDanger
                  type="button"
                  appIconAction="delete"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'GL.CONFIRM_DELETE' | translate"
                  (nzOnConfirm)="remove(mapping)"
                ></button>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="'GL.CONS_ACCOUNT_MAPPING_NEW' | translate"
      nzWidth="640px"
      [nzOkLoading]="saving()"
      (nzOnOk)="save()"
      (nzOnCancel)="modalOpen.set(false)"
      okAction="save"
    >
      <ng-container *nzModalContent>
        <app-gl-error-alert [error]="formError()" />
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="cam-member">{{ 'GL.CONS_ENTITY' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.member_tenant_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
              <nz-select id="cam-member" formControlName="member_tenant_id">
                @for (member of members(); track member.id) {
                  <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="cam-account">{{ 'GL.CONS_ENTITY_ACCOUNT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.account_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
              <nz-select id="cam-account" formControlName="account_id" nzShowSearch>
                @for (account of accounts.accountsOf(selectedMember()); track account.id) {
                  <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' ' + account.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cam-code">{{ 'GL.CONS_GROUP_ACCOUNT_CODE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.group_account_code.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <input id="cam-code" nz-input formControlName="group_account_code" maxlength="40" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cam-name">{{ 'GL.CONS_GROUP_ACCOUNT_NAME' | translate }}</nz-form-label>
              <nz-form-control>
                <input id="cam-name" nz-input formControlName="group_account_name" maxlength="255" />
              </nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class GlConsolidationAccountMappingsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly accounts = inject(GlConsolidationAccountStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  readonly group = input.required<ConsolidationGroup>();

  protected readonly members = computed(() => this.group().members ?? []);
  protected readonly mappings = signal<ConsolidationAccountMapping[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly formError = signal<unknown>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly selectedMember = signal<string | null>(null);

  protected readonly form = this.fb.group({
    member_tenant_id: this.fb.control('', Validators.required),
    account_id: this.fb.control('', Validators.required),
    group_account_code: this.fb.control('', [Validators.required, Validators.maxLength(40)]),
    group_account_name: this.fb.control('', Validators.maxLength(255)),
  });

  constructor() {
    this.form.controls.member_tenant_id.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((tenantId) => this.onMember(tenantId));
  }

  ngOnInit(): void {
    this.load();
  }

  protected name(tenantId: string): string {
    return memberName(this.group(), tenantId);
  }

  private onMember(tenantId: string | null): void {
    this.selectedMember.set(tenantId);
    this.form.controls.account_id.reset('');
    this.accounts.load(tenantId);
  }

  protected openCreate(): void {
    this.form.reset();
    this.selectedMember.set(null);
    this.formError.set(null);
    this.formErrors.set([]);
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .createAccountMapping(this.group().id, {
        member_tenant_id: value.member_tenant_id,
        account_id: value.account_id,
        group_account_code: value.group_account_code,
        group_account_name: nullable(value.group_account_name),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.message.success(this.i18n.translate('GL.CONS_SAVED'));
          this.load();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.formError.set(err);
          this.formErrors.set(applyServerErrors(this.form, err));
        },
      });
  }

  protected remove(mapping: ConsolidationAccountMapping): void {
    this.api.deleteAccountMapping(mapping.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.CONS_DELETED'));
        this.load();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.getAccountMappings(this.group().id).subscribe({
      next: (res) => {
        const rows = res.data ?? [];
        this.mappings.set(rows);
        new Set(rows.map((row) => row.member_tenant_id)).forEach((tenantId) => this.accounts.load(tenantId));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err);
        this.loading.set(false);
      },
    });
  }
}
