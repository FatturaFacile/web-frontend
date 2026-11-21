import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@shared';

/** Privacy console: RoPA, consent ledger, DSAR wizard and the CH versus IT retention matrix. */
@Component({
  selector: 'app-privacy-console-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  styleUrl: './security-center.scss',
  template: `
    <nav class="sub-tabs" [attr.aria-label]="'SECURITY_CENTER.TAB.PRIVACY' | translate">
      <a routerLink="ropa" routerLinkActive="active">{{
        'SECURITY_CENTER.PRIVACY.ROPA' | translate
      }}</a>
      <a routerLink="consents" routerLinkActive="active">{{
        'SECURITY_CENTER.PRIVACY.CONSENTS' | translate
      }}</a>
      <a routerLink="dsar" routerLinkActive="active">{{
        'SECURITY_CENTER.PRIVACY.DSAR' | translate
      }}</a>
      <a routerLink="retention" routerLinkActive="active">{{
        'SECURITY_CENTER.PRIVACY.RETENTION' | translate
      }}</a>
    </nav>
    <router-outlet></router-outlet>
  `,
})
export class PrivacyConsoleShellComponent {}
