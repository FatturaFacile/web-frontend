/** Wire contract of `/api/v1/academy` (Mod 112, Academy / LMS). */

export interface AcademyEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export type MissionStatus = 'not_started' | 'started' | 'completed';
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface TourStep {
  route: string;
  selector: string;
  placement: TourPlacement;
  text: string;
}

export interface ContextualHelp {
  id: number | string;
  route_pattern: string;
  /** The locale the server actually served (after it-CH -> it-IT -> en fallback). */
  locale: string;
  title: string;
  body_markdown: string;
  field_tooltips: Record<string, string>;
}

export interface Mission {
  id: number | string;
  code: string;
  sequence: number;
  difficulty: string;
  title: string;
  description: string;
  xp_reward: number;
  badge_code: string | null;
  requires_sandbox: boolean;
  status: MissionStatus;
  tour_steps: TourStep[];
}

export interface Track {
  id: number | string;
  code: string;
  difficulty: string;
  title: string;
  description: string;
  missions_total: number;
  missions_completed: number;
  completion_percent: number;
  xp_earned: number;
  certificate_code: string | null;
  missions: Mission[];
}

export interface AcademyProgress {
  total_xp: number;
  badges: { code: string; title?: string }[] | string[];
  tracks: Pick<Track, 'id' | 'code' | 'title' | 'completion_percent' | 'xp_earned'>[];
}

export interface VerifyStepResult {
  status: MissionStatus;
  completed: boolean;
  xp_awarded: number;
  badge_code: string | null;
}

export interface CertificateVerification {
  valid: boolean;
  holder_name?: string;
  track_title?: string;
  total_xp?: number;
  issued_at?: string;
}

export interface Cohort {
  id: number | string;
  name: string;
  join_code?: string;
  due_date?: string | null;
}

export interface CreateCohortPayload {
  name: string;
  track_ids: (number | string)[];
  due_date: string;
}

export interface ClassroomStudent {
  user_id: number | string;
  name: string;
  missions_completed: number;
  missions_total: number;
  total_xp: number;
  certificates: string[];
}

export interface ClassroomDashboard {
  cohort: Cohort;
  assignments: { track_id: number | string; track_title?: string; due_date?: string | null }[];
  students: ClassroomStudent[];
}
