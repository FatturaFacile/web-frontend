import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PcProduct, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { CatalogProductsStore } from './catalog-products.store';
import { ProductEditorComponent } from './product-editor.component';
import { PcOutcome, PRODUCT_CATALOG_MODULE } from './product-catalog.util';

/**
 * The catalog list: filters by type, kit type and text, the variants of every parent, and the drawer with the product editor
 * (general data, CH / IT classification, variant matrix, kit bill of materials, units of measure).
 */
@Component({
  selector: 'app-pc-products',
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
    NzTagModule,
    PageHeaderComponent,
    ProductEditorComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [CatalogProductsStore],
  styleUrl: './product-catalog.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.PRODUCT_CATALOG' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="pc-f-q">
        <span>{{ 'productCatalog.field.search' | translate }}</span>
        <input
          nz-input
          id="pc-f-q"
          [ngModel]="store.filters().q ?? ''"
          (ngModelChange)="onSearch($event)"
        />
      </label>
      <label class="field" for="pc-f-type">
        <span>{{ 'productCatalog.field.productType' | translate }}</span>
        <nz-select
          nzId="pc-f-type"
          nzAllowClear
          [ngModel]="store.filters().product_type || null"
          (ngModelChange)="store.setFilters({ product_type: $event ?? '' })"
        >
          @for (type of store.productTypes(); track type) {
            <nz-option
              [nzValue]="type"
              [nzLabel]="'productCatalog.productType.' + type | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="pc-f-kit">
        <span>{{ 'productCatalog.field.kitType' | translate }}</span>
        <nz-select
          nzId="pc-f-kit"
          nzAllowClear
          [ngModel]="store.filters().kit_type || null"
          (ngModelChange)="store.setFilters({ kit_type: $event ?? '' })"
        >
          @for (kit of store.kitTypes(); track kit) {
            <nz-option
              [nzValue]="kit"
              [nzLabel]="'productCatalog.kitType.' + kit | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="pc-f-kind">
        <span>{{ 'productCatalog.field.kind' | translate }}</span>
        <nz-select
          nzId="pc-f-kind"
          [ngModel]="store.filters().kind ?? 'catalog'"
          (ngModelChange)="store.setFilters({ kind: $event })"
        >
          <nz-option
            nzValue="catalog"
            [nzLabel]="'productCatalog.kind.catalog' | translate"
          ></nz-option>
          <nz-option
            nzValue="variants"
            [nzLabel]="'productCatalog.kind.variants' | translate"
          ></nz-option>
          <nz-option nzValue="all" [nzLabel]="'productCatalog.kind.all' | translate"></nz-option>
        </nz-select>
      </label>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()">
          {{ 'productCatalog.action.newProduct' | translate }}
        </button>
      }
      <a nz-button routerLink="attributes">{{ 'NAV.PRODUCT_CATALOG_ATTRIBUTES' | translate }}</a>
      <a nz-button routerLink="import-export">{{ 'NAV.PRODUCT_CATALOG_TRANSFER' | translate }}</a>
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
    @if (store.error(); as key) {
      <nz-alert
        nzType="error"
        nzShowIcon
        class="form-alert"
        [nzMessage]="key | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.products().length === 0 && !store.loading()) {
        <nz-empty [nzNotFoundContent]="'productCatalog.empty.products' | translate"></nz-empty>
      } @else {
        <nz-table
          #table
          nzSize="middle"
          [nzData]="store.products()"
          [nzFrontPagination]="false"
          [nzTotal]="store.total()"
          [nzPageIndex]="store.page()"
          [nzPageSize]="store.pageSize()"
          (nzPageIndexChange)="store.setPage($event)"
        >
          <thead>
            <tr>
              <th>{{ 'productCatalog.column.sku' | translate }}</th>
              <th>{{ 'productCatalog.column.name' | translate }}</th>
              <th>{{ 'productCatalog.column.type' | translate }}</th>
              <th>{{ 'productCatalog.column.kit' | translate }}</th>
              <th>{{ 'productCatalog.column.variants' | translate }}</th>
              <th>{{ 'productCatalog.column.price' | translate }}</th>
              <th>{{ 'productCatalog.column.active' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (product of table.data; track product.id) {
              <tr class="product-row">
                <td>{{ product.sku }}</td>
                <td>{{ product.name }}</td>
                <td>
                  <nz-tag>{{
                    'productCatalog.productType.' + product.product_type | translate
                  }}</nz-tag>
                </td>
                <td>
                  @if (product.kit_type) {
                    <nz-tag nzColor="purple">{{
                      'productCatalog.kitType.' + product.kit_type | translate
                    }}</nz-tag>
                  }
                </td>
                <td>{{ product.variants_count ?? '' }}</td>
                <td>{{ product.sale_price }}</td>
                <td>
                  <nz-tag [nzColor]="product.is_active ? 'green' : 'default'">
                    {{
                      (product.is_active
                        ? 'productCatalog.status.active'
                        : 'productCatalog.status.inactive'
                      ) | translate
                    }}
                  </nz-tag>
                </td>
                <td class="actions">
                  <button nz-button nzSize="small" type="button" (click)="openEdit(product)">
                    {{ 'productCatalog.action.edit' | translate }}
                  </button>
                  @if (canWrite) {
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'productCatalog.action.confirmDelete' | translate"
                      (nzOnConfirm)="remove(product)"
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
      [nzVisible]="drawerOpen()"
      nzWidth="min(1100px, 100vw)"
      [nzTitle]="'PAGE_TITLE.PRODUCT_CATALOG' | translate"
      (nzOnClose)="closeDrawer()"
    >
      <ng-container *nzDrawerContent>
        @if (drawerOpen()) {
          <app-pc-product-editor
            [productId]="editingId()"
            (saved)="onSaved()"
            (closed)="closeDrawer()"
          ></app-pc-product-editor>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class CatalogProductsComponent implements OnInit {
  protected readonly store = inject(CatalogProductsStore);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = this.permissions.canWrite(PRODUCT_CATALOG_MODULE);
  protected readonly drawerOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly feedback = signal<PcOutcome | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.store.init();
  }

  protected onSearch(text: string): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => void this.store.setFilters({ q: text }), 300);
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.drawerOpen.set(true);
  }

  protected openEdit(product: PcProduct): void {
    this.editingId.set(product.id);
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
    void this.store.reload();
  }

  protected onSaved(): void {
    void this.store.reload();
  }

  protected async remove(product: PcProduct): Promise<void> {
    const outcome = await this.store.remove(product.id);
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('productCatalog.message.deleted'));
    }
  }
}
