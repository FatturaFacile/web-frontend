import { Component } from '@angular/core';
import { environment } from '@env';
import { TranslatePipe } from '@shared';

/** Footer of the public pages: version, copyright and the legal documents (their URLs come from the build env). */
@Component({
  selector: 'app-auth-footer',
  imports: [TranslatePipe],
  styleUrl: './auth-footer.component.scss',
  template: `
    <footer class="auth-footer">
      <nav class="auth-footer-links" [attr.aria-label]="'AUTH.FOOTER_LEGAL' | translate">
        @if (privacyUrl) {
          <a [href]="privacyUrl" target="_blank" rel="noopener">{{ 'AUTH.PRIVACY_POLICY' | translate }}</a>
        } @else {
          <span>{{ 'AUTH.PRIVACY_POLICY' | translate }}</span>
        }
        <span aria-hidden="true">·</span>
        @if (termsUrl) {
          <a [href]="termsUrl" target="_blank" rel="noopener">{{ 'AUTH.TERMS_OF_SERVICE' | translate }}</a>
        } @else {
          <span>{{ 'AUTH.TERMS_OF_SERVICE' | translate }}</span>
        }
      </nav>
      <p class="auth-footer-meta">
        {{ 'AUTH.COPYRIGHT' | translate: { year: year } }} · {{ 'AUTH.VERSION' | translate }} {{ version }}
      </p>
    </footer>
  `,
})
export class AuthFooterComponent {
  protected readonly year = new Date().getFullYear();
  protected readonly version = environment.appVersion;
  protected readonly privacyUrl = environment.privacyUrl || '/privacy';
  protected readonly termsUrl = environment.termsUrl || '/terms';
}
