import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

interface BreadcrumbItem {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink, NzBreadCrumbModule, TranslatePipe],
  templateUrl: './breadcrumb.component.html',
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly breadcrumbs = signal<BreadcrumbItem[]>([]);

  constructor() {
    this.updateBreadcrumbs();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.updateBreadcrumbs();
      });
  }

  private updateBreadcrumbs(): void {
    const items: BreadcrumbItem[] = [];
    let currentRoute = this.activatedRoute.root;
    let url = '';

    while (currentRoute.firstChild) {
      currentRoute = currentRoute.firstChild;
      const pathSegment = currentRoute.routeConfig?.path;
      if (pathSegment) {
        url += `/${pathSegment}`;
      }

      const breadcrumb = currentRoute.snapshot.data['breadcrumb'];
      if (breadcrumb && !items.some((i) => i.label === breadcrumb)) {
        items.push({ label: breadcrumb, url: url || '/' });
      }
    }

    this.breadcrumbs.set(items);
  }
}
