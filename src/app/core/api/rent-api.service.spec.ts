import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { CheckInInspectionPayload, CheckOutInspectionPayload, RentalVehicle } from '../models';
import { RentApiService } from './rent-api.service';

describe('RentApiService', () => {
  let service: RentApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/rent`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RentApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(RentApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches rental vehicles and bookings', () => {
    const mockVehicle: RentalVehicle = {
      id: 'rv-1',
      plate: 'TI 98765',
      model: 'Volkswagen Golf',
      type: 'Berlina',
      client: 'Mario Bianchi',
      vignette: true,
      returnDate: '2026-05-01',
      status: 'rented',
    };

    service.getVehicles().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].plate).toBe('TI 98765');
    });

    const vReq = httpMock.expectOne(`${base}/vehicles`);
    expect(vReq.request.method).toBe('GET');
    vReq.flush({ data: [mockVehicle] });

    service.getBookings().subscribe((res) => {
      expect(res.data.length).toBe(1);
    });

    const bReq = httpMock.expectOne(`${base}/bookings`);
    expect(bReq.request.method).toBe('GET');
    bReq.flush({
      data: [
        {
          id: 'bk-1',
          vehicle_id: 'rv-1',
          client_id: 'cl-1',
          start_date: '2026-04-10',
          end_date: '2026-04-15',
          status: 'active',
          daily_rate: 85,
          total_amount: 425,
        },
      ],
    });
  });

  it('records check-in and check-out inspection', () => {
    const inPayload: CheckInInspectionPayload = {
      rental_booking_id: 'bk-1',
      mileage: 45200,
      fuel_level: '8/8',
      damage_markers: [],
    };

    service.recordCheckInInspection(inPayload).subscribe((res) => {
      expect(res).toBeTruthy();
    });

    const inReq = httpMock.expectOne(`${base}/check-in-inspection`);
    expect(inReq.request.method).toBe('POST');
    expect(inReq.request.body).toEqual(inPayload);
    inReq.flush({ success: true });

    const outPayload: CheckOutInspectionPayload = {
      rental_booking_id: 'bk-1',
      mileage: 45000,
      fuel_level: '8/8',
      damage_markers: ['graffio paraurti anteriore'],
    };

    service.recordCheckOutInspection(outPayload).subscribe((res) => {
      expect(res).toBeTruthy();
    });

    const outReq = httpMock.expectOne(`${base}/check-out-inspection`);
    expect(outReq.request.method).toBe('POST');
    expect(outReq.request.body).toEqual(outPayload);
    outReq.flush({ success: true });
  });
});
