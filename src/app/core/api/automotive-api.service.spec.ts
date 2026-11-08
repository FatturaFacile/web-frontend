import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { AutomotiveApiService } from './automotive-api.service';
import { AutomotiveVehicle, TireCheckInPayload, TireRecord } from '../models';

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
      plate: 'AA123BB',
      make: 'Fiat',
      model: '500',
      year: 2022,
    };

    service.getVehicles().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].plate).toBe('AA123BB');
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
        storageLocation: 'RACK-A1',
      },
    ]);
  });

  it('handles check-in, check-out and reminder for tire hotel', () => {
    const checkInPayload: TireCheckInPayload = {
      vehicle_id: 'v-1',
      season: 'WINTER',
      brand: 'Michelin',
      model: 'Alpin 6',
      size: '205/55 R16',
      dot: '4223',
      storage_location: 'RACK-B2',
      tread_depth_fl: 7.5,
      tread_depth_fr: 7.5,
      tread_depth_rl: 7.0,
      tread_depth_rr: 7.0,
    };

    service.checkInTires(checkInPayload).subscribe((res) => {
      expect(res).toBeTruthy();
    });
    const inReq = httpMock.expectOne(`${base}/tire-hotel/check-in`);
    expect(inReq.request.method).toBe('POST');
    inReq.flush({ success: true });

    service.checkOutTires('tire-1').subscribe((res) => {
      expect(res).toBeTruthy();
    });
    const outReq = httpMock.expectOne(`${base}/tire-hotel/tire-1/check-out`);
    expect(outReq.request.method).toBe('POST');
    outReq.flush({ success: true });

    service.sendReminder('tire-1').subscribe((res) => {
      expect(res).toBeTruthy();
    });
    const remReq = httpMock.expectOne(`${base}/tire-hotel/tire-1/reminder`);
    expect(remReq.request.method).toBe('POST');
    remReq.flush({ success: true });
  });
});
