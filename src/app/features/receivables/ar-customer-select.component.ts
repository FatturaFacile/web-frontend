import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';
import { ClientApiService, contactDisplayName, ContactResource } from '@core';
import { TranslatePipe } from '@shared';

export interface ArCustomerOption {
  id: string;
  name: string;
}

const SEARCH_DELAY_MS = 250;

/** Searchable customer picker (contacts of the CRM) shared by the ledger, credit and statement pages. */
@Component({
  selector: 'app-ar-customer-select',
  imports: [FormsModule, NzSelectModule, TranslatePipe],
  template: `
    <nz-select
      class="customer-select"
      style="min-width: 280px"
      nzShowSearch
      nzServerSearch
      nzAllowClear
      [ngModel]="customerId()"
      [nzPlaceHolder]="'AR.SELECT_CUSTOMER' | translate"
      [nzLoading]="loading()"
      [attr.aria-label]="'AR.CUSTOMER' | translate"
      (ngModelChange)="pick($event)"
      (nzOnSearch)="search$.next($event)"
    >
      @for (option of options(); track option.id) {
        <nz-option [nzValue]="option.id" [nzLabel]="option.name"></nz-option>
      }
    </nz-select>
  `,
})
export class ArCustomerSelectComponent {
  private readonly clients = inject(ClientApiService);
  private readonly destroyRef = inject(DestroyRef);

  /** Id of the selected customer (route driven). */
  readonly customerId = input<string | null>(null);
  readonly customerChange = output<ArCustomerOption | null>();

  readonly options = signal<ArCustomerOption[]>([]);
  readonly loading = signal(false);
  readonly search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(
        debounceTime(SEARCH_DELAY_MS),
        switchMap((term) => {
          this.loading.set(true);
          return this.clients.list({ search: term, per_page: 20 }).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.loading.set(false);
        if (response) {
          this.merge(response.data);
        }
      });

    // The selected customer may not be among the searched ones (a deep link): fetch it so its name shows.
    effect(() => {
      const id = this.customerId();
      if (id && !this.options().some((option) => option.id === id)) {
        this.clients
          .get(id)
          .pipe(
            catchError(() => of(null)),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe((response) => {
            if (response) {
              this.merge([response.data]);
            }
          });
      }
    });

    this.search$.next('');
  }

  pick(id: string | null): void {
    const option = id ? (this.options().find((row) => row.id === id) ?? null) : null;
    this.customerChange.emit(option);
  }

  private merge(contacts: readonly ContactResource[]): void {
    const incoming = contacts.map((contact) => ({ id: contact.id, name: contactDisplayName(contact) }));
    const known = new Map(this.options().map((option) => [option.id, option]));
    for (const option of incoming) {
      known.set(option.id, option);
    }
    this.options.set([...known.values()]);
  }
}
