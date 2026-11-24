import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HseApiService } from './hse-api.service';
import { IncidentReport, MatrixRow } from './hse.models';
import { HseStore } from './hse.store';

const ok = <T, M = undefined>(data: T, meta?: M) => of({ success: true, message: '', data, meta });

const redRow: MatrixRow = {
  employee_id: 'e1',
  employee_name: 'Carla Rossi',
  department_id: null,
  trainings: { forklift_patentino_muletto: { light: 'RED', expires_at: null, missing: true } },
  medical: {
    light: 'RED',
    fitness_outcome: 'temporarily_unfit_inidoneo_temporaneo',
    restrictions_summary: null,
    next_visit_due_date: null,
  },
  ppe: {},
  overall: 'RED',
  is_hard_blocked: true,
};

const incident: IncidentReport = {
  id: 'i1',
  protocol_number: 'INC-CH-2027-0001',
  jurisdiction: 'CH',
  incident_date: '2027-11-20T10:15:00+01:00',
  incident_type: 'near_miss',
  description: 'Spilled oil',
  prognosis_days: 0,
  status: 'draft',
  root_cause_analysis: null,
  corrective_actions: [],
  linked_insurance_claim_id: null,
};

const rule = {
  id: 'r1',
  name: 'Forklift',
  jurisdiction: 'IT',
  job_position_id: 'p1',
  work_center_id: null,
  construction_site_id: null,
  suva_hazard_class: null,
  dvr_risk_profile_code: null,
  required_training_types: [],
  required_medical_exam_codes: [],
  required_ppe_product_ids: [],
  is_active: true,
  version: 1,
} as const;

describe('HseStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: HseStore;

  beforeEach(() => {
    api = {
      complianceMatrix: vi.fn(() =>
        ok([redRow], {
          total: 1,
          per_page: 25,
          current_page: 1,
          last_page: 1,
          kpis: {
            overall_compliance_percent: 0,
            hard_blocked_workers: 1,
            expiring_in_30_days: 2,
            open_near_miss_and_capas: 3,
          },
        }),
      ),
      clearance: vi.fn(() => ok({ is_cleared: false, blocking_reasons: [], warnings: [] })),
      issuePpe: vi.fn(() => ok({ id: 'p1' })),
      incidents: vi.fn(() => ok([incident])),
      reportIncident: vi.fn(() => ok(incident)),
      requirementMatrices: vi.fn(() => ok([rule])),
      saveRequirementMatrix: vi.fn(() => ok({ ...rule, name: 'Updated', version: 2 })),
      audits: vi.fn(() => ok({ mssl_audits: [], dvr_revisions: [] })),
      saveMsslAudit: vi.fn(() => ok({ id: 'a1', score_percent: 85, status: 'completed' })),
      registerDvr: vi.fn(() => ok({ id: 'd1', revision_number: 2, status: 'active' })),
    };

    TestBed.configureTestingModule({ providers: [{ provide: HseApiService, useValue: api }] });
    store = TestBed.inject(HseStore);
  });

  it('loads the matrix with its KPI cards and derives the requirement columns', () => {
    store.loadMatrix().subscribe();

    expect(store.rows()).toEqual([redRow]);
    expect(store.kpis().hard_blocked_workers).toBe(1);
    expect(store.hasBlockedWorkers()).toBe(true);
    expect(store.trainingColumns()).toEqual(['forklift_patentino_muletto']);
    expect(store.meta()?.total).toBe(1);
    expect(store.loading()).toBe(false);
  });

  it('goes back to the first page when a filter changes', () => {
    store.setPage(3);
    store.setFilters({ status: 'RED' });

    expect(store.filters()).toMatchObject({ page: 1, status: 'RED' });
  });

  it('sends the filters of the matrix to the API', () => {
    store.setFilters({ status: 'YELLOW', jurisdiction: 'CH' });
    store.loadMatrix().subscribe();

    expect(api['complianceMatrix']).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'YELLOW', jurisdiction: 'CH' }),
    );
  });

  it('returns the verdict of the gatekeeper and never turns a failed call into a cleared worker', () => {
    let verdict: boolean | null = null;
    store
      .checkClearance({
        employeeId: 'e1',
        contextType: 'construction_site',
        targetId: 's1',
        scheduledAt: '2027-06-15T08:00:00Z',
      })
      .subscribe((result) => (verdict = result.is_cleared));

    expect(verdict).toBe(false);

    api['clearance'] = vi.fn(() => throwError(() => new Error('down')));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: HseApiService, useValue: api }] });
    const failing = TestBed.inject(HseStore);
    let failed = false;
    failing
      .checkClearance({
        employeeId: 'e1',
        contextType: 'construction_site',
        targetId: 's1',
        scheduledAt: 'x',
      })
      .subscribe({ next: () => undefined, error: () => (failed = true) });

    expect(failed).toBe(true);
  });

  it('clears the busy flag after a hand-over, successful or not', () => {
    store.issuePpe({} as never).subscribe();

    expect(store.busy()).toBe(false);

    api['issuePpe'] = vi.fn(() => throwError(() => new Error('stock')));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: HseApiService, useValue: api }] });
    const failing = TestBed.inject(HseStore);
    failing.issuePpe({} as never).subscribe({ error: () => undefined });

    expect(failing.busy()).toBe(false);
  });

  it('puts a reported incident at the top of the registry', () => {
    store.loadIncidents().subscribe();
    store.reportIncident({} as never).subscribe();

    expect(store.incidents()).toHaveLength(2);
    expect(store.incidents()[0].protocol_number).toBe('INC-CH-2027-0001');
  });

  it('replaces a saved rule in place and adds a new one at the top', () => {
    store.loadRequirementMatrices().subscribe();
    store.saveRequirementMatrix({} as never, 'r1').subscribe();

    expect(store.requirementMatrices()).toHaveLength(1);
    expect(store.requirementMatrices()[0].name).toBe('Updated');

    api['saveRequirementMatrix'] = vi.fn(() => ok({ ...rule, id: 'r2', name: 'New' }));
    store.saveRequirementMatrix({} as never).subscribe();

    expect(store.requirementMatrices().map((item) => item.id)).toEqual(['r2', 'r1']);
  });

  it('reloads the audits after saving an MSSL audit or a DVR revision', () => {
    store.saveMsslAudit({} as never).subscribe();
    store.registerDvr({} as never).subscribe();

    expect(api['audits']).toHaveBeenCalledTimes(2);
    expect(store.busy()).toBe(false);
  });
});
