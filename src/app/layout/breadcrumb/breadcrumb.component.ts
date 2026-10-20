import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';

interface BreadcrumbItem {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink, NzBreadCrumbModule],
  template: `
    @if (breadcrumbs().length > 0) {
      <nz-breadcrumb class="app-breadcrumb">
        <nz-breadcrumb-item>
          <a routerLink="/dashboard"><i class="fa-solid fa-house"></i> Home</a>
        </nz-breadcrumb-item>
        @for (item of breadcrumbs(); track item.url) {
          <nz-breadcrumb-item>
            <a [routerLink]="item.url">{{ item.label }}</a>
          </nz-breadcrumb-item>
        }
      </nz-breadcrumb>
    }
  `,
  styles: `
    .app-breadcrumb {
      margin-bottom: 16px;
      font-size: 13px;
    }
  `,
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly breadcrumbs = signal<BreadcrumbItem[]>([]);

  constructor() {
    this.updateBreadcrumbs();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
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
