export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertResource {
  id: string;
  title: string;
  message?: string | null;
  severity: AlertSeverity;
  alertable_type?: string | null;
  alertable_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface CreateAlertPayload {
  title: string;
  message?: string | null;
  severity?: AlertSeverity;
  alertable_type?: string | null;
  alertable_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
}

export interface UpdateAlertPayload extends Partial<CreateAlertPayload> {}
