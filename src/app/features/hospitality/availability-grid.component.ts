import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { HospitalityApiService, HospitalityGridNight, HospitalityGridRow, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, todayIso } from '../fleet/fleet.util';

/** Days shown at once: a fortnight fits the screen and stays far below the 62 days the API allows. */
export const GRID_DAYS = 14;

/** Y-m-d plus a number of days, computed in UTC so daylight saving never shifts the date. */
export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Free, tight (at most one room left) or sold out: the colour of a grid cell. */
export function cellState(night: HospitalityGridNight, total: number): 'free' | 'tight' | 'full' | 'none' {
  if (total === 0) {
    return 'none';
  }
  if (night.available === 0) {
    return 'full';
  }
  return night.available <= 1 ? 'tight' : 'free';
}

/** Calendar grid of the lodging availability: room types by night, with the rooms held for group blocks. */
@Component({
  selector: 'app-hospitality-availability-grid',
  imports: [PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzEmptyModule],
  styles: `
    .grid-wrap { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid var(--ff-color-border); padding: 4px 6px; text-align: center; min-width: 52px; }
    th.type, td.type { text-align: left; min-width: 160px; position: sticky; left: 0; background: var(--ff-color-surface); }
    .free { background: var(--ff-color-success-bg); }
    .tight { background: var(--ff-color-warning-bg); }
    .full { background: var(--ff-color-danger-bg); }
    .none { background: var(--ff-color-surface-alt); color: var(--ff-color-text-muted); }
    .held { display: block; font-size: 11px; opacity: 0.75; }
    .legend { display: flex; gap: 12px; margin-bottom: 8px; font-size: 12px; }
    .legend span { padding: 2px 8px; border: 1px solid var(--ff-color-border); }
    .toolbar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
  `,
  template: `
    <app-page-header [title]="'HOSPITALITY.GRID_TITLE' | translate" [subtitle]="'HOSPITALITY.GRID_SUBTITLE' | translate" />
    <nz-card class="main-card">
      <div class="toolbar">
        <button nz-button (click)="shift(-GRID_DAYS)">{{ 'HOSPITALITY.GRID_PREVIOUS' | translate }}</button>
        <button nz-button (click)="today()">{{ 'HOSPITALITY.GRID_TODAY' | translate }}</button>
        <button nz-button (click)="shift(GRID_DAYS)">{{ 'HOSPITALITY.GRID_NEXT' | translate }}</button>
        <strong>{{ from() }} - {{ lastDate() }}</strong>
      </div>
      <div class="legend">
        <span class="free">{{ 'HOSPITALITY.GRID_FREE' | translate }}</span>
        <span class="tight">{{ 'HOSPITALITY.GRID_TIGHT' | translate }}</span>
        <span class="full">{{ 'HOSPITALITY.GRID_FULL' | translate }}</span>
      </div>
      @if (rows().length === 0 && !loading()) {
        <nz-empty />
      } @else {
        <div class="grid-wrap">
          <table>
            <thead>
              <tr>
                <th class="type">{{ 'HOSPITALITY.GRID_ROOM_TYPE' | translate }}</th>
                @for (date of dates(); track date) {
                  <th>{{ date.slice(5) }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.room_type_id) {
                <tr>
                  <td class="type">{{ row.code }} - {{ row.name }} ({{ row.total }})</td>
                  @for (night of row.nights; track night.date) {
                    <td [class]="state(night, row.total)" [title]="night.date + ': ' + night.booked + ' / ' + night.held + ' / ' + night.available">
                      {{ night.available }}
                      @if (night.held > 0) {
                        <span class="held">{{ night.held }}</span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </nz-card>
  `,
})
export class HospitalityAvailabilityGridComponent implements OnInit {
  private readonly api = inject(HospitalityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly GRID_DAYS = GRID_DAYS;
  protected readonly from = signal(todayIso());
  protected readonly rows = signal<HospitalityGridRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly dates = computed(() => Array.from({ length: GRID_DAYS }, (_, index) => addDaysIso(this.from(), index)));
  protected readonly lastDate = computed(() => addDaysIso(this.from(), GRID_DAYS - 1));

  ngOnInit(): void {
    this.load();
  }

  protected state(night: HospitalityGridNight, total: number): string {
    return cellState(night, total);
  }

  protected shift(days: number): void {
    this.from.set(addDaysIso(this.from(), days));
    this.load();
  }

  protected today(): void {
    this.from.set(todayIso());
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.getAvailabilityGrid(this.from(), addDaysIso(this.from(), GRID_DAYS)).subscribe({
      next: (response) => {
        this.rows.set(response.data ?? []);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }
}
