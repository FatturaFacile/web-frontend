import { inject, Service, signal } from '@angular/core';
import { CrmApiService, InventoryApiService, ProcurementApiService, ProductItem, ReturnsApiService, ReturnsReasonCode, WarehouseItem } from '@core';
import { contactName } from './returns.util';

/** A choice of a select: the id of the record and the text the user sees. */
export interface LookupOption {
  id: string;
  label: string;
}

/**
 * The records the returns forms pick from: customers, suppliers, products, warehouses and the active reason codes.
 * Each list is loaded on demand and kept for the next form; customers and products are searched on the server.
 */
@Service()
export class ReturnsLookupsService {
  private readonly crm = inject(CrmApiService);
  private readonly procurement = inject(ProcurementApiService);
  private readonly inventory = inject(InventoryApiService);
  private readonly returns = inject(ReturnsApiService);

  readonly customers = signal<LookupOption[]>([]);
  readonly suppliers = signal<LookupOption[]>([]);
  readonly products = signal<(LookupOption & { costPrice: string })[]>([]);
  readonly warehouses = signal<LookupOption[]>([]);
  readonly reasons = signal<ReturnsReasonCode[]>([]);

  searchCustomers(search = ''): void {
    this.crm.getClients({ search, per_page: 50 }).subscribe({
      next: (response) => this.customers.set(response.data.map((contact) => ({ id: contact.id, label: contactName(contact) }))),
    });
  }

  loadSuppliers(): void {
    if (this.suppliers().length > 0) {
      return;
    }

    this.procurement.getSuppliers({ per_page: 100 }).subscribe({
      next: (response) => this.suppliers.set(response.data.map((supplier) => ({ id: supplier.id, label: supplier.company_name }))),
    });
  }

  searchProducts(search = ''): void {
    this.inventory.getProducts({ search, per_page: 50 }).subscribe({
      next: (response) => this.products.set(response.data.map((product: ProductItem) => ({ id: product.id, label: `${product.sku} - ${product.name}`, costPrice: String(product.cost_price) }))),
    });
  }

  loadWarehouses(): void {
    if (this.warehouses().length > 0) {
      return;
    }

    this.inventory.getWarehouses().subscribe({
      next: (response) => this.warehouses.set(response.data.map((warehouse: WarehouseItem) => ({ id: warehouse.id, label: `${warehouse.code} - ${warehouse.name}` }))),
    });
  }

  loadReasons(): void {
    this.returns.getReasonCodes(true).subscribe({ next: (response) => this.reasons.set(response.data) });
  }
}
