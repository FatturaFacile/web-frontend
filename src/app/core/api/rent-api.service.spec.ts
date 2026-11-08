import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { RentApiService } from './rent-api.service';
import { CheckInInspectionPayload, RentalBooking, RentalVehicle } from '../models';

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
        },
      ],
    });
  });

  it('records check-in inspection', () => {
    const payload: CheckInInspectionPayload = {
      rental_booking_id: 'bk-1',
      mileage: 45200,
      fuel_level_eighths: 8,
      damages: [],
      notes: 'Veicolo restituito in perfetto stato con serbatoio pieno',
    };

    service.recordCheckInInspection(payload).subscribe((res) => {
      expect(res).toBeTruthy();
    });

    const postReq = httpMock.expectOne(`${base}/check-in-inspection`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual(payload);
    postReq.flush({ success: true });
  });
});
