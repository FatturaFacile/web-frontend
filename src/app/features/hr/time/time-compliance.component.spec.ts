import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { HrTimeApiService, I18nService } from '@core';
import { legalExportParams, TimeComplianceComponent } from './time-compliance.component';

describe('legalExportParams', () => {
  it('uses the LUL format for Italy and the SECO format for Switzerland', () => {
    expect(legalExportParams('IT', '2027-01-01', '2027-01-31', null)).toEqual({
      jurisdiction: 'IT',
      from: '2027-01-01',
      to: '2027-01-31',
      format: 'lul_csv',
    });
    expect(legalExportParams('CH', '2027-01-01', '2027-01-31', 'e1')).toMatchObject({ format: 'seco_csv', employee_id: 'e1' });
  });
});

describe('TimeComplianceComponent', () => {
  const api = {
    exportLegal: vi.fn(),
    verifyIntegrity: vi.fn(),
    getComplianceAlerts: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: HrTimeApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(TimeComplianceComponent);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as {
      from: { set(v: string): void };
      to: { set(v: string): void };
      verify(): void;
      checkAlerts(): void;
      integrity(): unknown;
      alerts(): unknown;
    };
  }

  it('verifies the hash chain and shows the result', () => {
    api.verifyIntegrity.mockReturnValue(of({ data: { verified: true, entries_checked: 10, broken_at_id: null } }));
    const component = create();
    component.verify();
    expect(api.verifyIntegrity).toHaveBeenCalled();
    expect(component.integrity()).toEqual({ verified: true, entries_checked: 10, broken_at_id: null });
  });

  it('loads the compliance alerts of the period', () => {
    api.getComplianceAlerts.mockReturnValue(of({ data: { jurisdiction: 'CH', alerts: [], checked_from: 'a', checked_to: 'b' } }));
    const component = create();
    component.from.set('2027-01-01');
    component.to.set('2027-01-31');
    component.checkAlerts();
    expect(api.getComplianceAlerts).toHaveBeenCalledWith(expect.objectContaining({ jurisdiction: 'CH', from: '2027-01-01', to: '2027-01-31' }));
    expect(component.alerts()).not.toBeNull();
  });
});
