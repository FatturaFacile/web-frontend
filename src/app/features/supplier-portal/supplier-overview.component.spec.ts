import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierPortalApiService, SupplierPortalSummary, SupplierRiskProfile, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { SupplierOverviewComponent } from './supplier-overview.component';

describe('SupplierOverviewComponent', () => {
  let fixture: ComponentFixture<SupplierOverviewComponent>;
  let component: SupplierOverviewComponent;

  const summary: SupplierPortalSummary = {
    onboardings_by_status: {
      invited: 1,
      registration_submitted: 0,
      documents_required: 2,
      under_review: 3,
      approved: 10,
      rejected: 0,
      blocked: 1,
    },
    documents_to_review: 4,
    documents_expiring: 2,
    bank_changes_pending: 1,
    suppliers_by_risk: { none: 9, low: 1, medium: 1, high: 1, critical: 0 },
  };

  const risk: SupplierRiskProfile = {
    id: 'risk-1',
    supplier_id: 'sup-1',
    supplier_name: 'Fornitore Spa',
    level: 'high',
    score: 60,
    reasons: [{ code: 'vat_blocked', points: 60, detail: 'vat_status' }],
  };

  const apiSpy = { getSummary: vi.fn(), getRiskProfiles: vi.fn(), recalculateRisk: vi.fn() };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiSpy.getSummary.mockReturnValue(of({ data: summary }));
    apiSpy.getRiskProfiles.mockReturnValue(of({ data: [risk] }));
    apiSpy.recalculateRisk.mockReturnValue(of({ evaluated: 12 }));

    await TestBed.configureTestingModule({
      imports: [SupplierOverviewComponent],
      providers: [
        provideRouter([]),
        { provide: SupplierPortalApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SupplierOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows what waits for a decision and the suppliers at medium risk or above', () => {
    expect(apiSpy.getRiskProfiles).toHaveBeenCalledWith({ min_level: 'medium' });
    expect(component.underReview()).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Fornitore Spa');
    expect(fixture.nativeElement.textContent).toContain('SUPPLIER_PORTAL.REASON_VAT_BLOCKED');
  });

  it('recalculates the risk and reloads the page data', () => {
    component.recalculate();

    expect(apiSpy.recalculateRisk).toHaveBeenCalled();
    expect(messageSpy.success).toHaveBeenCalledWith('SUPPLIER_PORTAL.RISK_RECALCULATED');
    expect(apiSpy.getSummary).toHaveBeenCalledTimes(2);
  });
});
