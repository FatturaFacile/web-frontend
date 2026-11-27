import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DST_POLICIES, DstPolicy, DstRule, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  DISTRIBUTION_MODULE,
  DstOutcome,
  formatQuantity,
  numberOrNull,
  toNumber,
} from './distribution.util';
import { ReplenishmentStore } from './replenishment.store';

/** Replenishment rules per warehouse and item: policy, thresholds, preferred source, transfer multiple and lead time. */
@Component({
  selector: 'app-dst-replenishment',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [ReplenishmentStore],
  styleUrl: './distribution.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.DISTRIBUTION_REPLENISHMENT' | translate"
    ></app-page-header>

    <div class="toolbar">
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="open(null)">
          {{ 'distribution.action.newRule' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.errorKey ?? 'distribution.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.rules()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '1100px' }"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'distribution.field.warehouse' | translate }}</th>
            <th scope="col">{{ 'distribution.field.item' | translate }}</th>
            <th scope="col">{{ 'distribution.field.policy' | translate }}</th>
            <th scope="col" class="num">{{ 'distribution.field.safetyStock' | translate }}</th>
            <th scope="col" class="num">{{ 'distribution.field.reorderPoint' | translate }}</th>
            <th scope="col" class="num">{{ 'distribution.field.maxStock' | translate }}</th>
            <th scope="col">{{ 'distribution.field.sourceWarehouse' | translate }}</th>
            <th scope="col" class="num">{{ 'distribution.field.leadTimeDays' | translate }}</th>
            <th scope="col">{{ 'distribution.field.status' | translate }}</th>
            <th scope="col">{{ 'distribution.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <th scope="row">{{ row.warehouse?.code }}</th>
              <td>
                {{ row.item?.sku }} <small class="muted">{{ row.item?.name }}</small>
              </td>
              <td>{{ 'distribution.policy.' + row.policy | translate }}</td>
              <td class="num">{{ quantity(row.safety_stock) }}</td>
              <td class="num">{{ quantity(row.reorder_point) }}</td>
              <td class="num">{{ row.max_stock === null ? '—' : quantity(row.max_stock) }}</td>
              <td>{{ row.source_warehouse?.code ?? '—' }}</td>
              <td class="num">{{ row.lead_time_days }}</td>
              <td>
                <nz-tag [nzColor]="row.is_active ? 'green' : 'default'">{{
                  (row.is_active ? 'distribution.field.active' : 'distribution.field.inactive')
                    | translate
                }}</nz-tag>
              </td>
              <td class="row-actions">
                @if (canWrite) {
                  <button nz-button nzSize="small" type="button" (click)="open(row)">
                    {{ 'distribution.action.edit' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'distribution.confirm.deleteRule' | translate"
                    [nzOkText]="'distribution.action.confirm' | translate"
                    [nzCancelText]="'distribution.action.cancel' | translate"
                    (nzOnConfirm)="remove(row)"
                  >
                    {{ 'distribution.action.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="10">
                <nz-empty [nzNotFoundContent]="'distribution.empty.rules' | translate"></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="520"
      [nzTitle]="'distribution.section.rule' | translate"
      (nzOnClose)="drawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="
              failure.errorKey ?? 'distribution.error.generic' | translate: failure.params
            "
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <form [formGroup]="form" class="form" (ngSubmit)="submit()">
          <label class="field" for="dst-r-warehouse">
            <span>{{ 'distribution.field.warehouse' | translate }}</span>
            <nz-select nzId="dst-r-warehouse" formControlName="warehouse_id" nzShowSearch>
              @for (warehouse of store.lookups()?.warehouses ?? []; track warehouse.id) {
                <nz-option
                  [nzValue]="warehouse.id"
                  [nzLabel]="warehouse.code + ' ' + warehouse.name"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-r-item">
            <span>{{ 'distribution.field.item' | translate }}</span>
            <nz-select nzId="dst-r-item" formControlName="stock_item_id" nzShowSearch>
              @for (item of store.lookups()?.items ?? []; track item.id) {
                <nz-option [nzValue]="item.id" [nzLabel]="item.sku + ' ' + item.name"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-r-policy">
            <span>{{ 'distribution.field.policy' | translate }}</span>
            <nz-select nzId="dst-r-policy" formControlName="policy">
              @for (policy of policies; track policy) {
                <nz-option
                  [nzValue]="policy"
                  [nzLabel]="'distribution.policy.' + policy | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-r-source">
            <span>{{ 'distribution.field.sourceWarehouse' | translate }}</span>
            <nz-select
              nzId="dst-r-source"
              formControlName="source_warehouse_id"
              nzAllowClear
              nzShowSearch
            >
              @for (warehouse of store.lookups()?.warehouses ?? []; track warehouse.id) {
                <nz-option
                  [nzValue]="warehouse.id"
                  [nzLabel]="warehouse.code + ' ' + warehouse.name"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-r-safety">
            <span>{{ 'distribution.field.safetyStock' | translate }}</span>
            <nz-input-number
              nzId="dst-r-safety"
              formControlName="safety_stock"
              [nzMin]="0"
            ></nz-input-number>
          </label>
          <label class="field" for="dst-r-rop">
            <span>{{ 'distribution.field.reorderPoint' | translate }}</span>
            <nz-input-number
              nzId="dst-r-rop"
              formControlName="reorder_point"
              [nzMin]="0"
            ></nz-input-number>
          </label>
          @if (policy() === 'min_max') {
            <label class="field" for="dst-r-max">
              <span>{{ 'distribution.field.maxStock' | translate }}</span>
              <nz-input-number
                nzId="dst-r-max"
                formControlName="max_stock"
                [nzMin]="0"
              ></nz-input-number>
            </label>
          }
          @if (policy() === 'reorder_point_fixed_qty') {
            <label class="field" for="dst-r-fixed">
              <span>{{ 'distribution.field.fixedQuantity' | translate }}</span>
              <nz-input-number
                nzId="dst-r-fixed"
                formControlName="fixed_quantity"
                [nzMin]="0"
              ></nz-input-number>
            </label>
          }
          @if (policy() === 'periodic_review') {
            <label class="field" for="dst-r-cycle">
              <span>{{ 'distribution.field.reviewCycleDays' | translate }}</span>
              <nz-input-number
                nzId="dst-r-cycle"
                formControlName="review_cycle_days"
                [nzMin]="1"
              ></nz-input-number>
            </label>
            <label class="field" for="dst-r-dos">
              <span>{{ 'distribution.field.targetDaysOfSupply' | translate }}</span>
              <nz-input-number
                nzId="dst-r-dos"
                formControlName="target_days_of_supply"
                [nzMin]="1"
              ></nz-input-number>
            </label>
          }
          <label class="field" for="dst-r-min">
            <span>{{ 'distribution.field.minTransferQty' | translate }}</span>
            <nz-input-number
              nzId="dst-r-min"
              formControlName="min_transfer_qty"
              [nzMin]="0"
            ></nz-input-number>
          </label>
          <label class="field" for="dst-r-multiple">
            <span>{{ 'distribution.field.transferMultiple' | translate }}</span>
            <nz-input-number
              nzId="dst-r-multiple"
              formControlName="transfer_multiple"
              [nzMin]="0"
            ></nz-input-number>
          </label>
          <label class="field" for="dst-r-lead">
            <span>{{ 'distribution.field.leadTimeDays' | translate }}</span>
            <nz-input-number
              nzId="dst-r-lead"
              formControlName="lead_time_days"
              [nzMin]="0"
              [nzStep]="1"
            ></nz-input-number>
          </label>
          <label class="field" for="dst-r-priority">
            <span>{{ 'distribution.field.priority' | translate }}</span>
            <nz-input-number
              nzId="dst-r-priority"
              formControlName="priority"
              [nzMin]="1"
              [nzStep]="1"
            ></nz-input-number>
          </label>
          <label class="field">
            <span>{{ 'distribution.field.active' | translate }}</span>
            <nz-switch formControlName="is_active"></nz-switch>
          </label>
          <div class="actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="store.saving()"
              [disabled]="form.invalid"
            >
              {{ 'distribution.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="drawerOpen.set(false)">
              {{ 'distribution.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class ReplenishmentComponent implements OnInit {
  protected readonly store = inject(ReplenishmentStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(DISTRIBUTION_MODULE);
  protected readonly policies = DST_POLICIES;
  protected readonly feedback = signal<DstOutcome | null>(null);
  protected readonly formError = signal<DstOutcome | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<DstRule | null>(null);
  protected readonly policy = signal<DstPolicy>('min_max');

  protected readonly form = this.fb.group({
    warehouse_id: ['', Validators.required],
    stock_item_id: ['', Validators.required],
    policy: ['min_max' as DstPolicy, Validators.required],
    source_warehouse_id: [null as string | null],
    safety_stock: [0, [Validators.required, Validators.min(0)]],
    reorder_point: [0, [Validators.required, Validators.min(0)]],
    max_stock: [null as number | null],
    fixed_quantity: [null as number | null],
    min_transfer_qty: [null as number | null],
    transfer_multiple: [null as number | null],
    lead_time_days: [1, [Validators.required, Validators.min(0)]],
    review_cycle_days: [null as number | null],
    target_days_of_supply: [null as number | null],
    priority: [1, [Validators.required, Validators.min(1)]],
    is_active: [true],
  });

  constructor() {
    this.form.controls.policy.valueChanges.subscribe((value) => this.policy.set(value));
  }

  ngOnInit(): void {
    void this.store.load();
  }

  protected quantity(value: string | number): string {
    return formatQuantity(value);
  }

  protected open(rule: DstRule | null): void {
    this.editing.set(rule);
    this.form.reset({
      warehouse_id: rule?.warehouse_id ?? '',
      stock_item_id: rule?.stock_item_id ?? '',
      policy: rule?.policy ?? 'min_max',
      source_warehouse_id: rule?.source_warehouse_id ?? null,
      safety_stock: toNumber(rule?.safety_stock),
      reorder_point: toNumber(rule?.reorder_point),
      max_stock: numberOrNull(rule?.max_stock),
      fixed_quantity: numberOrNull(rule?.fixed_quantity),
      min_transfer_qty: numberOrNull(rule?.min_transfer_qty),
      transfer_multiple: numberOrNull(rule?.transfer_multiple),
      lead_time_days: rule?.lead_time_days ?? 1,
      review_cycle_days: rule?.review_cycle_days ?? null,
      target_days_of_supply: rule?.target_days_of_supply ?? null,
      priority: rule?.priority ?? 1,
      is_active: rule?.is_active ?? true,
    });
    this.policy.set(rule?.policy ?? 'min_max');
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  protected async submit(): Promise<void> {
    const outcome = await this.store.save(this.form.getRawValue(), this.editing()?.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('distribution.notification.saved'));
      this.drawerOpen.set(false);
    } else {
      this.formError.set(outcome);
    }
  }

  protected async remove(rule: DstRule): Promise<void> {
    const outcome = await this.store.remove(rule.id);
    this.feedback.set(outcome.ok ? null : outcome);
  }
}
