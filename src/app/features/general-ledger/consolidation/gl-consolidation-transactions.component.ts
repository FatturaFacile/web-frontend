import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  IntragroupAssetType,
  IntragroupTransaction,
  PermissionsService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlConsolidationAccountStore } from './gl-consolidation-account.store';
import { memberName, nullable } from './gl-consolidation.util';

/** Intragroup sales of goods or fixed assets whose unrealised margin the run eliminates. */
@Component({
  selector: 'app-gl-consolidation-transactions',
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
      <span class="muted">{{ 'GL.CONS_TRANSACTIONS_HINT' | translate }}</span>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()" appIconAction="create"></button>
      }
    </div>
    <nz-table #table nzSize="small" [nzData]="transactions()" [nzLoading]="loading()" [nzShowPagination]="false" [nzScroll]="{ x: '900px' }">
      <thead>
        <tr>
          <th>{{ 'GL.COL_DATE' | translate }}</th>
          <th>{{ 'GL.CONS_SELLER' | translate }}</th>
          <th>{{ 'GL.CONS_BUYER' | translate }}</th>
          <th>{{ 'GL.CONS_ASSET_TYPE' | translate }}</th>
          <th>{{ 'GL.COL_DESCRIPTION' | translate }}</th>
          <th class="num">{{ 'GL.CONS_SALE_PRICE' | translate }}</th>
          <th class="num">{{ 'GL.CONS_SELLER_COST' | translate }}</th>
          <th class="num">{{ 'GL.CONS_MARGIN' | translate }}</th>
          <th class="num">{{ 'GL.CONS_REMAINING' | translate }}</th>
          <th>{{ 'GL.COL_ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (item of table.data; track item.id) {
          <tr>
            <td>{{ item.transaction_date }}</td>
            <td>{{ name(item.seller_tenant_id) }}</td>
            <td>{{ name(item.buyer_tenant_id) }}</td>
            <td>{{ 'GL.CONS_ASSET_' + item.asset_type.toUpperCase() | translate }}</td>
            <td>{{ item.description }}</td>
            <td class="num">{{ item.sale_price ?? '' }}</td>
            <td class="num">{{ item.seller_cost ?? '' }}</td>
            <td class="num">{{ item.margin_amount ?? '' }}</td>
            <td class="num">{{ item.remaining_percentage ?? '' }}</td>
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
                  (nzOnConfirm)="remove(item)"
                ></button>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal appModalActions
      [nzVisible]="modalOpen()"
      [nzTitle]="'GL.CONS_TRANSACTION_NEW' | translate"
      nzWidth="820px"
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
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ct-seller">{{ 'GL.CONS_SELLER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.seller_tenant_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <nz-select id="ct-seller" formControlName="seller_tenant_id">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ct-buyer">{{ 'GL.CONS_BUYER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.buyer_tenant_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <nz-select id="ct-buyer" formControlName="buyer_tenant_id">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ct-type">{{ 'GL.CONS_ASSET_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="ct-type" formControlName="asset_type">
                  @for (type of assetTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="'GL.CONS_ASSET_' + type.toUpperCase() | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ct-date">{{ 'GL.COL_DATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.transaction_date.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <input id="ct-date" nz-input type="date" formControlName="transaction_date" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ct-relation">{{ 'GL.CONS_RELATION' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="ct-relation" formControlName="relation_id" nzAllowClear>
                  @for (relation of group().relations ?? []; track relation.id) {
                    <nz-option [nzValue]="relation.id" [nzLabel]="name(relation.entity_a_tenant_id) + ' / ' + name(relation.entity_b_tenant_id)" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="ct-desc">{{ 'GL.COL_DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control>
              <input id="ct-desc" nz-input formControlName="description" maxlength="255" />
            </nz-form-control>
          </nz-form-item>
          <p class="muted">{{ 'GL.CONS_MARGIN_HINT' | translate }}</p>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="ct-price">{{ 'GL.CONS_SALE_PRICE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.sale_price.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="ct-price" formControlName="sale_price" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ct-cost">{{ 'GL.CONS_SELLER_COST' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.seller_cost.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="ct-cost" formControlName="seller_cost" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ct-margin">{{ 'GL.CONS_MARGIN' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.margin_amount.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="ct-margin" formControlName="margin_amount" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="ct-remaining">{{ 'GL.CONS_REMAINING' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.remaining_percentage.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="ct-remaining" formControlName="remaining_percentage" [nzMin]="0" [nzMax]="100" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ct-opening">{{ 'GL.CONS_OPENING_REMAINING' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.opening_remaining_percentage.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="ct-opening" formControlName="opening_remaining_percentage" [nzMin]="0" [nzMax]="100" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ct-life">{{ 'GL.CONS_USEFUL_LIFE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.useful_life_years.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="ct-life" formControlName="useful_life_years" [nzMin]="1" [nzMax]="100" [nzPrecision]="0" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ct-asset">{{ 'GL.CONS_ASSET_ACCOUNT_BUYER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.asset_account_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
              <nz-select id="ct-asset" formControlName="asset_account_id" nzShowSearch>
                @for (account of accounts.accountsOf(buyer()); track account.id) {
                  <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' ' + account.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ct-profit">{{ 'GL.CONS_PROFIT_ACCOUNT_SELLER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.profit_account_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
              <nz-select id="ct-profit" formControlName="profit_account_id" nzShowSearch>
                @for (account of accounts.accountsOf(seller()); track account.id) {
                  <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' ' + account.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ct-dep">{{ 'GL.CONS_DEPRECIATION_ACCOUNT_BUYER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.depreciation_account_id.errors?.['serverError'] ?? ''">
              <nz-select id="ct-dep" formControlName="depreciation_account_id" nzShowSearch nzAllowClear>
                @for (account of accounts.accountsOf(buyer()); track account.id) {
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
export class GlConsolidationTransactionsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly accounts = inject(GlConsolidationAccountStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  readonly group = input.required<ConsolidationGroup>();

  protected readonly assetTypes: IntragroupAssetType[] = ['inventory', 'fixed_asset'];
  protected readonly members = computed(() => this.group().members ?? []);
  protected readonly transactions = signal<IntragroupTransaction[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly formError = signal<unknown>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly seller = signal<string | null>(null);
  protected readonly buyer = signal<string | null>(null);

  protected readonly form = this.fb.group({
    relation_id: this.fb.control<string | null>(null),
    seller_tenant_id: this.fb.control('', Validators.required),
    buyer_tenant_id: this.fb.control('', Validators.required),
    asset_type: this.fb.control<IntragroupAssetType>('inventory', Validators.required),
    description: this.fb.control('', Validators.maxLength(255)),
    transaction_date: this.fb.control('', Validators.required),
    sale_price: this.fb.control<number | null>(null),
    seller_cost: this.fb.control<number | null>(null),
    margin_amount: this.fb.control<number | null>(null),
    remaining_percentage: this.fb.control<number | null>(null),
    opening_remaining_percentage: this.fb.control<number | null>(null),
    useful_life_years: this.fb.control<number | null>(null),
    asset_account_id: this.fb.control('', Validators.required),
    profit_account_id: this.fb.control('', Validators.required),
    depreciation_account_id: this.fb.control<string | null>(null),
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.form.controls.seller_tenant_id.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((tenantId) => {
      this.seller.set(tenantId || null);
      this.form.controls.profit_account_id.reset('');
      this.accounts.load(tenantId);
    });
    this.form.controls.buyer_tenant_id.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((tenantId) => {
      this.buyer.set(tenantId || null);
      this.form.controls.asset_account_id.reset('');
      this.form.controls.depreciation_account_id.reset(null);
      this.accounts.load(tenantId);
    });
  }

  ngOnInit(): void {
    this.load();
  }

  protected name(tenantId: string): string {
    return memberName(this.group(), tenantId);
  }

  protected openCreate(): void {
    this.form.reset({ asset_type: 'inventory' });
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
      .createIntragroupTransaction(this.group().id, {
        relation_id: nullable(value.relation_id),
        seller_tenant_id: value.seller_tenant_id,
        buyer_tenant_id: value.buyer_tenant_id,
        asset_type: value.asset_type,
        description: nullable(value.description),
        transaction_date: value.transaction_date,
        sale_price: value.sale_price,
        seller_cost: value.seller_cost,
        margin_amount: value.margin_amount,
        remaining_percentage: value.remaining_percentage,
        opening_remaining_percentage: value.opening_remaining_percentage,
        useful_life_years: value.useful_life_years,
        asset_account_id: value.asset_account_id,
        profit_account_id: value.profit_account_id,
        depreciation_account_id: nullable(value.depreciation_account_id),
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

  protected remove(item: IntragroupTransaction): void {
    this.api.deleteIntragroupTransaction(item.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.CONS_DELETED'));
        this.load();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.getIntragroupTransactions(this.group().id).subscribe({
      next: (res) => {
        this.transactions.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err);
        this.loading.set(false);
      },
    });
  }
}
