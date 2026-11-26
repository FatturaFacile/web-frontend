import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import type { FsmBoardBlock, FsmBoardLane, FsmBoardUnassigned } from '@core';
import { I18nService } from '@core';
import { icons } from '../../../icons-provider';
import { DispatcherMapComponent } from './dispatcher-map.component';

function block(id: string, start: string, lat: number, lng: number): FsmBoardBlock {
  return {
    work_order_id: id,
    work_order_number: `WO-${id}`,
    title: id,
    work_type: 'corrective',
    priority: 'normal',
    status: 'dispatched',
    scheduled_start: start,
    scheduled_end: new Date(Date.parse(start) + 3_600_000).toISOString(),
    site: { address: null, latitude: lat, longitude: lng },
  };
}

const lane: FsmBoardLane = {
  technician_id: 't1',
  name: 'Anna Rossi',
  is_available: true,
  skills: [],
  van: { warehouse_id: 'v', ready: true, distinct_products_in_stock: 0, stock: {} },
  blocks: [
    block('1', '2026-03-02T08:00:00Z', 47.3769, 8.5417),
    block('2', '2026-03-02T10:00:00Z', 46.948, 7.4474),
    block('3', '2026-03-02T12:00:00Z', 47.4988, 8.7237),
  ],
};

const queued: FsmBoardUnassigned = {
  work_order_id: 'q1',
  work_order_number: 'WO-Q',
  title: 'Queue',
  work_type: 'corrective',
  priority: 'normal',
  status: 'unscheduled',
  scheduled_start: null,
  scheduled_end: null,
  site: { address: null, latitude: 47.0, longitude: 8.0 },
  required_skills: [],
  required_parts: [],
};

describe('DispatcherMapComponent', () => {
  let fixture: ComponentFixture<DispatcherMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DispatcherMapComponent],
      providers: [
        provideNzIcons(icons),
        { provide: I18nService, useValue: { currentLanguage: () => 'it', translate: (key: string) => key } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DispatcherMapComponent);
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('shows an empty state without coordinates', () => {
    fixture.componentRef.setInput('lanes', []);
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="map-empty"]')).not.toBeNull();
    expect(el().querySelector('svg.map-svg')).toBeNull();
  });

  it('plots queued and scheduled sites with one route polyline per technician', () => {
    fixture.componentRef.setInput('lanes', [lane]);
    fixture.componentRef.setInput('unassigned', [queued]);
    fixture.detectChanges();

    expect(el().querySelectorAll('circle')).toHaveLength(4);
    expect(el().querySelectorAll('polyline')).toHaveLength(1);
    expect(el().querySelector('[data-testid="pin-q1"]')).not.toBeNull();
  });

  it('lists the optimised stop order with distance and travel time, and the current order on demand', () => {
    fixture.componentRef.setInput('lanes', [lane]);
    fixture.detectChanges();

    const rows = (): string => el().querySelector('[data-testid="route-table"] tbody')?.textContent ?? '';
    // Nearest neighbour from Zurich goes to Winterthur before Bern.
    expect(rows()).toContain('WO-1 → WO-3 → WO-2');
    expect(rows()).toContain('km');
    expect(rows()).toContain('min');

    const buttons = el().querySelectorAll<HTMLButtonElement>('.map-toolbar button');
    buttons[1].click();
    fixture.detectChanges();
    expect(rows()).toContain('WO-1 → WO-2 → WO-3');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
  });
});
