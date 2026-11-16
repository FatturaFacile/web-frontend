import { Component, DestroyRef, forwardRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';
import { ClientApiService, contactDisplayName } from '@core';

interface CustomerOption {
  id: string;
  name: string;
}

/** Server-side searchable customer (CRM contact) picker bound to the contact id. */
@Component({
  selector: 'app-customer-select',
  imports: [FormsModule, NzSelectModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomerSelectComponent),
      multi: true,
    },
  ],
  template: `
    <nz-select
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
        <nz-option [nzValue]="option.id" [nzLabel]="option.name" />
      }
    </nz-select>
  `,
})
export class CustomerSelectComponent implements ControlValueAccessor {
  private readonly api = inject(ClientApiService);

  readonly inputId = input<string>('');
  readonly placeholder = input<string>('');
  /** Label of the initial value, so an existing selection renders before any search. */
  readonly initialLabel = input<string | null>(null);

  readonly value = signal<string | null>(null);
  readonly disabled = signal(false);
  readonly loading = signal(false);
  readonly options = signal<CustomerOption[]>([]);
  readonly search$ = new Subject<string>();

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        switchMap((term) => {
          this.loading.set(true);
          return this.api
            .list({ search: term || undefined, per_page: 20 })
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((res) => {
        this.loading.set(false);
        const found = (res?.data ?? []).map((c) => ({ id: c.id, name: contactDisplayName(c) }));
        const current = this.value();
        const keep = this.options().find((o) => o.id === current);
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
    const label = this.initialLabel();
    if (value && label && !this.options().some((o) => o.id === value)) {
      this.options.set([{ id: value, name: label }, ...this.options()]);
    }
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
