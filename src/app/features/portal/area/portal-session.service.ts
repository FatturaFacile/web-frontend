import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { PortalBranding, PortalCustomer } from '@core/models/portal-area.models';

const TOKEN_KEY = 'ff_portal_token';
const EXPIRES_KEY = 'ff_portal_expires_at';
const CUSTOMER_KEY = 'ff_portal_customer';
const SLUG_KEY = 'ff_portal_slug';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function read(key: string): string | null {
  try {
    return globalThis.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) {
      globalThis.sessionStorage?.removeItem(key);
    } else {
      globalThis.sessionStorage?.setItem(key, value);
    }
  } catch {
    // Storage can be blocked (private window): the session then lives in memory only.
  }
}

/**
 * Session of the customer portal, kept apart from the back-office `AuthStore`: a bearer token of one customer, held in
 * `sessionStorage` (gone when the tab closes), plus the white-label theme applied to the page.
 */
@Service()
export class PortalSessionService {
  private readonly document = inject(DOCUMENT);

  private readonly tokenState = signal<string | null>(read(TOKEN_KEY));
  private readonly expiresState = signal<string | null>(read(EXPIRES_KEY));
  private readonly customerState = signal<PortalCustomer | null>(this.readCustomer());
  private readonly slugState = signal<string | null>(read(SLUG_KEY));

  readonly branding = signal<PortalBranding | null>(null);
  readonly customer = this.customerState.asReadonly();
  readonly slug = this.slugState.asReadonly();

  readonly token = this.tokenState.asReadonly();
  readonly isAuthenticated = computed(() => {
    const expires = this.expiresState();
    return (
      this.tokenState() !== null && (expires === null || new Date(expires).getTime() > Date.now())
    );
  });

  /** The portal of a tenant is chosen by the `portal` query parameter of the link, or the slug already in use. */
  useSlug(slug: string | null): void {
    if (slug && slug !== this.slugState()) {
      this.slugState.set(slug);
      write(SLUG_KEY, slug);
    }
  }

  start(token: string, expiresAt: string, customer: PortalCustomer): void {
    this.tokenState.set(token);
    this.expiresState.set(expiresAt);
    this.customerState.set(customer);
    write(TOKEN_KEY, token);
    write(EXPIRES_KEY, expiresAt);
    write(CUSTOMER_KEY, JSON.stringify(customer));
  }

  clear(): void {
    this.tokenState.set(null);
    this.expiresState.set(null);
    this.customerState.set(null);
    write(TOKEN_KEY, null);
    write(EXPIRES_KEY, null);
    write(CUSTOMER_KEY, null);
  }

  /** Themes the page with the tenant's colours (CSS custom properties), favicon and title. Invalid colours are ignored. */
  applyBranding(branding: PortalBranding): void {
    this.branding.set(branding);

    const root = this.document.documentElement;
    const primary =
      branding.primary_color && HEX_COLOR.test(branding.primary_color)
        ? branding.primary_color
        : null;
    const secondary =
      branding.secondary_color && HEX_COLOR.test(branding.secondary_color)
        ? branding.secondary_color
        : null;

    for (const [name, value] of [
      ['--portal-primary', primary],
      ['--portal-secondary', secondary],
    ] as const) {
      if (value) {
        root.style.setProperty(name, value);
      } else {
        root.style.removeProperty(name);
      }
    }

    if (branding.company_name) {
      this.document.title = branding.company_name;
    }

    if (branding.favicon_url?.startsWith('https://')) {
      let link = this.document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
      if (!link) {
        link = this.document.createElement('link');
        link.rel = 'icon';
        this.document.head.appendChild(link);
      }
      link.href = branding.favicon_url;
    }
  }

  private readCustomer(): PortalCustomer | null {
    const raw = read(CUSTOMER_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && 'id' in parsed
        ? (parsed as PortalCustomer)
        : null;
    } catch {
      return null;
    }
  }
}
