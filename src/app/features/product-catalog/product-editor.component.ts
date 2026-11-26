import { Component, effect, inject, input, output, untracked } from '@angular/core';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzMessageService } from 'ng-zorro-antd/message';
import { PermissionsService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { KitBuilderComponent } from './kit-builder.component';
import { ProductEditorStore } from './product-editor.store';
import { PRODUCT_CATALOG_MODULE } from './product-catalog.util';
import { ProductGeneralFormComponent } from './product-general-form.component';
import { UomPackagingComponent } from './uom-packaging.component';
import { VariantMatrixComponent } from './variant-matrix.component';

/**
 * One product: its general data and CH / IT classification, and (once it exists) the variant matrix, the kit bill of materials and
 * the unit hierarchy with the converter.
 */
@Component({
  selector: 'app-pc-product-editor',
  imports: [
    KitBuilderComponent,
    NzAlertModule,
    NzSpinModule,
    NzTabsModule,
    ProductGeneralFormComponent,
    TranslatePipe,
    UomPackagingComponent,
    VariantMatrixComponent,
  ],
  providers: [ProductEditorStore],
  styleUrl: './product-catalog.scss',
  template: `
    <nz-spin [nzSpinning]="store.loading()">
      @if (store.error(); as key) {
        <nz-alert
          nzType="error"
          nzShowIcon
          class="form-alert"
          [nzMessage]="key | translate"
        ></nz-alert>
      }

      <nz-tabs>
        <nz-tab [nzTitle]="'productCatalog.tab.general' | translate">
          <app-pc-general-form
            [canWrite]="canWrite"
            (saved)="onSaved()"
            (cancelled)="closed.emit()"
          ></app-pc-general-form>
        </nz-tab>
        @if (store.product(); as product) {
          @if (!product.is_variant && !product.kit_type) {
            <nz-tab [nzTitle]="'productCatalog.tab.variants' | translate">
              <app-pc-variant-matrix [canWrite]="canWrite"></app-pc-variant-matrix>
            </nz-tab>
          }
          @if (product.kit_type) {
            <nz-tab [nzTitle]="'productCatalog.tab.kit' | translate">
              <app-pc-kit-builder [canWrite]="canWrite"></app-pc-kit-builder>
            </nz-tab>
          }
          <nz-tab [nzTitle]="'productCatalog.tab.units' | translate">
            <app-pc-uom-packaging [canWrite]="canWrite"></app-pc-uom-packaging>
          </nz-tab>
        }
      </nz-tabs>
    </nz-spin>
  `,
})
export class ProductEditorComponent {
  protected readonly store = inject(ProductEditorStore);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  /** The product to edit; null opens an empty form for a new one. */
  readonly productId = input<string | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly canWrite = this.permissions.canWrite(PRODUCT_CATALOG_MODULE);

  constructor() {
    effect(() => {
      const id = this.productId();
      untracked(() => void this.store.open(id));
    });
  }

  protected onSaved(): void {
    this.message.success(this.i18n.instant('productCatalog.message.saved'));
    this.saved.emit();
  }
}
