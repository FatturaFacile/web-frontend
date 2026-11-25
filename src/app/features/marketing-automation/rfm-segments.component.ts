import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CatalogApiService,
  DynamicCustomerSegment,
  I18nService,
  MarketingBlueprint,
  MarketingLocale,
  ProductCategory,
  RFM_LABELS,
  RfmLabelCode,
  SegmentCriteria,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { MarketingNavComponent } from './marketing-nav.component';
import { MarketingAutomationStore } from './marketing-automation.store';
import {
  asMarketingLocale,
  blueprintText,
  cleanCriteria,
  heatColor,
  heatNeedsLightText,
  matrixGrid,
  parseRegions,
  RFM_COLORS,
} from './marketing-automation.util';

interface SegmentForm {
  name: string;
  description: string;
  autoRefresh: boolean;
  recencyMin: number | null;
  recencyMax: number | null;
  frequencyMin: number | null;
  frequencyMax: number | null;
  monetaryMin: number | null;
  monetaryMax: number | null;
  excludeInsolvent: boolean;
  maxOverdue: number | null;
  categoryIds: string[];
  skus: string;
  windowMin: number | null;
  windowMax: number | null;
  regions: string;
  locale: MarketingLocale | '';
  rfmLabels: RfmLabelCode[];
}

const emptyForm = (): SegmentForm => ({
  name: '',
  description: '',
  autoRefresh: false,
  recencyMin: null,
  recencyMax: null,
  frequencyMin: null,
  frequencyMax: null,
  monetaryMin: null,
  monetaryMax: null,
  excludeInsolvent: true,
  maxOverdue: null,
  categoryIds: [],
  skus: '',
  windowMin: null,
  windowMax: null,
  regions: '',
  locale: '',
  rfmLabels: [],
});

/** Dynamic RFM segment builder with an interactive RFM matrix, the credit semaphore exclusion (Mod 028) and live counts. */
@Component({
  selector: 'app-rfm-segments',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    MarketingNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'marketing.segments.title' | translate"
      [subtitle]="'marketing.segments.subtitle' | translate"
    />
    <app-marketing-nav activeTab="segments" />

    @if (store.errorCode(); as code) {
      <p class="mb-4 text-red-600" role="alert">
        {{ code | translate }}
        @for (detail of store.errorDetails(); track detail) {
          <span class="block text-sm">{{ detail }}</span>
        }
      </p>
    }

    <div class="grid gap-4 xl:grid-cols-2">
      <nz-card [nzTitle]="'marketing.segments.builder' | translate">
        <div class="mb-4">
          <label class="mb-1 block text-xs font-medium" for="seg-preset">{{ 'marketing.segments.preset' | translate }}</label>
          <nz-select
            nzId="seg-preset"
            class="w-full"
            nzAllowClear
            [nzPlaceHolder]="'marketing.segments.preset_placeholder' | translate"
            [ngModel]="null"
            (ngModelChange)="applyPreset($event)"
          >
            @for (preset of store.presets(); track preset.code) {
              <nz-option [nzValue]="preset.code" [nzLabel]="presetName(preset)" />
            }
          </nz-select>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-medium" for="seg-name">{{ 'marketing.field.name' | translate }}</label>
            <input nz-input id="seg-name" [ngModel]="form().name" (ngModelChange)="set('name', $event)" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="seg-locale">{{ 'marketing.field.locale' | translate }}</label>
            <nz-select nzId="seg-locale" class="w-full" nzAllowClear [ngModel]="form().locale || null" (ngModelChange)="set('locale', $event ?? '')">
              @for (locale of locales; track locale) {
                <nz-option [nzValue]="locale" [nzLabel]="'marketing.locale.' + locale | translate" />
              }
            </nz-select>
          </div>
          <div class="md:col-span-2">
            <label class="mb-1 block text-xs font-medium" for="seg-desc">{{ 'marketing.field.description' | translate }}</label>
            <textarea nz-input id="seg-desc" rows="2" [ngModel]="form().description" (ngModelChange)="set('description', $event)"></textarea>
          </div>
        </div>

        <h3 class="mb-2 mt-4 text-sm font-semibold">{{ 'marketing.segments.rfm_thresholds' | translate }}</h3>
        <div class="grid gap-3 md:grid-cols-3">
          <fieldset>
            <legend class="mb-1 text-xs font-medium">{{ 'marketing.segments.recency_days' | translate }}</legend>
            <div class="flex gap-2">
              <nz-input-number [ngModel]="form().recencyMin" (ngModelChange)="set('recencyMin', $event)" [nzMin]="0" [nzPlaceHolder]="'marketing.field.min' | translate" />
              <nz-input-number [ngModel]="form().recencyMax" (ngModelChange)="set('recencyMax', $event)" [nzMin]="0" [nzPlaceHolder]="'marketing.field.max' | translate" />
            </div>
          </fieldset>
          <fieldset>
            <legend class="mb-1 text-xs font-medium">{{ 'marketing.segments.frequency_orders' | translate }}</legend>
            <div class="flex gap-2">
              <nz-input-number [ngModel]="form().frequencyMin" (ngModelChange)="set('frequencyMin', $event)" [nzMin]="0" [nzPlaceHolder]="'marketing.field.min' | translate" />
              <nz-input-number [ngModel]="form().frequencyMax" (ngModelChange)="set('frequencyMax', $event)" [nzMin]="0" [nzPlaceHolder]="'marketing.field.max' | translate" />
            </div>
          </fieldset>
          <fieldset>
            <legend class="mb-1 text-xs font-medium">{{ 'marketing.segments.monetary_value' | translate }}</legend>
            <div class="flex gap-2">
              <nz-input-number [ngModel]="form().monetaryMin" (ngModelChange)="set('monetaryMin', $event)" [nzMin]="0" [nzPlaceHolder]="'marketing.field.min' | translate" />
              <nz-input-number [ngModel]="form().monetaryMax" (ngModelChange)="set('monetaryMax', $event)" [nzMin]="0" [nzPlaceHolder]="'marketing.field.max' | translate" />
            </div>
          </fieldset>
        </div>

        <h3 class="mb-2 mt-4 text-sm font-semibold">{{ 'marketing.segments.business_filters' | translate }}</h3>
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-medium" for="seg-categories">{{ 'marketing.segments.categories' | translate }}</label>
            <nz-select nzId="seg-categories" class="w-full" nzMode="multiple" [ngModel]="form().categoryIds" (ngModelChange)="set('categoryIds', $event)">
              @for (category of categories(); track category.id) {
                <nz-option [nzValue]="category.id" [nzLabel]="category.name" />
              }
            </nz-select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="seg-skus">{{ 'marketing.segments.skus' | translate }}</label>
            <input nz-input id="seg-skus" [ngModel]="form().skus" (ngModelChange)="set('skus', $event)" />
          </div>
          <fieldset>
            <legend class="mb-1 text-xs font-medium">{{ 'marketing.segments.purchase_window' | translate }}</legend>
            <div class="flex gap-2">
              <nz-input-number [ngModel]="form().windowMin" (ngModelChange)="set('windowMin', $event)" [nzMin]="0" [nzPlaceHolder]="'marketing.field.min' | translate" />
              <nz-input-number [ngModel]="form().windowMax" (ngModelChange)="set('windowMax', $event)" [nzMin]="0" [nzPlaceHolder]="'marketing.field.max' | translate" />
            </div>
          </fieldset>
          <div>
            <label class="mb-1 block text-xs font-medium" for="seg-regions">{{ 'marketing.segments.regions' | translate }}</label>
            <input nz-input id="seg-regions" placeholder="TI, ZH, MI" [ngModel]="form().regions" (ngModelChange)="set('regions', $event)" />
          </div>
        </div>

        <h3 class="mb-2 mt-4 text-sm font-semibold">{{ 'marketing.segments.credit_semaphore' | translate }}</h3>
        <div class="grid items-end gap-3 md:grid-cols-2">
          <div class="flex items-center gap-2 text-sm">
            <nz-switch [attr.aria-label]="'marketing.segments.exclude_insolvent' | translate" [ngModel]="form().excludeInsolvent" (ngModelChange)="set('excludeInsolvent', $event)" />
            {{ 'marketing.segments.exclude_insolvent' | translate }}
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium" for="seg-overdue">{{ 'marketing.segments.max_overdue' | translate }}</label>
            <nz-input-number nzId="seg-overdue" [ngModel]="form().maxOverdue" (ngModelChange)="set('maxOverdue', $event)" [nzMin]="0" [nzDisabled]="!form().excludeInsolvent" />
          </div>
        </div>

        <div class="mt-4 grid items-center gap-3 md:grid-cols-2">
          <div class="flex items-center gap-2 text-sm">
            <nz-switch [attr.aria-label]="'marketing.segments.auto_refresh' | translate" [ngModel]="form().autoRefresh" (ngModelChange)="set('autoRefresh', $event)" />
            {{ 'marketing.segments.auto_refresh' | translate }}
          </div>
        </div>

        <div class="mt-6 flex flex-wrap gap-2">
          <button nz-button (click)="preview()" [disabled]="store.loading()">{{ 'marketing.segments.preview' | translate }}</button>
          <button nz-button nzType="primary" (click)="save()" [disabled]="!form().name.trim() || store.saving()">
            {{ (editingId() ? 'marketing.action.update' : 'marketing.action.create') | translate }}
          </button>
          <button nz-button nzType="text" (click)="reset()">{{ 'marketing.action.reset' | translate }}</button>
        </div>

        @if (store.segmentPreview(); as p) {
          <div class="mt-4 rounded border p-3" role="status" data-testid="segment-preview">
            <div class="text-sm font-semibold">{{ 'marketing.segments.live_count' | translate }}</div>
            <div class="mt-1 flex flex-wrap gap-4">
              <span>{{ 'marketing.segments.eligible' | translate }}: <strong>{{ p.eligible_contacts_count | number }}</strong></span>
              <span>{{ 'marketing.segments.excluded_insolvent' | translate }}: <strong>{{ p.excluded_insolvent_count | number }}</strong></span>
              <span>{{ 'marketing.segments.excluded_consent' | translate }}: <strong>{{ p.excluded_no_consent_count | number }}</strong></span>
            </div>
          </div>
        }
      </nz-card>

      <div class="flex flex-col gap-4">
        <nz-card [nzTitle]="'marketing.matrix.title' | translate">
          <nz-spin [nzSpinning]="store.loading()">
            @if (store.rfmMatrix(); as matrix) {
              <p class="mb-3 text-sm text-gray-600">
                {{ 'marketing.segments.eligible' | translate }}: <strong>{{ matrix.eligible | number }}</strong> ·
                {{ 'marketing.segments.excluded_insolvent' | translate }}: <strong data-testid="matrix-insolvent">{{ matrix.excluded_insolvent | number }}</strong> ·
                {{ 'marketing.segments.excluded_consent' | translate }}: <strong>{{ matrix.excluded_no_consent | number }}</strong>
              </p>
              <div class="mb-4 flex flex-wrap gap-2" role="group" [attr.aria-label]="'marketing.matrix.labels' | translate">
                @for (item of matrix.labels; track item.label) {
                  <button
                    type="button"
                    class="rounded border px-3 py-1 text-sm"
                    [style.border-color]="colors[item.label]"
                    [style.background]="isLabelOn(item.label) ? colors[item.label] : 'transparent'"
                    [style.color]="isLabelOn(item.label) ? '#ffffff' : 'inherit'"
                    [attr.aria-pressed]="isLabelOn(item.label)"
                    (click)="toggleLabel(item.label)"
                  >
                    {{ 'marketing.rfm.' + item.label | translate }} <strong>{{ item.count | number }}</strong>
                  </button>
                }
              </div>

              <div class="overflow-x-auto">
                <table class="border-collapse text-center text-sm" [attr.aria-label]="'marketing.matrix.heatmap' | translate">
                  <caption class="mb-1 text-left text-xs text-gray-500">{{ 'marketing.matrix.axes' | translate }}</caption>
                  <thead>
                    <tr>
                      <th scope="col"></th>
                      @for (f of [1, 2, 3, 4, 5]; track f) {
                        <th scope="col" class="px-2 text-xs font-normal text-gray-500">F{{ f }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of grid(); track row[0].r) {
                      <tr>
                        <th scope="row" class="pr-2 text-xs font-normal text-gray-500">R{{ row[0].r }}</th>
                        @for (cell of row; track cell.f) {
                          <td class="p-0">
                            <button
                              type="button"
                              class="h-10 w-14 border border-white text-xs"
                              [style.background]="heat(cell.count)"
                              [style.color]="light(cell.count) ? '#ffffff' : '#1f1f1f'"
                              [attr.aria-label]="'R' + cell.r + ' F' + cell.f + ': ' + cell.count"
                              (click)="selectCell(cell.r, cell.f)"
                            >
                              {{ cell.count }}
                            </button>
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (cellDetail(); as detail) {
                <p class="mt-3 text-sm" role="status">
                  R{{ detail.r }} · F{{ detail.f }}: <strong>{{ detail.count | number }}</strong>
                  {{ 'marketing.matrix.contacts' | translate }} ·
                  {{ 'marketing.matrix.monetary' | translate }}: {{ detail.monetary | number: '1.2-2' }}
                </p>
              }
            } @else {
              <p class="text-gray-500">{{ 'marketing.matrix.empty' | translate }}</p>
            }
          </nz-spin>
        </nz-card>

        <nz-card [nzTitle]="'marketing.segments.list' | translate">
          <nz-table #table [nzData]="store.segments()" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'marketing.field.name' | translate }}</th>
                <th>{{ 'marketing.segments.eligible' | translate }}</th>
                <th>{{ 'marketing.segments.excluded_insolvent' | translate }}</th>
                <th>{{ 'marketing.segments.last_evaluated' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (segment of table.data; track segment.id) {
                <tr [class.font-semibold]="segment.id === editingId()">
                  <td>
                    {{ segment.name }}
                    @if (segment.auto_refresh_hourly) {
                      <nz-tag>{{ 'marketing.segments.hourly' | translate }}</nz-tag>
                    }
                  </td>
                  <td>{{ segment.eligible_contacts_count | number }}</td>
                  <td>{{ segment.excluded_insolvent_count | number }}</td>
                  <td>{{ segment.last_evaluated_at ? (segment.last_evaluated_at | date: 'short') : '—' }}</td>
                  <td class="whitespace-nowrap">
                    <button nz-button nzSize="small" (click)="open(segment)">{{ 'marketing.action.open' | translate }}</button>
                    <button nz-button nzSize="small" (click)="store.evaluateSegment(segment.id)">{{ 'marketing.segments.evaluate' | translate }}</button>
                    <button nz-button nzSize="small" nzDanger (click)="remove(segment)">{{ 'marketing.action.delete' | translate }}</button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      </div>
    </div>
  `,
})
export class RfmSegmentsComponent implements OnInit {
  protected readonly store = inject(MarketingAutomationStore);
  private readonly catalog = inject(CatalogApiService);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);

  protected readonly locales: readonly MarketingLocale[] = ['it', 'de', 'fr', 'en'];
  protected readonly colors = RFM_COLORS;
  protected readonly form = signal<SegmentForm>(emptyForm());
  protected readonly editingId = signal<string | null>(null);
  protected readonly categories = signal<ProductCategory[]>([]);
  protected readonly selectedCell = signal<{ r: number; f: number } | null>(null);

  protected readonly grid = computed(() => matrixGrid(this.store.rfmMatrix()?.cells ?? []));
  private readonly maxCell = computed(() =>
    Math.max(0, ...(this.store.rfmMatrix()?.cells.map((cell) => cell.count) ?? [0])),
  );
  protected readonly cellDetail = computed(() => {
    const selected = this.selectedCell();
    return selected
      ? (this.store.rfmMatrix()?.cells.find((c) => c.r === selected.r && c.f === selected.f) ?? {
          ...selected,
          count: 0,
          monetary: 0,
        })
      : null;
  });

  ngOnInit(): void {
    void this.store.loadBlueprints();
    void this.store.loadSegments();
    this.catalog.getCategories().subscribe({
      next: (response) => this.categories.set(response.data),
      error: () => this.categories.set([]),
    });
  }

  protected set<K extends keyof SegmentForm>(field: K, value: SegmentForm[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  protected presetName(preset: MarketingBlueprint): string {
    return blueprintText(preset, 'name', this.locale());
  }

  protected applyPreset(code: string | null): void {
    const preset = this.store.presets().find((p) => p.code === code);
    if (!preset) {
      return;
    }
    this.editingId.set(null);
    this.form.set({
      ...this.fromCriteria((preset.payload['criteria'] ?? {}) as SegmentCriteria),
      name: blueprintText(preset, 'name', this.locale()),
      description: blueprintText(preset, 'description', this.locale()),
      autoRefresh: preset.payload['auto_refresh_hourly'] === true,
    });
  }

  protected open(segment: DynamicCustomerSegment): void {
    this.editingId.set(segment.id);
    this.form.set({
      ...this.fromCriteria(segment.criteria),
      name: segment.name,
      description: segment.description ?? '',
      autoRefresh: segment.auto_refresh_hourly,
    });
    this.selectedCell.set(null);
    void this.store.loadRfmMatrix(segment.id);
  }

  protected reset(): void {
    this.editingId.set(null);
    this.form.set(emptyForm());
  }

  protected isLabelOn(label: RfmLabelCode): boolean {
    return this.form().rfmLabels.includes(label);
  }

  protected toggleLabel(label: RfmLabelCode): void {
    const current = this.form().rfmLabels;
    this.set('rfmLabels', current.includes(label) ? current.filter((l) => l !== label) : [...current, label]);
    void this.preview();
  }

  protected selectCell(r: number, f: number): void {
    this.selectedCell.set({ r, f });
  }

  protected heat(count: number): string {
    return heatColor(count, this.maxCell());
  }

  protected light(count: number): boolean {
    return heatNeedsLightText(count, this.maxCell());
  }

  protected async preview(): Promise<void> {
    await this.store.previewSegment(this.criteria());
  }

  protected async save(): Promise<void> {
    const form = this.form();
    const saved = await this.store.saveSegment(
      {
        name: form.name.trim(),
        description: form.description.trim() || null,
        auto_refresh_hourly: form.autoRefresh,
        criteria: this.criteria(),
      },
      this.editingId() ?? undefined,
    );
    if (saved) {
      this.editingId.set(saved.id);
      this.message.success(this.i18n.translate('marketing.segments.saved'));
      await this.store.loadRfmMatrix(saved.id);
    }
  }

  protected async remove(segment: DynamicCustomerSegment): Promise<void> {
    await this.store.deleteSegment(segment.id);
    if (this.editingId() === segment.id) {
      this.reset();
    }
  }

  private locale(): MarketingLocale {
    return asMarketingLocale(this.i18n.currentLanguage());
  }

  private criteria(): SegmentCriteria {
    const f = this.form();
    return cleanCriteria({
      recency_days_min: f.recencyMin,
      recency_days_max: f.recencyMax,
      frequency_min: f.frequencyMin,
      frequency_max: f.frequencyMax,
      monetary_min: f.monetaryMin,
      monetary_max: f.monetaryMax,
      exclude_insolvent: f.excludeInsolvent,
      max_overdue_balance: f.excludeInsolvent ? f.maxOverdue : null,
      purchased_product_category_ids: f.categoryIds,
      purchased_skus: f.skus
        .split(/[\s,;]+/)
        .map((sku) => sku.trim())
        .filter((sku) => sku !== ''),
      purchased_window_months: { min: f.windowMin, max: f.windowMax },
      geographic_canton_or_province: parseRegions(f.regions),
      locale: f.locale === '' ? null : f.locale,
      rfm_labels: f.rfmLabels,
    });
  }

  private fromCriteria(c: SegmentCriteria): SegmentForm {
    return {
      ...emptyForm(),
      recencyMin: c.recency_days_min ?? null,
      recencyMax: c.recency_days_max ?? null,
      frequencyMin: c.frequency_min ?? null,
      frequencyMax: c.frequency_max ?? null,
      monetaryMin: c.monetary_min ?? null,
      monetaryMax: c.monetary_max ?? null,
      excludeInsolvent: c.exclude_insolvent ?? true,
      maxOverdue: c.max_overdue_balance ?? null,
      categoryIds: c.purchased_product_category_ids ?? [],
      skus: (c.purchased_skus ?? []).join(', '),
      windowMin: c.purchased_window_months?.min ?? null,
      windowMax: c.purchased_window_months?.max ?? null,
      regions: (c.geographic_canton_or_province ?? []).join(', '),
      locale: c.locale ?? '',
      rfmLabels: c.rfm_labels ?? [],
    };
  }

  protected readonly rfmLabels = RFM_LABELS;
}
