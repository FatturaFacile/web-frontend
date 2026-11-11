import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AuthApiService } from '@core/api/auth-api.service';
import { AuthStore } from '@core/auth/auth.store';
import { SsoLoginService } from '@core/auth/sso-login.service';
import { HeaderComponent } from './header.component';

describe('HeaderComponent logout', () => {
  const logout = vi.fn();
  const followIdpLogout = vi.fn();

  function create() {
    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: { logout } },
        { provide: SsoLoginService, useValue: { followIdpLogout } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const store = TestBed.inject(AuthStore);
    const storeLogout = vi.spyOn(store, 'logout').mockImplementation(() => undefined);
    const component = TestBed.createComponent(HeaderComponent).componentInstance;
    return { component, navigate, storeLogout };
  }

  beforeEach(() => {
    logout.mockReset();
    followIdpLogout.mockReset();
  });

  it('goes to the login after a password session logout', () => {
    logout.mockReturnValue(of({ data: { idp_logout_url: null } }));
    followIdpLogout.mockReturnValue(false);
    const { component, navigate, storeLogout } = create();

    component.logout();

    expect(storeLogout).toHaveBeenCalled();
    expect(followIdpLogout).toHaveBeenCalledWith(null);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('follows the identity provider logout URL of a single sign-on session', () => {
    logout.mockReturnValue(of({ data: { idp_logout_url: 'https://idp.example.com/logout' } }));
    followIdpLogout.mockReturnValue(true);
    const { component, navigate } = create();

    component.logout();

    expect(followIdpLogout).toHaveBeenCalledWith('https://idp.example.com/logout');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('still leaves the app when the logout request fails', () => {
    logout.mockReturnValue(throwError(() => new Error('offline')));
    const { component, navigate, storeLogout } = create();

    component.logout();

    expect(storeLogout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
