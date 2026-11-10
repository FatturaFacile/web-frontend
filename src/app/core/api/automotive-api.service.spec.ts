import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { AutomotiveVehicle, TireCheckInPayload } from '../models';
import { AutomotiveApiService } from './automotive-api.service';

describe('AutomotiveApiService', () => {
  let service: AutomotiveApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/automotive`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AutomotiveApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AutomotiveApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches vehicles and the seasonal switch plan', () => {
    const mockVehicle: AutomotiveVehicle = {
      id: 'v-1',
      license_plate: 'AA123BB',
      make: 'Fiat',
      model: '500',
      year: 2022,
    };

    service.getVehicles().subscribe((res) => {
      expect(res.data.data.length).toBe(1);
      expect(res.data.data[0].license_plate).toBe('AA123BB');
    });

    const vReq = httpMock.expectOne(`${base}/vehicles`);
    expect(vReq.request.method).toBe('GET');
    vReq.flush({ data: { current_page: 1, data: [mockVehicle], last_page: 1, per_page: 15, total: 1 } });

    service.getSeasonalSwitchPlan().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].warehouse_shelf_location).toBe('A-12-3');
    });

    const tReq = httpMock.expectOne(`${base}/tire-hotel/seasonal-switch-plan`);
    expect(tReq.request.method).toBe('GET');
    tReq.flush({
      success: true,
      data: [{ id: 'tire-1', vehicle_id: 'v-1', season: 'winter', warehouse_shelf_location: 'A-12-3' }],
    });
  });

  it('registers, gets, updates, and deletes an automotive vehicle', () => {
    const newVehicle: Partial<AutomotiveVehicle> = {
      license_plate: 'MI999ZZ',
      make: 'Alfa Romeo',
      model: 'Giulia',
      year: 2024,
    };

    const returnedVehicle: AutomotiveVehicle = {
      id: 'v-2',
      license_plate: 'MI999ZZ',
      make: 'Alfa Romeo',
      model: 'Giulia',
      year: 2024,
    };

    service.registerVehicle(newVehicle).subscribe((res) => {
      expect(res.data.id).toBe('v-2');
    });

    const postReq = httpMock.expectOne(`${base}/vehicles`);
    expect(postReq.request.method).toBe('POST');
    postReq.flush({ success: true, data: returnedVehicle });

    service.getVehicle('v-2').subscribe((res) => {
      expect(res.data.make).toBe('Alfa Romeo');
    });

    const getReq = httpMock.expectOne(`${base}/vehicles/v-2`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ success: true, data: returnedVehicle });

    service.updateVehicle('v-2', { model: 'Giulia Veloce' }).subscribe((res) => {
      expect(res.data.model).toBe('Giulia Veloce');
    });

    const putReq = httpMock.expectOne(`${base}/vehicles/v-2`);
    expect(putReq.request.method).toBe('PUT');
    putReq.flush({ success: true, data: { ...returnedVehicle, model: 'Giulia Veloce' } });

    service.deleteVehicle('v-2').subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const delReq = httpMock.expectOne(`${base}/vehicles/v-2`);
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush({ success: true });
  });

  it('checks in and checks out tires', () => {
    const payload: TireCheckInPayload = {
      vehicle_id: 'v-1',
      season: 'winter',
      brand: 'Michelin',
      model: 'Alpin 6',
      size: '205/55 R16',
      dot: '4022',
      front_left_tread_mm: 6,
      front_right_tread_mm: 6,
      rear_left_tread_mm: 5,
      rear_right_tread_mm: 5,
      warehouse_shelf_location: 'A-12-3',
    };

    service.checkInTires(payload).subscribe((res) => {
      expect(res.data.id).toBe('tire-1');
    });

    const ciReq = httpMock.expectOne(`${base}/tire-hotel/check-in`);
    expect(ciReq.request.method).toBe('POST');
    expect(ciReq.request.body).toEqual(payload);
    ciReq.flush({ success: true, data: { id: 'tire-1', status: 'stored' } });

    service.checkOutTires('tire-1').subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const coReq = httpMock.expectOne(`${base}/tire-hotel/tire-1/check-out`);
    expect(coReq.request.method).toBe('POST');
    coReq.flush({ success: true, data: null });
  });
});
