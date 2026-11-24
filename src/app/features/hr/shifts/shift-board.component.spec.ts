import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HrShiftApiService } from '@core';
import { ShiftBoardComponent } from './shift-board.component';

describe('ShiftBoardComponent publication', () => {
  let fixture: ComponentFixture<ShiftBoardComponent>;
  let publishShifts: ReturnType<typeof vi.fn>;
  const violation = { employee_id: 'e1', employee_name: 'Mario Rossi', date: '2026-11-02', message: 'Rest below 11 hours', is_blocking: true };

  beforeEach(() => {
    publishShifts = vi.fn();
    TestBed.configureTestingModule({
      imports: [ShiftBoardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HrShiftApiService, useValue: { publishShifts, getBoard: () => of({ data: { rows: [] } }) } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(ShiftBoardComponent);
    const component = fixture.componentInstance as unknown as { from: { set(v: string): void }; to: { set(v: string): void } };
    component.from.set('2026-11-02');
    component.to.set('2026-11-08');
  });

  it('asks for a reason when the publication is blocked and sends it with the second attempt', () => {
    publishShifts.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { violations: [violation] } } })),
    );
    const component = fixture.componentInstance as unknown as {
      publish(): void;
      publishAnyway(): void;
      violations(): unknown[];
      acknowledgementReason: { set(v: string): void };
    };

    component.publish();
    expect(publishShifts).toHaveBeenLastCalledWith({ from: '2026-11-02', to: '2026-11-08' });
    expect(component.violations()).toHaveLength(1);

    publishShifts.mockReturnValueOnce(of({ data: {} }));
    component.acknowledgementReason.set('  Urgent coverage  ');
    component.publishAnyway();

    expect(publishShifts).toHaveBeenLastCalledWith({ from: '2026-11-02', to: '2026-11-08', acknowledgement_reason: 'Urgent coverage' });
    expect(component.violations()).toHaveLength(0);
  });
});
