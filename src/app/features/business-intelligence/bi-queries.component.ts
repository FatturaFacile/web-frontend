import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BiSavedQuery, BiSnapshot, BiSnapshotComparison, BusinessIntelligenceApiService, TranslateService } from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { BiShareComponent } from './bi-share.component';
import { apiErrorText, formatBiValue, VISIBILITY_COLORS } from './bi.util';

type Change = { snapshot: string | number | null; current: string | number | null; change: string | number | null };

/** The saved queries with their schedule, their snapshots (taken now or on schedule, compared with today) and their shares. */
@Component({
  selector: 'app-bi-queries',
  styleUrl: './business-intelligence.scss',
  imports: [
    FormsModule,
    RouterLink,
    BiShareComponent,
    IconActionDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'BI.QUERIES_TITLE' | translate" [subtitle]="'BI.QUERIES_SUBTITLE' | translate">
      <a nz-button nzType="primary" routerLink="/business-intelligence/explorer" appIconAction="create"></a>
    </app-page-header>

    <div class="toolbar">
      <input nz-input style="width: 260px" [placeholder]="'BI.SEARCH' | translate" [attr.aria-label]="'BI.SEARCH' | translate" [ngModel]="search()" (ngModelChange)="search.set($event)" (keydown.enter)="load()" />
      <button nz-button (click)="load()">{{ 'BI.SEARCH' | translate }}</button>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="queries()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'BI.NAME' | translate }}</th>
            <th>{{ 'BI.DATASET' | translate }}</th>
            <th>{{ 'BI.VISIBILITY' | translate }}</th>
            <th>{{ 'BI.SNAPSHOT_FREQUENCY' | translate }}</th>
            <th>{{ 'BI.NEXT_SNAPSHOT' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td><a [routerLink]="['/business-intelligence/explorer']" [queryParams]="{ query: row.id }">{{ row.name }}</a></td>
              <td>{{ row.dataset }}</td>
              <td><nz-tag [nzColor]="visibilityColor(row.visibility)">{{ ('BI.VISIBILITY_' + row.visibility.toUpperCase()) | translate }}</nz-tag></td>
              <td>{{ row.snapshot_frequency ? (('BI.FREQUENCY_' + row.snapshot_frequency.toUpperCase()) | translate) : '' }}</td>
              <td>{{ row.next_snapshot_on ?? '' }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" type="button" (click)="openSnapshots(row)" [attr.aria-label]="'BI.SNAPSHOTS' | translate"><i class="fa-solid fa-camera" aria-hidden="true"></i></button>
                  @if (row.is_owner) {
                    <button nz-button nzType="text" type="button" (click)="openShare(row)" [attr.aria-label]="'BI.SHARE' | translate"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i></button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'BI.DELETE_QUERY_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && queries().length === 0) {
        <nz-empty [nzNotFoundContent]="'BI.NO_QUERIES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="shareVisible" [nzTitle]="'BI.SHARE_QUERY' | translate" [nzFooter]="null" nzWidth="560px" (nzOnCancel)="shareVisible.set(false)">
      <ng-container *nzModalContent>
        @if (selected(); as query) {
          <app-bi-share resourceType="saved_query" [resourceId]="query.id"></app-bi-share>
        }
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="snapshotsVisible" [nzTitle]="'BI.SNAPSHOTS' | translate" [nzFooter]="null" nzWidth="860px" (nzOnCancel)="snapshotsVisible.set(false)">
      <ng-container *nzModalContent>
        <div class="toolbar">
          <button nz-button nzType="primary" (click)="takeSnapshot()">{{ 'BI.TAKE_SNAPSHOT' | translate }}</button>
        </div>
        <nz-table #snapshotTable [nzData]="snapshots()" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'BI.SNAPSHOT_DATE' | translate }}</th>
              <th>{{ 'BI.SNAPSHOT_TRIGGER' | translate }}</th>
              <th>{{ 'BI.STATUS' | translate }}</th>
              <th class="num">{{ 'BI.ROWS' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (snapshot of snapshotTable.data; track snapshot.id) {
              <tr>
                <td>{{ snapshot.taken_on }}</td>
                <td>{{ ('BI.TRIGGER_' + snapshot.trigger.toUpperCase()) | translate }}</td>
                <td>
                  <nz-tag [nzColor]="snapshot.status === 'ok' ? 'green' : 'red'">{{ ('BI.SNAPSHOT_' + snapshot.status.toUpperCase()) | translate }}</nz-tag>
                  @if (snapshot.error) {
                    <span class="muted">{{ snapshot.error }}</span>
                  }
                </td>
                <td class="num">{{ snapshot.row_count }}</td>
                <td>
                  <div class="row-actions">
                    @if (snapshot.status === 'ok') {
                      <button nz-button nzType="link" type="button" (click)="compare(snapshot)">{{ 'BI.COMPARE' | translate }}</button>
                    }
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'BI.DELETE_SNAPSHOT_CONFIRM' | translate" (nzOnConfirm)="removeSnapshot(snapshot)"></button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (snapshots().length === 0) {
          <nz-empty [nzNotFoundContent]="'BI.NO_SNAPSHOTS' | translate"></nz-empty>
        }

        @if (comparison(); as diff) {
          <h3 class="bi-compare">{{ 'BI.COMPARED_WITH_TODAY' | translate: { date: diff.taken_on } }}</h3>
          <nz-table #diffTable [nzData]="diff.rows" nzSize="small" [nzPageSize]="10">
            <thead>
              <tr>
                @for (column of diff.columns; track column.key) {
                  <th [class.num]="column.kind !== 'dimension'">{{ column.label }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of diffTable.data; track $index) {
                <tr>
                  @for (column of diff.columns; track column.key) {
                    @if (column.kind === 'dimension') {
                      <td>{{ row[column.key] ?? '-' }}</td>
                    } @else {
                      <td class="num">{{ changeText(row[column.key], column.unit) }}</td>
                    }
                  }
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .bi-compare { margin: 16px 0 8px; }
  `,
})
export class BiQueriesComponent implements OnInit {
  private readonly api = inject(BusinessIntelligenceApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly queries = signal<BiSavedQuery[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly selected = signal<BiSavedQuery | null>(null);
  readonly shareVisible = signal(false);
  readonly snapshotsVisible = signal(false);
  readonly snapshots = signal<BiSnapshot[]>([]);
  readonly comparison = signal<BiSnapshotComparison | null>(null);

  ngOnInit(): void {
    this.load();
  }

  visibilityColor(visibility: string): string {
    return VISIBILITY_COLORS[visibility] ?? 'default';
  }

  load(): void {
    this.loading.set(true);
    this.api.getSavedQueries({ search: this.search().trim() || undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.queries.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('BI.ACTION_ERROR'));
      },
    });
  }

  remove(query: BiSavedQuery): void {
    this.api.deleteSavedQuery(query.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BI.QUERY_DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }

  openShare(query: BiSavedQuery): void {
    this.selected.set(query);
    this.shareVisible.set(true);
  }

  openSnapshots(query: BiSavedQuery): void {
    this.selected.set(query);
    this.comparison.set(null);
    this.snapshotsVisible.set(true);
    this.loadSnapshots();
  }

  takeSnapshot(): void {
    const query = this.selected();
    if (!query) {
      return;
    }

    this.api.takeSnapshot('saved_query', query.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BI.SNAPSHOT_TAKEN'));
        this.loadSnapshots();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }

  compare(snapshot: BiSnapshot): void {
    this.api.compareSnapshot(snapshot.id).subscribe({
      next: (response) => this.comparison.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }

  removeSnapshot(snapshot: BiSnapshot): void {
    this.api.deleteSnapshot(snapshot.id).subscribe({
      next: () => this.loadSnapshots(),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }

  /** `then → now (change)` of a measure cell of the comparison. */
  changeText(cell: unknown, unit: string | undefined): string {
    const value = cell as Change | string | null;
    if (value === null || typeof value !== 'object') {
      return '';
    }

    const format = (figure: string | number | null): string => (figure === null ? '-' : formatBiValue(figure, unit as never));
    return `${format(value.snapshot)} → ${format(value.current)} (${format(value.change)})`;
  }

  private loadSnapshots(): void {
    const query = this.selected();
    if (!query) {
      return;
    }

    this.api.getSnapshots('saved_query', query.id).subscribe({
      next: (response) => this.snapshots.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }
}
