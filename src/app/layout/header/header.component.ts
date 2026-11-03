import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { FormsModule } from '@angular/forms';
import { AppStore, AuthStore, SupportedLanguage } from '@core';
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
  readonly router = inject(Router);

  onTenantChange(tenantId: string): void {
    this.authStore.switchTenant(tenantId);
  }

  onLocaleChange(locale: SupportedLanguage): void {
    this.authStore.setLocale(locale);
  }

  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
