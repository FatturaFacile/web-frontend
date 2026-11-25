import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BudgetActualVolume, BudgetDecomposition, BudgetingApiService, DECOMPOSITION_GROUPS, DecompositionGroup, PermissionsService, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { BudgetingDimensionsComponent } from './budgeting-dimensions.component';
import { apiErrorText, blankToNull, OPTIONAL_UUID_PATTERN } from './budgeting.util';

/**
 * Volume and price variance of a version: volume = (actual quantity - budget quantity) x budget price, price = the rest,
 * so that volume + price = actual - budget. Groups without both quantities are shown with their monetary variance only.
 * The actual quantities are entered here by account and month.
 */
@Component({
  selector: 'app-budgeting-volume-price',
  styleUrl: './budgeting.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    BudgetingDimensionsComponent,
    IconActionDirective,
    ModalActionsDirective,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <div class="toolbar">
      <nz-select style="width: 220px" [ngModel]="groupBy()" (ngModelChange)="groupBy.set($event); load()" [attr.aria-label]="'BUDGETING.GROUP_BY' | translate">
        @for (value of groups; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('BUDGETING.GROUP_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 220px" [ngModel]="throughPeriod()" (ngModelChange)="throughPeriod.set($event); load()" [attr.aria-label]="'BUDGETING.THROUGH_PERIOD' | translate">
        @for (period of periods; track period) {
          <nz-option [nzValue]="period" [nzLabel]="('BUDGETING.THROUGH_PERIOD_N' | translate: { period: period })"></nz-option>
        }
      </nz-select>
      <span class="spacer"></span>
      @if (canManage) {
        <button nz-button (click)="openVolume()">{{ 'BUDGETING_CONTROL.ADD_ACTUAL_VOLUME' | translate }}</button>
      }
    </div>

    @if (decomposition(); as data) {
      <div class="stats-grid">
        <nz-card>{{ 'BUDGETING.VARIANCE' | translate }}: <strong>{{ data.totals.variance | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING_CONTROL.VOLUME_VARIANCE' | translate }}: <strong>{{ data.totals.volume_variance | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING_CONTROL.PRICE_VARIANCE' | translate }}: <strong>{{ data.totals.price_variance | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING_CONTROL.UNDECOMPOSED_VARIANCE' | translate }}: <strong>{{ data.totals.undecomposed_variance | number: '1.2-2' }}</strong></nz-card>
      </div>
      <p class="muted">{{ 'BUDGETING_CONTROL.DECOMPOSITION_HINT' | translate }}</p>

      <nz-card class="main-card">
        <nz-table #table [nzData]="data.rows" nzSize="small" [nzPageSize]="50">
          <thead>
            <tr>
              <th>{{ 'BUDGETING.GROUP_' + data.group_by.toUpperCase() | translate }}</th>
              <th class="num">{{ 'BUDGETING.BUDGET' | translate }}</th>
              <th class="num">{{ 'BUDGETING.ACTUAL' | translate }}</th>
              <th class="num">{{ 'BUDGETING.VARIANCE' | translate }}</th>
              <th class="num">{{ 'BUDGETING_CONTROL.BUDGET_QUANTITY' | translate }}</th>
              <th class="num">{{ 'BUDGETING_CONTROL.ACTUAL_QUANTITY' | translate }}</th>
              <th class="num">{{ 'BUDGETING_CONTROL.BUDGET_PRICE' | translate }}</th>
              <th class="num">{{ 'BUDGETING_CONTROL.ACTUAL_PRICE' | translate }}</th>
              <th class="num">{{ 'BUDGETING_CONTROL.VOLUME_VARIANCE' | translate }}</th>
              <th class="num">{{ 'BUDGETING_CONTROL.PRICE_VARIANCE' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.key) {
              <tr>
                <td>{{ row.code }} <span class="muted">{{ row.label }}</span></td>
                <td class="num">{{ row.budget | number: '1.2-2' }}</td>
                <td class="num">{{ row.actual | number: '1.2-2' }}</td>
                <td class="num" [class.row-overdue]="!row.is_favorable" [class.row-ok]="row.is_favorable && row.variance !== '0.00'">{{ row.variance | number: '1.2-2' }}</td>
                <td class="num">{{ row.budget_quantity !== null ? (row.budget_quantity | number: '1.0-3') : '' }}</td>
                <td class="num">{{ row.actual_quantity !== null ? (row.actual_quantity | number: '1.0-3') : '' }}</td>
                <td class="num">{{ row.budget_price !== null ? (row.budget_price | number: '1.2-4') : '' }}</td>
                <td class="num">{{ row.actual_price !== null ? (row.actual_price | number: '1.2-4') : '' }}</td>
                <td class="num">{{ row.volume_variance !== null ? (row.volume_variance | number: '1.2-2') : '' }}</td>
                <td class="num">{{ row.price_variance !== null ? (row.price_variance | number: '1.2-2') : '' }}</td>
                <td>
                  @if (!row.decomposable) {
                    <nz-tag>{{ 'BUDGETING_CONTROL.NOT_DECOMPOSABLE' | translate }}</nz-tag>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.rows.length === 0) {
          <nz-empty [nzNotFoundContent]="'BUDGETING.NO_DATA' | translate"></nz-empty>
        }
      </nz-card>
    }

    <nz-card class="main-card" [nzTitle]="'BUDGETING_CONTROL.ACTUAL_VOLUMES' | translate">
      <nz-table #volumeTable [nzData]="volumes()" nzSize="small" [nzPageSize]="10">
        <thead>
          <tr>
            <th>{{ 'BUDGETING_CONTROL.MONTH' | translate }}</th>
            <th>{{ 'BUDGETING.ACCOUNT' | translate }}</th>
            <th>{{ 'BUDGETING.COST_CENTER' | translate }}</th>
            <th class="num">{{ 'BUDGETING_CONTROL.QUANTITY' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of volumeTable.data; track row.id) {
            <tr>
              <td>{{ row.month }}</td>
              <td>{{ row.account_id }}</td>
              <td>{{ row.cost_center_id }}</td>
              <td class="num">{{ row.quantity | number: '1.0-3' }}</td>
              <td>
                @if (canManage) {
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'BUDGETING.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeVolume(row)"></button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (volumes().length === 0) {
        <nz-empty [nzNotFoundContent]="'BUDGETING_CONTROL.NO_ACTUAL_VOLUMES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="volumeVisible" [nzTitle]="'BUDGETING_CONTROL.ADD_ACTUAL_VOLUME' | translate" (nzOnCancel)="volumeVisible.set(false)" (nzOnOk)="saveVolume()" okAction="save" [nzOkDisabled]="volumeForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="volumeForm" nzLayout="vertical">
          <app-budgeting-dimensions [group]="volumeForm" [accountRequired]="true" />
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="volume-month">{{ 'BUDGETING_CONTROL.MONTH' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="volume-month" type="month" formControlName="month" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="volume-quantity">{{ 'BUDGETING_CONTROL.QUANTITY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="volume-quantity" type="number" min="0" step="any" formControlName="quantity" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class BudgetingVolumePriceComponent {
  private readonly api = inject(BudgetingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly versionId = input.required<string>();
  readonly refresh = input(0);

  readonly canManage = inject(PermissionsService).canWrite('budgeting_control');
  readonly groups = DECOMPOSITION_GROUPS;
  readonly periods = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  readonly groupBy = signal<DecompositionGroup>('account');
  readonly throughPeriod = signal(12);
  readonly decomposition = signal<BudgetDecomposition | null>(null);
  readonly volumes = signal<BudgetActualVolume[]>([]);
  readonly volumeVisible = signal(false);

  readonly volumeForm = this.fb.group({
    account_id: ['', [Validators.required]],
    cost_center_id: this.fb.control<string | null>(null),
    project_id: ['', [Validators.pattern(OPTIONAL_UUID_PATTERN)]],
    month: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}$/)]],
    quantity: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  constructor() {
    effect(() => {
      this.versionId();
      this.refresh();
      this.load();
    });
  }

  load(): void {
    this.api.getDecomposition(this.versionId(), this.throughPeriod(), this.groupBy()).subscribe({
      next: (response) => this.decomposition.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
    this.loadVolumes();
  }

  loadVolumes(): void {
    this.api.getActualVolumes({ per_page: 100 }).subscribe({
      next: (response) => this.volumes.set(response.data),
      error: () => this.volumes.set([]),
    });
  }

  openVolume(): void {
    this.volumeForm.reset({ account_id: '', cost_center_id: null, project_id: '', month: '', quantity: null });
    this.volumeVisible.set(true);
  }

  saveVolume(): void {
    const value = this.volumeForm.getRawValue();
    this.api
      .saveActualVolume({ account_id: value.account_id, cost_center_id: value.cost_center_id, project_id: blankToNull(value.project_id), month: value.month, quantity: String(value.quantity) })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('BUDGETING_CONTROL.VOLUME_SAVED'));
          this.volumeVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
      });
  }

  removeVolume(volume: BudgetActualVolume): void {
    this.api.deleteActualVolume(volume.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
