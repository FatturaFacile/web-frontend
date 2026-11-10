import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import { DashboardApiService, I18nService } from '@core';
import { DashboardBuilderComponent } from './dashboard-builder.component';

interface Harness {
  placements(): { widget_id: string; x: number; y: number; w: number; h: number }[];
  availableToAdd(): { id: string }[];
  widgetToAdd: { set(value: string | null): void };
  add(): void;
  remove(index: number): void;
  move(index: number, delta: -1 | 1): void;
  setNumber(index: number, key: 'x' | 'y' | 'w' | 'h', value: number | null): void;
  save(): void;
  reset(): void;
  dirty(): boolean;
}

describe('DashboardBuilderComponent', () => {
  let fixture: ComponentFixture<DashboardBuilderComponent>;
  let harness: Harness;

  const catalogue = [
    { id: 'kpi', title: 'KPI', description: '', type: 'kpi', default_dimensions: { w: 4, h: 2 }, configurable_options: {} },
    { id: 'cash', title: 'Cash flow', description: '', type: 'chart', default_dimensions: { w: 6, h: 3 }, configurable_options: {} },
  ];
  const layout = {
    id: null,
    name: 'Factory',
    is_default: true,
    is_customized: false,
    updated_at: null,
    widgets_layout: [{ widget_id: 'kpi', x: 0, y: 0, w: 4, h: 2 }],
  };
  const api = {
    getAvailableWidgets: vi.fn(),
    getLayout: vi.fn(),
    saveLayout: vi.fn(),
    resetLayout: vi.fn(),
    getWidgetData: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };
  const modal = { confirm: vi.fn((options: { nzOnOk: () => void }) => options.nzOnOk()) };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getAvailableWidgets.mockReturnValue(of({ data: catalogue }));
    api.getLayout.mockReturnValue(of({ data: layout }));
    api.saveLayout.mockReturnValue(of({ data: { ...layout, is_customized: true } }));
    api.resetLayout.mockReturnValue(of({ data: layout }));

    await TestBed.overrideProvider(NzModalService, { useValue: modal })
      .configureTestingModule({
      imports: [DashboardBuilderComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: DashboardApiService, useValue: api },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
        { provide: NzModalService, useValue: modal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardBuilderComponent);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  });

  it('loads the catalogue and the layout and offers only the widgets not placed yet', () => {
    expect(harness.placements().length).toBe(1);
    expect(harness.availableToAdd().map((widget) => widget.id)).toEqual(['cash']);
  });

  it('adds a widget below the others with its default size', () => {
    harness.widgetToAdd.set('cash');
    harness.add();

    expect(harness.placements()[1]).toEqual({ widget_id: 'cash', x: 0, y: 2, w: 6, h: 3 });
    expect(harness.dirty()).toBe(true);
  });

  it('saves the edited layout', () => {
    harness.setNumber(0, 'w', 8);
    harness.save();

    expect(api.saveLayout).toHaveBeenCalledWith({
      name: 'Factory',
      widgets_layout: [{ widget_id: 'kpi', x: 0, y: 0, w: 8, h: 2 }],
    });
    expect(harness.dirty()).toBe(false);
  });

  it('removes and reorders widgets', () => {
    harness.widgetToAdd.set('cash');
    harness.add();
    harness.move(1, -1);
    expect(harness.placements().map((item) => item.widget_id)).toEqual(['cash', 'kpi']);
    harness.remove(0);
    expect(harness.placements().map((item) => item.widget_id)).toEqual(['kpi']);
  });

  it('restores the factory layout after confirmation', () => {
    harness.reset();
    expect(api.resetLayout).toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith('DASHBOARD_BUILDER.RESET_DONE');
  });
});
