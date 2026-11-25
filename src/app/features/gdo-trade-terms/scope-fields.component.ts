import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { firstValueFrom } from 'rxjs';
import {
  GdoTradeTermsApiService,
  GdtCategoryRef,
  GdtDeliveryPoint,
  GdtNamedRef,
  GdtProductRef,
} from '@core';
import { TranslatePipe } from '@shared';

/**
 * The scope a rebate scale or a promotion counts: product categories (with their sub-categories), brands, products and
 * delivery points (stores, Ce.Di.). An empty list means no restriction in that dimension.
 */
@Component({
  selector: 'app-gdt-scope-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzSelectModule, ReactiveFormsModule, TranslatePipe],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <div [formGroup]="group()" class="form-grid">
      <label class="field" for="gdt-scope-categories">
        <span>{{ 'gdoTradeTerms.field.categories' | translate }}</span>
        <nz-select nzId="gdt-scope-categories" nzMode="multiple" nzShowSearch nzAllowClear formControlName="category_ids">
          @for (category of categories(); track category.id) {
            <nz-option [nzValue]="category.id" [nzLabel]="category.name"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gdt-scope-brands">
        <span>{{ 'gdoTradeTerms.field.brands' | translate }}</span>
        <nz-select nzId="gdt-scope-brands" nzMode="multiple" nzShowSearch nzAllowClear formControlName="brand_ids">
          @for (brand of brands(); track brand.id) {
            <nz-option [nzValue]="brand.id" [nzLabel]="brand.name"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gdt-scope-products">
        <span>{{ 'gdoTradeTerms.field.products' | translate }}</span>
        <nz-select
          nzId="gdt-scope-products"
          nzMode="multiple"
          nzShowSearch
          nzAllowClear
          nzServerSearch
          formControlName="product_ids"
          (nzOnSearch)="searchProducts($event)"
        >
          @for (product of productOptions(); track product.id) {
            <nz-option [nzValue]="product.id" [nzLabel]="product.label"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gdt-scope-points">
        <span>{{ 'gdoTradeTerms.field.deliveryPoints' | translate }}</span>
        <nz-select nzId="gdt-scope-points" nzMode="multiple" nzShowSearch nzAllowClear formControlName="delivery_point_ids">
          @for (point of points(); track point.id) {
            <nz-option [nzValue]="point.id" [nzLabel]="point.code + ' ' + point.name"></nz-option>
          }
        </nz-select>
      </label>
    </div>
    <p class="muted">{{ 'gdoTradeTerms.hint.scopeEmpty' | translate }}</p>
  `,
})
export class ScopeFieldsComponent {
  private readonly api = inject(GdoTradeTermsApiService);

  readonly group = input.required<FormGroup>();
  readonly categories = input<readonly GdtCategoryRef[]>([]);
  readonly brands = input<readonly GdtNamedRef[]>([]);
  readonly points = input<readonly GdtDeliveryPoint[]>([]);

  private readonly found = signal<GdtProductRef[]>([]);
  private readonly known = signal<Record<string, string>>({});

  /** The products found by the last search plus the ones already selected, so a selection keeps its label. */
  protected readonly productOptions = computed(() => {
    const options = new Map<string, string>(Object.entries(this.known()));
    for (const product of this.found()) {
      options.set(product.id, `${product.sku ?? ''} ${product.name}`.trim());
    }
    return [...options].map(([id, label]) => ({ id, label }));
  });

  protected async searchProducts(term: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.searchProducts(term));
      this.found.set(response.data);
      this.known.update((known) => ({
        ...known,
        ...Object.fromEntries(response.data.map((product) => [product.id, `${product.sku ?? ''} ${product.name}`.trim()])),
      }));
    } catch {
      this.found.set([]);
    }
  }
}
