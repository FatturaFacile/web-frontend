import { JsonPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DashboardApiService,
  DashboardLayout,
  DashboardWidgetDefinition,
  DashboardWidgetPlacement,
  I18nService,
} from '@core';
import { PageHeaderComponent, TranslatePipe, IconActionDirective } from '@shared';

type NumericPlacementKey = 'x' | 'y' | 'w' | 'h';

/** Dashboard builder: choose the widgets, their position and size, save or restore the factory layout. */
@Component({
  selector: 'app-dashboard-builder',
  styleUrl: './dashboard-builder.component.scss',
  imports: [
    IconActionDirective,
    FormsModule,
    JsonPipe,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './dashboard-builder.component.html',
})
export class DashboardBuilderComponent implements OnInit {
  private readonly api = inject(DashboardApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  protected readonly catalogue = signal<DashboardWidgetDefinition[]>([]);
  protected readonly placements = signal<DashboardWidgetPlacement[]>([]);
  protected readonly layout = signal<DashboardLayout | null>(null);
  protected readonly name = signal('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dirty = signal(false);
  protected readonly widgetToAdd = signal<string | null>(null);
  protected readonly preview = signal<unknown>(null);
  protected readonly previewLoading = signal(false);

  protected readonly availableToAdd = computed(() => {
    const placed = new Set(this.placements().map((placement) => placement.widget_id));
    return this.catalogue().filter((widget) => !placed.has(widget.id));
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getAvailableWidgets().subscribe({
      next: (res) => this.catalogue.set(res.data ?? []),
      error: () => this.message.error(this.i18n.translate('DASHBOARD_BUILDER.LOAD_FAILED')),
    });
    this.loadLayout();
  }

  protected title(widgetId: string): string {
    return this.catalogue().find((widget) => widget.id === widgetId)?.title ?? widgetId;
  }

  protected setNumber(index: number, key: NumericPlacementKey, value: number | null): void {
    this.placements.update((items) =>
      items.map((item, position) => (position === index ? { ...item, [key]: value ?? 0 } : item)),
    );
    this.dirty.set(true);
  }

  protected remove(index: number): void {
    this.placements.update((items) => items.filter((_, position) => position !== index));
    this.dirty.set(true);
  }

  protected move(index: number, delta: -1 | 1): void {
    const target = index + delta;
    this.placements.update((items) => {
      if (target < 0 || target >= items.length) {
        return items;
      }
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    this.dirty.set(true);
  }

  protected add(): void {
    const widget = this.catalogue().find((item) => item.id === this.widgetToAdd());
    if (!widget) {
      return;
    }
    const bottom = this.placements().reduce((max, item) => Math.max(max, item.y + item.h), 0);
    this.placements.update((items) => [
      ...items,
      { widget_id: widget.id, x: 0, y: bottom, w: widget.default_dimensions.w, h: widget.default_dimensions.h },
    ]);
    this.widgetToAdd.set(null);
    this.dirty.set(true);
  }

  protected save(): void {
    this.saving.set(true);
    this.api.saveLayout({ name: this.name() || undefined, widgets_layout: this.placements() }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.applyLayout(res.data);
        this.message.success(this.i18n.translate('DASHBOARD_BUILDER.SAVED'));
      },
      error: () => {
        this.saving.set(false);
        this.message.error(this.i18n.translate('DASHBOARD_BUILDER.SAVE_FAILED'));
      },
    });
  }

  protected reset(): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('DASHBOARD_BUILDER.RESET_CONFIRM'),
      nzOkDanger: true,
      nzOkText: this.i18n.translate('DASHBOARD_BUILDER.RESET'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOnOk: () =>
        this.api.resetLayout().subscribe({
          next: (res) => {
            this.applyLayout(res.data);
            this.message.success(this.i18n.translate('DASHBOARD_BUILDER.RESET_DONE'));
          },
          error: () => this.message.error(this.i18n.translate('DASHBOARD_BUILDER.SAVE_FAILED')),
        }),
    });
  }

  protected loadPreview(): void {
    this.previewLoading.set(true);
    this.api.getWidgetData(this.placements().map((placement) => placement.widget_id)).subscribe({
      next: (res) => {
        this.preview.set(res.data);
        this.previewLoading.set(false);
      },
      error: () => {
        this.previewLoading.set(false);
        this.message.error(this.i18n.translate('DASHBOARD_BUILDER.LOAD_FAILED'));
      },
    });
  }

  private loadLayout(): void {
    this.api.getLayout().subscribe({
      next: (res) => {
        this.applyLayout(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.i18n.translate('DASHBOARD_BUILDER.LOAD_FAILED'));
      },
    });
  }

  private applyLayout(layout: DashboardLayout): void {
    this.layout.set(layout);
    this.name.set(layout.name ?? '');
    this.placements.set((layout.widgets_layout ?? []).map((item) => ({ ...item })));
    this.dirty.set(false);
  }
}
