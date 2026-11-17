import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutomotiveApiService, TranslateService } from '@core';
import { TireCheckInComponent } from './tire-check-in.component';

describe('TireCheckInComponent', () => {
  const api = { listVehicles: vi.fn(), checkInTires: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.listVehicles.mockReturnValue(of({ data: [{ id: 'v1', license_plate: 'AA123BB', make: 'Fiat', model: 'Panda' }] }));
    api.checkInTires.mockReturnValue(of({ data: { id: 't1', status: 'stored' } }));
    TestBed.configureTestingModule({
      providers: [
        { provide: AutomotiveApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(TireCheckInComponent);
    fixture.componentRef.setInput('open', true);
    const checkedIn = vi.fn();
    fixture.componentInstance.checkedIn.subscribe(checkedIn);
    return { component: fixture.componentInstance, checkedIn };
  }

  it('does not submit an incomplete form', () => {
    const { component } = create();
    component['submit']();
    expect(api.checkInTires).not.toHaveBeenCalled();
  });

  it('sends the TireCheckInPayload of the API and closes the dialog', () => {
    const { component, checkedIn } = create();
    component['searchVehicles']('AA');
    expect(api.listVehicles).toHaveBeenCalledWith({ search: 'AA', per_page: 20 });

    component['form'].patchValue({ vehicle_id: 'v1', season: 'summer', brand: 'Pirelli', size: '195/65R15', warehouse_shelf_location: 'A-12' });
    component['submit']();

    expect(api.checkInTires).toHaveBeenCalledWith(expect.objectContaining({ vehicle_id: 'v1', season: 'summer', brand: 'Pirelli', model: null, dot: null, front_left_tread_mm: 8 }));
    expect(checkedIn).toHaveBeenCalled();
    expect(component.open()).toBe(false);
  });
});
