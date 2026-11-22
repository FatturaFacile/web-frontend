import { Component, DestroyRef, forwardRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';
import { InventoryApiService } from '@core';

interface ProductOption {
  id: string;
  label: string;
}

/** Server-side searchable product picker bound to the product id (spare parts of the van and of work orders). */
@Component({
  selector: 'app-fsm-product-select',
  imports: [FormsModule, NzSelectModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ProductSelectComponent), multi: true }],
  template: `
    <nz-select
      class="product-select"
      [nzId]="inputId()"
      [ngModel]="value()"
      (ngModelChange)="select($event)"
      [nzPlaceHolder]="placeholder()"
      [nzDisabled]="disabled()"
      [nzLoading]="loading()"
      nzShowSearch
      nzAllowClear
      nzServerSearch
      (nzOnSearch)="search$.next($event)"
      (nzOpenChange)="$event && options().length === 0 && search$.next('')"
    >
      @for (option of options(); track option.id) {
        <nz-option [nzValue]="option.id" [nzLabel]="option.label" />
      }
    </nz-select>
  `,
  styles: `
    .product-select {
      width: 100%;
    }
  `,
})
export class ProductSelectComponent implements ControlValueAccessor {
  private readonly api = inject(InventoryApiService);

  readonly inputId = input<string>('');
  readonly placeholder = input<string>('');

  readonly value = signal<string | null>(null);
  readonly disabled = signal(false);
  readonly loading = signal(false);
  readonly options = signal<ProductOption[]>([]);
  readonly search$ = new Subject<string>();

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        switchMap((term) => {
          this.loading.set(true);
          return this.api.getProducts({ search: term || undefined, per_page: 20 }).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((res) => {
        this.loading.set(false);
        const found = (res?.data ?? []).map((p) => ({ id: p.id, label: `${p.sku} - ${p.name}` }));
        const keep = this.options().find((o) => o.id === this.value());
        this.options.set(keep && !found.some((o) => o.id === keep.id) ? [keep, ...found] : found);
      });
  }

  select(value: string | null): void {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
