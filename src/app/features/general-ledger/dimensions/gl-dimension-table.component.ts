import { Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { applyServerErrors, Dimension, FetchGridModel, GeneralLedgerApiService, I18nService, PermissionsService } from '@core';
import { BaseTableComponent, TableColumnDef, TranslatePipe, IconActionDirective, ModalActionsDirective } from '@shared';
import { GlLookupStore } from '../shared/gl-lookup.store';

/** List with create/edit modal of cost centres or profit centres. */
@Component({
  selector: 'app-gl-dimension-table',
  styleUrl: './gl-dimension-table.component.scss',
  imports: [
    BaseTableComponent,
    IconActionDirective,
    ModalActionsDirective,
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSwitchModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @if (canWrite) {
      <button class="mb-4" nz-button nzType="primary" type="button" (click)="openModal(null)" appIconAction="create"></button>
    }
    <app-base-table [grid]="grid" [columns]="columns()" [actionsTemplate]="actionsTpl" [exportFileName]="'gl-dimensions'" />

    <ng-template #statusTpl let-item>
      <nz-tag [nzColor]="item.is_active ? 'green' : 'default'">{{ (item.is_active ? 'GL.ACTIVE' : 'GL.INACTIVE') | translate }}</nz-tag>
    </ng-template>
    <ng-template #actionsTpl let-item>
      @if (canWrite) {
        <button nz-button nzSize="small" type="button" (click)="openModal(item)" appIconAction="edit"></button>
      }
    </ng-template>

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="'GL.DIMENSION_FORM' | translate"
      [nzOkLoading]="saving()"
      (nzOnOk)="save()"
      (nzOnCancel)="modalOpen.set(false)"
      okAction="save"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="dim-code">{{ 'GL.COL_CODE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.code.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
              <input id="dim-code" nz-input formControlName="code" maxlength="50" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="dim-name">{{ 'GL.COL_NAME' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.name.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
              <input id="dim-name" nz-input formControlName="name" maxlength="255" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="dim-active">{{ 'GL.ACTIVE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-switch id="dim-active" formControlName="is_active" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class GlDimensionTableComponent {
  readonly kind = input.required<'cost' | 'profit'>();

  private readonly api = inject(GeneralLedgerApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly lookups = inject(GlLookupStore);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly grid = new FetchGridModel<Dimension>((query) =>
    this.kind() === 'cost' ? this.api.getCostCenters(query) : this.api.getProfitCenters(query),
  );
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  private editingId: string | null = null;

  protected readonly form = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.maxLength(50)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    is_active: this.fb.control(true),
  });

  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: Dimension; value: unknown }>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<Dimension>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'code', header: 'GL.COL_CODE' },
      { key: 'name', header: 'GL.COL_NAME' },
      {
        key: 'is_active',
        serverKey: 'activity_state',
        header: 'GL.STATUS',
        valueLabel: (value) => this.i18n.translate(value === 'active' ? 'GL.ACTIVE' : 'GL.INACTIVE'),
        customCellTemplate: this.statusTpl(),
      },
    ];
  });

  protected openModal(item: Dimension | null): void {
    this.editingId = item?.id ?? null;
    this.form.reset({ code: item?.code ?? '', name: item?.name ?? '', is_active: item?.is_active ?? true });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.form.getRawValue();
    const cost = this.kind() === 'cost';
    const id = this.editingId;
    const call = id
      ? cost
        ? this.api.updateCostCenter(id, payload)
        : this.api.updateProfitCenter(id, payload)
      : cost
        ? this.api.createCostCenter(payload)
        : this.api.createProfitCenter(payload);
    this.saving.set(true);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.lookups.load(true);
        this.grid.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        applyServerErrors(this.form, err);
      },
    });
  }
}
