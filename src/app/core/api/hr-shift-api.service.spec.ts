import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { HrShiftApiService } from '@core';

const ok = { success: true, message: '', data: [] };
const one = { success: true, message: '', data: {} };

describe('HrShiftApiService', () => {
  let service: HrShiftApiService;
  let httpMock: HttpTestingController;
  const hr = `${environment.apiBaseUrl}/hr`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [HrShiftApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HrShiftApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('shift types and sequences', () => {
    service.getShiftTypes().subscribe();
    httpMock.expectOne(`${hr}/shift-types`).flush(ok);
    service.createShiftType({ code: 'M', name: 'Morning', category: 'working', start_time: '07:00' }).subscribe();
    httpMock.expectOne(`${hr}/shift-types`).flush(one);
    service.updateShiftType('t1', { code: 'M', name: 'Morning', category: 'working' }).subscribe();
    const put = httpMock.expectOne(`${hr}/shift-types/t1`);
    expect(put.request.method).toBe('PUT');
    put.flush(one);

    service.getShiftSequences().subscribe();
    httpMock.expectOne(`${hr}/shift-sequences`).flush(ok);
    service.createShiftSequence({ name: 'Rot', pattern: 'rotation', steps: ['M', null, 'N'] }).subscribe();
    const seq = httpMock.expectOne(`${hr}/shift-sequences`);
    expect(seq.request.body.steps).toEqual(['M', null, 'N']);
    seq.flush(one);
    service
      .assignShiftSequence({ employee_id: 'e1', shift_sequence_id: 's1', start_date: '2026-12-01' })
      .subscribe();
    httpMock.expectOne(`${hr}/shift-sequences/assignments`).flush(one);
    service.addShiftException({ exception_date: '2026-12-25', reason: 'Christmas' }).subscribe();
    httpMock.expectOne(`${hr}/shift-exceptions`).flush(one);
    service
      .setStaffingNeed({ department_id: 'd1', shift_type_id: 't1', day_kind: 'weekday', required_count: 3, valid_from: '2026-12-01' })
      .subscribe();
    httpMock.expectOne(`${hr}/staffing-needs`).flush(one);
  });

  it('board, generate, publish and single shifts', () => {
    service.getBoard({ from: '2026-12-01', to: '2026-12-07', department_id: 'd1' }).subscribe();
    const board = httpMock.expectOne((r) => r.url === `${hr}/shifts/board`);
    expect(board.request.params.get('department_id')).toBe('d1');
    board.flush(one);
    service.generateShifts({ from: '2026-12-01', to: '2026-12-07' }).subscribe();
    const gen = httpMock.expectOne(`${hr}/shifts/generate`);
    expect(gen.request.method).toBe('POST');
    gen.flush({ success: true, message: '', data: { created: 4 } });
    service.publishShifts({ from: '2026-12-01', to: '2026-12-07' }).subscribe();
    httpMock.expectOne(`${hr}/shifts/publish`).flush(one);

    const shift = { employee_id: 'e1', shift_type_id: 't1', work_date: '2026-12-02' };
    service.placeShift(shift).subscribe();
    httpMock.expectOne(`${hr}/shifts`).flush(one);
    service.moveShift('s1', { ...shift, work_date: '2026-12-03' }).subscribe();
    const move = httpMock.expectOne(`${hr}/shifts/s1`);
    expect(move.request.method).toBe('PUT');
    move.flush(one);
    service.deleteShift('s1').subscribe();
    httpMock.expectOne(`${hr}/shifts/s1`).flush(null, { status: 204, statusText: 'No Content' });
  });

  it('absence plan and own shifts', () => {
    service.getAbsencePlan({ from: '2026-12-01', to: '2026-12-31' }).subscribe();
    httpMock.expectOne((r) => r.url === `${hr}/absence-plan`).flush(ok);
    service.getMyShifts({ from: '2026-12-01', to: '2026-12-31' }).subscribe();
    const mine = httpMock.expectOne((r) => r.url === `${hr}/time/my-shifts`);
    expect(mine.request.params.get('from')).toBe('2026-12-01');
    mine.flush(ok);
  });
});
