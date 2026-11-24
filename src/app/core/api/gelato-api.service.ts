import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  GelatoBalanceTargets,
  GelatoBook,
  GelatoCategory,
  GelatoGanacheResult,
  GelatoHaccpReading,
  GelatoIngredient,
  GelatoLine,
  GelatoLot,
  GelatoOrder,
  GelatoPreviewResult,
  GelatoRecipe,
  GelatoResponse,
  GelatoSolverResult,
} from '../models';

/** Endpoints of the artisanal gelato, chocolaterie and cold pastry module (Mod 398). */
@Service()
export class GelatoApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/gelato`;

  getIngredients(category?: string, q?: string): Observable<GelatoResponse<GelatoIngredient[]>> {
    let params = new HttpParams();
    if (category) params = params.set('category', category);
    if (q) params = params.set('q', q);
    return this.http.get<GelatoResponse<GelatoIngredient[]>>(`${this.base}/ingredients`, { params });
  }

  getRecipes(kind?: string): Observable<GelatoResponse<GelatoRecipe[]>> {
    const params = kind ? new HttpParams().set('kind', kind) : new HttpParams();
    return this.http.get<GelatoResponse<GelatoRecipe[]>>(`${this.base}/recipes`, { params });
  }

  saveRecipe(
    payload: Record<string, unknown>,
    id?: string,
  ): Observable<GelatoResponse<GelatoRecipe>> {
    return id
      ? this.http.put<GelatoResponse<GelatoRecipe>>(`${this.base}/recipes/${id}`, payload)
      : this.http.post<GelatoResponse<GelatoRecipe>>(`${this.base}/recipes`, payload);
  }

  /** Real-time preview of the lines on screen. */
  preview(
    category: GelatoCategory,
    lines: GelatoLine[],
    options: { overrun_percent?: number } = {},
  ): Observable<GelatoResponse<GelatoPreviewResult>> {
    return this.http.post<GelatoResponse<GelatoPreviewResult>>(`${this.base}/recipes/balance`, {
      category,
      lines,
      ...options,
    });
  }

  autoBalance(
    category: GelatoCategory,
    targets: GelatoBalanceTargets,
    pool: { ingredient_id: string; min_grams?: number | null; max_grams?: number | null }[],
  ): Observable<GelatoResponse<GelatoSolverResult>> {
    return this.http.post<GelatoResponse<GelatoSolverResult>>(`${this.base}/recipes/balance`, {
      category,
      targets,
      pool,
    });
  }

  scaleRecipe(id: string, batchWeightGrams: number): Observable<GelatoResponse<{ lines: GelatoLine[]; cost: number }>> {
    return this.http.post<GelatoResponse<{ lines: GelatoLine[]; cost: number }>>(
      `${this.base}/recipes/${id}/scale`,
      { batch_weight_grams: batchWeightGrams },
    );
  }

  calculateGanache(lines: GelatoLine[]): Observable<GelatoResponse<GelatoGanacheResult>> {
    return this.http.post<GelatoResponse<GelatoGanacheResult>>(`${this.base}/ganache/calculate`, { lines });
  }

  getLots(kind?: string): Observable<GelatoResponse<GelatoLot[]>> {
    const params = kind ? new HttpParams().set('kind', kind) : new HttpParams();
    return this.http.get<GelatoResponse<GelatoLot[]>>(`${this.base}/lots`, { params });
  }

  startLot(payload: Record<string, unknown>): Observable<GelatoResponse<GelatoLot>> {
    return this.http.post<GelatoResponse<GelatoLot>>(`${this.base}/lots`, payload);
  }

  addHaccpReadings(id: string, readings: GelatoHaccpReading[]): Observable<GelatoResponse<GelatoLot>> {
    return this.http.post<GelatoResponse<GelatoLot>>(`${this.base}/lots/${id}/haccp-readings`, { readings });
  }

  completeLot(id: string, payload: Record<string, unknown>): Observable<GelatoResponse<GelatoLot>> {
    return this.http.post<GelatoResponse<GelatoLot>>(`${this.base}/lots/${id}/complete`, payload);
  }

  getOrders(status?: string): Observable<GelatoResponse<GelatoOrder[]>> {
    const params = status ? new HttpParams().set('status', status) : new HttpParams();
    return this.http.get<GelatoResponse<GelatoOrder[]>>(`${this.base}/orders`, { params });
  }

  createOrder(payload: Record<string, unknown>): Observable<GelatoResponse<GelatoOrder>> {
    return this.http.post<GelatoResponse<GelatoOrder>>(`${this.base}/orders`, payload);
  }

  publishShowcase(
    locationKey: string,
    slots: { slot_number: number; recipe_id: string }[],
    jurisdiction: 'IT' | 'CH',
  ): Observable<GelatoResponse<{ id: string; version: number }>> {
    return this.http.post<GelatoResponse<{ id: string; version: number }>>(
      `${this.base}/showcase/${locationKey}/publish`,
      { slots, jurisdiction },
    );
  }

  getBook(locationKey: string): Observable<GelatoResponse<GelatoBook>> {
    return this.http.get<GelatoResponse<GelatoBook>>(`${this.base}/showcase/${locationKey}/book`);
  }
}
