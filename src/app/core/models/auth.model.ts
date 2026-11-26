import type { ApiResponse } from './api.models';

export interface User {
  id: number | string;
  name: string;
  email: string;
  [key: string]: unknown;
}

/** Second factors the API offers at the login challenge (`recovery_code` is the fallback, not a factor to enrol). */
export type TwoFactorMethod = 'totp' | 'email' | 'sms' | 'webauthn' | 'recovery_code';

export interface TwoFactorStatus {
  enabled: boolean;
  /** Active methods of the user (`totp`, `email`, `webauthn`, `recovery_code`). */
  methods?: TwoFactorMethod[];
  totp_enabled?: boolean;
  email_enabled?: boolean;
  webauthn_enabled?: boolean;
  pending_setup: boolean;
  confirmed_at: string | null;
  email_confirmed_at?: string | null;
  sms_enabled?: boolean;
  /** Phone of the SMS factor, masked by the API. */
  sms_phone?: string | null;
  sms_confirmed_at?: string | null;
  /** Number of trusted devices of the user. */
  trusted_devices?: number;
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
  /** Alternative proof: the code emailed by `POST /auth/two-factor/email/send`. */
  email_code?: string | null;
  /** Alternative proof: the code sent by `POST /auth/two-factor/sms/send`. */
  sms_code?: string | null;
}

/** WebAuthn answer of a security key at the login challenge: the ceremony of the options call and the signed assertion. */
export interface TwoFactorWebauthnProof {
  ceremony_id: string;
  credential: unknown;
}

/** Exactly one of `webauthn`, `email_code`, `code` or `recovery_code` is sent. */
export interface TwoFactorChallengePayload {
  challenge_token: string;
  code?: string | null;
  recovery_code?: string | null;
  email_code?: string | null;
  sms_code?: string | null;
  webauthn?: TwoFactorWebauthnProof;
  remember_device?: boolean;
  device_name?: string | null;
}

export interface LoginTwoFactorChallengeData {
  two_factor_required: true;
  challenge_token: string;
  expires_in: number;
  methods: TwoFactorMethod[];
  default_method: TwoFactorMethod | null;
  email_code_sent: boolean;
  sms_code_sent?: boolean;
  trusted_devices_enabled: boolean;
}

/** Answer of `POST /auth/two-factor/challenge/email` and of the email enrolment: when the code expires and may be resent. */
export interface EmailCodeDispatch {
  expires_in: number;
  resend_available_in: number;
}

/** Answer of the SMS enrolment start: the masked phone the code went to and the usual timings. */
export interface SmsCodeDispatch extends EmailCodeDispatch {
  phone: string;
}

/** Answer of `POST /auth/two-factor/challenge/webauthn/options`. */
export interface TwoFactorWebauthnOptions {
  ceremony_id: string;
  options: unknown;
}

export interface ConfirmEmailTwoFactorResponse {
  /** Only the first factor of the user returns recovery codes; empty afterwards. */
  recovery_codes: string[];
  methods: TwoFactorMethod[];
}

export interface EnableSmsTwoFactorPayload {
  current_password: string;
  /** E.164 number; the API ignores spaces, dots, dashes and brackets. */
  phone: string;
}

export interface TwoFactorMethodsResponse {
  methods: TwoFactorMethod[];
}

export interface TrustedDevice {
  id: string;
  label: string;
  ip_address: string | null;
  last_used_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface TrustedDevicesMeta {
  /** Days a remembered device skips the second factor. */
  days: number;
  /** False when the administrator turned the feature off. */
  enabled: boolean;
}

export interface TrustedDevicesResponse extends ApiResponse<TrustedDevice[]> {
  meta: TrustedDevicesMeta;
}

export interface RevokedTrustedDevices {
  revoked: number;
}

/** Codes of the password rules the API reports (`auth/password-policy/*`). */
export type PasswordRuleCode = 'min_length' | 'mixed_case' | 'numbers' | 'symbols' | 'reused' | 'breached';

export interface PasswordRuleResult {
  code: PasswordRuleCode;
  passed: boolean;
  message: string;
}

export interface PasswordCheckPayload {
  password: string;
  tenant_id?: string | null;
  email?: string | null;
}

export interface PasswordCheckResult {
  rules: PasswordRuleResult[];
  acceptable: boolean;
  /** 0 (empty) to 4 (excellent). */
  strength: number;
}

export interface PasswordPolicyRules {
  min_length: number;
  require_mixed_case: boolean;
  require_numbers: boolean;
  require_symbols: boolean;
  check_breached: boolean;
  history_count: number;
  max_age_days: number | null;
  rules: PasswordRuleCode[];
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
