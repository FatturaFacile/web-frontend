import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { AuthApiService } from '@core/api/auth-api.service';
import { AuthStore } from '@core/auth/auth.store';
import { AppStore } from '@core/state/app.store';
import { HeaderComponent, SidebarComponent, BreadcrumbComponent } from './layout';
// Only used inside a @defer block of the template: the compiler moves it into a lazy chunk.
import { TwoFactorSetupModalComponent } from './features/auth/components/two-factor-setup-modal/two-factor-setup-modal.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NzLayoutModule,
    HeaderComponent,
    SidebarComponent,
    BreadcrumbComponent,
    TwoFactorSetupModalComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly appStore = inject(AppStore);
  readonly authStore = inject(AuthStore);
  private readonly authApi = inject(AuthApiService, { optional: true });

  ngOnInit(): void {
    this.authStore.applySavedTheme();
    this.syncProfileInBackground();
  }

  private syncProfileInBackground(): void {
    if (this.authStore.isAuthenticated() && this.authApi) {
      this.authApi.me().subscribe({
        next: (res) => {
          if (res?.data) {
            this.authStore.updateProfile(res.data);
          }
        },
        error: () => {
          // Handled by tenantAuthInterceptor if session cookie expired (401)
        },
      });
    }
  }

  onGlobal2FASetupCompleted(): void {
    this.authStore.setTwoFactorSetupRequired(false);
  }
}
