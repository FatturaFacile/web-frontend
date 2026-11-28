import { Component, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { firstValueFrom } from 'rxjs';
import { PcProduct, ProductCatalogApiService } from '@core';

/** Product picker with server side search; the selected product id is the two-way `value`. */
@Component({
  selector: 'app-bonded-product-select',
  imports: [FormsModule, NzSelectModule],
  template: `
    <nz-select
      nzShowSearch
      nzServerSearch
      nzAllowClear
      class="product-select"
      [nzId]="inputId()"
      [ngModel]="value()"
      (ngModelChange)="value.set($event ?? null)"
      (nzOnSearch)="search($event)"
    >
      @for (product of products(); track product.id) {
        <nz-option
          [nzValue]="product.id"
          [nzLabel]="product.sku + ' — ' + product.name"
        ></nz-option>
      }
    </nz-select>
  `,
  styles: ['.product-select { width: 100%; }'],
})
export class BondedProductSelectComponent {
  private readonly api = inject(ProductCatalogApiService);

  readonly value = model<string | null>(null);
  readonly inputId = input<string>('bw-product');
  protected readonly products = signal<PcProduct[]>([]);

  constructor() {
    void this.search('');
  }

  protected async search(term: string): Promise<void> {
    try {
      const page = await firstValueFrom(
        this.api.listProducts({ q: term, kind: 'catalog', per_page: 20 }),
      );
      this.products.set(page.data);
    } catch {
      this.products.set([]);
    }
  }
}
