import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthApiService } from '../api/auth-api.service';
import { AuthStore } from '../auth/auth.store';
import { I18nService } from '../i18n';
import { ImpersonationBannerComponent } from './impersonation-banner.component';
import { PermissionStore } from './permission.store';

describe('ImpersonationBannerComponent', () => {
  const impersonation = signal<{ active: boolean; actor_id: string | null; expires_at: string | null } | null>(null);
  const logout = vi.fn();
  const navigate = vi.fn().mockResolvedValue(true);
  const apiLogout = vi.fn(() => of({}));

  function render() {
    TestBed.configureTestingModule({
      providers: [
        { provide: PermissionStore, useValue: { impersonation } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: AuthApiService, useValue: { logout: apiLogout } },
        { provide: AuthStore, useValue: { logout } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    const fixture = TestBed.createComponent(ImpersonationBannerComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders nothing for a normal session', () => {
    impersonation.set(null);
    expect(render().nativeElement.querySelector('[data-testid="impersonation-banner"]')).toBeNull();
  });

  it('shows the banner during an impersonation and leaving signs out', () => {
    impersonation.set({ active: true, actor_id: 'owner-1', expires_at: '2026-11-21T10:30:00Z' });
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('[data-testid="impersonation-banner"]')?.textContent).toContain('IAM.IMPERSONATION_BANNER');

    el.querySelector<HTMLButtonElement>('button')?.click();
    expect(apiLogout).toHaveBeenCalled();
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
