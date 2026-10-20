import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { TimeAttendanceData } from '@domain/models/time-attendance.model';
import { TimeAttendanceRepository } from '@domain/repositories/time-attendance.repository';
import { TimeAttendanceDto } from '../dtos/time-attendance.dto';
import { TimeAttendanceMapper } from '../mappers/time-attendance.mapper';

@Injectable()
export class TimeAttendanceHttpRepository implements TimeAttendanceRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/time-attendance';

  getData(): Observable<TimeAttendanceData> {
    return this.http
      .get<TimeAttendanceDto>(this.baseUrl)
      .pipe(map((dto) => TimeAttendanceMapper.toDomain(dto)));
  }

  toggleClock(): Observable<TimeAttendanceData> {
    return this.getData();
  }
}
