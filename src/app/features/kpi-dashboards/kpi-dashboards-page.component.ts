import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe, RadioControlDirective } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { debounceTime, interval, switchMap } from 'rxjs';
import {
  CatalogEntry,
  CockpitWidget,
  DrillSegment,
  ROLE_CODES,
  RoleCode,
} from './kpi-dashboards.models';
import { KpiDashboardsStore } from './kpi-dashboards.store';
import { kpiTitleKey } from './kpi-dashboards.utils';
import { KpiDrillDrawerComponent } from './kpi-drill-drawer.component';
import { KpiFilterBarComponent } from './kpi-filter-bar.component';
import { KpiWidgetComponent } from './kpi-widget.component';

/**
 * The role cockpits: tabs per role, the sticky global filter bar, the 12-column widget grid and the one-click drill-down
 * drawer. In edit mode the widgets are dragged to reorder, resized in steps of 4/6/12 columns, removed or added from the KPI
 * catalog, and the layout is saved as the member's own cockpit. A notification deep link
 * (`?role=cfo&kpi=cash_runway&drill=1`) opens the cockpit focused on that widget with its drawer.
 */
@Component({
  selector: 'app-kpi-dashboards-page',
  imports: [
    RadioControlDirective,
    DatePipe,
    FormsModule,
    CdkDropList,
    CdkDrag,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzEmptyModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    KpiFilterBarComponent,
    KpiWidgetComponent,
    KpiDrillDrawerComponent,
  ],
  styles: [
    `
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        margin: 12px 0;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 16px;
      }
      .cell {
        min-width: 0;
      }
      .edit-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        padding: 16px;
        border: 1px dashed var(--ant-color-border, #d9d9d9);
        border-radius: 8px;
        background: var(--ant-color-bg-container, #fff);
        cursor: move;
        min-height: 96px;
      }
      .edit-actions {
        display: flex;
        gap: 4px;
      }
      .stamp {
        font-size: 12px;
        color: var(--ant-color-text-secondary, #595959);
      }
      @media (max-width: 768px) {
        .grid {
          grid-template-columns: 1fr;
        }
        .cell {
          grid-column: auto !important;
        }
      }
    `,
  ],
  template: `
    <app-page-header
      [title]="'KPI_DASHBOARDS.TITLE' | translate"
      [subtitle]="'KPI_DASHBOARDS.SUBTITLE' | translate"
    />

    <nz-radio-group
      [ngModel]="store.role()"
      (ngModelChange)="selectRole($event)"
      nzButtonStyle="solid"
      data-testid="kpi-role-tabs"
    >
      @for (role of roles; track role) {
        <label [attr.for]="'kpi-dashboards-page-field-' + $index" appRadioControl nz-radio-button [nzValue]="role">{{
          'KPI_DASHBOARDS.DASHBOARD_' + role.toUpperCase() | translate
        }}</label>
      }
    </nz-radio-group>

    <app-kpi-filter-bar />

    <div class="toolbar">
      <span class="stamp" data-testid="kpi-stamp">
        @if (store.cockpit(); as cockpit) {
          {{ cockpit.generated_at | date: 'short' }}
        }
      </span>
      <div>
        @if (store.editing()) {
          <nz-select
            [ngModel]="null"
            (ngModelChange)="addWidget($event)"
            [nzPlaceHolder]="'KPI_DASHBOARDS.ADD_WIDGET' | translate"
            style="min-width: 240px"
            data-testid="kpi-add-widget"
          >
            @for (entry of store.availableToAdd(); track entry.kpi_code) {
              <nz-option [nzValue]="entry" [nzLabel]="title(entry.kpi_code)"></nz-option>
            }
          </nz-select>
          <button
            nz-button
            type="button"
            (click)="store.cancelEditing()"
            data-testid="kpi-cancel-layout"
          >
            {{ 'KPI_DASHBOARDS.CANCEL' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="store.saving()"
            (click)="save()"
            data-testid="kpi-save-layout"
          >
            {{ 'KPI_DASHBOARDS.SAVE_LAYOUT' | translate }}
          </button>
        } @else {
          <button nz-button type="button" (click)="refresh()" data-testid="kpi-refresh">
            {{ 'KPI_DASHBOARDS.REFRESH' | translate }}
          </button>
          <button
            nz-button
            type="button"
            (click)="store.startEditing()"
            [disabled]="store.widgets().length === 0"
            data-testid="kpi-edit-layout"
          >
            {{ 'KPI_DASHBOARDS.EDIT_LAYOUT' | translate }}
          </button>
        }
      </div>
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.forbidden()) {
        <p role="alert" data-testid="kpi-forbidden">{{ 'KPI_DASHBOARDS.FORBIDDEN' | translate }}</p>
      } @else if (store.failed()) {
        <p role="alert" data-testid="kpi-error">{{ 'KPI_DASHBOARDS.LOAD_ERROR' | translate }}</p>
      } @else if (store.editing()) {
        <div
          class="grid"
          cdkDropList
          cdkDropListOrientation="mixed"
          (cdkDropListDropped)="dropped($event)"
          data-testid="kpi-edit-grid"
        >
          @for (item of store.draft(); track item.kpi_code) {
            <div class="cell" cdkDrag [style.grid-column]="'span ' + item.w">
              <div class="edit-card">
                <strong>{{ kpiTitle(item.kpi_code) | translate }}</strong>
                <span class="edit-actions">
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    (click)="store.resizeDraft(item.kpi_code)"
                    [attr.data-testid]="'kpi-resize-' + item.kpi_code"
                  >
                    {{ 'KPI_DASHBOARDS.RESIZE' | translate }} ({{ item.w }})
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    (click)="store.removeDraft(item.kpi_code)"
                    [attr.data-testid]="'kpi-remove-' + item.kpi_code"
                  >
                    {{ 'KPI_DASHBOARDS.REMOVE_WIDGET' | translate }}
                  </button>
                </span>
              </div>
            </div>
          }
        </div>
      } @else if (store.widgets().length === 0 && !store.loading()) {
        <nz-empty [nzNotFoundContent]="'KPI_DASHBOARDS.NO_DATA' | translate"></nz-empty>
      } @else {
        <div class="grid" data-testid="kpi-grid">
          @for (widget of store.widgets(); track widget.widget_id) {
            <div
              class="cell"
              [style.grid-column]="'span ' + widget.position.w"
              [id]="'kpi-' + widget.kpi_code"
            >
              <app-kpi-widget
                [widget]="widget"
                [currency]="store.filters().currency"
                (drill)="openDrill(widget, $event)"
              />
            </div>
          }
        </div>
      }
    </nz-spin>

    <app-kpi-drill-drawer />
  `,
})
export class KpiDashboardsPageComponent implements OnInit {
  protected readonly store = inject(KpiDashboardsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly roles = ROLE_CODES;
  private focusKpi: string | null = null;
  private openDrillOnLoad = false;

  /** Reload when the role or any global filter changes; a newer change cancels the request still in flight. */
  private readonly query = computed(() => ({
    role: this.store.role(),
    filters: this.store.filters(),
  }));

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const role = params.get('role');

    if (role !== null && (ROLE_CODES as readonly string[]).includes(role)) {
      this.store.setRole(role as RoleCode);
    }

    this.focusKpi = params.get('kpi');
    this.openDrillOnLoad = params.get('drill') === '1';

    this.store.loadCatalog().subscribe();

    toObservable(this.query)
      .pipe(
        debounceTime(150),
        switchMap(() => this.store.load()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.focusRequestedWidget());

    toObservable(this.store.refreshIntervalMs)
      .pipe(
        switchMap((ms) => interval(ms)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (!this.store.editing()) {
          this.store.load().subscribe();
        }
      });
  }

  protected selectRole(role: RoleCode): void {
    this.store.setRole(role);
  }

  protected kpiTitle(kpiCode: string): string {
    return kpiTitleKey(kpiCode);
  }

  protected title(kpiCode: string): string {
    return this.i18n.translate(kpiTitleKey(kpiCode));
  }

  protected openDrill(widget: CockpitWidget, segment: DrillSegment): void {
    this.store.openDrill(widget, segment).subscribe();
  }

  protected refresh(): void {
    this.store.refreshCubes().subscribe({ complete: () => this.store.load().subscribe() });
  }

  protected dropped(event: CdkDragDrop<unknown>): void {
    this.store.moveDraft(event.previousIndex, event.currentIndex);
  }

  protected addWidget(entry: CatalogEntry | null): void {
    if (entry !== null) {
      this.store.addDraft(entry);
    }
  }

  protected save(): void {
    this.store.saveLayout().subscribe({
      next: () => {
        this.message.success(this.i18n.translate('KPI_DASHBOARDS.LAYOUT_SAVED'));
        this.store.load().subscribe();
      },
      error: () => this.message.error(this.i18n.translate('KPI_DASHBOARDS.LAYOUT_ERROR')),
    });
  }

  /** A notification deep link scrolls to its widget and opens the drawer once, after the first load. */
  private focusRequestedWidget(): void {
    const kpi = this.focusKpi;

    if (kpi === null) {
      return;
    }

    this.focusKpi = null;
    const widget = this.store.widgets().find((candidate) => candidate.kpi_code === kpi);

    if (widget === undefined) {
      return;
    }

    setTimeout(() => document.getElementById(`kpi-${kpi}`)?.scrollIntoView?.({ block: 'center' }));

    if (this.openDrillOnLoad) {
      this.openDrillOnLoad = false;
      this.openDrill(widget, {});
    }
  }
}
