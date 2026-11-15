import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { HospitalityApiService, HospitalityGridRow, TranslateService } from '@core';
import { addDaysIso, cellState, GRID_DAYS, HospitalityAvailabilityGridComponent } from './availability-grid.component';

const rows: HospitalityGridRow[] = [
  {
    room_type_id: 'rt-1',
    code: 'DBL',
    name: 'Double',
    total: 3,
    nights: [
      { date: '2026-11-25', booked: 0, held: 2, available: 1 },
      { date: '2026-11-26', booked: 3, held: 0, available: 0 },
    ],
  },
];

describe('availability grid', () => {
  const getAvailabilityGrid = vi.fn();

  beforeEach(() => {
    getAvailabilityGrid.mockReset().mockReturnValue(of({ success: true, data: rows }));
    TestBed.configureTestingModule({
      providers: [
        { provide: HospitalityApiService, useValue: { getAvailabilityGrid } },
        { provide: NzMessageService, useValue: { error: vi.fn(), success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key, translate: (key: string) => key } },
      ],
    });
  });

  it('adds days across month and year ends', () => {
    expect(addDaysIso('2026-11-25', 7)).toBe('2026-12-02');
    expect(addDaysIso('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('colours a night as free, tight, full or without rooms', () => {
    expect(cellState({ date: 'd', booked: 0, held: 0, available: 3 }, 3)).toBe('free');
    expect(cellState({ date: 'd', booked: 2, held: 0, available: 1 }, 3)).toBe('tight');
    expect(cellState({ date: 'd', booked: 3, held: 0, available: 0 }, 3)).toBe('full');
    expect(cellState({ date: 'd', booked: 0, held: 0, available: 0 }, 0)).toBe('none');
  });

  it('loads a fortnight from today and moves by a fortnight', () => {
    const fixture = TestBed.createComponent(HospitalityAvailabilityGridComponent);
    fixture.detectChanges();
    const [from, to] = getAvailabilityGrid.mock.calls[0] as [string, string];
    expect(to).toBe(addDaysIso(from, GRID_DAYS));

    (fixture.componentInstance as unknown as { shift: (days: number) => void }).shift(GRID_DAYS);
    expect(getAvailabilityGrid.mock.calls[1][0]).toBe(to);

    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('DBL - Double (3)');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('td.full').length).toBe(1);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('td.tight').length).toBe(1);
  });
});
