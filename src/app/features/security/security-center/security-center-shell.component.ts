import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/** Frame of the Security, Privacy & Compliance Center: the title and the five sections. */
@Component({
  selector: 'app-security-center-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, PageHeaderComponent, TranslatePipe],
  styleUrl: './security-center.scss',
  template: `
    <app-page-header
      [title]="'SECURITY_CENTER.TITLE' | translate"
      [subtitle]="'SECURITY_CENTER.SUBTITLE' | translate"
    ></app-page-header>
    <nav class="tabs" [attr.aria-label]="'SECURITY_CENTER.TITLE' | translate">
      <a routerLink="posture" routerLinkActive="active">{{
        'SECURITY_CENTER.TAB.POSTURE' | translate
      }}</a>
      <a routerLink="audit" routerLinkActive="active">{{
        'SECURITY_CENTER.TAB.AUDIT' | translate
      }}</a>
      <a routerLink="privacy" routerLinkActive="active">{{
        'SECURITY_CENTER.TAB.PRIVACY' | translate
      }}</a>
      <a routerLink="breaches" routerLinkActive="active">{{
        'SECURITY_CENTER.TAB.BREACHES' | translate
      }}</a>
    </nav>
    <router-outlet></router-outlet>
  `,
})
export class SecurityCenterShellComponent {}
