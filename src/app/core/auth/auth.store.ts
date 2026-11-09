import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { I18nService, resolveInitialLanguage, SupportedLanguage } from '../i18n';

export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly jurisdiction: 'IT' | 'CH';
  readonly currency: 'EUR' | 'CHF';
  readonly vatNumber: string;
  readonly sdiCode?: string;
  readonly qrIban?: string;
  readonly address: string;
  readonly role?: string | null;
}

export interface UserProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly avatar?: string;
  readonly role?: string | null;
  readonly roles?: string[];
  readonly permissions?: string[];
  readonly two_factor_enabled?: boolean;
  readonly locale?: string;
  readonly active_tenant?: {
    readonly id: string;
    readonly name: string;
    readonly country?: string;
    readonly role: string | null;
  } | null;
  readonly tenants?: readonly {
    readonly id: string;
    readonly name: string;
    readonly country?: string;
    readonly role: string | null;
  }[];
}

export interface AuthState {
  readonly isAuthenticated: boolean;
  readonly user: UserProfile | null;
  readonly tenants: Tenant[];
  readonly activeTenantId: string;
  readonly activeJurisdiction: 'IT' | 'CH';
  readonly activeCurrency: 'EUR' | 'CHF';
  readonly activeLocale: SupportedLanguage;
  readonly theme: 'light' | 'dark';
  readonly twoFactorSetupRequired: boolean;
}

export const DEFAULT_TENANTS: Tenant[] = [
  {
    id: 't-it-01',
    name: 'Rossi Impianti S.r.l.',
    jurisdiction: 'IT',
    currency: 'EUR',
    vatNumber: 'IT12345678901',
    sdiCode: 'M5UXCR1',
    address: 'Via Manzoni 45, 20121 Milano (MI), Italia',
    role: 'owner',
  },
  {
    id: 't-ch-02',
    name: 'Helvetia Tech SA',
    jurisdiction: 'CH',
    currency: 'CHF',
    vatNumber: 'CHE-114.892.451 IVA',
    qrIban: 'CH4431999123000889012',
    address: 'Via Nassa 12, 6900 Lugano (TI), Svizzera',
    role: 'admin',
  },
];

export const DEFAULT_USER: UserProfile = {
  id: 'usr-001',
  name: 'Marco Rossi',
  email: 'm.rossi@rossiimpianti.it',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  role: 'owner',
  roles: ['owner', 'admin'],
  permissions: ['*'],
  active_tenant: {
    id: 't-it-01',
    name: 'Rossi Impianti S.r.l.',
    country: 'IT',
    role: 'owner',
  },
};

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('theme') || localStorage.getItem('ff_theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  }
  return 'light';
}

function getInitialTenantId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved =
      window.localStorage.getItem('ff_active_tenant_id') ||
      window.localStorage.getItem('tenant_id') ||
      window.localStorage.getItem('ff_tenant_id');
    if (saved) {
      return saved;
    }
  }
  return 't-it-01';
}

/** Storage key read by the HTTP interceptor to send `X-User-Id` (no injection, to avoid a DI cycle). */
export const USER_ID_STORAGE_KEY = 'ff_active_user_id';

function persistUserId(user: UserProfile | null): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  if (user?.id) {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, String(user.id));
  } else {
    window.localStorage.removeItem(USER_ID_STORAGE_KEY);
  }
}

function persistTenantId(tenantId: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  if (tenantId) {
    window.localStorage.setItem('ff_active_tenant_id', tenantId);
    window.localStorage.setItem('tenant_id', tenantId);
  } else {
    window.localStorage.removeItem('ff_active_tenant_id');
    window.localStorage.removeItem('tenant_id');
  }
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tenants: DEFAULT_TENANTS,
  activeTenantId: getInitialTenantId(),
  activeJurisdiction: 'IT',
  activeCurrency: 'EUR',
  activeLocale: resolveInitialLanguage(),
  theme: getInitialTheme(),
  twoFactorSetupRequired: false,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ tenants, activeTenantId, activeJurisdiction, theme, user }) => ({
    activeTenant: computed(
      () => tenants().find((t) => t.id === activeTenantId()) ?? tenants()[0]
    ),
    activeRole: computed(() => {
      const u = user();
      return (
        u?.active_tenant?.role ??
        u?.role ??
        (u?.roles && u.roles[0]) ??
        tenants().find((t) => t.id === activeTenantId())?.role ??
        'member'
      );
    }),
    activeRoles: computed(() => {
      const u = user();
      if (u?.active_tenant?.role) {
        return [u.active_tenant.role];
      }
      if (u?.roles && u.roles.length > 0) {
        return u.roles;
      }
      if (u?.role) {
        return [u.role];
      }
      const tenantRole = tenants().find((t) => t.id === activeTenantId())?.role;
      return tenantRole ? [tenantRole] : ['member'];
    }),
    userPermissions: computed(() => user()?.permissions ?? []),
    isItalianJurisdiction: computed(() => activeJurisdiction() === 'IT'),
    isSwissJurisdiction: computed(() => activeJurisdiction() === 'CH'),
    isDarkMode: computed(() => theme() === 'dark'),
  })),
  withMethods((store, i18n = inject(I18nService)) => ({
    login(tenantId?: string, user?: UserProfile | null): void {
      const targetUser = user ?? DEFAULT_USER;
      persistUserId(targetUser);

      let targetTenants = store.tenants();
      if (targetUser.tenants && targetUser.tenants.length > 0) {
        targetTenants = targetUser.tenants.map((t) => {
          const existing = store.tenants().find((et) => et.id === t.id);
          const isCh = t.country === 'CH' || existing?.jurisdiction === 'CH';
          return {
            id: t.id,
            name: t.name,
            jurisdiction: isCh ? 'CH' : 'IT',
            currency: isCh ? 'CHF' : 'EUR',
            vatNumber: existing?.vatNumber ?? '',
            sdiCode: existing?.sdiCode,
            qrIban: existing?.qrIban,
            address: existing?.address ?? '',
            role: t.role,
          };
        });
      }

      const activeId =
        tenantId ||
        targetUser.active_tenant?.id ||
        (targetTenants[0]?.id ?? 't-it-01');

      persistTenantId(activeId);

      const tenant =
        targetTenants.find((t) => t.id === activeId) ?? targetTenants[0] ?? DEFAULT_TENANTS[0];

      patchState(store, {
        isAuthenticated: true,
        user: targetUser,
        tenants: targetTenants,
        activeTenantId: tenant.id,
        activeJurisdiction: tenant.jurisdiction,
        activeCurrency: tenant.currency,
        twoFactorSetupRequired: false,
      });
    },
    logout(): void {
      persistUserId(null);
      patchState(store, {
        isAuthenticated: false,
        user: null,
        twoFactorSetupRequired: false,
      });
    },
    setUser(user: UserProfile | null): void {
      persistUserId(user);
      patchState(store, {
        user,
        isAuthenticated: !!user,
      });
    },
    switchTenant(tenantId: string): void {
      const tenant = store.tenants().find((t) => t.id === tenantId);
      if (tenant) {
        persistTenantId(tenant.id);
        const currentUser = store.user();
        const updatedUser: UserProfile | null = currentUser
          ? {
              ...currentUser,
              active_tenant: {
                id: tenant.id,
                name: tenant.name,
                country: tenant.jurisdiction,
                role: tenant.role ?? currentUser.active_tenant?.role ?? null,
              },
            }
          : null;

        patchState(store, {
          activeTenantId: tenant.id,
          activeJurisdiction: tenant.jurisdiction,
          activeCurrency: tenant.currency,
          user: updatedUser,
        });
      }
    },
    setJurisdiction(jurisdiction: 'IT' | 'CH'): void {
      const defaultCurrency = jurisdiction === 'IT' ? 'EUR' : 'CHF';
      patchState(store, {
        activeJurisdiction: jurisdiction,
        activeCurrency: defaultCurrency,
      });
    },
    setCurrency(activeCurrency: 'EUR' | 'CHF'): void {
      patchState(store, { activeCurrency });
    },
    setLocale(activeLocale: SupportedLanguage): void {
      patchState(store, { activeLocale });
      void i18n.setLanguage(activeLocale);
    },
    setTwoFactorSetupRequired(required: boolean): void {
      patchState(store, { twoFactorSetupRequired: required });
    },
    toggleTheme(): void {
      const newTheme: 'light' | 'dark' = store.theme() === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('theme', newTheme);
        localStorage.setItem('ff_theme', newTheme);
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', newTheme);
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      patchState(store, { theme: newTheme });
    },
    applySavedTheme(): void {
      const currentTheme = store.theme();
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', currentTheme);
        if (currentTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },
  }))
);
