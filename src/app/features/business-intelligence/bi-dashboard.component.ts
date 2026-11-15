import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  BI_PERIOD_PRESETS,
  BiDashboard,
  BiDataset,
  BiSavedQuery,
  BiWidget,
  BiWidgetData,
  BusinessIntelligenceApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { BiShareComponent } from './bi-share.component';
import { BiWidgetFormComponent } from './bi-widget-form.component';
import { BiWidgetViewComponent } from './bi-widget-view.component';
import { apiErrorText, VISIBILITY_COLORS } from './bi.util';

/**
 * A dashboard: the grid of widgets with the filters of the viewer (period) and, for whoever may edit it, the builder (add,
 * change and remove widgets, change the layout), sharing and snapshots. Figures are loaded for all widgets at once; a
 * widget that cannot be drawn shows its own error.
 */
@Component({
  selector: 'app-bi-dashboard',
  styleUrl: './business-intelligence.scss',
  imports: [
    FormsModule,
    RouterLink,
    BiShareComponent,
    BiWidgetFormComponent,
    BiWidgetViewComponent,
    IconActionDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
  ],
  template: `
    @if (dashboard(); as board) {
      <app-page-header [title]="board.name" [subtitle]="board.description ?? ''">
        <a nz-button routerLink="/business-intelligence">{{ 'BI.BACK_TO_DASHBOARDS' | translate }}</a>
      </app-page-header>

      <div class="toolbar">
        <nz-tag [nzColor]="visibilityColor(board.visibility)">{{ ('BI.VISIBILITY_' + board.visibility.toUpperCase()) | translate }}</nz-tag>
        <nz-select style="width: 220px" nzAllowClear [nzPlaceHolder]="'BI.PERIOD' | translate" [ngModel]="period()" (ngModelChange)="onPeriod($event)" [attr.aria-label]="'BI.PERIOD' | translate">
          @for (preset of presets; track preset) {
            <nz-option [nzValue]="preset" [nzLabel]="('BI.PERIOD_' + preset.toUpperCase()) | translate"></nz-option>
          }
        </nz-select>
        <span class="spacer"></span>
        <button nz-button (click)="loadData()"><i class="fa-solid fa-rotate" aria-hidden="true"></i> {{ 'BI.REFRESH' | translate }}</button>
        <button nz-button (click)="takeSnapshot()"><i class="fa-solid fa-camera" aria-hidden="true"></i> {{ 'BI.TAKE_SNAPSHOT' | translate }}</button>
        @if (board.is_owner) {
          <button nz-button (click)="shareVisible.set(true)"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> {{ 'BI.SHARE' | translate }}</button>
        }
        @if (canWrite()) {
          <button nz-button [nzType]="editing() ? 'primary' : 'default'" (click)="editing.set(!editing())"><i class="fa-solid fa-pen-ruler" aria-hidden="true"></i> {{ 'BI.EDIT_LAYOUT' | translate }}</button>
          @if (editing()) {
            <button nz-button nzType="primary" appIconAction="create" (click)="openWidget()"></button>
          }
        }
      </div>

      <nz-spin [nzSpinning]="loading()">
        @if ((board.widgets ?? []).length === 0) {
          <nz-empty [nzNotFoundContent]="'BI.NO_WIDGETS' | translate"></nz-empty>
        } @else {
          <div class="bi-grid">
            @for (widget of board.widgets ?? []; track widget.id) {
              <nz-card class="bi-cell" [nzTitle]="widget.title" [nzExtra]="actions" [style.grid-column]="widget.layout.x + 1 + ' / span ' + widget.layout.w" [style.grid-row]="widget.layout.y + 1 + ' / span ' + widget.layout.h">
                <ng-template #actions>
                  @if (editing()) {
                    <button nz-button nzType="text" appIconAction="edit" (click)="openWidget(widget)"></button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'BI.DELETE_WIDGET_CONFIRM' | translate" (nzOnConfirm)="removeWidget(widget)"></button>
                  }
                </ng-template>
                <app-bi-widget-view [widget]="widget" [data]="dataOf(widget)" [view]="view()"></app-bi-widget-view>
              </nz-card>
            }
          </div>
        }
      </nz-spin>

      <nz-modal [(nzVisible)]="widgetVisible" [nzTitle]="(editingWidget() ? 'BI.EDIT_WIDGET' : 'BI.NEW_WIDGET') | translate" [nzFooter]="null" nzWidth="720px" (nzOnCancel)="widgetVisible.set(false)">
        <ng-container *nzModalContent>
          <app-bi-widget-form [dashboardId]="board.id" [widget]="editingWidget()" [datasets]="datasets()" [queries]="queries()" (saved)="onWidgetSaved()"></app-bi-widget-form>
        </ng-container>
      </nz-modal>

      <nz-modal [(nzVisible)]="shareVisible" [nzTitle]="'BI.SHARE_DASHBOARD' | translate" [nzFooter]="null" nzWidth="560px" (nzOnCancel)="shareVisible.set(false)">
        <ng-container *nzModalContent>
          <app-bi-share resourceType="dashboard" [resourceId]="board.id"></app-bi-share>
        </ng-container>
      </nz-modal>
    }
  `,
})
export class BiDashboardComponent implements OnInit {
  private readonly api = inject(BusinessIntelligenceApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly presets = BI_PERIOD_PRESETS;
  readonly dashboard = signal<BiDashboard | null>(null);
  readonly data = signal<BiWidgetData[]>([]);
  readonly datasets = signal<BiDataset[]>([]);
  readonly queries = signal<BiSavedQuery[]>([]);
  readonly loading = signal(false);
  readonly editing = signal(false);
  readonly period = signal<string | null>(null);
  readonly widgetVisible = signal(false);
  readonly shareVisible = signal(false);
  readonly editingWidget = signal<BiWidget | null>(null);

  /** Filters of the viewer; they replace the saved period of the dashboard for this view only. */
  readonly view = computed(() => {
    const period = this.period();
    return period ? { period: { preset: period } } : {};
  });

  ngOnInit(): void {
    this.load();
    this.api.getDatasets().subscribe({ next: (response) => this.datasets.set(response.data), error: () => this.datasets.set([]) });
    this.api.getSavedQueries({ per_page: 100 }).subscribe({ next: (response) => this.queries.set(response.data), error: () => this.queries.set([]) });
  }

  visibilityColor(visibility: string): string {
    return VISIBILITY_COLORS[visibility] ?? 'default';
  }

  /** Whoever owns the dashboard or was given edit access can change it (the API decides; this only hides the buttons). */
  canWrite(): boolean {
    return this.dashboard()?.can_edit === true;
  }

  dataOf(widget: BiWidget): BiWidgetData | undefined {
    return this.data().find((entry) => entry.widget_id === widget.id);
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.api.getDashboard(id).subscribe({
      next: (response) => {
        this.dashboard.set(response.data);
        this.period.set(response.data.filters?.period?.preset ?? null);
        this.loadData();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }

  loadData(): void {
    const board = this.dashboard();
    if (!board) {
      return;
    }

    this.loading.set(true);
    this.api.getDashboardData(board.id, this.view()).subscribe({
      next: (response) => {
        this.data.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR'));
      },
    });
  }

  onPeriod(preset: string | null): void {
    this.period.set(preset);
    this.loadData();
  }

  openWidget(widget: BiWidget | null = null): void {
    this.editingWidget.set(widget);
    this.widgetVisible.set(true);
  }

  onWidgetSaved(): void {
    this.widgetVisible.set(false);
    this.load();
  }

  removeWidget(widget: BiWidget): void {
    this.api.deleteWidget(widget.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BI.WIDGET_DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }

  takeSnapshot(): void {
    const board = this.dashboard();
    if (!board) {
      return;
    }

    this.api.takeSnapshot('dashboard', board.id).subscribe({
      next: () => this.message.success(this.translate.instant('BI.SNAPSHOT_TAKEN')),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }
}
