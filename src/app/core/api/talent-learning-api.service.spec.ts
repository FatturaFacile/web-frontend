import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { TalentLearningApiService } from './talent-learning-api.service';

describe('TalentLearningApiService', () => {
  let service: TalentLearningApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/talent-learning`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TalentLearningApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TalentLearningApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('updates a compensation cycle, a budget pool and a merit proposal with PUT', () => {
    service.updateCycle('cy-1', { name: 'FY27' }).subscribe();
    const cycle = httpTesting.expectOne(`${base}/compensation/cycles/cy-1`);
    expect(cycle.request.method).toBe('PUT');
    expect(cycle.request.body).toEqual({ name: 'FY27' });
    cycle.flush({ data: { id: 'cy-1' } });

    service.updateBudgetPool('p-1', { name: 'Pool' }).subscribe();
    const pool = httpTesting.expectOne(`${base}/compensation/pools/p-1`);
    expect(pool.request.method).toBe('PUT');
    pool.flush({ data: { id: 'p-1' } });

    service.updateMeritProposal('m-1', { employee_id: 'e-1' }).subscribe();
    const proposal = httpTesting.expectOne(`${base}/compensation/proposals/m-1`);
    expect(proposal.request.method).toBe('PUT');
    proposal.flush({ data: { id: 'm-1' } });
  });

  it('reads the cycle summary', () => {
    service.getCycleSummary('cy-1').subscribe();
    const req = httpTesting.expectOne((r) => r.url === `${base}/compensation/cycles/cy-1/summary`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: {} });
  });
});
