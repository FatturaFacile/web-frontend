export interface User {
  id: number | string;
  name: string;
  email: string;
  [key: string]: unknown;
}

export interface TwoFactorStatus {
  enabled: boolean;
  pending_setup: boolean;
  confirmed_at: string | null;
  remaining_recovery_codes: number;
  required_by_tenant: boolean;
}

export interface TwoFactorEnableResponse {
  secret: string;
  otpauth_uri: string;
}

export interface ConfirmedPasswordPayload {
  current_password: string;
}

export interface ConfirmTwoFactorPayload {
  code: string;
}

export interface ConfirmTwoFactorResponse {
  recovery_codes: string[] | null;
}

export interface RecoveryCodesResponse {
  recovery_codes: string[];
}

export interface DisableTwoFactorPayload {
  current_password: string;
  code?: string | null;
  recovery_code?: string | null;
}

export interface TwoFactorChallengePayload {
  challenge_token: string;
  code?: string | null;
  recovery_code?: string | null;
}

export interface LoginTwoFactorChallengeData {
  two_factor_required: true;
  challenge_token: string;
  expires_in: number;
}

export interface TokenSessionItem {
  kind: 'token';
  id: string;
  name: string;
  ip_address: null;
  user_agent: null;
  last_used_at: string | null;
  expires_at: string | null;
  current: boolean;
}

export interface WebSessionItem {
  kind: 'session';
  id: string;
  name: null;
  ip_address: string;
  user_agent: string;
  last_used_at: string;
  expires_at: string;
  current: boolean;
}

export type UserSession = TokenSessionItem | WebSessionItem;

export interface RevokeOtherSessionsResponse {
  tokens: number;
  sessions: number;
}
