import { Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { filter, map } from 'rxjs';
import { AppStore, AuthStore } from '@core';
import { HeaderComponent, SidebarComponent, BreadcrumbComponent } from './layout';

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

  /** Public pages (RMA estimate/tracking) render without the shell, even for signed-in staff. */
  readonly publicPage = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => isPublicPage(this.router.routerState.snapshot.root)),
    ),
    { initialValue: isPublicPage(this.router.routerState.snapshot.root) },
  );

  ngOnInit(): void {
    this.authStore.applySavedTheme();
  }
}
