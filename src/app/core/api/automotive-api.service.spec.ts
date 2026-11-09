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

  it('fetches vehicles and tire hotel records', () => {
    const mockVehicle: AutomotiveVehicle = {
      id: 'v-1',
      license_plate: 'AA123BB',
      make: 'Fiat',
      model: '500',
      year: 2022,
    };

    service.getVehicles().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].license_plate).toBe('AA123BB');
    });

    const vReq = httpMock.expectOne(`${base}/vehicles`);
    expect(vReq.request.method).toBe('GET');
    vReq.flush({ data: [mockVehicle] });

    service.getTireHotelRecords().subscribe((records) => {
      expect(records.length).toBe(1);
    });

    const tReq = httpMock.expectOne(`${base}/tire-hotel`);
    expect(tReq.request.method).toBe('GET');
    tReq.flush([
      {
        id: 'tire-1',
        customerName: 'Mario Rossi',
        vehiclePlate: 'AA123BB',
        vehicleModel: 'Fiat 500',
        season: 'WINTER',
      },
    ]);
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

  it('checks in tires and sends reminder', () => {
    const payload: TireCheckInPayload = {
      vehicle_id: 'v-1',
      customer_id: 'cust-1',
      season: 'WINTER',
      brand: 'Michelin',
      model: 'Alpin 6',
      dot: '4022',
      tread_depth_mm: { front_left: 6, front_right: 6, rear_left: 5, rear_right: 5 },
      has_rims: true,
      rim_type: 'Alloy',
      rack_location: 'A-12-3',
    };

    service.checkInTires(payload).subscribe((res) => {
      expect(res).toBeTruthy();
    });

    const ciReq = httpMock.expectOne(`${base}/tire-hotel/check-in`);
    expect(ciReq.request.method).toBe('POST');
    ciReq.flush({ success: true });

    service.sendReminder('tire-1').subscribe((res) => {
      expect(res).toBeTruthy();
    });

    const rReq = httpMock.expectOne(`${base}/tire-hotel/tire-1/reminder`);
    expect(rReq.request.method).toBe('POST');
    rReq.flush({ success: true });
  });
});
