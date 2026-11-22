/** Models of the artisanal gelato, chocolaterie and cold pastry module (Mod 398). */

export interface GelatoResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type GelatoLocale = 'it' | 'de' | 'fr' | 'en';
export type GelatoStatus = 'OPTIMAL' | 'WARNING' | 'OUT_OF_RANGE';
export type GelatoCategory =
  | 'DAIRY_CREAM'
  | 'FRUIT_SORBET'
  | 'CHOCOLATE_FAT_PASTE'
  | 'SAVORY_GASTRONOMIC'
  | 'SEMIFREDDO_COLD_PASTRY'
  | 'GANACHE_CHOCOLATE';

export type GelatoLocalizedName = Record<GelatoLocale, string>;

export interface GelatoIngredient {
  id: string;
  code: string;
  name: GelatoLocalizedName;
  category: string;
  pod: number;
  pac: number;
  milk_fat_percent: number;
  other_fat_percent: number;
  slng_percent: number;
  total_solids_percent: number;
  water_percent: number;
  cost_per_kg: number;
  allergens: string[];
  is_vegan: boolean;
  is_defrosted: boolean;
}

export interface GelatoLine {
  ingredient_id?: string | null;
  sub_recipe_id?: string | null;
  grams: number;
}

export interface GelatoIndicator {
  value: number;
  min: number;
  max: number;
  status: GelatoStatus;
  diagnostic: string;
}

export interface GelatoCurvePoint {
  temperature_celsius: number;
  ice_fraction_of_freezable_water: number;
  frozen_water_percent: number;
  unfrozen_water_percent: number;
}

export interface GelatoCost {
  cost_per_kg: number;
  cost_per_gram: number;
  batch_cost: number;
  mix_litres: number;
  cost_per_litre_mix: number;
  gelato_litres: number;
  cost_per_litre_gelato: number;
  cost_per_tub: number;
  cost_per_portion: number;
  portions_per_litre_gelato: number | null;
}

export interface GelatoMetrics {
  total_grams: number;
  pod: number;
  pac: number;
  milk_fat_percent: number;
  other_fat_percent: number;
  total_fat_percent: number;
  slng_percent: number;
  slng_max_safe_threshold: number;
  total_solids_percent: number;
  water_percent: number;
  freezing_point_celsius: number;
  ideal_serving_temp_celsius: number;
  freezing_curve: GelatoCurvePoint[];
  lactose_risk: { status: 'OK' | 'APPROACHING' | 'EXCEEDED'; slng_percent: number; slng_max: number; margin: number };
  cost: GelatoCost;
  evaluation: { overall: GelatoStatus; indicators: Record<string, GelatoIndicator> };
}

export interface GelatoBalanceTargets {
  weight: number;
  pod?: number | null;
  pac?: number | null;
  total_fat?: number | null;
  slng?: number | null;
  total_solids?: number | null;
}

export interface GelatoSolverResult {
  mode: 'auto_balance';
  status: 'EXACT' | 'CLOSEST_FEASIBLE';
  weights: Record<string, number>;
  achieved: GelatoMetrics;
  residuals: Record<string, { target: number; achieved: number; residual: number; met: boolean }>;
  slng_guard_applied: boolean;
}

export interface GelatoPreviewResult {
  mode: 'preview';
  metrics: GelatoMetrics;
}

export interface GelatoRecipe {
  id: string;
  code: string;
  name: GelatoLocalizedName;
  category: GelatoCategory;
  kind: string;
  batch_weight_grams: number;
  food_cost_per_kg: number;
  allergens: string[];
  lines?: GelatoLine[];
}

export interface GelatoHaccpReading {
  at: string;
  temperature_celsius: number;
  phase?: 'heat' | 'cool' | 'age' | 'harden' | null;
}

export interface GelatoLot {
  id: string;
  lot_code: string;
  kind: 'base' | 'flavor';
  method: 'direct' | 'two_stage';
  status: string;
  parent_lot_id: string | null;
  recipe_id: string | null;
  mix_weight_grams: number;
  yield_grams: number | null;
  overrun_percent: number | null;
  haccp_readings: GelatoHaccpReading[] | null;
  haccp_passed: boolean | null;
  haccp_findings: string[] | null;
}

export interface GelatoGanacheResult {
  water_percent: number;
  water_activity: number;
  shelf_life_days: number;
  risk_band: string;
}

export interface GelatoOrder {
  id: string;
  order_number: string;
  kind: 'praline_box' | 'gelato_cake' | 'takeaway_tub';
  customer_name: string;
  total_price: number;
  component_cost: number;
  status: string;
  pickup_at: string | null;
}

export interface GelatoBookIngredient {
  ingredient_id: string;
  name: string;
  percent: number;
  allergens: string[];
}

export interface GelatoBookSlot {
  slot_number: number;
  recipe_id: string;
  name: string;
  ingredients: GelatoBookIngredient[];
  allergens: { code: string; name: string }[];
  gluten_free: boolean;
  lactose_free: boolean;
  vegan: boolean;
  defrosted: boolean;
  defrosted_notice: string | null;
}

export interface GelatoBook {
  location_key: string;
  jurisdiction: string;
  version: number;
  published_at: string;
  books: Partial<Record<GelatoLocale, { locale: GelatoLocale; slots: GelatoBookSlot[] }>>;
}
