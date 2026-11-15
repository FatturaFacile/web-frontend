import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  REBATE_DISCOUNT_TYPES,
  REBATE_PROMOTION_STATES,
  RebateDiscountType,
  RebatePromotion,
  RebatePromotionRequest,
  RebatePromotionState,
  RebatesApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, decimalOrNull, PROMOTION_STATE_COLORS, todayIso } from './rebates.util';

/** Trade promotions with their date range, discount and optional product, customer and minimum quantity. */
@Component({
  selector: 'app-rebates-promotions',
  styleUrl: './rebates.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
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
    <app-page-header [title]="'REBATES.PROMOTIONS_TITLE' | translate" [subtitle]="'REBATES.PROMOTIONS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 220px" nzAllowClear [ngModel]="stateFilter()" (ngModelChange)="stateFilter.set($event); load()" [nzPlaceHolder]="'REBATES.STATE' | translate">
        @for (state of states; track state) {
          <nz-option [nzValue]="state" [nzLabel]="('REBATES.STATE_' + state.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="promotions()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'REBATES.CODE' | translate }}</th>
            <th>{{ 'REBATES.NAME' | translate }}</th>
            <th class="num">{{ 'REBATES.DISCOUNT' | translate }}</th>
            <th>{{ 'REBATES.PERIOD' | translate }}</th>
            <th>{{ 'REBATES.STATE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.code }}</td>
              <td>{{ row.name }}</td>
              <td class="num">{{ row.discount_value | number: '1.0-4' }}{{ row.discount_type === 'percentage' ? ' %' : '' }}</td>
              <td>{{ row.starts_on }} - {{ row.ends_on }}</td>
              <td>
                <nz-tag [nzColor]="stateColor(row.state)">{{ ('REBATES.STATE_' + row.state.toUpperCase()) | translate }}</nz-tag>
              </td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'REBATES.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && promotions().length === 0) {
        <nz-empty [nzNotFoundContent]="'REBATES.NO_PROMOTIONS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'REBATES.EDIT_PROMOTION' : 'REBATES.NEW_PROMOTION') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pr-code">{{ 'REBATES.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="pr-code" formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pr-name">{{ 'REBATES.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="pr-name" formControlName="name" maxlength="160" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'REBATES.DISCOUNT_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="discount_type">
                  @for (type of discountTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="('REBATES.DISCOUNT_' + type.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pr-value">{{ 'REBATES.DISCOUNT_VALUE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="pr-value" type="number" min="0" step="any" formControlName="discount_value" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="pr-qty">{{ 'REBATES.MIN_QUANTITY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="pr-qty" type="number" min="0" step="any" formControlName="min_quantity" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pr-start">{{ 'REBATES.STARTS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="pr-start" type="date" formControlName="starts_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pr-end">{{ 'REBATES.ENDS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="pr-end" type="date" formControlName="ends_on" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-control><label nz-checkbox formControlName="is_active">{{ 'REBATES.IS_ACTIVE' | translate }}</label></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="pr-notes">{{ 'REBATES.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="pr-notes" rows="2" formControlName="notes" maxlength="2000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class RebatesPromotionsComponent implements OnInit {
  private readonly api = inject(RebatesApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly states = REBATE_PROMOTION_STATES;
  readonly discountTypes = REBATE_DISCOUNT_TYPES;

  readonly promotions = signal<RebatePromotion[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly editing = signal<RebatePromotion | null>(null);
  readonly stateFilter = signal<RebatePromotionState | null>(null);

  readonly form = this.fb.group({
    code: ['', [Validators.required]],
    name: ['', [Validators.required]],
    discount_type: ['percentage' as RebateDiscountType, [Validators.required]],
    discount_value: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    min_quantity: this.fb.control<number | null>(null, [Validators.min(0)]),
    starts_on: [todayIso(), [Validators.required]],
    ends_on: [todayIso(), [Validators.required]],
    is_active: [true],
    notes: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPromotions({ state: this.stateFilter() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.promotions.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('REBATES.ACTION_ERROR'));
      },
    });
  }

  stateColor(state: string): string {
    return PROMOTION_STATE_COLORS[state] ?? 'default';
  }

  openModal(promotion: RebatePromotion | null = null): void {
    this.editing.set(promotion);
    this.form.reset({
      code: promotion?.code ?? '',
      name: promotion?.name ?? '',
      discount_type: promotion?.discount_type ?? 'percentage',
      discount_value: promotion ? Number(promotion.discount_value) : null,
      min_quantity: promotion?.min_quantity ? Number(promotion.min_quantity) : null,
      starts_on: promotion?.starts_on ?? todayIso(),
      ends_on: promotion?.ends_on ?? todayIso(),
      is_active: promotion?.is_active ?? true,
      notes: promotion?.notes ?? '',
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: RebatePromotionRequest = {
      code: value.code,
      name: value.name,
      discount_type: value.discount_type,
      discount_value: String(value.discount_value),
      min_quantity: decimalOrNull(value.min_quantity),
      starts_on: value.starts_on,
      ends_on: value.ends_on,
      is_active: value.is_active,
      notes: blankToNull(value.notes),
    };
    const current = this.editing();
    const request = current ? this.api.updatePromotion(current.id, payload) : this.api.createPromotion(payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('REBATES.PROMOTION_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('REBATES.ACTION_ERROR')),
    });
  }

  remove(promotion: RebatePromotion): void {
    this.api.deletePromotion(promotion.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('REBATES.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('REBATES.ACTION_ERROR')),
    });
  }
}
