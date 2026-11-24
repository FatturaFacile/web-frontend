import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DISCOUNT_MODES,
  DiscountMode,
  InventoryApiService,
  PRICING_CHANNELS,
  PriceListItem,
  PricingApiService,
  PricingChannel,
  PricingPriceHistory,
  PricingPriceListItem,
  PricingRoundingMode,
  ProductItem,
  TranslateService,
} from '@core';
import {
  IconActionDirective,
  ModalActionsDirective,
  PageHeaderComponent,
  TranslatePipe,
} from '@shared';
import { apiErrorText, blankToNull, decimalOrNull } from '../rebates/rebates.util';
import { parseDiscountCascade, previewCascade } from './pricing.util';

/**
 * Price list manager: lists with currency, channel, Swiss 0.05 rounding and validity; items and quantity tiers with a
 * cascading discount (live preview); the immutable price change history in a drawer.
 */
@Component({
  selector: 'app-pricing-price-lists',
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
    NzDrawerModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'PRICING.LISTS_TITLE' | translate"
      [subtitle]="'PRICING.LISTS_SUBTITLE' | translate"
    >
      <button nz-button nzType="primary" (click)="openListModal()" appIconAction="create"></button>
    </app-page-header>

    <nz-card>
      <nz-table #table [nzData]="lists()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'PRICING.CODE' | translate }}</th>
            <th>{{ 'PRICING.NAME' | translate }}</th>
            <th>{{ 'PRICING.CURRENCY' | translate }}</th>
            <th>{{ 'PRICING.CHANNEL' | translate }}</th>
            <th>{{ 'PRICING.ROUNDING' | translate }}</th>
            <th>{{ 'PRICING.VALIDITY' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.code }}</td>
              <td>
                {{ row.name }}
                @if (row.is_default) {
                  <nz-tag nzColor="blue">{{ 'PRICING.DEFAULT' | translate }}</nz-tag>
                }
                @if (row.is_active === false) {
                  <nz-tag>{{ 'PRICING.INACTIVE' | translate }}</nz-tag>
                }
              </td>
              <td>{{ row.currency }}</td>
              <td>{{ 'PRICING.CHANNEL_' + (row.channel ?? 'DEFAULT') | translate }}</td>
              <td>{{ 'PRICING.ROUNDING_' + (row.rounding_mode ?? 'NONE') | translate }}</td>
              <td>{{ row.valid_from ?? '…' }} - {{ row.valid_to ?? '…' }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" (click)="openItems(row)">
                    {{ 'PRICING.ITEMS' | translate }}
                  </button>
                  <button nz-button nzType="text" (click)="openHistory(row)">
                    {{ 'PRICING.HISTORY' | translate }}
                  </button>
                  <button
                    nz-button
                    nzType="text"
                    appIconAction="edit"
                    (click)="openListModal(row)"
                  ></button>
                  <button
                    nz-button
                    nzType="text"
                    nzDanger
                    appIconAction="delete"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'PRICING.DELETE_CONFIRM' | translate"
                    (nzOnConfirm)="removeList(row)"
                  ></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && lists().length === 0) {
        <nz-empty [nzNotFoundContent]="'PRICING.NO_LISTS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions
      [(nzVisible)]="listModalVisible"
      [nzTitle]="(editingList() ? 'PRICING.EDIT_LIST' : 'PRICING.NEW_LIST') | translate"
      (nzOnCancel)="listModalVisible.set(false)"
      (nzOnOk)="saveList()"
      okAction="save"
      [nzOkDisabled]="listForm.invalid"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="listForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="pl-name">{{
              'PRICING.NAME' | translate
            }}</nz-form-label>
            <nz-form-control
              ><input nz-input id="pl-name" formControlName="name" maxlength="100"
            /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="pl-code">{{ 'PRICING.CODE' | translate }}</nz-form-label>
            <nz-form-control
              ><input nz-input id="pl-code" formControlName="code" maxlength="40"
            /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="pl-currency">{{
              'PRICING.CURRENCY' | translate
            }}</nz-form-label>
            <nz-form-control
              ><input nz-input id="pl-currency" formControlName="currency" maxlength="3"
            /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="pl-channel">{{ 'PRICING.CHANNEL' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select id="pl-channel" formControlName="channel">
                @for (channel of channels; track channel) {
                  <nz-option
                    [nzValue]="channel"
                    [nzLabel]="'PRICING.CHANNEL_' + channel | translate"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'PRICING.SWISS_ROUNDING' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-switch
                formControlName="swiss_rounding"
                [attr.aria-label]="'PRICING.SWISS_ROUNDING' | translate"
              ></nz-switch>
              <div class="muted">{{ 'PRICING.SWISS_ROUNDING_HELP' | translate }}</div>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="pl-from">{{ 'PRICING.VALID_FROM' | translate }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="pl-from" type="date" formControlName="valid_from"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="pl-to">{{ 'PRICING.VALID_TO' | translate }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="pl-to" type="date" formControlName="valid_to"
              /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="pl-priority">{{ 'PRICING.PRIORITY' | translate }}</nz-form-label>
            <nz-form-control
              ><input nz-input id="pl-priority" type="number" formControlName="priority"
            /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control>
              <nz-switch
                formControlName="is_default"
                [attr.aria-label]="'PRICING.DEFAULT' | translate"
              ></nz-switch>
              {{ 'PRICING.DEFAULT' | translate }}
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-drawer
      [nzVisible]="itemsVisible()"
      nzWidth="860"
      [nzTitle]="(currentList()?.name ?? '') + ' · ' + ('PRICING.ITEMS' | translate)"
      (nzOnClose)="itemsVisible.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form nz-form [formGroup]="itemForm" nzLayout="vertical" (ngSubmit)="saveItem()">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="it-product">{{
                'PRICING.PRODUCT' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select id="it-product" formControlName="product_id" nzShowSearch>
                  @for (product of products(); track product.id) {
                    <nz-option
                      [nzValue]="product.id"
                      [nzLabel]="product.sku + ' · ' + product.name"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="it-price">{{
                'PRICING.PRICE' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="it-price"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="price"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="it-min">{{ 'PRICING.MIN_QUANTITY' | translate }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="it-min"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="min_quantity"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="it-max">{{ 'PRICING.MAX_QUANTITY' | translate }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="it-max"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="max_quantity"
              /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="it-cascade">{{ 'PRICING.CASCADE' | translate }}</nz-form-label>
              <nz-form-control
                [nzErrorTip]="'PRICING.CASCADE_INVALID' | translate"
                [nzValidateStatus]="cascadeValid() ? '' : 'error'"
              >
                <input
                  nz-input
                  id="it-cascade"
                  formControlName="discount_cascade"
                  placeholder="30+5+2"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="it-mode">{{
                'PRICING.DISCOUNT_MODE' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select id="it-mode" formControlName="discount_mode">
                  @for (mode of modes; track mode) {
                    <nz-option
                      [nzValue]="mode"
                      [nzLabel]="'PRICING.MODE_' + mode | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <p class="cascade-preview" data-testid="cascade-preview" aria-live="polite">
            @if (cascadeValid()) {
              {{ 'PRICING.PREVIEW' | translate }}: {{ preview().net | number: '1.2-4' }} ({{
                preview().effectivePercent | number: '1.0-2'
              }}
              %) → {{ preview().rounded | number: '1.2-4' }}
            } @else {
              {{ 'PRICING.CASCADE_INVALID' | translate }}
            }
          </p>
          <button
            nz-button
            nzType="primary"
            type="submit"
            [disabled]="itemForm.invalid || !cascadeValid()"
          >
            {{ 'PRICING.ADD_ITEM' | translate }}
          </button>
        </form>

        <nz-table
          #itemsTable
          [nzData]="items()"
          [nzLoading]="itemsLoading()"
          nzSize="small"
          [nzPageSize]="50"
        >
          <thead>
            <tr>
              <th>{{ 'PRICING.PRODUCT' | translate }}</th>
              <th class="num">{{ 'PRICING.PRICE' | translate }}</th>
              <th>{{ 'PRICING.TIER' | translate }}</th>
              <th>{{ 'PRICING.CASCADE' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (item of itemsTable.data; track item.id) {
              <tr>
                <td>{{ productLabel(item.product_id) }}</td>
                <td class="num">{{ item.price | number: '1.2-4' }}</td>
                <td>
                  {{ item.min_quantity | number: '1.0-4'
                  }}{{ item.max_quantity ? ' - ' + (item.max_quantity | number: '1.0-4') : '+' }}
                </td>
                <td>{{ item.discount_cascade ?? '' }}</td>
                <td>
                  <button
                    nz-button
                    nzType="text"
                    appIconAction="edit"
                    (click)="editItem(item)"
                  ></button>
                  <button
                    nz-button
                    nzType="text"
                    nzDanger
                    appIconAction="delete"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'PRICING.DELETE_CONFIRM' | translate"
                    (nzOnConfirm)="removeItem(item)"
                  ></button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </ng-container>
    </nz-drawer>

    <nz-drawer
      [nzVisible]="historyVisible()"
      nzWidth="860"
      [nzTitle]="(currentList()?.name ?? '') + ' · ' + ('PRICING.HISTORY' | translate)"
      (nzOnClose)="historyVisible.set(false)"
    >
      <ng-container *nzDrawerContent>
        <nz-table
          #historyTable
          [nzData]="history()"
          [nzLoading]="historyLoading()"
          nzSize="small"
          [nzPageSize]="25"
        >
          <thead>
            <tr>
              <th>{{ 'PRICING.WHEN' | translate }}</th>
              <th>{{ 'PRICING.AUTHOR' | translate }}</th>
              <th>{{ 'PRICING.PRODUCT' | translate }}</th>
              <th>{{ 'PRICING.OLD_VALUE' | translate }}</th>
              <th>{{ 'PRICING.NEW_VALUE' | translate }}</th>
              <th>{{ 'PRICING.REASON' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of historyTable.data; track entry.id) {
              <tr>
                <td>{{ entry.effective_at }}</td>
                <td>{{ entry.changed_by_name ?? '-' }}</td>
                <td>{{ entry.product_id ? productLabel(entry.product_id) : '' }}</td>
                <td>
                  {{ entry.old_price ?? '-' }}
                  {{ entry.old_discount_cascade ? '(' + entry.old_discount_cascade + ')' : '' }}
                </td>
                <td>
                  {{ entry.new_price ?? '-' }}
                  {{ entry.new_discount_cascade ? '(' + entry.new_discount_cascade + ')' : '' }}
                </td>
                <td>{{ entry.reason ?? '' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </ng-container>
    </nz-drawer>
  `,
  styleUrl: './pricing.scss',
})
export class PricingPriceListsComponent implements OnInit {
  private readonly inventory = inject(InventoryApiService);
  private readonly api = inject(PricingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly channels = PRICING_CHANNELS;
  readonly modes = DISCOUNT_MODES;

  readonly lists = signal<PriceListItem[]>([]);
  readonly products = signal<ProductItem[]>([]);
  readonly loading = signal(false);
  readonly listModalVisible = signal(false);
  readonly editingList = signal<PriceListItem | null>(null);
  readonly currentList = signal<PriceListItem | null>(null);
  readonly itemsVisible = signal(false);
  readonly itemsLoading = signal(false);
  readonly items = signal<PricingPriceListItem[]>([]);
  readonly editingItem = signal<PricingPriceListItem | null>(null);
  readonly historyVisible = signal(false);
  readonly historyLoading = signal(false);
  readonly history = signal<PricingPriceHistory[]>([]);

  readonly listForm = this.fb.group({
    name: ['', [Validators.required]],
    code: [''],
    currency: ['CHF', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    channel: ['DEFAULT' as PricingChannel],
    swiss_rounding: [false],
    valid_from: [''],
    valid_to: [''],
    priority: [0],
    is_default: [false],
  });

  readonly itemForm = this.fb.group({
    product_id: ['', [Validators.required]],
    price: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    min_quantity: this.fb.control<number | null>(null),
    max_quantity: this.fb.control<number | null>(null),
    discount_cascade: [''],
    discount_mode: ['MULTIPLICATIVE' as DiscountMode],
  });

  private readonly itemValue = signal(this.itemForm.getRawValue());

  readonly cascadeValid = computed(
    () => parseDiscountCascade(this.itemValue().discount_cascade) !== null,
  );
  readonly preview = computed(() => {
    const value = this.itemValue();
    const rounding: PricingRoundingMode =
      this.currentList()?.rounding_mode === 'SWISS_005' ? 'SWISS_005' : 'NONE';
    return previewCascade(
      Number(value.price ?? 0),
      value.discount_cascade,
      value.discount_mode,
      rounding,
    );
  });

  ngOnInit(): void {
    this.itemForm.valueChanges.subscribe(() => this.itemValue.set(this.itemForm.getRawValue()));
    this.load();
    this.inventory
      .getProducts({ per_page: 100 })
      .subscribe({
        next: (response) => this.products.set(response.data),
        error: () => this.products.set([]),
      });
  }

  load(): void {
    this.loading.set(true);
    this.inventory.getPriceLists().subscribe({
      next: (response) => {
        this.lists.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PRICING.ACTION_ERROR'));
      },
    });
  }

  productLabel(id: string): string {
    const product = this.products().find((candidate) => candidate.id === id);
    return product ? `${product.sku} · ${product.name}` : id;
  }

  openListModal(list: PriceListItem | null = null): void {
    this.editingList.set(list);
    this.listForm.reset({
      name: list?.name ?? '',
      code: list?.code ?? '',
      currency: list?.currency ?? 'CHF',
      channel: (list?.channel as PricingChannel | null | undefined) ?? 'DEFAULT',
      swiss_rounding: list?.rounding_mode === 'SWISS_005',
      valid_from: list?.valid_from ?? '',
      valid_to: list?.valid_to ?? '',
      priority: list?.priority ?? 0,
      is_default: list?.is_default ?? false,
    });
    this.listModalVisible.set(true);
  }

  saveList(): void {
    const value = this.listForm.getRawValue();
    const payload = {
      name: value.name,
      code: blankToNull(value.code),
      currency: value.currency.toUpperCase(),
      channel: value.channel,
      rounding_mode: value.swiss_rounding ? 'SWISS_005' : 'NONE',
      valid_from: blankToNull(value.valid_from),
      valid_to: blankToNull(value.valid_to),
      priority: value.priority,
      is_default: value.is_default,
    };
    const current = this.editingList();
    const request = current
      ? this.inventory.updatePriceList(current.id, payload)
      : this.inventory.createPriceList(payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRICING.SAVED'));
        this.listModalVisible.set(false);
        this.load();
      },
      error: (error: unknown) =>
        this.message.error(apiErrorText(error) ?? this.translate.instant('PRICING.ACTION_ERROR')),
    });
  }

  removeList(list: PriceListItem): void {
    this.inventory.deletePriceList(list.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRICING.DELETED'));
        this.load();
      },
      error: (error: unknown) =>
        this.message.error(apiErrorText(error) ?? this.translate.instant('PRICING.ACTION_ERROR')),
    });
  }

  openItems(list: PriceListItem): void {
    this.currentList.set(list);
    this.itemsVisible.set(true);
    this.loadItems();
  }

  loadItems(): void {
    const list = this.currentList();
    if (!list) {
      return;
    }
    this.itemsLoading.set(true);
    this.api.getItems(list.id).subscribe({
      next: (response) => {
        this.items.set(response.data);
        this.itemsLoading.set(false);
      },
      error: () => this.itemsLoading.set(false),
    });
  }

  editItem(item: PricingPriceListItem): void {
    this.editingItem.set(item);
    this.itemForm.patchValue({
      product_id: item.product_id,
      price: Number(item.price),
      min_quantity: item.min_quantity ? Number(item.min_quantity) : null,
      max_quantity: item.max_quantity ? Number(item.max_quantity) : null,
      discount_cascade: item.discount_cascade ?? '',
      discount_mode: (item.discount_mode as DiscountMode | undefined) ?? 'MULTIPLICATIVE',
    });
  }

  saveItem(): void {
    const list = this.currentList();
    if (!list || this.itemForm.invalid || !this.cascadeValid()) {
      return;
    }
    const value = this.itemForm.getRawValue();
    const payload = {
      product_id: value.product_id,
      price: String(value.price),
      min_quantity: decimalOrNull(value.min_quantity),
      max_quantity: decimalOrNull(value.max_quantity),
      discount_cascade: blankToNull(value.discount_cascade),
      discount_mode: value.discount_mode,
    };
    const editing = this.editingItem();
    const request$ = editing
      ? this.api.updateItem(list.id, editing.id, payload)
      : this.api.createItem(list.id, payload);

    request$.subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRICING.SAVED'));
        this.editingItem.set(null);
        this.itemForm.reset({
          product_id: '',
          price: null,
          min_quantity: null,
          max_quantity: null,
          discount_cascade: '',
          discount_mode: 'MULTIPLICATIVE',
        });
        this.loadItems();
      },
      error: (error: unknown) =>
        this.message.error(apiErrorText(error) ?? this.translate.instant('PRICING.ACTION_ERROR')),
    });
  }

  removeItem(item: PricingPriceListItem): void {
    const list = this.currentList();
    if (!list) {
      return;
    }
    this.api
      .deleteItem(list.id, item.id)
      .subscribe({
        next: () => this.loadItems(),
        error: () => this.message.error(this.translate.instant('PRICING.ACTION_ERROR')),
      });
  }

  openHistory(list: PriceListItem): void {
    this.currentList.set(list);
    this.historyVisible.set(true);
    this.historyLoading.set(true);
    this.api.getHistory({ price_list_id: list.id, per_page: 100 }).subscribe({
      next: (response) => {
        this.history.set(response.data);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }
}
