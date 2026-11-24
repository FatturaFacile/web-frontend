import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { map, Observable, of, switchMap, throwError } from 'rxjs';
import { AuthApiService, SsoProtocol } from '../api/auth-api.service';
import { isInsecureBackendRequest } from './csrf.utils';

const RETURN_URL_KEY = 'ff_sso_return_url';
const SIGN_IN_CODE = /^[A-Za-z0-9]{64}$/;

/** The identity provider answered with an address the app must not send the browser to. */
export class SsoRedirectError extends Error {
  constructor() {
    super('Unsafe single sign-on redirect URL');
    this.name = 'SsoRedirectError';
  }
}

/**
 * Single sign-on, browser side. `start` asks the API for the URL of the identity provider of a tenant and sends the
 * browser there; the sign-in then finishes on `/auth/sso/complete`, where `consumeSignInCode` takes the single-use
 * code out of the URL fragment (never the query string) and removes it from the address bar at once.
 *
 * Cookie-only: nothing here stores a token. The only thing kept (in `sessionStorage`) is the same-app return path.
 */
@Service()
export class SsoLoginService {
  private readonly api = inject(AuthApiService);
  private readonly document = inject(DOCUMENT);

  /**
   * Discovers the single sign-on of an email address and, when there is one, starts it and leaves for the identity
   * provider. Emits `false` when the address has no single sign-on (nothing happened), `true` when the browser is
   * on its way.
   */
  signInWithEmail(email: string, returnUrl?: string | null): Observable<boolean> {
    return this.api.discoverSso(email.trim()).pipe(
      switchMap((sso) =>
        sso.available && sso.protocol && sso.tenant_id
          ? this.start(sso.protocol, sso.tenant_id, returnUrl).pipe(map(() => true))
          : of(false),
      ),
    );
  }

  start(protocol: SsoProtocol, tenantId: string, returnUrl?: string | null): Observable<void> {
    return this.api.startSso(protocol, tenantId).pipe(
      switchMap((url) => {
        if (!this.isSafeRedirect(url)) {
          return throwError(() => new SsoRedirectError());
        }
        this.rememberReturnUrl(returnUrl);
        this.navigate(url);
        return of(undefined);
      }),
    );
  }

  /**
   * Reads `#code=...` and removes the fragment from the address bar with `history.replaceState`, whatever it holds.
   * Returns null when there is no well-formed code.
   */
  consumeSignInCode(): string | null {
    const view = this.document.defaultView;
    const hash = view?.location.hash ?? '';
    if (!view || hash === '') {
      return null;
    }
    const code = new URLSearchParams(hash.replace(/^#/, '')).get('code');
    view.history.replaceState(view.history.state, '', view.location.pathname + view.location.search);
    return code !== null && SIGN_IN_CODE.test(code) ? code : null;
  }

  /**
   * The OpenID Connect redirect: the identity provider sends the browser back with `?code=...&state=...`. Both are
   * removed from the address bar at once. An error answer (`?error=`) is stripped too. Returns null unless both are present.
   */
  consumeOidcParams(): { code: string; state: string } | null {
    const view = this.document.defaultView;
    const search = view?.location.search ?? '';
    if (!view || search === '') {
      return null;
    }
    const params = new URLSearchParams(search);
    const code = params.get('code');
    const state = params.get('state');
    if (code === null && state === null && !params.has('error')) {
      return null;
    }
    view.history.replaceState(view.history.state, '', view.location.pathname + view.location.hash);
    return code && state ? { code, state } : null;
  }

  /** After the local logout: ends the session at the identity provider too, when the API gave a URL for it. */
  followIdpLogout(url: string | null | undefined): boolean {
    if (!url || !this.isSafeRedirect(url)) {
      return false;
    }
    this.navigate(url);
    return true;
  }

  /** The path the user wanted before leaving for the identity provider; read once. */
  takeReturnUrl(): string | null {
    try {
      const storage = this.document.defaultView?.sessionStorage;
      const url = storage?.getItem(RETURN_URL_KEY) ?? null;
      storage?.removeItem(RETURN_URL_KEY);
      return isSameAppPath(url) ? url : null;
    } catch {
      return null;
    }
  }

  /** Leaves the app for the identity provider. */
  protected navigate(url: string): void {
    this.document.defaultView?.location.assign(url);
  }

  private rememberReturnUrl(returnUrl?: string | null): void {
    try {
      const storage = this.document.defaultView?.sessionStorage;
      if (isSameAppPath(returnUrl ?? null)) {
        storage?.setItem(RETURN_URL_KEY, returnUrl as string);
      } else {
        storage?.removeItem(RETURN_URL_KEY);
      }
    } catch {
      // Private mode or blocked storage: the user lands on the default page.
    }
  }

  private isSafeRedirect(url: string): boolean {
    return /^https?:\/\//i.test(url) && !isInsecureBackendRequest(url);
  }
}

function isSameAppPath(url: string | null): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
}
