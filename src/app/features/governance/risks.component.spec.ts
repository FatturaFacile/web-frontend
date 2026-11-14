import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { GovDashboard, GovernanceApiService, GovHeatmapCell, GovRisk, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { GovernanceRisksComponent } from './risks.component';
import { GovernanceAccess } from './governance-access.service';

function heatmap(counts: Record<string, number>): GovHeatmapCell[] {
  const cells: GovHeatmapCell[] = [];
  for (let likelihood = 5; likelihood >= 1; likelihood--) {
    for (let impact = 1; impact <= 5; impact++) {
      const score = likelihood * impact;
      const rating = score >= 15 ? 'critical' : score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low';
      cells.push({ likelihood, impact, score, rating, count: counts[`${likelihood}-${impact}`] ?? 0 });
    }
  }
  return cells;
}

const dashboard: GovDashboard = {
  as_of: '2027-06-22',
  basis: 'residual',
  risks: {
    total: 2,
    by_status: { identified: 1, assessed: 1, treating: 0, accepted: 0, closed: 0 },
    by_rating: { low: 1, medium: 0, high: 0, critical: 1 },
    review_overdue: 0,
    heatmap: heatmap({ '5-5': 1, '2-2': 1 }),
  },
  controls: { active: 3, test_overdue: 1, never_tested: 0, tests_in_period: 3, tests_by_result: { pass: 2, partial: 0, fail: 1 }, pass_rate: 66.7, pass_rate_months: 12 },
  findings: { open_total: 2, open_by_severity: { low: 0, medium: 0, high: 1, critical: 1 }, risk_accepted: 0 },
  actions: { open: 1, overdue: 1, due_next_30_days: 0, awaiting_verification: 0 },
  obligations: { open: 4, overdue: 0, due_next_30_days: 2 },
  audits: { year: 2027, plan_status: 'draft', plan_audits: 0, plan_closed: 0, plan_completion_rate: null, in_progress: 0, late_to_start: 0 },
};

const criticalRisk: GovRisk = {
  id: 'r-1',
  code: 'RSK-2027-0001',
  title: 'Ransomware',
  category: 'it_security',
  likelihood: 5,
  impact: 5,
  inherent_score: 25,
  inherent_rating: 'critical',
  residual_likelihood: null,
  residual_impact: null,
  residual_score: null,
  residual_rating: null,
  owner: null,
  status: 'identified',
  next_review_date: '2027-09-22',
  is_review_overdue: false,
};

const lowRisk: GovRisk = {
  ...criticalRisk,
  id: 'r-2',
  code: 'RSK-2027-0002',
  title: 'Late invoice',
  category: 'financial',
  likelihood: 3,
  impact: 3,
  inherent_score: 9,
  inherent_rating: 'medium',
  residual_likelihood: 2,
  residual_impact: 2,
  residual_score: 4,
  residual_rating: 'low',
  status: 'assessed',
};

describe('GovernanceRisksComponent', () => {
  let fixture: ComponentFixture<GovernanceRisksComponent>;
  let component: GovernanceRisksComponent;

  const apiSpy = {
    getRisks: vi.fn(),
    getDashboard: vi.fn(),
    getMembers: vi.fn(),
    getControls: vi.fn(),
    getRisk: vi.fn(),
    createRisk: vi.fn(),
    updateRisk: vi.fn(),
    deleteRisk: vi.fn(),
    transitionRisk: vi.fn(),
    syncRiskControls: vi.fn(),
  };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };
  const accessStub = {
    canWrite: () => true,
    canManage: () => true,
    canApprove: () => true,
    userId: () => 'u-1',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiSpy.getRisks.mockReturnValue(of({ data: [criticalRisk, lowRisk] }));
    apiSpy.getDashboard.mockReturnValue(of({ data: dashboard }));
    apiSpy.getMembers.mockReturnValue(of({ data: [{ id: 'u-1', name: 'Laura', role: 'owner' }] }));
    apiSpy.getControls.mockReturnValue(of({ data: [] }));
    apiSpy.createRisk.mockReturnValue(of({ data: criticalRisk }));
    apiSpy.transitionRisk.mockReturnValue(of({ data: lowRisk }));

    await TestBed.configureTestingModule({
      imports: [GovernanceRisksComponent],
      providers: [
        { provide: GovernanceApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        { provide: GovernanceAccess, useValue: accessStub },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GovernanceRisksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the register, the dashboard and the members and draws the 25 cells of the heatmap', () => {
    expect(apiSpy.getRisks).toHaveBeenCalled();
    expect(apiSpy.getDashboard).toHaveBeenCalledWith('residual');
    expect(apiSpy.getMembers).toHaveBeenCalled();

    const cells = fixture.nativeElement.querySelectorAll('button.heatmap-cell');
    expect(cells.length).toBe(25);
    expect(fixture.nativeElement.querySelectorAll('button.heatmap-cell.rating-critical').length).toBe(6);
    expect(fixture.nativeElement.textContent).toContain('RSK-2027-0001');
  });

  it('narrows the register to the clicked cell of the heatmap and back', () => {
    const cell = dashboard.risks.heatmap.find((item) => item.likelihood === 5 && item.impact === 5) as GovHeatmapCell;

    (component as unknown as { toggleCell(cell: GovHeatmapCell): void }).toggleCell(cell);
    fixture.detectChanges();

    const visible = (component as unknown as { visibleRisks(): GovRisk[] }).visibleRisks();
    expect(visible.map((risk) => risk.code)).toEqual(['RSK-2027-0001']);

    (component as unknown as { toggleCell(cell: GovHeatmapCell): void }).toggleCell(cell);
    expect((component as unknown as { visibleRisks(): GovRisk[] }).visibleRisks().length).toBe(2);
  });

  it('uses the residual score of a treated risk for its heatmap cell and the inherent one on request', () => {
    const lowCell = dashboard.risks.heatmap.find((item) => item.likelihood === 2 && item.impact === 2) as GovHeatmapCell;
    const internals = component as unknown as { toggleCell(cell: GovHeatmapCell): void; visibleRisks(): GovRisk[] };

    internals.toggleCell(lowCell);
    expect(internals.visibleRisks().map((risk) => risk.code)).toEqual(['RSK-2027-0002']);

    component.changeBasis('inherent');
    expect(apiSpy.getDashboard).toHaveBeenLastCalledWith('inherent');
    expect(internals.visibleRisks()).toEqual([]);
  });

  it('previews the score and rating of the form and saves the payload of the API', () => {
    component.openCreate();
    component['form'].patchValue({ title: 'Data loss', category: 'it_security', likelihood: 4, impact: 4, residual_likelihood: 2, residual_impact: 3 });

    expect(component['previewScore']()).toBe(16);
    expect(component['previewRating']()).toBe('critical');
    expect(component['previewResidualScore']()).toBe(6);

    component.save();

    expect(apiSpy.createRisk).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Data loss', category: 'it_security', likelihood: 4, impact: 4, residual_likelihood: 2, residual_impact: 3, owner_id: null }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('GOVERNANCE.COMMON.SAVED');
    expect(component['formVisible']()).toBe(false);
  });

  it('does not save an invalid form', () => {
    component.openCreate();
    component.save();

    expect(apiSpy.createRisk).not.toHaveBeenCalled();
  });

  it('shows the business rule that the API refuses', () => {
    apiSpy.transitionRisk.mockReturnValue(
      throwError(() => ({ status: 422, error: { message: 'A risk needs an owner', errors: { status: ['A risk needs an owner'] } } })),
    );
    component.openTransition(criticalRisk);
    component.applyTransition({ status: 'assessed', notes: null });

    expect(apiSpy.transitionRisk).toHaveBeenCalledWith('r-1', { status: 'assessed', notes: null });
    expect(messageSpy.error).toHaveBeenCalledWith('A risk needs an owner');
    expect(component['nextStatuses'](criticalRisk)).toEqual(['assessed', 'closed']);
  });
});
