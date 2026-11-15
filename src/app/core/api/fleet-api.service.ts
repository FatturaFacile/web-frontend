import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  FleetAssignment,
  FleetAssignmentEndRequest,
  FleetAssignmentRequest,
  FleetDashboard,
  FleetDeadline,
  FleetDeadlineFilters,
  FleetDeadlineRenewRequest,
  FleetDeadlineRequest,
  FleetFuelEntry,
  FleetFuelEntryRequest,
  FleetIncident,
  FleetIncidentKind,
  FleetIncidentRequest,
  FleetPaymentStatus,
  FleetResponse,
  FleetScheduledService,
  FleetScheduledServiceRequest,
  FleetServiceRecord,
  FleetServiceRecordRequest,
  FleetServiceType,
  FleetVehicle,
  FleetVehicleCosts,
  FleetVehicleFilters,
  FleetVehicleRequest,
} from '../models';

@Service()
export class FleetApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/fleet`;

  // Dashboard
  getDashboard(days?: number): Observable<FleetResponse<FleetDashboard>> {
    return this.http.get<FleetResponse<FleetDashboard>>(`${this.base}/dashboard`, { params: this.params({ days }) });
  }

  // Vehicles
  getVehicles(filters?: FleetVehicleFilters): Observable<FleetResponse<FleetVehicle[]>> {
    return this.http.get<FleetResponse<FleetVehicle[]>>(`${this.base}/vehicles`, { params: this.params(filters) });
  }

  getVehicle(id: string): Observable<FleetResponse<FleetVehicle>> {
    return this.http.get<FleetResponse<FleetVehicle>>(`${this.base}/vehicles/${id}`);
  }

  createVehicle(payload: FleetVehicleRequest): Observable<FleetResponse<FleetVehicle>> {
    return this.http.post<FleetResponse<FleetVehicle>>(`${this.base}/vehicles`, payload);
  }

  updateVehicle(id: string, payload: Partial<FleetVehicleRequest>): Observable<FleetResponse<FleetVehicle>> {
    return this.http.put<FleetResponse<FleetVehicle>>(`${this.base}/vehicles/${id}`, payload);
  }

  deleteVehicle(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/vehicles/${id}`);
  }

  getVehicleCosts(id: string): Observable<FleetResponse<FleetVehicleCosts>> {
    return this.http.get<FleetResponse<FleetVehicleCosts>>(`${this.base}/vehicles/${id}/costs`);
  }

  // Driver assignments
  getAssignments(filters?: { vehicle_id?: string; employee_id?: string; open?: boolean; per_page?: number }): Observable<FleetResponse<FleetAssignment[]>> {
    return this.http.get<FleetResponse<FleetAssignment[]>>(`${this.base}/assignments`, { params: this.params(filters) });
  }

  createAssignment(payload: FleetAssignmentRequest): Observable<FleetResponse<FleetAssignment>> {
    return this.http.post<FleetResponse<FleetAssignment>>(`${this.base}/assignments`, payload);
  }

  updateAssignment(id: string, payload: Partial<FleetAssignmentRequest>): Observable<FleetResponse<FleetAssignment>> {
    return this.http.put<FleetResponse<FleetAssignment>>(`${this.base}/assignments/${id}`, payload);
  }

  endAssignment(id: string, payload: FleetAssignmentEndRequest): Observable<FleetResponse<FleetAssignment>> {
    return this.http.post<FleetResponse<FleetAssignment>>(`${this.base}/assignments/${id}/end`, payload);
  }

  deleteAssignment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/assignments/${id}`);
  }

  // Fuel and charging
  getFuelEntries(filters?: { vehicle_id?: string; from?: string; to?: string; per_page?: number }): Observable<FleetResponse<FleetFuelEntry[]>> {
    return this.http.get<FleetResponse<FleetFuelEntry[]>>(`${this.base}/fuel-entries`, { params: this.params(filters) });
  }

  createFuelEntry(payload: FleetFuelEntryRequest): Observable<FleetResponse<FleetFuelEntry>> {
    return this.http.post<FleetResponse<FleetFuelEntry>>(`${this.base}/fuel-entries`, payload);
  }

  updateFuelEntry(id: string, payload: Partial<FleetFuelEntryRequest>): Observable<FleetResponse<FleetFuelEntry>> {
    return this.http.put<FleetResponse<FleetFuelEntry>>(`${this.base}/fuel-entries/${id}`, payload);
  }

  deleteFuelEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/fuel-entries/${id}`);
  }

  // Service records
  getServices(filters?: { vehicle_id?: string; service_type?: FleetServiceType; per_page?: number }): Observable<FleetResponse<FleetServiceRecord[]>> {
    return this.http.get<FleetResponse<FleetServiceRecord[]>>(`${this.base}/services`, { params: this.params(filters) });
  }

  createService(payload: FleetServiceRecordRequest): Observable<FleetResponse<FleetServiceRecord>> {
    return this.http.post<FleetResponse<FleetServiceRecord>>(`${this.base}/services`, payload);
  }

  updateService(id: string, payload: Partial<FleetServiceRecordRequest>): Observable<FleetResponse<FleetServiceRecord>> {
    return this.http.put<FleetResponse<FleetServiceRecord>>(`${this.base}/services/${id}`, payload);
  }

  deleteService(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/services/${id}`);
  }

  // Scheduled services
  getScheduledServices(filters?: { vehicle_id?: string; overdue?: boolean; active?: boolean; per_page?: number }): Observable<FleetResponse<FleetScheduledService[]>> {
    return this.http.get<FleetResponse<FleetScheduledService[]>>(`${this.base}/scheduled-services`, { params: this.params(filters) });
  }

  createScheduledService(payload: FleetScheduledServiceRequest): Observable<FleetResponse<FleetScheduledService>> {
    return this.http.post<FleetResponse<FleetScheduledService>>(`${this.base}/scheduled-services`, payload);
  }

  updateScheduledService(id: string, payload: Partial<FleetScheduledServiceRequest>): Observable<FleetResponse<FleetScheduledService>> {
    return this.http.put<FleetResponse<FleetScheduledService>>(`${this.base}/scheduled-services/${id}`, payload);
  }

  deleteScheduledService(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/scheduled-services/${id}`);
  }

  // Compliance deadlines
  getDeadlines(filters?: FleetDeadlineFilters): Observable<FleetResponse<FleetDeadline[]>> {
    return this.http.get<FleetResponse<FleetDeadline[]>>(`${this.base}/deadlines`, { params: this.params(filters) });
  }

  createDeadline(payload: FleetDeadlineRequest): Observable<FleetResponse<FleetDeadline>> {
    return this.http.post<FleetResponse<FleetDeadline>>(`${this.base}/deadlines`, payload);
  }

  updateDeadline(id: string, payload: Partial<FleetDeadlineRequest>): Observable<FleetResponse<FleetDeadline>> {
    return this.http.put<FleetResponse<FleetDeadline>>(`${this.base}/deadlines/${id}`, payload);
  }

  renewDeadline(id: string, payload: FleetDeadlineRenewRequest): Observable<FleetResponse<FleetDeadline>> {
    return this.http.post<FleetResponse<FleetDeadline>>(`${this.base}/deadlines/${id}/renew`, payload);
  }

  deleteDeadline(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/deadlines/${id}`);
  }

  // Incidents and fines
  getIncidents(filters?: { vehicle_id?: string; employee_id?: string; kind?: FleetIncidentKind; payment_status?: FleetPaymentStatus; per_page?: number }): Observable<FleetResponse<FleetIncident[]>> {
    return this.http.get<FleetResponse<FleetIncident[]>>(`${this.base}/incidents`, { params: this.params(filters) });
  }

  createIncident(payload: FleetIncidentRequest): Observable<FleetResponse<FleetIncident>> {
    return this.http.post<FleetResponse<FleetIncident>>(`${this.base}/incidents`, payload);
  }

  updateIncident(id: string, payload: Partial<FleetIncidentRequest>): Observable<FleetResponse<FleetIncident>> {
    return this.http.put<FleetResponse<FleetIncident>>(`${this.base}/incidents/${id}`, payload);
  }

  payIncident(id: string, paidOn?: string): Observable<FleetResponse<FleetIncident>> {
    return this.http.post<FleetResponse<FleetIncident>>(`${this.base}/incidents/${id}/pay`, paidOn ? { paid_on: paidOn } : {});
  }

  deleteIncident(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/incidents/${id}`);
  }

  private params(values?: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      }
    }
    return params;
  }
}
