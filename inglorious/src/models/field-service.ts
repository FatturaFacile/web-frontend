export interface FieldServiceTicket {
  id: string
  client: string
  subject: string
  technician: string
  sla: string
  status: string
  /** An ng-zorro tag color, chosen by the backend. */
  color: string
}
