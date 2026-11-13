import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutomotiveApiService, TireHotelRecord, TranslateService } from '@core';
import { TireHotelComponent } from './tire-hotel.component';

describe('TireHotelComponent', () => {
  const tire = { id: 'tire-1', vehicle_id: 'veh-1', season: 'winter', license_plate: 'AA123BB' } as TireHotelRecord;

  let component: TireHotelComponent;
  let listSeasonalSwitchPlan: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listSeasonalSwitchPlan = vi.fn().mockImplementation((query: Record<string, unknown>) =>
      query['grid_values']
        ? of({ data: [{ value: 'winter', count: 7 }, { value: 'summer', count: 3 }], meta: { total: 2 } })
        : of({ data: [tire], meta: { total: 10, last_page: 1 } }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: AutomotiveApiService, useValue: { listSeasonalSwitchPlan, checkOutTires: vi.fn().mockReturnValue(of({})) } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new TireHotelComponent());
  });

  it('counts the seasons over the whole dataset, not over the loaded page', () => {
    expect(component.winterCount()).toBe(7);
    expect(component.summerCount()).toBe(3);
    expect(listSeasonalSwitchPlan).toHaveBeenCalledWith(expect.objectContaining({ grid_values: 'season' }));
  });

  it('serves the vehicle plate and the translated season through server-driven columns', () => {
    const [plate, season] = component.columns();

    expect(plate.serverKey).toBe('vehicle.license_plate');
    expect(plate.valueGetter?.(tire)).toBe('AA123BB');
    expect(season.valueLabel?.('winter')).toBe('automotive.tireHotel.season.winter');
    expect(season.valueLabel?.('all_season')).toBe('TIRE_HOTEL.SEASON_ALL');
  });

  it('reloads the grid and the season counts after a check-out', () => {
    listSeasonalSwitchPlan.mockClear();

    component.checkOut(tire);

    expect(listSeasonalSwitchPlan).toHaveBeenCalledWith(expect.objectContaining({ grid_values: 'season' }));
    expect(component.checkingOutId()).toBeNull();
  });
});
