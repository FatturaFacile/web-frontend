export type TireSeason = "SUMMER" | "WINTER" | "ALL_SEASON"

export interface TireTreadDepth {
  frontLeft: number
  frontRight: number
  rearLeft: number
  rearRight: number
}

export interface TireRecord {
  id: string
  customerName: string
  vehiclePlate: string
  vehicleModel: string
  season: TireSeason
  brandModel: string
  dot: string
  treadDepthMm: TireTreadDepth
  hasRims: boolean
  rimType: string
  rackLocation: string
  depositDate: string
  status: string
  reminderSent: boolean
}
