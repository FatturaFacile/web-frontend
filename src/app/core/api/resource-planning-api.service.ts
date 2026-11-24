import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AllocationFilter,
  AllocationMutationResult,
  AllocationPayload,
  CandidateSearchPayload,
  CapacityHeatmap,
  CapacityResource,
  ConvertToHardPayload,
  EmployeeSkillProfile,
  EmployeeSkillProfileFilter,
  EmployeeSkillProfilePayload,
  HeatmapFilter,
  RebalancePayload,
  ResourceAllocation,
  ResourceCandidate,
  ResourcePlanningResponse,
  Skill,
  SkillPayload,
  UtilizationGroupBy,
  UtilizationReport,
  UtilizationTarget,
  UtilizationTargetPayload,
} from '../models';

type Envelope<T> = Observable<ResourcePlanningResponse<T>>;

/** Endpoints of the resource planning and capacity saturation module (Mod 079). */
@Service()
export class ResourcePlanningApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/resource-planning`;

  // --- Skill taxonomy ---

  getSkills(category?: string): Envelope<Skill[]> {
    let params = new HttpParams();
    if (category) {
      params = params.set('category', category);
    }
    return this.http.get<ResourcePlanningResponse<Skill[]>>(`${this.base}/skills`, { params });
  }

  createSkill(payload: SkillPayload): Envelope<Skill> {
    return this.http.post<ResourcePlanningResponse<Skill>>(`${this.base}/skills`, payload);
  }

  updateSkill(id: string, payload: SkillPayload): Envelope<Skill> {
    return this.http.put<ResourcePlanningResponse<Skill>>(`${this.base}/skills/${id}`, payload);
  }

  deleteSkill(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/skills/${id}`);
  }

  // --- Employee skill profiles ---

  getSkillProfiles(filter: EmployeeSkillProfileFilter = {}): Envelope<EmployeeSkillProfile[]> {
    let params = new HttpParams();
    if (filter.employee_id) {
      params = params.set('employee_id', filter.employee_id);
    }
    if (filter.skill_id) {
      params = params.set('skill_id', filter.skill_id);
    }
    return this.http.get<ResourcePlanningResponse<EmployeeSkillProfile[]>>(
      `${this.base}/employee-skill-profiles`,
      { params },
    );
  }

  /** Upsert on employee + skill. */
  saveSkillProfile(payload: EmployeeSkillProfilePayload): Envelope<EmployeeSkillProfile> {
    return this.http.post<ResourcePlanningResponse<EmployeeSkillProfile>>(
      `${this.base}/employee-skill-profiles`,
      payload,
    );
  }

  updateSkillProfile(
    id: string,
    payload: EmployeeSkillProfilePayload,
  ): Envelope<EmployeeSkillProfile> {
    return this.http.put<ResourcePlanningResponse<EmployeeSkillProfile>>(
      `${this.base}/employee-skill-profiles/${id}`,
      payload,
    );
  }

  deleteSkillProfile(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/employee-skill-profiles/${id}`);
  }

  // --- Resources ---

  getResources(departmentId?: string): Envelope<CapacityResource[]> {
    let params = new HttpParams();
    if (departmentId) {
      params = params.set('department_id', departmentId);
    }
    return this.http.get<ResourcePlanningResponse<CapacityResource[]>>(`${this.base}/resources`, {
      params,
    });
  }

  // --- Allocations ---

  getAllocations(filter: AllocationFilter): Envelope<ResourceAllocation[]> {
    let params = new HttpParams().set('from', filter.from).set('to', filter.to);
    if (filter.employee_id) {
      params = params.set('employee_id', filter.employee_id);
    }
    if (filter.project_id) {
      params = params.set('project_id', filter.project_id);
    }
    if (filter.booking_type) {
      params = params.set('booking_type', filter.booking_type);
    }
    return this.http.get<ResourcePlanningResponse<ResourceAllocation[]>>(
      `${this.base}/allocations`,
      { params },
    );
  }

  createAllocation(payload: AllocationPayload): Envelope<AllocationMutationResult> {
    return this.http.post<ResourcePlanningResponse<AllocationMutationResult>>(
      `${this.base}/allocations`,
      payload,
    );
  }

  convertToHard(id: string, payload: ConvertToHardPayload = {}): Envelope<AllocationMutationResult> {
    return this.http.post<ResourcePlanningResponse<AllocationMutationResult>>(
      `${this.base}/allocations/${id}/convert-to-hard`,
      payload,
    );
  }

  rebalance(id: string, payload: RebalancePayload): Envelope<AllocationMutationResult> {
    return this.http.post<ResourcePlanningResponse<AllocationMutationResult>>(
      `${this.base}/allocations/${id}/rebalance`,
      payload,
    );
  }

  deleteAllocation(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/allocations/${id}`);
  }

  // --- Capacity heatmap and candidates ---

  getHeatmap(filter: HeatmapFilter): Envelope<CapacityHeatmap> {
    let params = new HttpParams()
      .set('from', filter.from)
      .set('to', filter.to)
      .set('granularity', filter.granularity);
    if (filter.department_id) {
      params = params.set('department_id', filter.department_id);
    }
    for (const employeeId of filter.employee_ids ?? []) {
      params = params.append('employee_id[]', employeeId);
    }
    return this.http.get<ResourcePlanningResponse<CapacityHeatmap>>(
      `${this.base}/capacity/heatmap`,
      { params },
    );
  }

  searchCandidates(payload: CandidateSearchPayload): Envelope<ResourceCandidate[]> {
    return this.http.post<ResourcePlanningResponse<ResourceCandidate[]>>(
      `${this.base}/candidates/search`,
      payload,
    );
  }

  // --- Billable utilization ---

  getUtilizationReport(
    from: string,
    to: string,
    groupBy: UtilizationGroupBy,
  ): Envelope<UtilizationReport> {
    const params = new HttpParams().set('from', from).set('to', to).set('group_by', groupBy);
    return this.http.get<ResourcePlanningResponse<UtilizationReport>>(
      `${this.base}/reports/billable-utilization`,
      { params },
    );
  }

  getUtilizationTargets(): Envelope<UtilizationTarget[]> {
    return this.http.get<ResourcePlanningResponse<UtilizationTarget[]>>(
      `${this.base}/utilization-targets`,
    );
  }

  /** Upsert: both ids null is the tenant default. */
  saveUtilizationTarget(payload: UtilizationTargetPayload): Envelope<UtilizationTarget> {
    return this.http.put<ResourcePlanningResponse<UtilizationTarget>>(
      `${this.base}/utilization-targets`,
      payload,
    );
  }
}
