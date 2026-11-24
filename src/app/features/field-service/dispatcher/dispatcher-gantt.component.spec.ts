import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import type { FsmBoardLane, FsmBoardUnassigned } from '@core';
import { I18nService } from '@core';
import { icons } from '../../../icons-provider';
import { DispatcherGanttComponent } from './dispatcher-gantt.component';

const window = { from: '2026-03-02T00:00:00Z', to: '2026-03-09T00:00:00Z' };

const lane: FsmBoardLane = {
  technician_id: 't1',
  name: 'Anna Rossi',
  is_available: true,
  skills: ['hvac'],
  van: { warehouse_id: 'v1', ready: true, distinct_products_in_stock: 0, stock: {} },
  blocks: [
    {
      work_order_id: 'w1',
      work_order_number: 'WO-1',
      title: 'Boiler',
      work_type: 'corrective',
      priority: 'normal',
      status: 'on_site',
      scheduled_start: '2026-03-03T08:00:00Z',
      scheduled_end: '2026-03-03T10:00:00Z',
      site: { address: null, latitude: null, longitude: null },
    },
    {
      work_order_id: 'w2',
      work_order_number: 'WO-2',
      title: 'Outside the window',
      work_type: 'corrective',
      priority: 'normal',
      status: 'dispatched',
      scheduled_start: '2026-04-03T08:00:00Z',
      scheduled_end: '2026-04-03T10:00:00Z',
      site: { address: null, latitude: null, longitude: null },
    },
  ],
};

const queued: FsmBoardUnassigned = {
  work_order_id: 'q1',
  work_order_number: 'WO-Q',
  title: 'Needs electrics',
  work_type: 'corrective',
  priority: 'urgent',
  status: 'unscheduled',
  scheduled_start: null,
  scheduled_end: null,
  site: { address: null, latitude: null, longitude: null },
  required_skills: ['electrical'],
  required_parts: [{ product_id: 'p1', quantity: 2 }],
};

describe('DispatcherGanttComponent', () => {
  let fixture: ComponentFixture<DispatcherGanttComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DispatcherGanttComponent],
      providers: [
        provideNzIcons(icons),
        { provide: I18nService, useValue: { currentLanguage: () => 'it', translate: (key: string) => key } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DispatcherGanttComponent);
    fixture.componentRef.setInput('lanes', [lane]);
    fixture.componentRef.setInput('window', window);
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('renders one coloured bar per block inside the window', () => {
    const bars = el().querySelectorAll<HTMLElement>('.gantt-bar');
    expect(bars).toHaveLength(1);
    expect(bars[0].dataset['status']).toBe('on_site');
    expect(bars[0].style.backgroundColor).not.toBe('');
    expect(el().querySelectorAll('.gantt-tick')).toHaveLength(7);
  });

  it('shows skill and van warnings of the queue item being assigned', () => {
    expect(el().querySelector('[data-testid="skill-warning"]')).toBeNull();
    fixture.componentRef.setInput('selected', queued);
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="skill-warning"]')?.textContent).toContain('electrical');
    expect(el().querySelector('[data-testid="stock-warning"]')).not.toBeNull();
  });

  it('emits the clicked block and the lane assign action', () => {
    const blockSpy = vi.fn();
    const laneSpy = vi.fn();
    fixture.componentInstance.blockSelected.subscribe(blockSpy);
    fixture.componentInstance.laneAction.subscribe(laneSpy);
    fixture.componentRef.setInput('selected', queued);
    fixture.detectChanges();

    el().querySelector<HTMLButtonElement>('.gantt-bar')?.click();
    expect(blockSpy).toHaveBeenCalledWith({ block: lane.blocks[0], lane });

    el().querySelector<HTMLButtonElement>('.gantt-label button')?.click();
    expect(laneSpy).toHaveBeenCalledWith(lane);
  });

  it('emits the clicked instant only while a queue item is selected', () => {
    const slotSpy = vi.fn();
    fixture.componentInstance.slotSelected.subscribe(slotSpy);
    const track = el().querySelector<HTMLElement>('.gantt-row:not(.gantt-head) .gantt-track') as HTMLElement;
    track.getBoundingClientRect = () => ({ left: 0, width: 700, top: 0, right: 700, bottom: 56, height: 56, x: 0, y: 0, toJSON: () => ({}) });

    track.dispatchEvent(new MouseEvent('click', { clientX: 350 }));
    expect(slotSpy).not.toHaveBeenCalled();

    fixture.componentRef.setInput('selected', queued);
    fixture.detectChanges();
    track.dispatchEvent(new MouseEvent('click', { clientX: 350 }));
    expect(slotSpy).toHaveBeenCalledWith({ lane, at: '2026-03-05T12:00:00.000Z' });
  });
});
