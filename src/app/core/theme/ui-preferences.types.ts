export type ThemePreference = 'light' | 'dark' | 'system';
export type UiDensity = 'compact' | 'comfortable' | 'spacious';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];
export const UI_DENSITIES: readonly UiDensity[] = ['compact', 'comfortable', 'spacious'];

/** `GET/PATCH /api/v1/user/preferences` */
export interface UserUiPreferences {
  theme_preference: ThemePreference;
  ui_density: UiDensity;
  /** null follows the operating system setting. */
  reduced_motion: boolean | null;
}

/** `GET/PATCH /api/v1/tenant/branding` */
export interface TenantBranding {
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  brand_logo_url: string | null;
  default_theme: ThemePreference;
}

export type UpdateTenantBrandingPayload = Partial<TenantBranding>;
export type UpdateUserUiPreferencesPayload = Partial<UserUiPreferences>;

export const DEFAULT_USER_UI_PREFERENCES: UserUiPreferences = {
  theme_preference: 'system',
  ui_density: 'comfortable',
  reduced_motion: null,
};

export const DEFAULT_TENANT_BRANDING: TenantBranding = {
  brand_primary_color: null,
  brand_secondary_color: null,
  brand_logo_url: null,
  default_theme: 'system',
};
