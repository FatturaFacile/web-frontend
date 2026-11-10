import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutomotiveApiService, AutomotiveVehicle, TireHotelRecord, TranslateService } from '@core';
import { TireHotelComponent } from './tire-hotel.component';

describe('TireHotelComponent', () => {
  const vehicle = { id: 'veh-1', license_plate: 'AA123BB', make: 'Fiat', model: 'Panda' } as AutomotiveVehicle;
  const tire = { id: 'tire-1', vehicle_id: 'veh-1', season: 'winter' } as TireHotelRecord;

  let component: TireHotelComponent;

  beforeEach(() => {
    const api = {
      getSeasonalSwitchPlan: vi.fn().mockReturnValue(of({ success: true, data: [tire] })),
      getVehicles: vi.fn().mockReturnValue(
        of({ success: true, data: { current_page: 1, data: [vehicle], last_page: 1, per_page: 15, total: 1 } }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AutomotiveApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new TireHotelComponent());
  });

  it('reads the vehicle rows from the nested paginator and resolves the vehicle of a tire set', () => {
    component.loadTireRecords();

    expect(component.vehicles()).toEqual([vehicle]);
    expect(component.vehicleOf(tire)).toEqual(vehicle);
    expect(component.tireRecords().length).toBe(1);
  });
});
