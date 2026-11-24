import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  applyServerErrors,
  ConsolidationGroup,
  GeneralLedgerConsolidationApiService,
  I18nService,
  IntercompanyMappingType,
  IntercompanyRelation,
  PermissionsService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlConsolidationAccountStore } from './gl-consolidation-account.store';
import { memberName, nullable } from './gl-consolidation.util';

/** Intercompany relations between two entities of the group and the pairs of accounts that must match. */
@Component({
  selector: 'app-gl-consolidation-relations',
  styleUrl: './gl-consolidation.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
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
      <span class="muted">{{ 'GL.CONS_RELATIONS_HINT' | translate }}</span>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openRelation()" appIconAction="create"></button>
      }
    </div>
    <nz-table #table nzSize="small" [nzData]="relations()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th></th>
          <th>{{ 'GL.CONS_ENTITY_A' | translate }}</th>
          <th>{{ 'GL.CONS_ENTITY_B' | translate }}</th>
          <th class="num">{{ 'GL.CONS_TOLERANCE' | translate }}</th>
          <th>{{ 'GL.COL_DESCRIPTION' | translate }}</th>
          <th>{{ 'GL.COL_ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (relation of table.data; track relation.id) {
          <tr>
            <td [nzExpand]="expanded() === relation.id" (nzExpandChange)="toggle(relation)"></td>
            <td>{{ name(relation.entity_a_tenant_id) }}</td>
            <td>{{ name(relation.entity_b_tenant_id) }}</td>
            <td class="num">{{ relation.tolerance_amount }}</td>
            <td>{{ relation.description }}</td>
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
                  (nzOnConfirm)="removeRelation(relation)"
                ></button>
              }
            </td>
          </tr>
          <tr [nzExpand]="expanded() === relation.id">
            <div class="toolbar">
              <strong>{{ 'GL.CONS_ACCOUNT_PAIRS' | translate }}</strong>
              <span class="spacer"></span>
              @if (canWrite) {
                <button nz-button nzSize="small" type="button" (click)="openMapping(relation)" appIconAction="add"></button>
              }
            </div>
            <nz-table nzSize="small" [nzData]="relation.mappings ?? []" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'GL.CONS_MAPPING_TYPE' | translate }}</th>
                  <th>{{ 'GL.CONS_ACCOUNT_A' | translate }}</th>
                  <th>{{ 'GL.CONS_ACCOUNT_B' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (mapping of relation.mappings ?? []; track mapping.id) {
                  <tr>
                    <td>{{ 'GL.CONS_MAPPING_' + mapping.mapping_type.toUpperCase() | translate }}</td>
                    <td>{{ accounts.label(relation.entity_a_tenant_id, mapping.account_a_id) }}</td>
                    <td>{{ mapping.account_b_id ? accounts.label(relation.entity_b_tenant_id, mapping.account_b_id) : '' }}</td>
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
                          (nzOnConfirm)="removeMapping(mapping.id)"
                        ></button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal appModalActions
      [nzVisible]="relationOpen()"
      [nzTitle]="'GL.CONS_RELATION_NEW' | translate"
      nzWidth="640px"
      [nzOkLoading]="saving()"
      (nzOnOk)="saveRelation()"
      (nzOnCancel)="relationOpen.set(false)"
      okAction="save"
    >
      <ng-container *nzModalContent>
        <app-gl-error-alert [error]="formError()" />
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="relationForm">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cr-a">{{ 'GL.CONS_ENTITY_A' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="relationForm.controls.entity_a_tenant_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <nz-select id="cr-a" formControlName="entity_a_tenant_id">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cr-b">{{ 'GL.CONS_ENTITY_B' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="relationForm.controls.entity_b_tenant_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <nz-select id="cr-b" formControlName="entity_b_tenant_id">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="cr-tol">{{ 'GL.CONS_TOLERANCE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="relationForm.controls.tolerance_amount.errors?.['serverError'] ?? ''">
              <nz-input-number class="w-full" id="cr-tol" formControlName="tolerance_amount" [nzMin]="0" [nzPrecision]="4" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="cr-desc">{{ 'GL.COL_DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea id="cr-desc" nz-input rows="2" maxlength="5000" formControlName="description"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions
      [nzVisible]="mappingTarget() !== null"
      [nzTitle]="'GL.CONS_MAPPING_NEW' | translate"
      nzWidth="640px"
      [nzOkLoading]="saving()"
      (nzOnOk)="saveMapping()"
      (nzOnCancel)="mappingTarget.set(null)"
      okAction="save"
    >
      <ng-container *nzModalContent>
        <app-gl-error-alert [error]="formError()" />
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="mappingForm">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="cmap-type">{{ 'GL.CONS_MAPPING_TYPE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select id="cmap-type" formControlName="mapping_type">
                @for (type of mappingTypes; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="'GL.CONS_MAPPING_' + type.toUpperCase() | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="cmap-a">{{ 'GL.CONS_ACCOUNT_A' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="mappingForm.controls.account_a_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
              <nz-select id="cmap-a" formControlName="account_a_id" nzShowSearch>
                @for (account of accounts.accountsOf(mappingTarget()?.entity_a_tenant_id); track account.id) {
                  <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' ' + account.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="cmap-b">{{ 'GL.CONS_ACCOUNT_B' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="mappingForm.controls.account_b_id.errors?.['serverError'] ?? ''">
              <nz-select id="cmap-b" formControlName="account_b_id" nzShowSearch nzAllowClear>
                @for (account of accounts.accountsOf(mappingTarget()?.entity_b_tenant_id); track account.id) {
                  <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' ' + account.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class GlConsolidationRelationsComponent {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly accounts = inject(GlConsolidationAccountStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  readonly group = input.required<ConsolidationGroup>();
  readonly changed = output<void>();

  protected readonly mappingTypes: IntercompanyMappingType[] = ['receivable_payable', 'revenue_cost', 'investment_equity'];
  protected readonly relations = computed(() => this.group().relations ?? []);
  protected readonly members = computed(() => this.group().members ?? []);

  protected readonly expanded = signal<string | null>(null);
  protected readonly error = signal<unknown>(null);
  protected readonly formError = signal<unknown>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly relationOpen = signal(false);
  protected readonly mappingTarget = signal<IntercompanyRelation | null>(null);

  protected readonly relationForm = this.fb.group({
    entity_a_tenant_id: this.fb.control('', Validators.required),
    entity_b_tenant_id: this.fb.control('', Validators.required),
    tolerance_amount: this.fb.control<number | null>(null, Validators.min(0)),
    description: this.fb.control('', Validators.maxLength(5000)),
  });

  protected readonly mappingForm = this.fb.group({
    mapping_type: this.fb.control<IntercompanyMappingType>('receivable_payable', Validators.required),
    account_a_id: this.fb.control('', Validators.required),
    account_b_id: this.fb.control<string | null>(null),
  });

  protected name(tenantId: string): string {
    return memberName(this.group(), tenantId);
  }

  protected toggle(relation: IntercompanyRelation): void {
    const open = this.expanded() === relation.id;
    this.expanded.set(open ? null : relation.id);
    if (!open) {
      this.accounts.load(relation.entity_a_tenant_id);
      this.accounts.load(relation.entity_b_tenant_id);
    }
  }

  protected openRelation(): void {
    this.relationForm.reset({ tolerance_amount: null });
    this.formError.set(null);
    this.formErrors.set([]);
    this.relationOpen.set(true);
  }

  protected openMapping(relation: IntercompanyRelation): void {
    this.accounts.load(relation.entity_a_tenant_id);
    this.accounts.load(relation.entity_b_tenant_id);
    this.mappingForm.reset({ mapping_type: 'receivable_payable', account_b_id: null });
    this.formError.set(null);
    this.formErrors.set([]);
    this.mappingTarget.set(relation);
  }

  protected saveRelation(): void {
    if (this.relationForm.invalid) {
      this.relationForm.markAllAsTouched();
      return;
    }
    const value = this.relationForm.getRawValue();
    this.saving.set(true);
    this.api
      .createRelation(this.group().id, {
        entity_a_tenant_id: value.entity_a_tenant_id,
        entity_b_tenant_id: value.entity_b_tenant_id,
        tolerance_amount: value.tolerance_amount,
        description: nullable(value.description),
      })
      .subscribe({
        next: () => {
          this.relationOpen.set(false);
          this.done();
        },
        error: (err: unknown) => this.failed(err, this.relationForm),
      });
  }

  protected saveMapping(): void {
    const relation = this.mappingTarget();
    if (!relation || this.mappingForm.invalid) {
      this.mappingForm.markAllAsTouched();
      return;
    }
    const value = this.mappingForm.getRawValue();
    this.saving.set(true);
    this.api
      .createRelationMapping(relation.id, {
        mapping_type: value.mapping_type,
        account_a_id: value.account_a_id,
        account_b_id: nullable(value.account_b_id),
      })
      .subscribe({
        next: () => {
          this.expanded.set(relation.id);
          this.mappingTarget.set(null);
          this.done();
        },
        error: (err: unknown) => this.failed(err, this.mappingForm),
      });
  }

  protected removeRelation(relation: IntercompanyRelation): void {
    this.api.deleteRelation(relation.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.CONS_DELETED'));
        this.changed.emit();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  protected removeMapping(mappingId: string): void {
    this.api.deleteRelationMapping(mappingId).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.CONS_DELETED'));
        this.changed.emit();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  private done(): void {
    this.saving.set(false);
    this.message.success(this.i18n.translate('GL.CONS_SAVED'));
    this.changed.emit();
  }

  private failed(err: unknown, form: FormGroup): void {
    this.saving.set(false);
    this.formError.set(err);
    this.formErrors.set(applyServerErrors(form, err));
  }
}
