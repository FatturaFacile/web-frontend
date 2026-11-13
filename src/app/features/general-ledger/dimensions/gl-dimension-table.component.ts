import { Component, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { applyServerErrors, Dimension, GeneralLedgerApiService, PermissionsService } from '@core';
import { TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { GlLookupStore } from '../shared/gl-lookup.store';

/** List with create/edit modal of cost centres or profit centres. */
@Component({
  selector: 'app-gl-dimension-table',
  styleUrl: './gl-dimension-table.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    IconActionDirective,
    ModalActionsDirective,
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @if (canWrite) {
      <button class="mb-4" nz-button nzType="primary" type="button" (click)="openModal(null)" appIconAction="create"></button>
    }
    <nz-table #table nzSize="middle" [nzData]="items()" [nzLoading]="loading()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th [nzSortFn]="'code' | gridSort" [nzFilters]="'code' | gridFilterList: table.nzData" [nzFilterFn]="'code' | gridFilterFn">{{ 'GL.COL_CODE' | translate }}</th>
          <th [nzSortFn]="'name' | gridSort" [nzFilters]="'name' | gridFilterList: table.nzData" [nzFilterFn]="'name' | gridFilterFn">{{ 'GL.COL_NAME' | translate }}</th>
          <th>{{ 'GL.STATUS' | translate }}</th>
          <th>{{ 'GL.COL_ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (item of table.data; track item.id) {
          <tr>
            <td>{{ item.code }}</td>
            <td>{{ item.name }}</td>
            <td>
              <nz-tag [nzColor]="item.is_active ? 'green' : 'default'">{{
                (item.is_active ? 'GL.ACTIVE' : 'GL.INACTIVE') | translate
              }}</nz-tag>
            </td>
            <td>
              @if (canWrite) {
                <button nz-button nzSize="small" type="button" (click)="openModal(item)" appIconAction="edit"></button>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

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
export class GlDimensionTableComponent implements OnInit {
  readonly kind = input.required<'cost' | 'profit'>();

  private readonly api = inject(GeneralLedgerApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly lookups = inject(GlLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly items = signal<Dimension[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  private editingId: string | null = null;

  protected readonly form = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.maxLength(50)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    is_active: this.fb.control(true),
  });

  ngOnInit(): void {
    this.load();
  }

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
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        applyServerErrors(this.form, err);
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    const call = this.kind() === 'cost' ? this.api.getCostCenters() : this.api.getProfitCenters();
    call.subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
