import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  BI_GRID_COLUMNS,
  BI_WIDGET_TYPES,
  BiDataset,
  BiSavedQuery,
  BiWidget,
  BiWidgetRequest,
  BiWidgetType,
  BusinessIntelligenceApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, TranslatePipe, RadioControlDirective } from '@shared';
import { apiErrorText, drillableDimensions, specDimensionKeys } from './bi.util';

/**
 * Create or edit form of a widget: its title and type, its source (a saved query or its own dataset with dimensions and
 * measures), the dimensions a viewer can drill through and its place on the grid. The API validates everything again.
 */
@Component({
  selector: 'app-bi-widget-form',
  imports: [RadioControlDirective, FormsModule, IconActionDirective, TranslatePipe, NzButtonModule, NzFormModule, NzInputModule, NzInputNumberModule, NzRadioModule, NzSelectModule],
  template: `
    <form nz-form nzLayout="vertical" (ngSubmit)="save()">
      <nz-form-item>
        <nz-form-label nzRequired nzFor="widget-title">{{ 'BI.WIDGET_TITLE' | translate }}</nz-form-label>
        <nz-form-control><input nz-input id="widget-title" name="title" maxlength="160" [ngModel]="title()" (ngModelChange)="title.set($event)" /></nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label nzRequired nzFor="widget-type">{{ 'BI.WIDGET_TYPE' | translate }}</nz-form-label>
        <nz-form-control>
          <nz-select id="widget-type" [ngModel]="type()" name="type" (ngModelChange)="type.set($event)">
            @for (value of types; track value) {
              <nz-option [nzValue]="value" [nzLabel]="('BI.TYPE_' + value.toUpperCase()) | translate"></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>

      <nz-radio-group [ngModel]="source()" name="source" (ngModelChange)="source.set($event)" class="bi-source">
        <label for="bi-widget-form-query" appRadioControl nz-radio nzValue="query">{{ 'BI.SOURCE_QUERY' | translate }}</label>
        <label for="bi-widget-form-inline" appRadioControl nz-radio nzValue="inline">{{ 'BI.SOURCE_INLINE' | translate }}</label>
      </nz-radio-group>

      @if (source() === 'query') {
        <nz-form-item>
          <nz-form-label nzRequired nzFor="widget-query">{{ 'BI.SAVED_QUERY' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select id="widget-query" name="query" [ngModel]="queryId()" (ngModelChange)="queryId.set($event)" nzShowSearch>
              @for (query of queries(); track query.id) {
                <nz-option [nzValue]="query.id" [nzLabel]="query.name"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
      } @else {
        <nz-form-item>
          <nz-form-label nzRequired nzFor="widget-dataset">{{ 'BI.DATASET' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select id="widget-dataset" name="dataset" [ngModel]="datasetKey()" (ngModelChange)="onDataset($event)">
              @for (dataset of datasets(); track dataset.key) {
                <nz-option [nzValue]="dataset.key" [nzLabel]="dataset.label"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="widget-dimensions">{{ 'BI.DIMENSIONS' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select id="widget-dimensions" name="dimensions" nzMode="multiple" [ngModel]="dimensions()" (ngModelChange)="dimensions.set($event)">
              @for (dimension of dataset()?.dimensions ?? []; track dimension.key) {
                <nz-option [nzValue]="dimension.key" [nzLabel]="dimension.label"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired nzFor="widget-measures">{{ 'BI.MEASURES' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select id="widget-measures" name="measures" nzMode="multiple" [ngModel]="measures()" (ngModelChange)="measures.set($event)">
              @for (measure of dataset()?.measures ?? []; track measure.key) {
                <nz-option [nzValue]="measure.key" [nzLabel]="measure.label"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        @if ((dataset()?.calculated_measures ?? []).length > 0) {
          <nz-form-item>
            <nz-form-label nzFor="widget-calculated">{{ 'BI.CALCULATED_MEASURES' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select id="widget-calculated" name="calculated" nzMode="multiple" [ngModel]="calculated()" (ngModelChange)="calculated.set($event)">
                @for (measure of dataset()?.calculated_measures ?? []; track measure.key) {
                  <nz-option [nzValue]="measure.key" [nzLabel]="measure.label"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        }
      }

      <nz-form-item>
        <nz-form-label nzFor="widget-drill">{{ 'BI.DRILL_PATH' | translate }}</nz-form-label>
        <nz-form-control [nzExtra]="'BI.DRILL_PATH_HELP' | translate">
          <nz-select id="widget-drill" name="drill" nzMode="multiple" [ngModel]="drillPath()" (ngModelChange)="drillPath.set($event)">
            @for (dimension of drillOptions(); track dimension.key) {
              <nz-option [nzValue]="dimension.key" [nzLabel]="dimension.label"></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>

      <div class="bi-layout">
        @if (widget()) {
          <nz-form-item>
            <nz-form-label nzFor="widget-x">{{ 'BI.LAYOUT_X' | translate }}</nz-form-label>
            <nz-form-control><nz-input-number id="widget-x" name="x" [nzMin]="0" [nzMax]="gridColumns - 1" [ngModel]="x()" (ngModelChange)="x.set($event ?? 0)"></nz-input-number></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="widget-y">{{ 'BI.LAYOUT_Y' | translate }}</nz-form-label>
            <nz-form-control><nz-input-number id="widget-y" name="y" [nzMin]="0" [ngModel]="y()" (ngModelChange)="y.set($event ?? 0)"></nz-input-number></nz-form-control>
          </nz-form-item>
        }
        <nz-form-item>
          <nz-form-label nzFor="widget-w">{{ 'BI.LAYOUT_W' | translate }}</nz-form-label>
          <nz-form-control><nz-input-number id="widget-w" name="w" [nzMin]="1" [nzMax]="gridColumns" [ngModel]="w()" (ngModelChange)="w.set($event ?? 6)"></nz-input-number></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="widget-h">{{ 'BI.LAYOUT_H' | translate }}</nz-form-label>
          <nz-form-control><nz-input-number id="widget-h" name="h" [nzMin]="1" [nzMax]="40" [ngModel]="h()" (ngModelChange)="h.set($event ?? 4)"></nz-input-number></nz-form-control>
        </nz-form-item>
      </div>

      <button nz-button nzType="primary" type="submit" appIconAction="save" [disabled]="!valid() || saving()"></button>
    </form>
  `,
  styles: `
    .bi-source { display: block; margin-bottom: 16px; }
    .bi-layout { display: flex; gap: 16px; flex-wrap: wrap; }
    nz-select { width: 100%; }
  `,
})
export class BiWidgetFormComponent {
  private readonly api = inject(BusinessIntelligenceApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly dashboardId = input.required<string>();
  /** The widget to edit; none creates a new one. */
  readonly widget = input<BiWidget | null>(null);
  readonly datasets = input<BiDataset[]>([]);
  readonly queries = input<BiSavedQuery[]>([]);
  readonly saved = output<BiWidget>();

  readonly types = BI_WIDGET_TYPES;
  readonly gridColumns = BI_GRID_COLUMNS;
  readonly saving = signal(false);

  readonly title = signal('');
  readonly type = signal<BiWidgetType>('table');
  readonly source = signal<'query' | 'inline'>('inline');
  readonly queryId = signal<string | null>(null);
  readonly datasetKey = signal<string | null>(null);
  readonly dimensions = signal<string[]>([]);
  readonly measures = signal<string[]>([]);
  readonly calculated = signal<string[]>([]);
  readonly drillPath = signal<string[]>([]);
  readonly x = signal(0);
  readonly y = signal(0);
  readonly w = signal(6);
  readonly h = signal(4);

  readonly dataset = computed(() => this.datasets().find((dataset) => dataset.key === this.datasetKey()));

  readonly drillOptions = computed(() => {
    if (this.source() === 'query') {
      const query = this.queries().find((item) => item.id === this.queryId());
      return drillableDimensions(this.datasets().find((dataset) => dataset.key === query?.dataset));
    }

    return drillableDimensions(this.dataset());
  });

  readonly valid = computed(() => {
    if (this.title().trim() === '') {
      return false;
    }

    return this.source() === 'query' ? this.queryId() !== null : this.datasetKey() !== null && (this.measures().length > 0 || this.calculated().length > 0);
  });

  constructor() {
    effect(() => {
      const widget = this.widget();
      untracked(() => this.fill(widget));
    });
  }

  onDataset(key: string | null): void {
    this.datasetKey.set(key);
    this.dimensions.set([]);
    this.measures.set([]);
    this.calculated.set([]);
    this.drillPath.set([]);
  }

  save(): void {
    if (!this.valid()) {
      return;
    }

    const payload = this.payload();
    const widget = this.widget();
    this.saving.set(true);
    const request = widget ? this.api.updateWidget(widget.id, payload) : this.api.addWidget(this.dashboardId(), payload);
    request.subscribe({
      next: (response) => {
        this.saving.set(false);
        this.message.success(this.translate.instant('BI.WIDGET_SAVED'));
        this.saved.emit(response.data);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR'));
      },
    });
  }

  /** The request the API expects: a saved query or its own specification, never both. */
  payload(): BiWidgetRequest {
    const dimensions = this.dimensions();
    const values = [...this.measures(), ...this.calculated()];
    const config: NonNullable<BiWidgetRequest['config']> = { drill_path: this.drillPath() };

    if (this.type() === 'pivot' && this.source() === 'inline' && dimensions.length > 0 && values.length > 0) {
      const keys = specDimensionKeys({ dimensions, measures: [] });
      config.pivot = { rows: [keys[0]], columns: keys.slice(1, 2), values };
    }

    const layout = this.widget() ? { x: this.x(), y: this.y(), w: this.w(), h: this.h() } : { w: this.w(), h: this.h() };
    const base = { title: this.title().trim(), widget_type: this.type(), config, layout };

    if (this.source() === 'query') {
      return { ...base, saved_query_id: this.queryId(), dataset: null, spec: null, calculated_measures: [] };
    }

    return { ...base, saved_query_id: null, dataset: this.datasetKey(), spec: { dimensions, measures: this.measures() }, calculated_measures: this.calculated() };
  }

  private fill(widget: BiWidget | null): void {
    this.title.set(widget?.title ?? '');
    this.type.set(widget?.widget_type ?? 'table');
    this.source.set(widget?.saved_query_id ? 'query' : 'inline');
    this.queryId.set(widget?.saved_query_id ?? null);
    this.datasetKey.set(widget?.dataset ?? null);
    this.dimensions.set(widget?.spec?.dimensions ?? []);
    this.measures.set(widget?.spec?.measures ?? []);
    this.calculated.set(widget?.calculated_measures ?? []);
    this.drillPath.set(widget?.config?.drill_path ?? []);
    this.x.set(widget?.layout.x ?? 0);
    this.y.set(widget?.layout.y ?? 0);
    this.w.set(widget?.layout.w ?? 6);
    this.h.set(widget?.layout.h ?? 4);
  }
}
