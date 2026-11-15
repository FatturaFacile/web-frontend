import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TmsTrackingEvent, TranslateService } from '@core';
import { TrackingTimelineComponent } from './tracking-timeline.component';

const event = (id: string, type: TmsTrackingEvent['event_type'], occurredAt: string): TmsTrackingEvent => ({
  id,
  transport_order_id: 'o-1',
  event_type: type,
  location: 'Milan',
  occurred_at: occurredAt,
  notes: null,
});

describe('TrackingTimelineComponent', () => {
  const create = (events: TmsTrackingEvent[]) => {
    TestBed.configureTestingModule({
      imports: [TrackingTimelineComponent],
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key, translate: (key: string) => key } }],
    });
    const fixture = TestBed.createComponent(TrackingTimelineComponent);
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();
    return fixture;
  };

  it('orders the events from the oldest to the newest', () => {
    const fixture = create([event('b', 'delivered', '2026-11-02T10:00:00Z'), event('a', 'picked_up', '2026-11-01T08:00:00Z')]);

    expect(fixture.componentInstance.sortedEvents().map((e) => e.id)).toEqual(['a', 'b']);
    const items = fixture.nativeElement.querySelectorAll('.tl-item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('RES.V.picked_up');
    expect(items[1].querySelector('.tl-dot').classList.contains('delivered')).toBe(true);
  });

  it('shows the empty state without events', () => {
    const fixture = create([]);

    expect(fixture.nativeElement.querySelector('.tracking-timeline')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('TMS.TIMELINE_EMPTY');
  });
});
