import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly jurisdiction: 'IT' | 'CH';
  readonly currency: 'EUR' | 'CHF';
  readonly vatNumber: string;
  readonly sdiCode?: string;
  readonly qrIban?: string;
  readonly address: string;
}

export interface UserProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly avatar: string;
  readonly role: string;
  readonly roles: string[];
}

export interface AuthState {
  readonly isAuthenticated: boolean;
  readonly user: UserProfile | null;
  readonly tenants: Tenant[];
  readonly activeTenantId: string;
  readonly activeJurisdiction: 'IT' | 'CH';
  readonly activeCurrency: 'EUR' | 'CHF';
  readonly activeLocale: 'IT' | 'DE' | 'FR' | 'EN';
  readonly theme: 'light' | 'dark';
}

const DEFAULT_TENANTS: Tenant[] = [
  {
    id: 't-it-01',
    name: 'Rossi Impianti S.r.l.',
    jurisdiction: 'IT',
    currency: 'EUR',
    vatNumber: 'IT12345678901',
    sdiCode: 'M5UXCR1',
    address: 'Via Manzoni 45, 20121 Milano (MI), Italia',
  },
  {
    id: 't-ch-02',
    name: 'Helvetia Tech SA',
    jurisdiction: 'CH',
    currency: 'CHF',
    vatNumber: 'CHE-114.892.451 IVA',
    qrIban: 'CH4431999123000889012',
    address: 'Via Nassa 12, 6900 Lugano (TI), Svizzera',
  },
];

const DEFAULT_USER: UserProfile = {
  id: 'usr-001',
  name: 'Marco Rossi',
  email: 'm.rossi@rossiimpianti.it',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  role: 'ERP Administrator',
  roles: ['ADMIN', 'FINANCE_MANAGER', 'OPERATOR'],
};

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('ff_theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  }
  return 'light';
}

const initialState: AuthState = {
  isAuthenticated: true, // Default authenticated in demo mode
  user: DEFAULT_USER,
  tenants: DEFAULT_TENANTS,
  activeTenantId: 't-it-01',
  activeJurisdiction: 'IT',
  activeCurrency: 'EUR',
  activeLocale: 'IT',
  theme: getInitialTheme(),
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ tenants, activeTenantId, activeJurisdiction, activeCurrency, theme }) => ({
    activeTenant: computed(
      () => tenants().find((t) => t.id === activeTenantId()) ?? tenants()[0]
    ),
    isItalianJurisdiction: computed(() => activeJurisdiction() === 'IT'),
    isSwissJurisdiction: computed(() => activeJurisdiction() === 'CH'),
    isDarkMode: computed(() => theme() === 'dark'),
  })),
  withMethods((store) => ({
    login(tenantId = 't-it-01'): void {
      const tenant = store.tenants().find((t) => t.id === tenantId) ?? store.tenants()[0];
      patchState(store, {
        isAuthenticated: true,
        user: DEFAULT_USER,
        activeTenantId: tenant.id,
        activeJurisdiction: tenant.jurisdiction,
        activeCurrency: tenant.currency,
      });
    },
    logout(): void {
      patchState(store, {
        isAuthenticated: false,
        user: null,
      });
    },
    switchTenant(tenantId: string): void {
      const tenant = store.tenants().find((t) => t.id === tenantId);
      if (tenant) {
        patchState(store, {
          activeTenantId: tenant.id,
          activeJurisdiction: tenant.jurisdiction,
          activeCurrency: tenant.currency,
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
    setLocale(activeLocale: 'IT' | 'DE' | 'FR' | 'EN'): void {
      patchState(store, { activeLocale });
    },
    toggleTheme(): void {
      const newTheme: 'light' | 'dark' = store.theme() === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('ff_theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
      patchState(store, { theme: newTheme });
    },
    applySavedTheme(): void {
      const currentTheme = store.theme();
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', currentTheme);
      }
    },
  }))
);
