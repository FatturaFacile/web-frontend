import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { TimeAttendanceData } from '@domain/models/time-attendance.model';
import { TIME_ATTENDANCE_REPOSITORY, TimeAttendanceRepository } from '@domain/repositories/time-attendance.repository';
import { TimeAttendanceStore } from './time-attendance.store';

describe('TimeAttendanceStore', () => {
  let store: InstanceType<typeof TimeAttendanceStore>;
  let mockRepository: {
    getData: ReturnType<typeof vi.fn>;
    toggleClock: ReturnType<typeof vi.fn>;
  };

  const mockData: TimeAttendanceData = {
    summary: {
      weeklyHoursWorked: 36.0,
      weeklyLimitHours: 45.0,
      overtimeHours: 0.0,
      vacationDaysAvailable: 20.0,
      statutoryRestCompliant: true,
      jurisdiction: 'CH',
      regime: 'SWISS_ARG_ART_9',
    },
    todaySession: {
      isClockedIn: false,
      clockInTime: '08:00',
      breakMinutes: 30,
      totalTodayHours: 4.5,
    },
    records: [
      {
        id: 'att-1',
        date: '2026-10-20',
        clockIn: '08:00',
        clockOut: '12:30',
        breakMinutes: 30,
        hoursWorked: 4.0,
        complianceNotice: 'Conforme ArG',
        status: 'COMPLETED',
      },
    ],
    vacations: {
      annualEntitlementDays: 25,
      takenDays: 5,
      remainingDays: 20,
      rolHoursAvailable: 30.0,
    },
  };

  beforeEach(() => {
    mockRepository = {
      getData: vi.fn().mockReturnValue(of(mockData)),
      toggleClock: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TimeAttendanceStore,
        { provide: TIME_ATTENDANCE_REPOSITORY, useValue: mockRepository as unknown as TimeAttendanceRepository },
      ],
    });

    store = TestBed.inject(TimeAttendanceStore);
  });

  it('should initialize and load attendance data calculating weekly progress percentage', () => {
    expect(store.data()).toBeNull();
    expect(store.weeklyPercent()).toBe(0);

    store.loadData();

    expect(mockRepository.getData).toHaveBeenCalledTimes(1);
    expect(store.data()).toEqual(mockData);
    expect(store.weeklyWorked()).toBe(36.0);
    expect(store.weeklyLimit()).toBe(45.0);
    // 36 / 45 = 80%
    expect(store.weeklyPercent()).toBe(80);
    expect(store.isClockedIn()).toBe(false);
  });

  it('should toggle clock-in and clock-out session state', () => {
    store.loadData();

    expect(store.isClockedIn()).toBe(false);

    store.toggleClock();
    expect(store.isClockedIn()).toBe(true);

    store.toggleClock();
    expect(store.isClockedIn()).toBe(false);
  });
});
