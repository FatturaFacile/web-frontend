/**
 * Enterprise authentication settings: tenant security policy, OpenID Connect and SAML providers, SCIM token.
 * Mirrors the FormRequests of `routes/enterprise_auth.php` (the API is the contract).
 */

export type TwoFactorRequirement = 'none' | 'all' | 'roles';

export interface SecurityPolicy {
  password: {
    min_length: number;
    require_mixed_case: boolean;
    require_numbers: boolean;
    require_symbols: boolean;
    history_count: number;
    max_age_days: number | null;
  };
  lockout: {
    max_attempts: number;
    minutes: number;
  };
  session: {
    idle_timeout_minutes: number | null;
    max_concurrent_sessions: number | null;
  };
  two_factor: {
    require_for: TwoFactorRequirement;
    roles: string[];
  };
  sso_only: boolean;
  sso_ready: boolean;
}

/** Every group is optional: the API updates the groups that are sent. */
export interface UpdateSecurityPolicyPayload {
  password?: Partial<SecurityPolicy['password']>;
  lockout?: Partial<SecurityPolicy['lockout']>;
  session?: Partial<SecurityPolicy['session']>;
  two_factor?: Partial<SecurityPolicy['two_factor']>;
  sso_only?: boolean;
}

export type SsoTokenAuthMethod = 'client_secret_post' | 'client_secret_basic';

/** OpenID Connect provider as returned by the API: the client secret is never returned, only `has_client_secret`. */
export interface SsoProvider {
  id: string;
  name: string;
  issuer: string;
  authorization_endpoint: string | null;
  token_endpoint: string | null;
  jwks_uri: string | null;
  redirect_uri: string;
  client_id: string;
  has_client_secret: boolean;
  token_endpoint_auth_method: SsoTokenAuthMethod | null;
  end_session_endpoint: string | null;
  post_logout_redirect_uri: string | null;
  scopes: string;
  allowed_email_domains: string[];
  role_claim: string | null;
  role_mapping: Record<string, string> | null;
  default_role: string | null;
  sync_role_on_login: boolean;
  jit_provisioning: boolean;
  enabled: boolean;
  ready: boolean;
  discovered_at: string | null;
}

export interface UpsertSsoProviderPayload {
  name: string;
  issuer: string;
  use_discovery?: boolean;
  authorization_endpoint?: string | null;
  token_endpoint?: string | null;
  jwks_uri?: string | null;
  redirect_uri: string;
  client_id: string;
  /** Write-only: omit to keep the stored secret. */
  client_secret?: string | null;
  token_endpoint_auth_method?: SsoTokenAuthMethod | null;
  end_session_endpoint?: string | null;
  post_logout_redirect_uri?: string | null;
  scopes?: string;
  allowed_email_domains: string[];
  role_claim?: string | null;
  role_mapping?: Record<string, string> | null;
  default_role?: string | null;
  sync_role_on_login?: boolean;
  jit_provisioning?: boolean;
  enabled?: boolean;
}

export interface SamlServiceProviderInfo {
  entity_id: string;
  acs_url: string;
  slo_url: string;
  metadata_url: string;
}

/** SAML provider as returned by the API: the service provider private key is never returned, only `has_sp_signing_key`. */
export interface SamlProvider {
  id: string;
  name: string;
  idp_entity_id: string | null;
  idp_sso_url: string | null;
  idp_slo_url: string | null;
  idp_certificates_count: number;
  idp_metadata_url: string | null;
  metadata_refreshed_at: string | null;
  email_attribute: string | null;
  name_attribute: string | null;
  role_attribute: string | null;
  role_mapping: Record<string, string> | null;
  default_role: string | null;
  sync_role_on_login: boolean;
  jit_provisioning: boolean;
  allowed_email_domains: string[];
  has_sp_signing_key: boolean;
  enabled: boolean;
  ready: boolean;
  sp: SamlServiceProviderInfo;
}

export interface UpsertSamlProviderPayload {
  name: string;
  idp_metadata_url?: string | null;
  idp_metadata_xml?: string | null;
  idp_entity_id?: string | null;
  idp_sso_url?: string | null;
  idp_slo_url?: string | null;
  idp_certificates?: string[] | null;
  email_attribute?: string | null;
  name_attribute?: string | null;
  role_attribute?: string | null;
  role_mapping?: Record<string, string> | null;
  default_role?: string | null;
  sync_role_on_login?: boolean;
  jit_provisioning?: boolean;
  allowed_email_domains: string[];
  /** Write-only: omit both to keep the stored key pair. */
  sp_private_key?: string | null;
  sp_certificate?: string | null;
  enabled?: boolean;
}

export interface ScimTokenStatus {
  configured: boolean;
  token_hint: string | null;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
}

/** Response of the rotation: the plain `token` is returned this once and must not be stored by the client. */
export interface ScimTokenRotation extends ScimTokenStatus {
  token: string;
}

export interface RotateScimTokenPayload {
  expires_in_days?: number | null;
}
