import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  BillOfMaterial,
  ProductionOrder,
  TrackProductionStagePayload,
} from '../models';

@Service()
export class ManufacturingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/manufacturing`;

  getProductionOrders(): Observable<ApiResponse<ProductionOrder[]>> {
    return this.http.get<ApiResponse<ProductionOrder[]>>(`${this.base}/production-orders`);
  }

  getBillsOfMaterials(): Observable<ApiResponse<BillOfMaterial[]>> {
    return this.http.get<ApiResponse<BillOfMaterial[]>>(`${this.base}/bom`);
  }

  trackStage(stageId: string, payload: TrackProductionStagePayload): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/stages/${stageId}/track`, payload);
  }
}
