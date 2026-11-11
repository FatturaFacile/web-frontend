import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { Observable, of, switchMap, throwError } from 'rxjs';
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
