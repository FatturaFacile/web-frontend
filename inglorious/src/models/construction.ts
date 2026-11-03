export interface ConstructionSite {
  id?: string
  code: string
  client: string
  location: string
  regime: "CH" | "IT" | string
  sal: string
  norm: string
  vatRegime: string
}
