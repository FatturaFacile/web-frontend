import { inject, Service, signal } from '@angular/core';
import {
  ClientApiService,
  ContactResource,
  contactDisplayName,
  InventoryApiService,
  ProductItem,
  WarehouseItem,
} from '@core';

/** Lazily loaded pick lists (customers, products, warehouses) shared by the sales cycle pages. */
@Service()
export class SalesLookupsService {
  private readonly clientApi = inject(ClientApiService);
  private readonly inventoryApi = inject(InventoryApiService);

  readonly contacts = signal<ContactResource[]>([]);
  readonly products = signal<ProductItem[]>([]);
  readonly warehouses = signal<WarehouseItem[]>([]);
  private loaded = false;

  load(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    this.clientApi.list({ type: 'client', page: 1, per_page: 100 }).subscribe({
      next: (res) => this.contacts.set(res.data ?? []),
      error: () => this.contacts.set([]),
    });
    this.inventoryApi.getProducts({ page: 1, per_page: 100 }).subscribe({
      next: (res) => this.products.set(res.data ?? []),
      error: () => this.products.set([]),
    });
    this.inventoryApi.getWarehouses().subscribe({
      next: (res) => this.warehouses.set(res.data ?? []),
      error: () => this.warehouses.set([]),
    });
  }

  contactLabel(contact: ContactResource): string {
    return contactDisplayName(contact);
  }

  contactName(id: string | null | undefined, ref?: { name?: string | null } | null): string {
    if (ref?.name) {
      return ref.name;
    }
    const found = this.contacts().find((c) => c.id === id);
    return found ? contactDisplayName(found) : (id ?? '-');
  }
}
