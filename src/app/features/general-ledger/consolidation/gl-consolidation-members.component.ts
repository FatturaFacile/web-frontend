import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  ConsolidationBasis,
  ConsolidationGroup,
  ConsolidationMemberPayload,
  ConsolidationMemberRow,
  ConsolidationMethod,
  GeneralLedgerConsolidationApiService,
  I18nService,
  PermissionsService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { memberName, nullable } from './gl-consolidation.util';

/** Entities of a consolidation group with their ownership, consolidation method and fiscal year offset. */
@Component({
  selector: 'app-gl-consolidation-members',
  styleUrl: './gl-consolidation.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    GlErrorAlertComponent,
    TranslatePipe,
  ],
  template: `
    <app-gl-error-alert [error]="error()" />
    <div class="toolbar">
      <span class="muted">{{ 'GL.CONS_MEMBERS_HINT' | translate }}</span>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()" appIconAction="create"></button>
      }
    </div>
    <nz-table #table nzSize="small" [nzData]="members()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'GL.COL_NAME' | translate }}</th>
          <th class="num">{{ 'GL.CONS_OWNERSHIP' | translate }}</th>
          <th>{{ 'GL.CONS_METHOD' | translate }}</th>
          <th>{{ 'GL.CONS_HOLDER' | translate }}</th>
          <th class="num">{{ 'GL.CONS_YEAR_OFFSET' | translate }}</th>
          <th>{{ 'GL.CONS_BASIS' | translate }}</th>
          <th class="num">{{ 'GL.CONS_TAX_RATE' | translate }}</th>
          <th>{{ 'GL.COL_ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (member of table.data; track member.id) {
          <tr>
            <td>
              {{ member.name }}
              @if (member.is_parent) {
                <nz-tag nzColor="blue">{{ 'GL.CONS_PARENT' | translate }}</nz-tag>
              }
            </td>
            <td class="num">{{ member.ownership_percentage }}%</td>
            <td>{{ 'GL.CONS_METHOD_' + member.consolidation_method.toUpperCase() | translate }}</td>
            <td>{{ holderName(member) }}</td>
            <td class="num">{{ member.fiscal_year_offset_months }}</td>
            <td>{{ member.consolidation_basis ? ('GL.CONS_BASIS_' + member.consolidation_basis.toUpperCase() | translate) : '' }}</td>
            <td class="num">{{ member.tax_rate ?? '' }}</td>
            <td>
              @if (canWrite) {
                <div class="actions">
                  <button nz-button nzSize="small" type="button" appIconAction="edit" (click)="openEdit(member)"></button>
                  @if (!member.is_parent) {
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      appIconAction="delete"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'GL.CONFIRM_DELETE' | translate"
                      (nzOnConfirm)="remove(member)"
                    ></button>
                  }
                </div>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="(editing() ? 'GL.CONS_MEMBER_EDIT' : 'GL.CONS_MEMBER_NEW') | translate"
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
          @if (!editing()) {
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cm-tenant">{{ 'GL.CONS_ENTITY' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.member_tenant_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <nz-select id="cm-tenant" formControlName="member_tenant_id" nzShowSearch>
                  @for (tenant of availableTenants(); track tenant.id) {
                    <nz-option [nzValue]="tenant.id" [nzLabel]="tenant.name" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cm-share">{{ 'GL.CONS_OWNERSHIP' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.ownership_percentage.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <nz-input-number class="w-full" id="cm-share" formControlName="ownership_percentage" [nzMin]="0.0001" [nzMax]="100" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cm-method">{{ 'GL.CONS_METHOD' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="cm-method" formControlName="consolidation_method">
                  @for (method of methods; track method) {
                    <nz-option [nzValue]="method" [nzLabel]="'GL.CONS_METHOD_' + method.toUpperCase() | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="cm-holder">{{ 'GL.CONS_HOLDER' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="cm-holder" formControlName="holder_tenant_id" nzAllowClear [nzPlaceHolder]="'GL.CONS_HOLDER_PARENT' | translate">
                  @for (member of holders(); track member.id) {
                    <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cm-offset">{{ 'GL.CONS_YEAR_OFFSET' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.fiscal_year_offset_months.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="cm-offset" formControlName="fiscal_year_offset_months" [nzMin]="-11" [nzMax]="11" [nzPrecision]="0" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="cm-basis">{{ 'GL.CONS_BASIS' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="cm-basis" formControlName="consolidation_basis" nzAllowClear>
                  @for (basis of bases; track basis) {
                    <nz-option [nzValue]="basis" [nzLabel]="'GL.CONS_BASIS_' + basis.toUpperCase() | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cm-tax">{{ 'GL.CONS_TAX_RATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.tax_rate.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="cm-tax" formControlName="tax_rate" [nzMin]="0" [nzMax]="100" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class GlConsolidationMembersComponent {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly tenants = inject(AuthStore).tenants;
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  readonly group = input.required<ConsolidationGroup>();
  /** Emitted after a change, so that the group (and the tabs that list its members) reloads. */
  readonly changed = output<void>();

  protected readonly methods: ConsolidationMethod[] = ['full', 'proportional', 'equity'];
  protected readonly bases: ConsolidationBasis[] = ['own_year', 'interim_twelve_months'];

  protected readonly members = computed(() => this.group().members ?? []);
  protected readonly holders = computed(() => this.members().filter((member) => member.id !== this.editing()?.id));
  protected readonly availableTenants = computed(() => {
    const taken = new Set(this.members().map((member) => member.member_tenant_id));
    return this.tenants().filter((tenant) => !taken.has(tenant.id));
  });

  protected readonly error = signal<unknown>(null);
  protected readonly formError = signal<unknown>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<ConsolidationMemberRow | null>(null);

  protected readonly form = this.fb.group({
    member_tenant_id: this.fb.control('', Validators.required),
    ownership_percentage: this.fb.control<number | null>(100, [Validators.required, Validators.min(0.0001), Validators.max(100)]),
    consolidation_method: this.fb.control<ConsolidationMethod>('full', Validators.required),
    holder_tenant_id: this.fb.control<string | null>(null),
    fiscal_year_offset_months: this.fb.control<number | null>(null),
    consolidation_basis: this.fb.control<ConsolidationBasis | null>(null),
    tax_rate: this.fb.control<number | null>(null),
  });

  protected holderName(member: ConsolidationMemberRow): string {
    return member.holder_tenant_id ? memberName(this.group(), member.holder_tenant_id) : '';
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ ownership_percentage: 100, consolidation_method: 'full' });
    this.form.controls.member_tenant_id.enable();
    this.openModal();
  }

  protected openEdit(member: ConsolidationMemberRow): void {
    this.editing.set(member);
    this.form.reset({
      member_tenant_id: member.member_tenant_id,
      ownership_percentage: Number(member.ownership_percentage),
      consolidation_method: member.consolidation_method,
      holder_tenant_id: member.holder_tenant_id,
      fiscal_year_offset_months: member.fiscal_year_offset_months,
      consolidation_basis: member.consolidation_basis,
      tax_rate: member.tax_rate === null ? null : Number(member.tax_rate),
    });
    // The entity of a member cannot change: the API refuses the field on update.
    this.form.controls.member_tenant_id.disable();
    this.openModal();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const editing = this.editing();
    const payload: ConsolidationMemberPayload = {
      ownership_percentage: value.ownership_percentage ?? 0,
      consolidation_method: value.consolidation_method,
      holder_tenant_id: nullable(value.holder_tenant_id),
      fiscal_year_offset_months: value.fiscal_year_offset_months,
      consolidation_basis: nullable(value.consolidation_basis),
      tax_rate: value.tax_rate,
    };
    if (!editing) {
      payload.member_tenant_id = value.member_tenant_id;
    }
    this.saving.set(true);
    const groupId = this.group().id;
    const request = editing ? this.api.updateMember(groupId, editing.id, payload) : this.api.addMember(groupId, payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.message.success(this.i18n.translate('GL.CONS_SAVED'));
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(err);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }

  protected remove(member: ConsolidationMemberRow): void {
    this.api.removeMember(this.group().id, member.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.CONS_DELETED'));
        this.changed.emit();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  private openModal(): void {
    this.formError.set(null);
    this.formErrors.set([]);
    this.modalOpen.set(true);
  }
}
