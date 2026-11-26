import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  PC_DELTA_TYPES,
  PC_LOCALES,
  PcAttribute,
  PcAttributePayload,
  PcAttributeValue,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AttributesStore } from './attributes.store';
import {
  attributeName,
  PcOutcome,
  PRODUCT_CATALOG_MODULE,
  valueLabel,
} from './product-catalog.util';

interface Draft {
  id: string | null;
  code: string;
  name: PcAttributePayload['name'];
  sku_token: string;
  values: PcAttributeValue[];
}

function emptyValue(): PcAttributeValue {
  return {
    code: '',
    label: {},
    sku_token: '',
    price_delta: null,
    price_delta_type: null,
    cost_delta: null,
    cost_delta_type: null,
  };
}

/**
 * The attributes of the variant matrices (size, colour, material, ...): names and value labels in the four languages, the SKU
 * token of every value and its price and cost surcharge (fixed or percent of the parent).
 */
@Component({
  selector: 'app-pc-attributes',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [AttributesStore],
  styleUrl: './product-catalog.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.PRODUCT_CATALOG_ATTRIBUTES' | translate"
    ></app-page-header>

    <div class="toolbar">
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()">
          {{ 'productCatalog.action.newAttribute' | translate }}
        </button>
      }
    </div>

    @if (feedback(); as failure) {
      <nz-alert
        nzType="error"
        nzShowIcon
        nzCloseable
        class="form-alert"
        [nzMessage]="failure.errorKey ?? '' | translate: failure.params"
        [nzDescription]="failure.detail"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.attributes().length === 0 && !store.loading()) {
        <nz-empty [nzNotFoundContent]="'productCatalog.empty.attributes' | translate"></nz-empty>
      } @else {
        <nz-table
          #table
          [nzData]="store.attributes()"
          nzSize="middle"
          [nzShowPagination]="false"
          [nzFrontPagination]="false"
        >
          <thead>
            <tr>
              <th>{{ 'productCatalog.field.code' | translate }}</th>
              <th>{{ 'productCatalog.field.name' | translate }}</th>
              <th>{{ 'productCatalog.column.values' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (attribute of table.data; track attribute.id) {
              <tr class="attribute-row">
                <td>{{ attribute.code }}</td>
                <td>{{ name(attribute) }}</td>
                <td>{{ valuesOf(attribute) }}</td>
                <td class="actions">
                  @if (canWrite) {
                    <button nz-button nzSize="small" type="button" (click)="openEdit(attribute)">
                      {{ 'productCatalog.action.edit' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'productCatalog.action.confirmDelete' | translate"
                      (nzOnConfirm)="remove(attribute)"
                    >
                      {{ 'productCatalog.action.delete' | translate }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-spin>

    <nz-drawer
      [nzVisible]="draft() !== null"
      nzWidth="min(960px, 100vw)"
      [nzTitle]="'PAGE_TITLE.PRODUCT_CATALOG_ATTRIBUTES' | translate"
      (nzOnClose)="draft.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (draft(); as current) {
          <div class="grid">
            <label class="field" for="pc-attr-code">
              <span>{{ 'productCatalog.field.code' | translate }}</span>
              <input
                nz-input
                id="pc-attr-code"
                [disabled]="current.id !== null"
                [ngModel]="current.code"
                (ngModelChange)="patch({ code: $event })"
              />
            </label>
            @for (locale of locales; track locale) {
              <label class="field" [for]="'pc-attr-name-' + locale">
                <span>{{ 'productCatalog.field.name' | translate }} ({{ locale }})</span>
                <input
                  nz-input
                  [id]="'pc-attr-name-' + locale"
                  [ngModel]="current.name[locale] ?? ''"
                  (ngModelChange)="patchName(locale, $event)"
                />
              </label>
            }
          </div>

          @for (value of current.values; track $index; let i = $index) {
            <div class="value-row">
              <input
                nz-input
                [attr.aria-label]="'productCatalog.field.code' | translate"
                [ngModel]="value.code"
                (ngModelChange)="patchValue(i, { code: $event })"
              />
              @for (locale of locales; track locale) {
                <input
                  nz-input
                  [attr.aria-label]="'productCatalog.field.name' | translate"
                  [placeholder]="locale"
                  [ngModel]="value.label[locale] ?? ''"
                  (ngModelChange)="patchLabel(i, locale, $event)"
                />
              }
              <input
                nz-input
                maxlength="10"
                [attr.aria-label]="'productCatalog.field.skuToken' | translate"
                [ngModel]="value.sku_token"
                (ngModelChange)="patchValue(i, { sku_token: ($event ?? '').toUpperCase() })"
              />
              <input
                nz-input
                inputmode="decimal"
                [attr.aria-label]="'productCatalog.field.priceDelta' | translate"
                [placeholder]="'productCatalog.field.priceDelta' | translate"
                [ngModel]="value.price_delta ?? ''"
                (ngModelChange)="
                  patchValue(i, {
                    price_delta: $event || null,
                    price_delta_type: $event ? (value.price_delta_type ?? 'fixed') : null,
                  })
                "
              />
              <nz-select
                [nzDisabled]="!value.price_delta"
                [ngModel]="value.price_delta_type"
                (ngModelChange)="patchValue(i, { price_delta_type: $event })"
              >
                @for (type of deltaTypes; track type) {
                  <nz-option
                    [nzValue]="type"
                    [nzLabel]="'productCatalog.deltaType.' + type | translate"
                  ></nz-option>
                }
              </nz-select>
              <input
                nz-input
                inputmode="decimal"
                [attr.aria-label]="'productCatalog.field.costDelta' | translate"
                [placeholder]="'productCatalog.field.costDelta' | translate"
                [ngModel]="value.cost_delta ?? ''"
                (ngModelChange)="
                  patchValue(i, {
                    cost_delta: $event || null,
                    cost_delta_type: $event ? (value.cost_delta_type ?? 'fixed') : null,
                  })
                "
              />
              <nz-select
                [nzDisabled]="!value.cost_delta"
                [ngModel]="value.cost_delta_type"
                (ngModelChange)="patchValue(i, { cost_delta_type: $event })"
              >
                @for (type of deltaTypes; track type) {
                  <nz-option
                    [nzValue]="type"
                    [nzLabel]="'productCatalog.deltaType.' + type | translate"
                  ></nz-option>
                }
              </nz-select>
              <button nz-button nzDanger type="button" (click)="removeValue(i)">
                {{ 'productCatalog.action.remove' | translate }}
              </button>
            </div>
          }

          @if (drawerFailure(); as failure) {
            <nz-alert
              nzType="error"
              nzShowIcon
              class="form-alert"
              [nzMessage]="failure.errorKey ?? '' | translate: failure.params"
              [nzDescription]="failure.detail"
            ></nz-alert>
          }

          <div class="form-footer">
            <button nz-button type="button" (click)="addValue()">
              {{ 'productCatalog.action.addValue' | translate }}
            </button>
            <button nz-button type="button" (click)="draft.set(null)">
              {{ 'productCatalog.action.cancel' | translate }}
            </button>
            @if (canWrite) {
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="!valid() || store.saving()"
                (click)="save()"
              >
                {{ 'productCatalog.action.save' | translate }}
              </button>
            }
          </div>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class AttributesComponent implements OnInit {
  protected readonly store = inject(AttributesStore);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = this.permissions.canWrite(PRODUCT_CATALOG_MODULE);
  protected readonly locales = PC_LOCALES;
  protected readonly deltaTypes = PC_DELTA_TYPES;
  protected readonly draft = signal<Draft | null>(null);
  protected readonly feedback = signal<PcOutcome | null>(null);
  protected readonly drawerFailure = signal<PcOutcome | null>(null);

  ngOnInit(): void {
    void this.store.init();
  }

  private get locale(): string {
    return this.i18n.currentLanguage().slice(0, 2);
  }

  protected name(attribute: PcAttribute): string {
    return attributeName(attribute, this.locale);
  }

  protected valuesOf(attribute: PcAttribute): string {
    return attribute.values.map((value) => valueLabel(value, this.locale)).join(', ');
  }

  protected valid(): boolean {
    const current = this.draft();
    if (current === null) {
      return false;
    }
    const tokens = current.values.map((value) => value.sku_token.trim());
    return (
      /^[a-z0-9_]+$/.test(current.code) &&
      (current.name['en'] ?? '').trim() !== '' &&
      current.values.every(
        (value) => value.code.trim() !== '' && (value.label['en'] ?? '').trim() !== '',
      ) &&
      tokens.every((token) => token !== '') &&
      new Set(tokens).size === tokens.length
    );
  }

  protected openCreate(): void {
    this.drawerFailure.set(null);
    this.draft.set({ id: null, code: '', name: {}, sku_token: '', values: [emptyValue()] });
  }

  protected openEdit(attribute: PcAttribute): void {
    this.drawerFailure.set(null);
    this.draft.set({
      id: attribute.id,
      code: attribute.code,
      name: { ...attribute.name },
      sku_token: attribute.sku_token,
      values: attribute.values.map((value) => ({ ...value, label: { ...value.label } })),
    });
  }

  protected patch(change: Partial<Draft>): void {
    this.draft.update((current) => (current === null ? current : { ...current, ...change }));
  }

  protected patchName(locale: string, text: string): void {
    this.draft.update((current) =>
      current === null ? current : { ...current, name: { ...current.name, [locale]: text } },
    );
  }

  protected patchValue(index: number, change: Partial<PcAttributeValue>): void {
    this.draft.update((current) =>
      current === null
        ? current
        : {
            ...current,
            values: current.values.map((value, position) =>
              position === index ? { ...value, ...change } : value,
            ),
          },
    );
  }

  protected patchLabel(index: number, locale: string, text: string): void {
    const value = this.draft()?.values[index];
    if (value !== undefined) {
      this.patchValue(index, { label: { ...value.label, [locale]: text } });
    }
  }

  protected addValue(): void {
    this.draft.update((current) =>
      current === null ? current : { ...current, values: [...current.values, emptyValue()] },
    );
  }

  protected removeValue(index: number): void {
    this.draft.update((current) =>
      current === null
        ? current
        : { ...current, values: current.values.filter((_, position) => position !== index) },
    );
  }

  protected async save(): Promise<void> {
    const current = this.draft();
    if (current === null) {
      return;
    }
    const payload: PcAttributePayload = {
      code: current.code,
      name: current.name,
      sku_token: current.sku_token || null,
      values: current.values,
    };
    const outcome = await this.store.save(payload, current.id);
    this.drawerFailure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('productCatalog.message.saved'));
      this.draft.set(null);
    }
  }

  protected async remove(attribute: PcAttribute): Promise<void> {
    const outcome = await this.store.remove(attribute.id);
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('productCatalog.message.deleted'));
    }
  }
}
