import { TimeAttendanceData } from '@domain/models/time-attendance.model';
import { TimeAttendanceDto } from '../dtos/time-attendance.dto';

export class TimeAttendanceMapper {
  static toDomain(dto: TimeAttendanceDto): TimeAttendanceData {
    return {
      summary: { ...dto.summary },
      todaySession: { ...dto.todaySession },
      records: dto.records.map((r) => ({ ...r })),
      vacations: { ...dto.vacations },
    };
  }

  static toDto(model: TimeAttendanceData): TimeAttendanceDto {
    return {
      summary: { ...model.summary },
      todaySession: { ...model.todaySession },
      records: model.records.map((r) => ({ ...r })),
      vacations: { ...model.vacations },
    };
  }
}
