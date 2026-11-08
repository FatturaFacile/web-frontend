import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from '@core/services/auth.service';
import { TEST_PASSWORD } from '../../../testing/credentials';

describe('AuthService (Pure Cookie-Based Authentication with CSRF Protection)', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AuthService],
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('login() should first GET /sanctum/csrf-cookie and then POST /login with credentials', () => {
    const credentials = { email: 'user@example.com', password: TEST_PASSWORD };
    let responseData: unknown = null;

    service.login(credentials).subscribe((data) => {
      responseData = data;
    });

    // 1. First request must be GET /sanctum/csrf-cookie
    const csrfReq = httpTesting.expectOne(
      (req) => req.url.endsWith('/sanctum/csrf-cookie') && req.method === 'GET',
    );
    expect(csrfReq.request.method).toBe('GET');
    csrfReq.flush('', { status: 204, statusText: 'No Content' });

    // 2. Second request must be POST /login
    const loginReq = httpTesting.expectOne(
      (req) => req.url.endsWith('/login') && req.method === 'POST',
    );
    expect(loginReq.request.method).toBe('POST');
    expect(loginReq.request.body).toEqual(credentials);
    loginReq.flush({ message: 'Authenticated' });

    expect(responseData).toEqual({ message: 'Authenticated' });

    // 3. Confirm NO tokens are written to localStorage or sessionStorage
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('ff_access_token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('logout() should send POST to /logout', () => {
    let responseData: unknown = null;

    service.logout().subscribe((res) => {
      responseData = res;
    });

    const logoutReq = httpTesting.expectOne(
      (req) => req.url.endsWith('/logout') && req.method === 'POST',
    );
    expect(logoutReq.request.method).toBe('POST');
    logoutReq.flush({ message: 'Logged out' });

    expect(responseData).toEqual({ message: 'Logged out' });
  });

  it('getUser() should send GET to /api/user', () => {
    const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };
    let fetchedUser: unknown = null;

    service.getUser().subscribe((user) => {
      fetchedUser = user;
    });

    const userReq = httpTesting.expectOne(
      (req) => req.url.endsWith('/api/user') && req.method === 'GET',
    );
    expect(userReq.request.method).toBe('GET');
    userReq.flush(mockUser);

    expect(fetchedUser).toEqual(mockUser);
  });
});
