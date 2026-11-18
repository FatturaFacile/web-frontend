import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { PortalAreaApiService } from '@core/api/portal-area-api.service';
import { TranslatePipe } from '@shared';
import { PortalSessionService } from './portal-session.service';

/**
 * Lightweight, mobile-first frame of the customer portal. It has nothing of the back-office shell: the tenant's logo and
 * colours (`--portal-primary`, `--portal-secondary`) are the only identity on the page.
 */
@Component({
  selector: 'app-portal-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NzButtonModule, TranslatePipe],
  template: `
    <header class="portal-header">
      <a class="portal-brand" routerLink="/portal/dashboard">
        @if (session.branding()?.logo_url; as logo) {
          <img class="portal-logo" [src]="logo" [alt]="session.branding()?.company_name ?? ''" />
        } @else {
          <span class="portal-name">{{
            session.branding()?.company_name ?? ('PORTAL_AREA.TITLE' | translate)
          }}</span>
        }
      </a>
      <nav class="portal-nav" [attr.aria-label]="'PORTAL_AREA.TITLE' | translate">
        <a routerLink="/portal/dashboard" routerLinkActive="active">{{
          'PORTAL_AREA.NAV_DASHBOARD' | translate
        }}</a>
        <a routerLink="/portal/documents" routerLinkActive="active">{{
          'PORTAL_AREA.NAV_DOCUMENTS' | translate
        }}</a>
        <a routerLink="/portal/support" routerLinkActive="active">{{
          'PORTAL_AREA.NAV_SUPPORT' | translate
        }}</a>
      </nav>
      <button nz-button nzType="default" nzSize="small" type="button" (click)="logout()">
        {{ 'PORTAL_AREA.LOGOUT' | translate }}
      </button>
    </header>
    <main class="portal-main"><router-outlet /></main>
    <footer class="portal-footer">
      @if (session.branding()?.support_email; as email) {
        <a [href]="'mailto:' + email">{{ email }}</a>
      }
      @if (session.branding()?.privacy_policy_url; as policy) {
        <a [href]="policy" target="_blank" rel="noopener noreferrer">{{
          'PORTAL_AREA.PRIVACY_POLICY' | translate
        }}</a>
      }
    </footer>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: #f5f6f8;
      --portal-primary: #1677ff;
      --portal-secondary: #001529;
    }
    .portal-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--portal-secondary);
      color: #fff;
    }
    .portal-brand {
      color: #fff;
      font-weight: 600;
      text-decoration: none;
      margin-right: auto;
    }
    .portal-logo {
      max-height: 36px;
      max-width: 160px;
      display: block;
    }
    .portal-nav {
      display: flex;
      gap: 16px;
      order: 3;
      width: 100%;
      overflow-x: auto;
    }
    .portal-nav a {
      color: #fff;
      opacity: 0.8;
      padding: 4px 0;
      text-decoration: none;
      border-bottom: 2px solid transparent;
      white-space: nowrap;
    }
    .portal-nav a.active {
      opacity: 1;
      border-bottom-color: var(--portal-primary);
    }
    .portal-main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 16px;
    }
    .portal-footer {
      display: flex;
      gap: 16px;
      justify-content: center;
      padding: 16px;
      font-size: 13px;
    }
    @media (min-width: 768px) {
      .portal-nav {
        order: 0;
        width: auto;
      }
      .portal-header {
        padding: 12px 32px;
      }
    }
  `,
})
export class PortalShellComponent implements OnInit {
  protected readonly session = inject(PortalSessionService);
  private readonly api = inject(PortalAreaApiService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (this.session.branding() === null) {
      this.api.getBranding(this.session.slug()).subscribe({
        next: (response) => this.session.applyBranding(response.data),
        error: () => undefined,
      });
    }
  }

  protected logout(): void {
    const leave = () => {
      this.session.clear();
      void this.router.navigate(['/portal/login'], {
        queryParams: this.session.slug() ? { portal: this.session.slug() } : {},
      });
    };
    this.api.logout().subscribe({ next: leave, error: leave });
  }
}
