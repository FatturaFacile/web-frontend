import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzMessageService } from 'ng-zorro-antd/message';
import { FormsModule } from '@angular/forms';
import {
  AppStore,
  AuthApiService,
  AuthStore,
  PermissionsService,
  SupportedLanguage,
} from '@core';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-header',
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
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly appStore = inject(AppStore);
  readonly authStore = inject(AuthStore);
  readonly permissions = inject(PermissionsService);
  private readonly authApi = inject(AuthApiService);
  private readonly message = inject(NzMessageService);
  readonly router = inject(Router);

  onTenantChange(tenantId: string): void {
    if (tenantId === this.authStore.activeTenantId()) {
      return;
    }

    this.authApi.switchTenant({ tenant_id: tenantId }).subscribe({
      next: () => {
        this.authStore.switchTenant(tenantId);
        this.message.success('Tenant attivo aggiornato con successo.');
      },
      error: (err: unknown) => {
        const body = (err as { error?: { message?: string; detail?: string } })?.error;
        this.message.error(body?.detail || body?.message || 'Impossibile cambiare tenant.');
      },
    });
  }

  onLocaleChange(locale: SupportedLanguage): void {
    this.authStore.setLocale(locale);
  }

  logout(): void {
    this.authApi.logout().subscribe({
      next: () => {
        this.authStore.logout();
        void this.router.navigate(['/login']);
      },
      error: () => {
        this.authStore.logout();
        void this.router.navigate(['/login']);
      },
    });
  }
}
