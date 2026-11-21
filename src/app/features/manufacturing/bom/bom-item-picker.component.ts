import { Component, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ManufacturingApiService, MfgItemSummary } from '@core';
import { TranslatePipe } from '@shared';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { catchError, debounceTime, distinctUntilChanged, of, Subject, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Search-as-you-type picker of an item of the item master; the selected value is the item id. */
@Component({
  selector: 'app-bom-item-picker',
  imports: [FormsModule, NzSelectModule, TranslatePipe],
  template: `
    <nz-select
      class="picker"
      nzShowSearch
      nzAllowClear
      nzServerSearch
      [nzLoading]="loading()"
      [nzPlaceHolder]="placeholder() | translate"
      [attr.aria-label]="placeholder() | translate"
      [ngModel]="value()"
      (ngModelChange)="value.set($event)"
      (nzOnSearch)="search$.next($event)"
    >
      @for (item of items(); track item.id) {
        <nz-option [nzValue]="item.id" [nzLabel]="item.item_code + ' · ' + item.name"></nz-option>
      }
    </nz-select>
  `,
  styles: ':host { display: block } .picker { width: 100%; min-width: 240px }',
})
export class BomItemPickerComponent {
  private readonly api = inject(ManufacturingApiService);

  readonly placeholder = input.required<string>();
  readonly value = model<string | null>(null);

  protected readonly items = signal<MfgItemSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((search) => {
          this.loading.set(true);

          return this.api
            .getMfgItems({ search, per_page: 20 })
            .pipe(catchError(() => of({ data: [] as MfgItemSummary[] })));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.items.set(res.data);
        this.loading.set(false);
      });
    this.search$.next('');
  }
}
