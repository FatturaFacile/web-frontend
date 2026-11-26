import { Component, effect, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { filter, map } from 'rxjs';
import { AuthApiService } from '@core/api/auth-api.service';
import { AuthStore } from '@core/auth/auth.store';
import { I18nService } from '@core/i18n/i18n.service';
import { regionOfCountry } from '@core/i18n/i18n.types';
import { AppStore } from '@core/state/app.store';
import { DisplayPreferencesService } from '@core/theme/display-preferences.service';
import { ImpersonationBannerComponent } from '@core/iam/impersonation-banner.component';
import { HeaderComponent, SidebarComponent, BreadcrumbComponent } from './layout';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { SpotlightTourOverlayComponent } from './features/academy/spotlight-tour-overlay.component';
import { ContextualHelpDrawerComponent } from './features/academy/contextual-help-drawer.component';
import { ToastHostComponent } from '@shared/ui/toast/toast-host.component';
import { GlobalSearchComponent } from '@shared/components/global-search/global-search.component';
import { CopilotDrawerComponent } from '@features/copilot/copilot-drawer.component';
import { SignatureRequestHostComponent } from './features/e-signature/signature-request-host.component';

/** True when the deepest active route is a customer-facing page (`data.publicPage`). */
function isPublicPage(root: ActivatedRouteSnapshot): boolean {
  let route: ActivatedRouteSnapshot | null = root;
  while (route) {
    if (route.data?.['publicPage'] === true) {
      return true;
    }
    route = route.firstChild;
  }
  return false;
}

@Component({
  selector: 'app-root',
  styleUrl: './app.component.scss',
  imports: [
    RouterOutlet,
    NzLayoutModule,
    HeaderComponent,
    ImpersonationBannerComponent,
    SidebarComponent,
    BreadcrumbComponent,
    GlobalSearchComponent,
    CopilotDrawerComponent,
    ToastHostComponent,
    SpotlightTourOverlayComponent,
    ContextualHelpDrawerComponent,
    SignatureRequestHostComponent,
    TranslatePipe,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  readonly appStore = inject(AppStore);
  readonly authStore = inject(AuthStore);
  private readonly authApi = inject(AuthApiService, { optional: true });
  private readonly displayPreferences = inject(DisplayPreferencesService, { optional: true });
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  /** Swiss and Italian tenants get the regional dictionary of their language (it-CH, de-CH, fr-CH, it-IT). */
  private readonly regionSync = effect(() => this.i18n.setRegion(regionOfCountry(this.authStore.activeJurisdiction())));

  /** Public pages (RMA estimate/tracking) render without the shell, even for signed-in staff. */
  readonly publicPage = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => isPublicPage(this.router.routerState.snapshot.root)),
    ),
    { initialValue: isPublicPage(this.router.routerState.snapshot.root) },
  );

  ngOnInit(): void {
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
}
