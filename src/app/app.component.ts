import { Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { AppStore, AuthStore } from '@core';
import { HeaderComponent, SidebarComponent, BreadcrumbComponent } from './layout';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NzLayoutModule,
    HeaderComponent,
    SidebarComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly appStore = inject(AppStore);
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  /** Public pages (careers portal) always render without the app chrome. */
  readonly isPublicPage = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => isPublicUrl(e.urlAfterRedirects)),
    ),
    { initialValue: isPublicUrl(this.router.url) },
  );

  ngOnInit(): void {
    this.authStore.applySavedTheme();
  }
}

function isPublicUrl(url: string): boolean {
  return url === '/careers' || url.startsWith('/careers/') || url.startsWith('/careers?');
}
