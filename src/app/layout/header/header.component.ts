import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzMessageService } from 'ng-zorro-antd/message';
import { FormsModule } from '@angular/forms';
// Deep imports keep the `@core` and `@shared` barrels (every API service, every resource page) out of the initial bundle.
import { AuthApiService } from '@core/api/auth-api.service';
import { AuthStore } from '@core/auth/auth.store';
import { SsoLoginService } from '@core/auth/sso-login.service';
import { PermissionsService } from '@core/auth/permissions.service';
import type { SupportedLanguage } from '@core/i18n/i18n.types';
import { TranslateService } from '@core/i18n/i18n.service';
import { AppStore } from '@core/state/app.store';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

@Component({
  selector: 'app-header',
  styleUrl: './header.component.scss',
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    NzButtonModule,
    NzDropdownModule,
    NzSelectModule,
    NzTagModule,
    NzAvatarModule,
    TranslatePipe,
  ],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private readonly translate = inject(TranslateService);
  readonly appStore = inject(AppStore);
  readonly authStore = inject(AuthStore);
  readonly permissions = inject(PermissionsService);
  private readonly authApi = inject(AuthApiService);
  private readonly sso = inject(SsoLoginService);
  private readonly message = inject(NzMessageService);
  readonly router = inject(Router);

  onTenantChange(tenantId: string): void {
    if (tenantId === this.authStore.activeTenantId()) {
      return;
    }

    this.authApi.switchTenant({ tenant_id: tenantId }).subscribe({
      next: () => {
        this.authStore.switchTenant(tenantId);
        this.message.success(this.translate.instant('header.msgTenantAttivoAggiornatoConSuccesso'));
      },
      error: (err: unknown) => {
        const body = (err as { error?: { message?: string; detail?: string } })?.error;
        this.message.error(body?.detail || body?.message || this.translate.instant('header.msgImpossibileCambiareTenant'));
      },
    });
  }

  onLocaleChange(locale: SupportedLanguage): void {
    this.authStore.setLocale(locale);
  }

  logout(): void {
    this.authApi.logout().subscribe({
      next: (res) => {
        this.authStore.logout();
        // A single sign-on session also ends at the identity provider, which then returns to the app.
        if (!this.sso.followIdpLogout(res?.data?.idp_logout_url)) {
          void this.router.navigate(['/login']);
        }
      },
      error: () => {
        this.authStore.logout();
        void this.router.navigate(['/login']);
      },
    });
  }
}
