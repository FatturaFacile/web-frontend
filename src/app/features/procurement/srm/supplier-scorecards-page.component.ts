import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  SUPPLIER_RATING_COMPONENTS,
  SupplierRating,
  SupplierRatingComponentKey,
  SupplierRatingSortField,
  SupplierTier,
} from '@domain/procurement/srm.models';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { ratingComponentKey, scoreStatus, tierColor, toNumber } from './srm.helpers';
import { SrmStore } from './srm.store';

const TIERS: readonly SupplierTier[] = ['A', 'B', 'C', 'D'];
const DEFAULT_PAGE_SIZE = 20;

/**
 * Supplier scorecards: composite 0-100 rating, A-D tier and the five weighted components per supplier.
 * Search, tier filter, sorting and paging are executed by the API (`/procurement/srm/scorecards`).
 */
@Component({
  selector: 'app-supplier-scorecards-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SrmStore],
  imports: [
    DecimalPipe,
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzProgressModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
  ],
  template: `
    <app-page-header
      [title]="'srm.scorecards.title' | translate"
      [subtitle]="'srm.scorecards.subtitle' | translate"
    >
      <nz-range-picker
        [ngModel]="range()"
        (ngModelChange)="onRange($event)"
        [nzAllowClear]="false"
      />
      <button nz-button type="button" (click)="reload()" [nzLoading]="store.loading()">
        <span nz-icon nzType="reload" aria-hidden="true"></span>
        {{ 'srm.dashboard.refresh' | translate }}
      </button>
    </app-page-header>

    <div class="filters">
      <input
        nz-input
        type="search"
        [ngModel]="search()"
        (ngModelChange)="onSearch($event)"
        [placeholder]="'srm.scorecards.search' | translate"
        data-testid="scorecard-search"
      />
      <nz-select
        [ngModel]="tierFilter()"
        (ngModelChange)="onTier($event)"
        [nzPlaceHolder]="'srm.scorecards.allTiers' | translate"
        nzAllowClear
        class="tier-select"
        data-testid="scorecard-tier"
      >
        @for (tier of tiers; track tier) {
          <nz-option [nzValue]="tier" [nzLabel]="'srm.tier.' + tier | translate" />
        }
      </nz-select>
    </div>

    @if (store.error(); as error) {
      <nz-alert
        nzType="error"
        nzShowIcon
        [nzMessage]="'srm.dashboard.loadError' | translate"
        [nzDescription]="error"
      />
    }

    <nz-table
      #table
      [nzData]="store.scorecards()"
      [nzLoading]="store.loading()"
      [nzFrontPagination]="false"
      [nzTotal]="store.scorecardsMeta()?.total ?? 0"
      [nzPageIndex]="pageIndex()"
      [nzPageSize]="pageSize()"
      [nzShowSizeChanger]="true"
      [nzPageSizeOptions]="[10, 20, 50, 100]"
      [nzNoResult]="noResult"
      (nzQueryParams)="onQuery($event)"
      nzSize="small"
      data-testid="scorecard-table"
    >
      <thead>
        <tr>
          <th nzColumnKey="name" [nzSortFn]="true" [nzSortOrder]="sortOrder('name')">
            {{ 'srm.scorecards.col.supplier' | translate }}
          </th>
          <th>{{ 'srm.scorecards.col.qualification' | translate }}</th>
          @for (component of components; track component) {
            <th [nzColumnKey]="component" [nzSortFn]="true" [nzSortOrder]="sortOrder(component)">
              {{ componentLabel(component) | translate }}
            </th>
          }
          <th nzColumnKey="score" [nzSortFn]="true" [nzSortOrder]="sortOrder('score')">
            {{ 'srm.scorecards.col.score' | translate }}
          </th>
          <th>{{ 'srm.scorecards.col.tier' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.supplier_id) {
          <tr [class.highlight]="row.supplier_id === highlighted()">
            <td>{{ row.supplier_name }}</td>
            <td>
              <nz-tag>{{ 'srm.qualification.' + row.qualification_status | translate }}</nz-tag>
            </td>
            @for (component of components; track component) {
              <td class="num">
                @if (row.components[component] !== null) {
                  {{ toNumber(row.components[component]) | number: '1.0-1' }}%
                } @else {
                  <span
                    class="muted"
                    nz-tooltip
                    [nzTooltipTitle]="'srm.scorecards.noData' | translate"
                    >—</span
                  >
                }
              </td>
            }
            <td class="score">
              @if (row.score !== null) {
                <nz-progress
                  [nzPercent]="toNumber(row.score) ?? 0"
                  [nzStatus]="status(row)"
                  nzSize="small"
                />
              } @else {
                <span class="muted">—</span>
              }
            </td>
            <td>
              @if (row.tier) {
                <nz-tag [nzColor]="color(row.tier)">{{ row.tier }}</nz-tag>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    <ng-template #noResult>
      <nz-empty [nzNotFoundContent]="'srm.scorecards.empty' | translate" />
    </ng-template>

    <p class="legend">{{ 'srm.scorecards.legend' | translate }}</p>
  `,
  styles: `
    .filters {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .filters input {
      max-width: 280px;
    }
    .tier-select {
      min-width: 160px;
    }
    .num {
      text-align: right;
    }
    .score {
      min-width: 140px;
    }
    .muted,
    .legend {
      color: rgba(0, 0, 0, 0.45);
    }
    .highlight {
      background: rgba(24, 144, 255, 0.08);
    }
  `,
})
export class SupplierScorecardsPageComponent implements OnInit {
  protected readonly store = inject(SrmStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly search$ = new Subject<string>();

  protected readonly tiers = TIERS;
  protected readonly components = SUPPLIER_RATING_COMPONENTS;
  protected readonly range = signal<Date[]>([new Date(new Date().getFullYear(), 0, 1), new Date()]);
  protected readonly search = signal('');
  protected readonly tierFilter = signal<SupplierTier | null>(null);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly sort = signal<{ field: SupplierRatingSortField; direction: 'asc' | 'desc' }>({
    field: 'score',
    direction: 'desc',
  });
  protected readonly highlighted = signal<string | null>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('supplier'),
  );

  protected toNumber = toNumber;

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pageIndex.set(1);
        this.reload();
      });
    this.reload();
  }

  protected reload(): void {
    const [from, to] = this.range();
    const search = this.search().trim();
    this.store.loadScorecards({
      from: iso(from),
      to: iso(to),
      search: search === '' ? undefined : search,
      tier: this.tierFilter() ?? undefined,
      sort: this.sort().field,
      direction: this.sort().direction,
      page: this.pageIndex(),
      per_page: this.pageSize(),
    });
  }

  protected onRange(range: Date[] | null): void {
    if (range && range.length === 2) {
      this.range.set(range);
      this.pageIndex.set(1);
      this.reload();
    }
  }

  protected onSearch(term: string): void {
    this.search.set(term);
    this.search$.next(term.trim());
  }

  protected onTier(tier: SupplierTier | null): void {
    this.tierFilter.set(tier);
    this.pageIndex.set(1);
    this.reload();
  }

  /** Page, page size and sort changes of the table; they re-query the API instead of sorting in the browser. */
  protected onQuery(params: NzTableQueryParams): void {
    const active = params.sort.find((entry) => entry.value !== null);
    const next: { field: SupplierRatingSortField; direction: 'asc' | 'desc' } = active
      ? {
          field: active.key as SupplierRatingSortField,
          direction: active.value === 'ascend' ? 'asc' : 'desc',
        }
      : { field: 'score', direction: 'desc' };

    const sortChanged =
      next.field !== this.sort().field || next.direction !== this.sort().direction;
    const sizeChanged = params.pageSize !== this.pageSize();

    if (!sortChanged && !sizeChanged && params.pageIndex === this.pageIndex()) {
      return;
    }

    this.sort.set(next);
    this.pageSize.set(params.pageSize);
    this.pageIndex.set(sortChanged || sizeChanged ? 1 : params.pageIndex);
    this.reload();
  }

  protected sortOrder(field: SupplierRatingSortField): 'ascend' | 'descend' | null {
    const current = this.sort();
    if (current.field !== field) {
      return null;
    }
    return current.direction === 'asc' ? 'ascend' : 'descend';
  }

  protected componentLabel(component: SupplierRatingComponentKey): string {
    return ratingComponentKey(component);
  }

  protected color(tier: SupplierTier | null): string {
    return tierColor(tier);
  }

  protected status(row: SupplierRating): 'success' | 'normal' | 'exception' {
    return scoreStatus(row.score);
  }
}

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
