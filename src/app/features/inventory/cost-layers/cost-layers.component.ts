import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { catchError, debounceTime, distinctUntilChanged, of, Subject, switchMap } from 'rxjs';
import { InventoryItemOption, InventoryValuationApiService, InventoryWarehouseOption } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { CostLayerFacade } from '../shared/inventory-valuation.facades';
import { isZeroAmount } from '../shared/inventory-valuation.utils';

@Component({
  selector: 'app-cost-layers',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [CostLayerFacade],
  templateUrl: './cost-layers.component.html',
  styleUrl: '../shared/inventory-valuation.scss',
})
export class CostLayersComponent implements OnInit {
  protected readonly facade = inject(CostLayerFacade);
  private readonly api = inject(InventoryValuationApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isZero = isZeroAmount;

  readonly items = signal<InventoryItemOption[]>([]);
  readonly itemsLoading = signal(false);
  readonly warehouses = signal<InventoryWarehouseOption[]>([]);
  private readonly itemSearch$ = new Subject<string>();

  ngOnInit(): void {
    this.api.listWarehouses().subscribe({
      next: (list) => this.warehouses.set(list),
      error: () => this.warehouses.set([]),
    });
    this.itemSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          this.itemsLoading.set(true);
          return this.api.searchItems(term || undefined).pipe(catchError(() => of([] as InventoryItemOption[])));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => {
        this.items.set(list);
        this.itemsLoading.set(false);
      });
    this.itemSearch$.next('');
  }

  searchItems(term: string): void {
    this.itemSearch$.next(term);
  }

  setItem(id: string | null): void {
    this.facade.setFilter({ item_id: id ?? undefined });
  }

  setWarehouse(id: string | null): void {
    this.facade.setFilter({ warehouse_id: id ?? undefined });
  }

  setLot(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.facade.setFilter({ lot_id: value || undefined });
  }

  setOpenOnly(value: boolean): void {
    this.facade.setFilter({ open_only: value || undefined });
  }
}
