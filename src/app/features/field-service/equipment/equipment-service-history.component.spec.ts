import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import type { FsmEquipment, FsmEquipmentHistory } from '@core';
import { FsmApiService, I18nService, PermissionsService } from '@core';
import { icons } from '../../../icons-provider';
import { EquipmentServiceHistoryComponent } from './equipment-service-history.component';

interface Harness {
  select(item: FsmEquipment): void;
  saveMeters(): void;
  meterForm: { patchValue(value: object): void; markAsDirty(): void; getRawValue(): { current_operating_hours: number | null; current_cycle_count: number | null } };
  meterError: () => string | null;
  selectedId: () => string | null;
}

const item: FsmEquipment = {
  id: 'e1',
  serial_number: 'SN-100',
  product_id: 'p1',
  customer_id: 'c1',
  service_contract_id: 'k1',
  site_address: 'Zurich',
  site_latitude: 47.37,
  site_longitude: 8.54,
  current_operating_hours: '100.0',
  current_cycle_count: 10,
  last_service_date: '2026-01-10',
  next_scheduled_service_date: '2026-07-10',
};

const history: FsmEquipmentHistory = {
  equipment: {
    id: 'e1',
    serial_number: 'SN-100',
    current_operating_hours: '100.0',
    current_cycle_count: 10,
    last_service_date: '2026-01-10',
    next_scheduled_service_date: '2026-07-10',
  },
  history: [
    {
      report_id: 'r1',
      report_number: 'SR-1',
      work_order_id: 'w1',
      work_type: 'preventive',
      signed_at: '2026-01-10T09:00:00+00:00',
      summary: 'Yearly service',
      labor_hours: '2.00',
      meter_reading_hours: '90.0',
      meter_reading_cycles: 8,
      parts: [
        { product_id: 'abcdefgh-1', quantity: '1', covered: true },
        { product_id: 'zzzzzzzz-2', quantity: '2', covered: false },
      ],
    },
  ],
};

describe('EquipmentServiceHistoryComponent', () => {
  let fixture: ComponentFixture<EquipmentServiceHistoryComponent>;
  let harness: Harness;
  const api = { listEquipment: vi.fn(), getEquipmentHistory: vi.fn(), updateMeters: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    vi.clearAllMocks();
    api.listEquipment.mockReturnValue(of({ data: [item] }));
    api.getEquipmentHistory.mockReturnValue(of({ data: history }));
    api.updateMeters.mockReturnValue(of({ data: { id: 'e1', current_operating_hours: '150.0', current_cycle_count: 12 } }));

    await TestBed.configureTestingModule({
      imports: [EquipmentServiceHistoryComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: FsmApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: I18nService, useValue: { currentLanguage: () => 'it', translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EquipmentServiceHistoryComponent);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  });

  it('lists the equipment with its meters', () => {
    expect(el().querySelector('[data-testid="equipment-table"]')?.textContent).toContain('SN-100');
    expect(el().querySelector('[data-testid="history-card"]')).toBeNull();
  });

  it('shows the chronological history with covered and chargeable parts and links to the work order', () => {
    harness.select(item);
    fixture.detectChanges();

    expect(api.getEquipmentHistory).toHaveBeenCalledWith('e1');
    const table = el().querySelector('[data-testid="history-table"]') as HTMLElement;
    expect(table.textContent).toContain('SR-1');
    expect(table.querySelector('a')?.getAttribute('href')).toBe('/field-service/work-orders/w1');
    expect(table.querySelectorAll('nz-tag')).toHaveLength(2);
    expect(harness.meterForm.getRawValue()).toEqual({ current_operating_hours: 100, current_cycle_count: 10 });
  });

  it('updates the meters then reloads the equipment and its history', () => {
    harness.select(item);
    harness.meterForm.patchValue({ current_operating_hours: 150, current_cycle_count: 12 });
    harness.saveMeters();

    expect(api.updateMeters).toHaveBeenCalledWith('e1', { current_operating_hours: 150, current_cycle_count: 12 });
    expect(message.success).toHaveBeenCalledWith('FSM.EQUIP.METERS_UPDATED');
    expect(api.listEquipment).toHaveBeenCalledTimes(2);
    expect(api.getEquipmentHistory).toHaveBeenCalledTimes(2);
  });

  it('shows the API message when the meter would regress', () => {
    api.updateMeters.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { message: 'invalid', errors: { meter_reading: ['Meter cannot decrease'] } } }),
      ),
    );
    harness.select(item);
    harness.meterForm.patchValue({ current_operating_hours: 10 });
    harness.saveMeters();

    expect(harness.meterError()).toBe('Meter cannot decrease');
    expect(message.success).not.toHaveBeenCalled();
  });

  it('does not save without a selected equipment', () => {
    harness.saveMeters();
    expect(api.updateMeters).not.toHaveBeenCalled();
  });
});
